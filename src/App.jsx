import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './config/supabase'
import { useAuth } from './hooks/useAuth'
import { getTodayStr, getTomorrowStr, createStatusMapper } from './utils/helpers'
import { useUserPreferences } from './hooks/useUserPreferences'
import { DATE_TABS } from './config/constants'
import { Icon } from './components/Icon'
import { FixtureCard } from './components/FixtureCard'
import { FilterModal } from './components/FilterModal'
import { AuthModal } from './components/AuthModal'
import { AddBroadcastModal } from './components/AddBroadcastModal'
import { AdminDataModal } from './components/AdminDataModal'
import { UserSettingsModal } from './components/UserSettingsModal'
import { useReferenceData } from './hooks/useReferenceData'

function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const { getSportConfig, getSportColors, getFlag, getCountryNames, getChannelsForCountry, getStatusMap, getConfig, reload: reloadReferenceData } = useReferenceData()
  const mapStatus = useMemo(() => createStatusMapper(getStatusMap()), [getStatusMap])
  const { formatTime, getStatus: getUserStatus, getRelative, preferences, loading: prefsLoading } = useUserPreferences(user)
  const [isAdmin, setIsAdmin] = useState(false)
  const headerRef = useRef(null)
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
  const fixturesPerPage = getConfig('fixtures_per_page', 20)
  const [displayLimit, setDisplayLimit] = useState(20) // Pagination: overridden by fixturesPerPage from config

  const loadMatches = async () => {
    setLoading(true)
    try {
      const today = getTodayStr()
      const tomorrow = getTomorrowStr()

      // Fetch matches in pages to avoid Supabase 1000-row default limit
      let matchesData = []
      const PAGE_SIZE = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from("matches")
          .select("*")
          .gte("match_date", today)
          .lte("match_date", tomorrow)
          .order("match_date", { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (error) {
          console.error("Error loading matches:", error)
          setLoading(false)
          return
        }

        matchesData = matchesData.concat(data || [])
        if (!data || data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }

      if (matchesData && matchesData.length > 0) {
        const matchIds = matchesData.map(m => m.id)

        // Fetch broadcasts in batches to avoid URL length limits
        // Each batch is also paginated to avoid Supabase 1000-row default limit
        let broadcasts = []
        const MATCH_BATCH_SIZE = 50
        for (let i = 0; i < matchIds.length; i += MATCH_BATCH_SIZE) {
          const batch = matchIds.slice(i, i + MATCH_BATCH_SIZE)
          let batchFrom = 0
          while (true) {
            const { data: batchData, error: broadcastsError } = await supabase
              .from("broadcasts")
              .select("*")
              .in("match_id", batch)
              .range(batchFrom, batchFrom + PAGE_SIZE - 1)

            if (broadcastsError) {
              console.error("Error loading broadcasts:", broadcastsError)
              break
            }

            broadcasts = broadcasts.concat(batchData || [])
            if (!batchData || batchData.length < PAGE_SIZE) break
            batchFrom += PAGE_SIZE
          }
        }

        const broadcastIds = broadcasts.map(b => b.id)

        // Fetch votes in batches to avoid URL length limits
        // Each batch is also paginated to avoid Supabase 1000-row default limit
        let votes = []
        if (broadcastIds.length > 0) {
          const VOTE_BATCH_SIZE = 50
          for (let i = 0; i < broadcastIds.length; i += VOTE_BATCH_SIZE) {
            const batch = broadcastIds.slice(i, i + VOTE_BATCH_SIZE)
            let batchFrom = 0
            while (true) {
              const { data: votesData, error: votesError } = await supabase
                .from("votes")
                .select("*")
                .in("broadcast_id", batch)
                .range(batchFrom, batchFrom + PAGE_SIZE - 1)

              if (votesError) {
                console.error("Error loading votes:", votesError)
                break
              }

              votes = votes.concat(votesData || [])
              if (!votesData || votesData.length < PAGE_SIZE) break
              batchFrom += PAGE_SIZE
            }
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

          // Map raw API status from DB, with client-side "starting-soon" overlay
          let displayStatus = mapStatus(m.status)
          if (displayStatus === 'upcoming') {
            if (isStartingSoon(m.match_date, m.match_time)) {
              displayStatus = 'starting-soon'
            }
          }

          return {
            ...m,
            broadcasts: mBroadcasts,
            status: displayStatus
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
  
  // Set up real-time subscription for votes only
  // Broadcasts and match statuses update on manual refresh / page reload
  useEffect(() => {
    const votesChannel = supabase
      .channel('votes-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        async (payload) => {
          const broadcastId = payload.new?.broadcast_id || payload.old?.broadcast_id
          if (!broadcastId) return

          const { data: votes } = await supabase
            .from('votes')
            .select('*')
            .eq('broadcast_id', broadcastId)

          const voteStats = { up: 0, down: 0, myVote: null }
          votes?.forEach(v => {
            if (v.vote_type === 'up') voteStats.up++
            else if (v.vote_type === 'down') voteStats.down++
            if (user && (v.user_id_uuid === user.id || v.user_id === user.id)) {
              voteStats.myVote = v.vote_type
            }
          })

          setMatches(prev => prev.map(m => ({
            ...m,
            broadcasts: m.broadcasts.map(b => {
              if (b.id !== broadcastId) return b
              return { ...b, voteStats }
            })
          })))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(votesChannel)
    }
  }, [user])
  
  const handleAddBroadcast = async (matchId, country, channel) => {
    if (!user) {
      console.error('User must be authenticated to add broadcast')
      return
    }

    // Check if this country+channel combo is blocked for this fixture
    const { data: blocked } = await supabase
      .from('blocked_broadcasts')
      .select('id')
      .eq('match_id', matchId)
      .ilike('country', country)
      .ilike('channel', channel)
      .limit(1)

    if (blocked && blocked.length > 0) {
      alert('This broadcast has been blocked due to community downvotes and cannot be re-added.')
      return
    }

    const { data, error } = await supabase.from("broadcasts").insert([{
      match_id: matchId,
      country,
      channel,
      created_by_uuid: user.id,
      created_by: user.email || 'Anonymous'
    }]).select()

    if (error) {
      if (error.code === '23505') {
        alert('This broadcast already exists for this fixture.')
      } else {
        console.error('Error adding broadcast:', error)
      }
      return
    }

    if (data && data.length > 0) {
      const newBroadcast = data[0]

      // Auto-upvote by creator
      const { error: voteError } = await supabase.from("votes").insert([{
        broadcast_id: newBroadcast.id,
        user_id_uuid: user.id,
        user_id: user.id,
        vote_type: 'up'
      }])

      if (voteError) {
        console.error('Error creating auto-vote:', voteError)
      }

      // Update state directly (no real-time subscription for broadcasts)
      setMatches(prev => prev.map(m => {
        if (m.id !== matchId) return m
        const exists = m.broadcasts.some(b => b.id === newBroadcast.id)
        if (exists) return m
        return {
          ...m,
          broadcasts: [...m.broadcasts, {
            ...newBroadcast,
            voteStats: { up: 1, down: 0, myVote: 'up' }
          }]
        }
      }))
    }
  }
  
  const handleVote = async (broadcastId, voteType) => {
    if (!user) return

    try {
      // Fetch existing vote from database using user_id_uuid
      const { data: existing, error: fetchError } = await supabase
        .from("votes")
        .select("*")
        .eq("broadcast_id", broadcastId)
        .eq("user_id_uuid", user.id)

      if (fetchError) return

      // Helper to optimistically update vote stats in state
      const updateVoteStats = (newMyVote, upDelta, downDelta) => {
        setMatches(prev => prev.map(m => ({
          ...m,
          broadcasts: m.broadcasts.map(b => {
            if (b.id !== broadcastId) return b
            return {
              ...b,
              voteStats: {
                up: (b.voteStats?.up || 0) + upDelta,
                down: (b.voteStats?.down || 0) + downDelta,
                myVote: newMyVote
              }
            }
          })
        })))
      }

      if (existing && existing.length > 0) {
        const oldVote = existing[0].vote_type
        if (oldVote === voteType) {
          // Toggle off: remove vote
          const { error } = await supabase
            .from("votes")
            .delete()
            .eq("broadcast_id", broadcastId)
            .eq("user_id_uuid", user.id)

          if (!error) {
            updateVoteStats(null, oldVote === 'up' ? -1 : 0, oldVote === 'down' ? -1 : 0)
          }
        } else {
          // Change vote: delete old and insert new
          const { error: deleteError } = await supabase
            .from("votes")
            .delete()
            .eq("broadcast_id", broadcastId)
            .eq("user_id_uuid", user.id)

          if (deleteError) return

          const { error: insertError } = await supabase
            .from("votes")
            .insert([{
              broadcast_id: broadcastId,
              user_id_uuid: user.id,
              user_id: user.id,
              vote_type: voteType
            }])

          if (!insertError) {
            updateVoteStats(
              voteType,
              (voteType === 'up' ? 1 : 0) - (oldVote === 'up' ? 1 : 0),
              (voteType === 'down' ? 1 : 0) - (oldVote === 'down' ? 1 : 0)
            )
          }
        }
      } else {
        // New vote: insert
        const { error } = await supabase
          .from("votes")
          .insert([{
            broadcast_id: broadcastId,
            user_id_uuid: user.id,
            user_id: user.id,
            vote_type: voteType
          }])

        if (!error) {
          updateVoteStats(voteType, voteType === 'up' ? 1 : 0, voteType === 'down' ? 1 : 0)
        }
      }

    } catch (error) {
      // Silently fail - user can retry
    }
  }

  const handleDeleteBroadcast = async (broadcastId) => {
    if (!user) return

    try {
      // Delete the broadcast (votes will be cascade deleted if FK constraint exists)
      // Admins can delete any broadcast, regular users can only delete their own
      let query = supabase
        .from("broadcasts")
        .delete()
        .eq("id", broadcastId)

      // Non-admins can only delete their own broadcasts
      if (!isAdmin) {
        query = query.eq("created_by_uuid", user.id)
      }

      const { data, error } = await query.select()

      if (error) {
        alert(`Failed to delete broadcast: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        alert('Could not delete this broadcast. You may not have permission.')
        return
      }

      // Optimistically remove from state (realtime subscription is a backup)
      setMatches(prev => prev.map(m => ({
        ...m,
        broadcasts: m.broadcasts.filter(b => b.id !== broadcastId)
      })))

    } catch (error) {
      alert(`Unexpected error: ${error.message}`)
    }
  }

  const handleRefreshBroadcasts = async (matchId) => {
    // Fetch broadcasts for this match
    const { data: broadcasts } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('match_id', matchId)

    // Fetch votes for these broadcasts
    const broadcastIds = (broadcasts || []).map(b => b.id)
    let votes = []
    if (broadcastIds.length > 0) {
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .in('broadcast_id', broadcastIds)
      votes = votesData || []
    }

    // Build vote stats
    const votesByBroadcast = {}
    votes.forEach(v => {
      if (!votesByBroadcast[v.broadcast_id]) {
        votesByBroadcast[v.broadcast_id] = { up: 0, down: 0, myVote: null }
      }
      if (v.vote_type === 'up') votesByBroadcast[v.broadcast_id].up++
      else if (v.vote_type === 'down') votesByBroadcast[v.broadcast_id].down++
      if (user && (v.user_id_uuid === user.id || v.user_id === user.id)) {
        votesByBroadcast[v.broadcast_id].myVote = v.vote_type
      }
    })

    // Update only broadcasts for this match
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m
      return {
        ...m,
        broadcasts: (broadcasts || []).map(b => ({
          ...b,
          voteStats: votesByBroadcast[b.id] || { up: 0, down: 0, myVote: null }
        }))
      }
    }))
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
    setDisplayLimit(fixturesPerPage)
  }, [filters, search, dateTab, fixturesPerPage])

  // Periodically re-evaluate "starting-soon" for upcoming matches
  // The livescore API only reports "NS" before a match, so starting-soon is client-side
  const statusRefreshMs = getConfig('status_refresh_seconds', 60) * 1000
  useEffect(() => {
    const timer = setInterval(() => {
      setMatches(prev => {
        let changed = false
        const updated = prev.map(m => {
          if (m.status !== 'upcoming' && m.status !== 'starting-soon') return m
          const startingSoon = isStartingSoon(m.match_date, m.match_time)
          const newStatus = startingSoon ? 'starting-soon' : 'upcoming'
          if (newStatus !== m.status) {
            changed = true
            return { ...m, status: newStatus }
          }
          return m
        })
        return changed ? updated : prev
      })
    }, statusRefreshMs)

    return () => clearInterval(timer)
  }, [statusRefreshMs])

  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const hasActiveFilters = filters.sports?.length > 0 || filters.countries?.length > 0 || filters.events?.length > 0 || filters.statuses?.length > 0

  // Check if a match is within N minutes of starting (for "starting-soon" overlay)
  // This is client-side only since the livescore API only reports "NS" before kickoff
  const startingSoonMinutes = getConfig('starting_soon_minutes', 15)
  const isStartingSoon = (matchDate, matchTime) => {
    try {
      let timeStr = matchTime.trim()
      if (timeStr.split(':').length === 2) timeStr = `${timeStr}:00`
      const matchDateTime = new Date(`${matchDate}T${timeStr}Z`)
      if (isNaN(matchDateTime.getTime())) return false
      const diffMinutes = (matchDateTime - new Date()) / (1000 * 60)
      return diffMinutes > 0 && diffMinutes <= startingSoonMinutes
    } catch {
      return false
    }
  }

  const filtered = useMemo(() => {
    let result = matches.filter(m => {
      if (dateTab === "Today" && m.match_date !== todayStr) return false
      if (dateTab === "Tomorrow" && m.match_date !== tomorrowStr) return false

      // Hide finished fixtures from previous days
      if (m.match_date < todayStr) return false

      if (hasActiveFilters) {
        if (filters.sports?.length > 0 && !filters.sports.includes(m.sport)) return false
        if (filters.countries?.length > 0 && !filters.countries.includes(m.country)) return false
        if (filters.events?.length > 0 && !filters.events.includes(m.league)) return false
        if (filters.statuses?.length > 0) {
          if (!filters.statuses.includes(m.status)) return false
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

    // Always sort by: LIVE → STARTING-SOON → UPCOMING → FINISHED → CANCELLED
    // Within each status, sort by time (most recent live matches first, earliest upcoming matches first)
    const statusOrder = { live: 0, "starting-soon": 1, upcoming: 2, finished: 3, cancelled: 4 }
    result.sort((a, b) => {
      const aStatus = a.status || 'upcoming'
      const bStatus = b.status || 'upcoming'

      // First, sort by status
      const statusDiff = (statusOrder[aStatus] ?? 5) - (statusOrder[bStatus] ?? 5)
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

  // Calculate live count from DB status
  const liveCount = useMemo(() =>
    filtered.filter(m => m.status === "live").length,
    [filtered]
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
    setDisplayLimit(prev => prev + fixturesPerPage)
  }

  const [blockedBroadcasts, setBlockedBroadcasts] = useState([])

  const openAddBroadcast = async (match) => {
    setSelectedMatch(match)
    // Fetch blocked broadcasts for this match
    const { data } = await supabase
      .from('blocked_broadcasts')
      .select('country, channel')
      .eq('match_id', match.id)
    setBlockedBroadcasts(data || [])
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
      <div ref={headerRef} style={{ background: "#12122a", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "12px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }} onClick={() => window.location.reload()} title="Refresh">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00e5ff,#7c4dff)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="7" width="26" height="17" rx="2.5" stroke="#fff" strokeWidth="2" fill="none" />
                <line x1="11" y1="27" x2="21" y2="27" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="24" x2="16" y2="27" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M13 18l3-5 3 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M10 20l6-10 6 10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: "#fff" }}>SportsOnTV</div>
              <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>{liveCount} live · {filtered.length} matches</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
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
                title="Admin Panel"
              >
                <Icon name="shield" size={14} />
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
        {(loading || prefsLoading) ? (
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
              Fetching our data...
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
                  onDeleteBroadcast={handleDeleteBroadcast}
                  onRefreshBroadcasts={handleRefreshBroadcasts}
                  isAdmin={isAdmin}
                  getSportColors={getSportColors}
                  getFlag={getFlag}
                  formatTime={formatTime}
                  getStatus={getUserStatus}
                  getRelative={getRelative}
                  preferences={preferences}
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
          SportsOnTV · Community-Powered Broadcasts
        </p>
      </div>
      
      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} signInWithGoogle={signInWithGoogle} />}
      {showFilters && <FilterModal onClose={() => setShowFilters(false)} filters={filters} onApply={setFilters} allSports={allSports} matches={matches} getSportColors={getSportColors} getFlag={getFlag} headerRef={headerRef} />}
      {showAddBroadcast && selectedMatch && <AddBroadcastModal onClose={() => setShowAddBroadcast(false)} match={selectedMatch} onAdd={handleAddBroadcast} user={user} countryNames={getCountryNames()} getChannelsForCountry={getChannelsForCountry} getFlag={getFlag} blockedBroadcasts={blockedBroadcasts} />}
      {showAdminPanel && <AdminDataModal onClose={() => setShowAdminPanel(false)} onUpdate={() => { reloadReferenceData(); loadMatches() }} currentUserEmail={user?.email} headerRef={headerRef} />}
      {showUserSettings && <UserSettingsModal onClose={() => setShowUserSettings(false)} onSave={handleSettingsSaved} user={user} headerRef={headerRef} />}
    </div>
  )
}

export default App
