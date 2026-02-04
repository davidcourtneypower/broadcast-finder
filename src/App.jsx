import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './config/supabase'
import { useAuth } from './hooks/useAuth'
import { getTodayStr, getTomorrowStr } from './utils/helpers'
import { DATE_TABS } from './config/constants'
import { Icon } from './components/Icon'
import { FixtureCard } from './components/FixtureCard'
import { FilterModal } from './components/FilterModal'
import { AuthModal } from './components/AuthModal'
import { AddBroadcastModal } from './components/AddBroadcastModal'
import { AdminDataModal } from './components/AdminDataModal'
import { UserSettingsModal } from './components/UserSettingsModal'
import { getSportConfig } from './config/sports'

function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAddBroadcast, setShowAddBroadcast] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showUserSettings, setShowUserSettings] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [filters, setFilters] = useState({ sports: [], countries: [], events: [], statuses: [] })
  const [dateTab, setDateTab] = useState("Today")
  const [search, setSearch] = useState("")
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(20) // Pagination: show 20 fixtures initially

  const loadMatches = async () => {
    setLoading(true)
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: true })

      if (matchesError) {
        console.error("Error loading matches:", matchesError)
        setLoading(false)
        return
      }

      if (matchesData && matchesData.length > 0) {
        const matchIds = matchesData.map(m => m.id)

        const { data: broadcasts, error: broadcastsError } = await supabase
          .from("broadcasts")
          .select("*")
          .in("match_id", matchIds)

        if (broadcastsError) {
          console.error("Error loading broadcasts:", broadcastsError)
        }

        const broadcastIds = (broadcasts || []).map(b => b.id)

        // Only fetch votes if there are broadcasts
        let votes = []
        if (broadcastIds.length > 0) {
          const { data: votesData, error: votesError } = await supabase
            .from("votes")
            .select("*")
            .in("broadcast_id", broadcastIds)

          if (votesError) {
            console.error("Error loading votes:", votesError)
          } else {
            votes = votesData || []
          }
        }

        // Build vote statistics for each broadcast
        const votesByBroadcast = {}
        votes.forEach(v => {
          if (!votesByBroadcast[v.broadcast_id]) {
            votesByBroadcast[v.broadcast_id] = { up: 0, down: 0, myVote: null }
          }

          // Count votes by type
          if (v.vote_type === "up") {
            votesByBroadcast[v.broadcast_id].up++
          } else if (v.vote_type === "down") {
            votesByBroadcast[v.broadcast_id].down++
          }

          // Track current user's vote using user_id_uuid (new) or user_id (legacy)
          if (user && (v.user_id_uuid === user.id || v.user_id === user.id)) {
            votesByBroadcast[v.broadcast_id].myVote = v.vote_type
          }
        })

        // Enrich matches with broadcasts and vote stats
        const enriched = matchesData.map(m => {
          const mBroadcasts = (broadcasts || [])
            .filter(b => b.match_id === m.id)
            .map(b => ({
              ...b,
              voteStats: votesByBroadcast[b.id] || { up: 0, down: 0, myVote: null }
            }))

          // Calculate status dynamically based on match time
          const calculatedStatus = getMatchStatus(
            m.match_date,
            m.match_time,
            m.sport
          )

          return {
            ...m,
            broadcasts: mBroadcasts,
            status: calculatedStatus
          }
        })

        setMatches(enriched)
      } else {
        // No matches found
        setMatches([])
      }
    } catch (e) {
      console.error("Unexpected error loading matches:", e)
    }
    setLoading(false)
  }
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadMatches()
    setRefreshing(false)
  }
  
  const handleAddBroadcast = async (matchId, country, channel) => {
    if (!user) {
      console.error('User must be authenticated to add broadcast')
      return
    }

    const { data, error } = await supabase.from("broadcasts").insert([{
      match_id: matchId,
      country,
      channel,
      created_by_uuid: user.id,
      created_by: user.email || 'Anonymous' // Keep legacy field for compatibility
    }]).select()

    if (!error && data && data.length > 0) {
      const newBroadcast = {
        ...data[0],
        voteStats: { up: 0, down: 0, myVote: null }
      }

      setMatches(prev => prev.map(m =>
        m.id === matchId
          ? { ...m, broadcasts: [...m.broadcasts, newBroadcast] }
          : m
      ))
    }
  }
  
  const handleVote = async (broadcastId, voteType) => {
    if (!user) return

    // Helper function to update vote counts in state
    const updateVoteCounts = (oldVote, newVote) => {
      setMatches(prev => prev.map(m => ({
        ...m,
        broadcasts: m.broadcasts.map(b => {
          if (b.id !== broadcastId) return b

          let { up, down } = b.voteStats

          // Remove old vote count
          if (oldVote === 'up') up--
          if (oldVote === 'down') down--

          // Add new vote count
          if (newVote === 'up') up++
          if (newVote === 'down') down++

          return {
            ...b,
            voteStats: { up, down, myVote: newVote }
          }
        })
      })))
    }

    try {
      // Get current vote state before making changes
      const currentBroadcast = matches
        .flatMap(m => m.broadcasts)
        .find(b => b.id === broadcastId)

      if (!currentBroadcast) {
        console.error('Broadcast not found:', broadcastId)
        return
      }

      const oldVote = currentBroadcast.voteStats.myVote

      // Fetch existing vote from database using user_id_uuid
      const { data: existing, error: fetchError } = await supabase
        .from("votes")
        .select("*")
        .eq("broadcast_id", broadcastId)
        .eq("user_id_uuid", user.id)

      if (fetchError) {
        console.error('Error fetching vote:', fetchError)
        return
      }

      let newVoteType = null
      let dbError = null

      if (existing && existing.length > 0) {
        if (existing[0].vote_type === voteType) {
          // Toggle off: remove vote
          const { error } = await supabase
            .from("votes")
            .delete()
            .eq("broadcast_id", broadcastId)
            .eq("user_id_uuid", user.id)

          dbError = error
          newVoteType = null
        } else {
          // Change vote: update existing vote
          const { error } = await supabase
            .from("votes")
            .update({ vote_type: voteType })
            .eq("broadcast_id", broadcastId)
            .eq("user_id_uuid", user.id)

          dbError = error
          newVoteType = voteType
        }
      } else {
        // New vote: insert
        const { error } = await supabase
          .from("votes")
          .insert([{
            broadcast_id: broadcastId,
            user_id_uuid: user.id,
            user_id: user.id, // Keep legacy field for compatibility
            vote_type: voteType
          }])

        dbError = error
        newVoteType = voteType
      }

      if (dbError) {
        console.error('Error updating vote:', dbError)
        // Could show a toast notification here
        return
      }

      // Update local state after successful database operation
      updateVoteCounts(oldVote, newVoteType)

    } catch (error) {
      console.error('Unexpected error in handleVote:', error)
      // Could show a toast notification here
    }
  }

  useEffect(() => {
    // Check if user is admin (you can customize this logic)
    // For now, checking if email matches a specific domain or value
    if (user?.email) {
      // Example: make specific email addresses admins
      setIsAdmin(user.email === 'davidcourtneypower@gmail.com' || user.user_metadata?.is_admin === true)
    } else {
      setIsAdmin(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading) {
      loadMatches()
    }
  }, [user, authLoading])

  // Reset pagination when filters, search, or date changes
  useEffect(() => {
    setDisplayLimit(20)
  }, [filters, search, dateTab])

  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const hasActiveFilters = filters.sports?.length > 0 || filters.countries?.length > 0 || filters.events?.length > 0 || filters.statuses?.length > 0

  // Sport-specific status calculation
  const getMatchStatus = (matchDate, matchTime, sport) => {
    try {
      // Handle time format - could be HH:MM or HH:MM:SS
      let timeStr = matchTime.trim()
      if (timeStr.split(':').length === 2) {
        timeStr = `${timeStr}:00`
      }

      const matchDateTime = new Date(`${matchDate}T${timeStr}Z`)

      // Check if date is valid
      if (isNaN(matchDateTime.getTime())) {
        return "upcoming"
      }

      const now = new Date()
      const diffMinutes = (now - matchDateTime) / (1000 * 60)

      // Get sport-specific configuration
      const config = getSportConfig(sport)
      const matchDuration = config?.matchDuration || 180
      const pregameWindow = 15

      if (diffMinutes < -pregameWindow) return "upcoming"
      if (diffMinutes >= -pregameWindow && diffMinutes < 0) return "starting-soon"
      if (diffMinutes >= 0 && diffMinutes <= matchDuration) return "live"
      return "finished"
    } catch (error) {
      return "upcoming"
    }
  }

  const filtered = useMemo(() => {
    let result = matches.filter(m => {
      if (dateTab === "Today" && m.match_date !== todayStr) return false
      if (dateTab === "Tomorrow" && m.match_date !== tomorrowStr) return false
      if (hasActiveFilters) {
        if (filters.sports?.length > 0 && !filters.sports.includes(m.sport)) return false
        if (filters.countries?.length > 0 && !filters.countries.includes(m.country)) return false
        if (filters.events?.length > 0 && !filters.events.includes(m.league)) return false
        if (filters.statuses?.length > 0) {
          const matchStatus = getMatchStatus(m.match_date, m.match_time, m.sport)
          if (!filters.statuses.includes(matchStatus)) return false
        }
      }
      if (search) {
        const q = search.toLowerCase()
        const hit = [m.home, m.away, m.league, m.sport].some(field =>
          field?.toLowerCase().includes(q)
        )
        if (!hit) return false
      }
      return true
    })

    // Always sort by: LIVE → STARTING-SOON → UPCOMING → FINISHED
    // Within each status, sort by time (most recent live matches first, earliest upcoming matches first)
    const statusOrder = { live: 0, "starting-soon": 1, upcoming: 2, finished: 3 }
    result.sort((a, b) => {
      const aStatus = getMatchStatus(a.match_date, a.match_time, a.sport)
      const bStatus = getMatchStatus(b.match_date, b.match_time, b.sport)

      // First, sort by status
      const statusDiff = statusOrder[aStatus] - statusOrder[bStatus]
      if (statusDiff !== 0) return statusDiff

      // Within same status, sort by time
      const dateCompare = a.match_date.localeCompare(b.match_date)
      if (dateCompare !== 0) return dateCompare

      // For live and finished matches, show most recent first (descending - recently started/finished)
      // For starting-soon and upcoming, show earliest first (ascending - soonest first)
      if (aStatus === 'live' || aStatus === 'finished') {
        return b.match_time.localeCompare(a.match_time)
      }
      return a.match_time.localeCompare(b.match_time)
    })

    return result
  }, [matches, dateTab, search, filters, hasActiveFilters, todayStr, tomorrowStr])

  const allSports = useMemo(() =>
    [...new Set(matches.map(m => m.sport))].sort(), [matches]
  )

  // Calculate live count based on time
  const liveCount = useMemo(() =>
    matches.filter(m => getMatchStatus(m.match_date, m.match_time, m.sport) === "live").length,
    [matches]
  )

  const activeFilterCount = (filters.sports?.length || 0) +
    (filters.countries?.length || 0) + (filters.events?.length || 0) + (filters.statuses?.length || 0)

  // Pagination: get displayed matches
  const displayedMatches = useMemo(() =>
    filtered.slice(0, displayLimit),
    [filtered, displayLimit]
  )

  const hasMoreMatches = filtered.length > displayLimit

  const loadMore = () => {
    setDisplayLimit(prev => prev + 20)
  }

  const openAddBroadcast = (match) => {
    setSelectedMatch(match)
    setShowAddBroadcast(true)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const handleSettingsSaved = () => {
    // Close modal and trigger a re-render to reflect new preferences
    setShowUserSettings(false)
    // Force a small delay to ensure preferences are updated in the database
    setTimeout(() => {
      // Trigger re-render by updating a dummy state or reloading user preferences
      window.location.reload()
    }, 100)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e1a", color: "#fff", maxWidth: 440, margin: "0 auto", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#12122a", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "12px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00e5ff,#7c4dff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="tv" size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: "#fff" }}>BroadcastFinder</div>
              <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>{liveCount} live · {matches.length} matches</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isAdmin && (
              <button onClick={handleRefresh} disabled={refreshing} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "4px 8px", color: refreshing ? "#555" : "#aaa", fontSize: 10, cursor: refreshing ? "not-allowed" : "pointer", fontFamily: "monospace" }}>
                <Icon name="refresh" size={11} color={refreshing ? "#555" : "#aaa"} />{refreshing ? "..." : "Sync"}
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowAdminPanel(true)} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,229,255,0.15)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 7, padding: "4px 8px", color: "#00e5ff", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
                <Icon name="settings" size={11} /> Admin
              </button>
            )}
            {user ? (
              <>
                <button
                  onClick={() => setShowUserSettings(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7,
                    padding: "6px 8px",
                    color: "#aaa",
                    cursor: "pointer"
                  }}
                  title={`Settings (${user.email})`}
                >
                  <Icon name="settings" size={14} />
                </button>
                <button
                  onClick={handleSignOut}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7,
                    padding: "6px 8px",
                    color: "#aaa",
                    cursor: "pointer"
                  }}
                  title="Sign out"
                >
                  <Icon name="logOut" size={14} />
                </button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} style={{ display: "flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg,rgba(0,229,255,0.15),rgba(124,77,255,0.15))", border: "1px solid rgba(124,77,255,0.3)", borderRadius: 7, padding: "4px 8px", color: "#aaa", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
                <Icon name="logIn" size={12} /> Sign In
              </button>
            )}
          </div>
        </div>

        {matches.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Icon name="search" size={13} color="#555" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams, leagues..." style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => setShowFilters(true)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: hasActiveFilters ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.06)", color: hasActiveFilters ? "#00e5ff" : "#aaa", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                <Icon name="filter" size={14} />
                {activeFilterCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#00e5ff", color: "#000", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>}
              </button>
            </div>

            <div style={{ display: "flex", gap: 5 }}>
              {DATE_TABS.map(t => {
                const active = dateTab === t
                return (
                  <button key={t} onClick={() => setDateTab(t)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", background: active ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.04)", color: active ? "#00e5ff" : "#666", fontSize: 12, cursor: "pointer", fontFamily: "monospace", fontWeight: active ? 600 : 400 }}>
                    {t}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      
      {/* Content */}
      <div style={{ padding: "10px 12px 24px", flex: "1 0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#555" }}>
            {/* Loading Spinner */}
            <div style={{
              width: 48,
              height: 48,
              margin: "0 auto 20px",
              border: "4px solid rgba(0,229,255,0.1)",
              borderTop: "4px solid #00e5ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#00e5ff", marginBottom: 8 }}>
              Loading Fixtures
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Fetching matches and preparing times...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
            <Icon name="database" size={32} color="#444" style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No matches found</p>
            <p style={{ margin: "8px 0 12px", fontSize: 11, color: "#333" }}>
              {isAdmin ? "Import matches to get started" : "Check back later"}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {displayedMatches.map(m => (
                <FixtureCard
                  key={m.id}
                  match={m}
                  user={user}
                  onVote={handleVote}
                  onRequestAuth={() => setShowAuth(true)}
                  onAddBroadcast={openAddBroadcast}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMoreMatches && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <button
                  onClick={loadMore}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "1px solid rgba(0,229,255,0.3)",
                    background: "rgba(0,229,255,0.1)",
                    color: "#00e5ff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "monospace"
                  }}
                >
                  + Load More ({filtered.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ad Space */}
      <div style={{ background: "#0a0a18", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 14px" }}>
        <div style={{
          minHeight: 90,
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.1)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontSize: 11,
          fontFamily: "monospace"
        }}>
          Advertisement Space
        </div>
      </div>

      {/* Footer - Sticky */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px", background: "#0a0a18", textAlign: "center", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 10, color: "#3a3a4a", fontFamily: "monospace", lineHeight: 1.4 }}>
          Powered by Supabase · Real-time Community Broadcasts
        </p>
      </div>
      
      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} signInWithGoogle={signInWithGoogle} />}
      {showFilters && <FilterModal onClose={() => setShowFilters(false)} filters={filters} onApply={setFilters} allSports={allSports} matches={matches} />}
      {showAddBroadcast && selectedMatch && <AddBroadcastModal onClose={() => setShowAddBroadcast(false)} match={selectedMatch} onAdd={handleAddBroadcast} user={user} />}
      {showAdminPanel && <AdminDataModal onClose={() => setShowAdminPanel(false)} onUpdate={loadMatches} />}
      {showUserSettings && <UserSettingsModal onClose={() => setShowUserSettings(false)} onSave={handleSettingsSaved} user={user} />}
    </div>
  )
}

export default App
