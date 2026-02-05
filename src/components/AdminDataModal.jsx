import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { supabase } from '../config/supabase'
import { ConfirmModal } from './ConfirmModal'

export const AdminDataModal = ({ onClose, onUpdate, currentUserEmail }) => {
  const [activeTab, setActiveTab] = useState('import')
  const [jsonData, setJsonData] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [importing, setImporting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [selectedDates, setSelectedDates] = useState(['today', 'tomorrow'])
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [fetchResult, setFetchResult] = useState(null)
  const [broadcasts, setBroadcasts] = useState([])
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false)
  const [selectedBroadcasts, setSelectedBroadcasts] = useState([])
  const [deletingBroadcasts, setDeletingBroadcasts] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [searchBroadcast, setSearchBroadcast] = useState("")
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [bannedUsers, setBannedUsers] = useState([])
  const [processingBan, setProcessingBan] = useState(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [banTarget, setBanTarget] = useState(null)
  const [banReason, setBanReason] = useState("")
  const [banAction, setBanAction] = useState("ban") // "ban" or "unban"
  const [searchUser, setSearchUser] = useState("")
  const [logTypeFilter, setLogTypeFilter] = useState("all")

  // Helper function to log admin actions
  const logAdminAction = async (actionType, details) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const adminEmail = session?.user?.email

      await supabase.from('admin_action_logs').insert([{
        action_type: actionType,
        admin_uuid: session?.user?.id,
        admin_email: adminEmail,
        target_user_uuid: details.targetUserUuid,
        target_user_email: details.targetUserEmail,
        broadcast_id: details.broadcastId,
        match_id: details.matchId,
        details: details.extraData || {}
      }])
    } catch (e) {
      console.error('Error logging admin action:', e)
      // Don't throw - logging failure shouldn't break the main action
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setError("")
    setSuccess("")
    try {
      const parsed = JSON.parse(jsonData)
      if (!Array.isArray(parsed)) {
        setError("Expected an array of matches")
        setImporting(false)
        return
      }
      const matches = parsed.map(m => ({
        id: m.id,
        sport: m.sport,
        league: m.league,
        home: m.home,
        away: m.away,
        match_date: m.date,
        match_time: m.time,
        country: m.country,
        status: m.status || "upcoming",
        popularity: m.popularity || 70
      }))
      const { error: dbError } = await supabase.from("matches").upsert(matches)
      if (dbError) {
        setError("Database error: " + dbError.message)
      } else {
        setSuccess(`Successfully imported ${matches.length} matches!`)
        setTimeout(() => { onUpdate(); onClose() }, 1500)
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setImporting(false)
  }

  const handleFetch = async () => {
    setFetching(true)
    setError("")
    setSuccess("")
    setFetchResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-all-sports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dates: selectedDates,
          trigger: 'manual'
        })
      })

      const result = await response.json()

      if (result.success || result.status === 'partial') {
        setFetchResult(result)
        setSuccess(`Successfully fetched ${result.eventsFound} events across ${result.sportsFound} sports!`)
        setTimeout(() => { onUpdate() }, 1000)
      } else {
        setError("Fetch failed: " + (result.error || 'Unknown error'))
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setFetching(false)
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      if (logTypeFilter === "all" || logTypeFilter === "api_fetch") {
        // Load API fetch logs
        const { data, error } = await supabase
          .from('api_fetch_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        // Transform to unified format
        const apiLogs = (data || []).map(log => ({
          id: log.id,
          type: 'api_fetch',
          action_type: log.fetch_type,
          status: log.status,
          created_at: log.created_at,
          details: {
            sport: log.sport,
            fetch_date: log.fetch_date,
            matches_fetched: log.matches_fetched,
            matches_updated: log.matches_updated,
            api_response_time_ms: log.api_response_time_ms,
            error_message: log.error_message
          }
        }))

        setLogs(apiLogs)
      }

      if (logTypeFilter === "all" || logTypeFilter === "admin_actions") {
        // Load admin action logs
        const { data, error } = await supabase
          .from('admin_action_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (!error && data) {
          const actionLogs = data.map(log => ({
            id: log.id,
            type: 'admin_action',
            action_type: log.action_type,
            admin_email: log.admin_email,
            target_user_email: log.target_user_email,
            created_at: log.created_at,
            details: log.details || {}
          }))

          if (logTypeFilter === "admin_actions") {
            setLogs(actionLogs)
          } else {
            // Combine and sort by date
            setLogs(prev => [...prev, ...actionLogs].sort((a, b) =>
              new Date(b.created_at) - new Date(a.created_at)
            ).slice(0, 50))
          }
        }
      }
    } catch (e) {
      console.error('Error loading logs:', e)
    }
    setLoadingLogs(false)
  }

  const loadBroadcasts = async () => {
    setLoadingBroadcasts(true)
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select(`
          *,
          matches:match_id (
            home,
            away,
            league,
            sport,
            match_date,
            match_time
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setBroadcasts(data || [])
    } catch (e) {
      console.error('Error loading broadcasts:', e)
    }
    setLoadingBroadcasts(false)
  }

  const toggleBroadcastSelection = (broadcastId) => {
    setSelectedBroadcasts(prev =>
      prev.includes(broadcastId)
        ? prev.filter(id => id !== broadcastId)
        : [...prev, broadcastId]
    )
  }

  const toggleSelectAll = () => {
    const filteredBroadcasts = getFilteredBroadcasts()
    if (selectedBroadcasts.length === filteredBroadcasts.length) {
      setSelectedBroadcasts([])
    } else {
      setSelectedBroadcasts(filteredBroadcasts.map(b => b.id))
    }
  }

  const confirmBulkDelete = () => {
    if (selectedBroadcasts.length === 0) return
    setShowDeleteConfirm(true)
  }

  const handleBulkDelete = async () => {
    if (selectedBroadcasts.length === 0) return

    setDeletingBroadcasts(true)
    try {
      // Get broadcast details before deletion for logging
      const deletedBroadcasts = broadcasts.filter(b => selectedBroadcasts.includes(b.id))

      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .in('id', selectedBroadcasts)

      if (error) throw error

      // Log the bulk deletion
      await logAdminAction('broadcasts_deleted', {
        extraData: {
          deleted_count: selectedBroadcasts.length,
          broadcast_ids: selectedBroadcasts
        }
      })

      setSuccess(`Successfully deleted ${selectedBroadcasts.length} broadcast${selectedBroadcasts.length > 1 ? 's' : ''}`)
      setSelectedBroadcasts([])
      await loadBroadcasts()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error deleting broadcasts: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setDeletingBroadcasts(false)
    setShowDeleteConfirm(false)
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      // Get ALL users from user_profiles table
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, created_at, ban_status, ban_reason, banned_at, banned_by_email')
        .order('created_at', { ascending: false })

      if (profilesError) {
        console.error('Error loading user profiles:', profilesError)
        // Fallback: Get users from broadcasts if user_profiles fails
        const { data: broadcastsData, error: broadcastsError } = await supabase
          .from('broadcasts')
          .select('created_by, created_by_uuid')

        if (broadcastsError) throw broadcastsError

        const userMap = {}
        broadcastsData?.forEach(b => {
          const email = b.created_by
          const uuid = b.created_by_uuid
          if (email && uuid) {
            if (!userMap[uuid]) {
              userMap[uuid] = { uuid, email, broadcastCount: 0 }
            }
            userMap[uuid].broadcastCount++
          }
        })

        const usersList = Object.values(userMap).sort((a, b) => b.broadcastCount - a.broadcastCount)
        setUsers(usersList)
      } else {
        // Get email from auth.users via RPC or join
        // For now, we'll get emails from broadcasts table
        const { data: broadcastsData } = await supabase
          .from('broadcasts')
          .select('created_by, created_by_uuid')

        // Create a map of uuid -> email
        const emailMap = {}
        broadcastsData?.forEach(b => {
          if (b.created_by_uuid && b.created_by) {
            emailMap[b.created_by_uuid] = b.created_by
          }
        })

        // Count broadcasts per user
        const broadcastCounts = {}
        broadcastsData?.forEach(b => {
          if (b.created_by_uuid) {
            broadcastCounts[b.created_by_uuid] = (broadcastCounts[b.created_by_uuid] || 0) + 1
          }
        })

        const usersList = (profilesData || []).map(profile => ({
          uuid: profile.id,
          email: emailMap[profile.id] || 'Unknown',
          displayName: profile.display_name,
          broadcastCount: broadcastCounts[profile.id] || 0,
          ban_status: profile.ban_status,
          ban_reason: profile.ban_reason,
          banned_at: profile.banned_at,
          banned_by_email: profile.banned_by_email
        })).sort((a, b) => b.broadcastCount - a.broadcastCount)

        setUsers(usersList)

        // Set banned users list from profiles
        setBannedUsers(usersList.filter(u => u.ban_status).map(u => u.uuid))
      }
    } catch (e) {
      console.error('Error loading users:', e)
      setBannedUsers([])
    }
    setLoadingUsers(false)
  }

  const openBanModal = (userUuid, userEmail, action) => {
    setBanTarget({ uuid: userUuid, email: userEmail })
    setBanAction(action)
    setBanReason("")
    setShowBanModal(true)
  }

  const confirmBanAction = async () => {
    if (!banTarget) return

    setProcessingBan(banTarget.uuid)
    setShowBanModal(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const adminEmail = session?.user?.email
      const adminUuid = session?.user?.id

      if (banAction === "ban") {
        // Ban user - update user_profiles
        const { error } = await supabase
          .from('user_profiles')
          .update({
            ban_status: true,
            ban_reason: banReason || 'No reason provided',
            banned_at: new Date().toISOString(),
            banned_by_uuid: adminUuid,
            banned_by_email: adminEmail
          })
          .eq('id', banTarget.uuid)

        if (error) throw error

        // Log the ban action
        await logAdminAction('user_banned', {
          targetUserUuid: banTarget.uuid,
          targetUserEmail: banTarget.email,
          extraData: { ban_reason: banReason || 'No reason provided' }
        })

        setBannedUsers(prev => [...prev, banTarget.uuid])
        setSuccess(`User ${banTarget.email} has been banned`)
      } else {
        // Unban user - update user_profiles
        const { error } = await supabase
          .from('user_profiles')
          .update({
            ban_status: false,
            ban_reason: null,
            banned_at: null,
            banned_by_uuid: null,
            banned_by_email: null
          })
          .eq('id', banTarget.uuid)

        if (error) throw error

        // Log the unban action
        await logAdminAction('user_unbanned', {
          targetUserUuid: banTarget.uuid,
          targetUserEmail: banTarget.email,
          extraData: { unban_reason: banReason || 'No reason provided' }
        })

        setBannedUsers(prev => prev.filter(id => id !== banTarget.uuid))
        setSuccess(`User ${banTarget.email} has been unbanned`)
      }

      await loadUsers() // Reload to show updated ban status
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError(`Error ${banAction === 'ban' ? 'banning' : 'unbanning'} user: ` + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setProcessingBan(null)
    setBanTarget(null)
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    } else if (activeTab === 'broadcasts') {
      loadBroadcasts()
    } else if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab, logTypeFilter])

  const toggleDate = (date) => {
    setSelectedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    )
  }

  const getStatusColor = (status) => {
    if (status === 'success') return '#81c784'
    if (status === 'partial') return '#ffb74d'
    return '#e57373'
  }

  const getStatusBg = (status) => {
    if (status === 'success') return 'rgba(76,175,80,0.15)'
    if (status === 'partial') return 'rgba(255,152,0,0.15)'
    return 'rgba(244,67,54,0.15)'
  }

  const getStatusBorder = (status) => {
    if (status === 'success') return 'rgba(76,175,80,0.3)'
    if (status === 'partial') return 'rgba(255,152,0,0.3)'
    return 'rgba(244,67,54,0.3)'
  }

  const getFilteredBroadcasts = () => {
    return broadcasts.filter(broadcast => {
      // Single unified search across username, fixture, and league
      if (searchBroadcast) {
        const searchTerm = searchBroadcast.toLowerCase()
        const username = (broadcast.created_by || '').toLowerCase()
        const match = broadcast.matches

        // Check username
        if (username.includes(searchTerm)) return true

        // Check fixture (home vs away teams)
        if (match) {
          const fixture = `${match.home} ${match.away}`.toLowerCase()
          if (fixture.includes(searchTerm)) return true

          // Check league
          const league = (match.league || '').toLowerCase()
          if (league.includes(searchTerm)) return true
        }

        // Check channel/country
        if ((broadcast.channel || '').toLowerCase().includes(searchTerm)) return true
        if ((broadcast.country || '').toLowerCase().includes(searchTerm)) return true

        return false
      }

      return true
    })
  }

  const getFilteredUsers = () => {
    return users.filter(user => {
      // Filter out users with unknown email (no broadcasts)
      if (!user.email || user.email === 'Unknown') {
        return false
      }

      // Filter out current admin
      if (currentUserEmail && user.email === currentUserEmail) {
        return false
      }

      // Search filter
      if (searchUser) {
        const email = user.email || ''
        if (!email.toLowerCase().includes(searchUser.toLowerCase())) {
          return false
        }
      }

      return true
    })
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 600, border: "1px solid #2a2a4a", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#888", cursor: "pointer" }}>
          <Icon name="x" size={16} />
        </button>

        <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="shield" size={16} color="#00e5ff" /> Admin Panel
        </h3>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #2a2a4a", paddingBottom: 0 }}>
          {[
            { id: 'import', label: 'Import JSON', icon: 'upload' },
            { id: 'fetch', label: 'Fetch from API', icon: 'download' },
            { id: 'broadcasts', label: 'Broadcasts', icon: 'tv' },
            { id: 'users', label: 'Users', icon: 'shield' },
            { id: 'logs', label: 'View Logs', icon: 'list' }
          ].map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  background: active ? "rgba(0,229,255,0.15)" : "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid #00e5ff" : "2px solid transparent",
                  color: active ? "#00e5ff" : "#666",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                <Icon name={tab.icon} size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {activeTab === 'import' && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
                Paste the parsed matches JSON array. This will sync to Supabase.
              </div>
              <textarea
                value={jsonData}
                onChange={(e) => { setJsonData(e.target.value); setError(""); setSuccess("") }}
                placeholder='[{"id":"123","sport":"Football","league":"Premier League","home":"Team A","away":"Team B","date":"2026-02-04","time":"20:00","country":"UK","status":"upcoming","popularity":85}]'
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #2a2a4a",
                  background: "#111122",
                  color: "#fff",
                  fontSize: 11,
                  fontFamily: "monospace",
                  outline: "none",
                  resize: "none",
                  marginBottom: 12,
                  minHeight: 200
                }}
              />
              {error && <div style={{ padding: 8, marginBottom: 12, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 12, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #2a2a4a", background: "rgba(255,255,255,0.05)", color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleImport} disabled={!jsonData.trim() || importing} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: jsonData.trim() && !importing ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: jsonData.trim() && !importing ? "pointer" : "not-allowed" }}>
                  {importing ? "Importing..." : "Import to Supabase"}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'fetch' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>
                Manually fetch all sports fixtures and TV broadcasts from TheSportsDB. This will retrieve events for all sports on the selected dates.
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600 }}>Select Dates</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {['today', 'tomorrow'].map(date => {
                    const selected = selectedDates.includes(date)
                    return (
                      <button
                        key={date}
                        onClick={() => toggleDate(date)}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: selected ? "1px solid rgba(0,229,255,0.5)" : "1px solid #2a2a4a",
                          background: selected ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.04)",
                          color: selected ? "#00e5ff" : "#666",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8
                        }}
                      >
                        <div style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: selected ? "2px solid #00e5ff" : "2px solid #444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: selected ? "#00e5ff" : "transparent"
                        }}>
                          {selected && <Icon name="check" size={10} color="#000" />}
                        </div>
                        {date.charAt(0).toUpperCase() + date.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {fetchResult && (
                <div style={{
                  padding: 12,
                  background: getStatusBg(fetchResult.status),
                  border: `1px solid ${getStatusBorder(fetchResult.status)}`,
                  borderRadius: 8
                }}>
                  <div style={{ fontSize: 12, color: getStatusColor(fetchResult.status), marginBottom: 8, fontWeight: 600 }}>
                    Fetch {fetchResult.status === 'success' ? 'Successful' : fetchResult.status === 'partial' ? 'Partially Successful' : 'Failed'}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>
                    • Found: {fetchResult.eventsFound} events<br />
                    • Inserted: {fetchResult.eventsInserted} matches<br />
                    • Sports: {fetchResult.sportsFound}<br />
                    {fetchResult.sportStats && Object.keys(fetchResult.sportStats).length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 10 }}>
                        {Object.entries(fetchResult.sportStats).slice(0, 5).map(([sport, stats]) => (
                          <div key={sport}>• {sport}: {stats.eventsFound} events</div>
                        ))}
                        {Object.keys(fetchResult.sportStats).length > 5 && (
                          <div>• ...and {Object.keys(fetchResult.sportStats).length - 5} more sports</div>
                        )}
                      </div>
                    )}
                    {fetchResult.errors && (
                      <>
                        • Errors: {fetchResult.errors.length}<br />
                        <div style={{ fontSize: 10, color: "#e57373", marginTop: 8, fontFamily: "monospace" }}>
                          {fetchResult.errors.join('\n')}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && <div style={{ padding: 8, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #2a2a4a", background: "rgba(255,255,255,0.05)", color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
                <button
                  onClick={handleFetch}
                  disabled={selectedDates.length === 0 || fetching}
                  style={{
                    flex: 2,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: selectedDates.length > 0 && !fetching ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: selectedDates.length > 0 && !fetching ? "pointer" : "not-allowed"
                  }}
                >
                  {fetching ? "Fetching..." : "Fetch All Sports from TheSportsDB"}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'broadcasts' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {broadcasts.length} broadcast{broadcasts.length !== 1 ? 's' : ''} total
                    {selectedBroadcasts.length > 0 && ` • ${selectedBroadcasts.length} selected`}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {selectedBroadcasts.length > 0 && (
                      <button
                        onClick={confirmBulkDelete}
                        disabled={deletingBroadcasts}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid rgba(244,67,54,0.4)",
                          background: "rgba(244,67,54,0.15)",
                          color: "#e57373",
                          fontSize: 10,
                          cursor: deletingBroadcasts ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 600
                        }}
                      >
                        <Icon name="x" size={10} />
                        {deletingBroadcasts ? "Deleting..." : `Delete (${selectedBroadcasts.length})`}
                      </button>
                    )}
                    <button
                      onClick={loadBroadcasts}
                      disabled={loadingBroadcasts}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #2a2a4a",
                        background: "rgba(255,255,255,0.05)",
                        color: "#aaa",
                        fontSize: 10,
                        cursor: loadingBroadcasts ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Icon name="refresh" size={10} />
                      {loadingBroadcasts ? "..." : "Refresh"}
                    </button>
                  </div>
                </div>

                {/* Unified search */}
                <div style={{ position: "relative" }}>
                  <Icon name="search" size={12} color="#555" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    value={searchBroadcast}
                    onChange={(e) => setSearchBroadcast(e.target.value)}
                    placeholder="Search user email, teams, leagues..."
                    style={{
                      width: "100%",
                      padding: "6px 10px 6px 30px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "#111122",
                      color: "#fff",
                      fontSize: 11,
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              {error && <div style={{ padding: 8, marginBottom: 8, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 8, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              {loadingBroadcasts ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading broadcasts...</div>
                </div>
              ) : broadcasts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                  <Icon name="tv" size={24} color="#444" style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No broadcasts yet</p>
                </div>
              ) : (
                <>
                  {getFilteredBroadcasts().length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 4 }}>
                      <button
                        onClick={toggleSelectAll}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: selectedBroadcasts.length === getFilteredBroadcasts().length ? "2px solid #00e5ff" : "2px solid #444",
                          background: selectedBroadcasts.length === getFilteredBroadcasts().length ? "#00e5ff" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        {selectedBroadcasts.length === getFilteredBroadcasts().length && <Icon name="check" size={12} color="#000" />}
                      </button>
                      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>Select All</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                    {getFilteredBroadcasts().map(broadcast => {
                      const match = broadcast.matches
                      const isSelected = selectedBroadcasts.includes(broadcast.id)
                      return (
                      <div
                        key={broadcast.id}
                        style={{
                          padding: 10,
                          background: isSelected ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.03)",
                          border: isSelected ? "1px solid rgba(0,229,255,0.3)" : "1px solid #2a2a4a",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer"
                        }}
                        onClick={() => toggleBroadcastSelection(broadcast.id)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleBroadcastSelection(broadcast.id)
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: isSelected ? "2px solid #00e5ff" : "2px solid #444",
                            background: isSelected ? "#00e5ff" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0
                          }}
                        >
                          {isSelected && <Icon name="check" size={12} color="#000" />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "#fff", marginBottom: 4, fontWeight: 500 }}>
                            {broadcast.country} • {broadcast.channel}
                          </div>
                          {match && (
                            <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>
                              {match.sport} • {match.league}<br />
                              {match.home} vs {match.away}<br />
                              {match.match_date} {match.match_time}
                            </div>
                          )}
                          <div style={{ fontSize: 9, color: "#555", marginTop: 4, fontFamily: "monospace" }}>
                            Added by: {broadcast.created_by || 'Unknown'} • {new Date(broadcast.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {getFilteredUsers().length} user{getFilteredUsers().length !== 1 ? 's' : ''} total
                  </div>
                  <button
                    onClick={loadUsers}
                    disabled={loadingUsers}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "rgba(255,255,255,0.05)",
                      color: "#aaa",
                      fontSize: 10,
                      cursor: loadingUsers ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Icon name="refresh" size={10} />
                    {loadingUsers ? "..." : "Refresh"}
                  </button>
                </div>

                {/* User search */}
                <div style={{ position: "relative" }}>
                  <Icon name="search" size={12} color="#555" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search by email..."
                    style={{
                      width: "100%",
                      padding: "6px 10px 6px 30px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "#111122",
                      color: "#fff",
                      fontSize: 11,
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              {error && <div style={{ padding: 8, marginBottom: 8, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 8, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              {loadingUsers ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading users...</div>
                </div>
              ) : getFilteredUsers().length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                  <Icon name="shield" size={24} color="#444" style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No users found</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                  {getFilteredUsers().map(user => {
                    const isBanned = bannedUsers.includes(user.uuid)
                    const isProcessing = processingBan === user.uuid
                    return (
                      <div
                        key={user.uuid}
                        style={{
                          padding: 12,
                          background: isBanned ? "rgba(244,67,54,0.08)" : "rgba(255,255,255,0.03)",
                          border: isBanned ? "1px solid rgba(244,67,54,0.3)" : "1px solid #2a2a4a",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "#fff", marginBottom: 4, fontWeight: 500 }}>
                            {user.email}
                          </div>
                          <div style={{ fontSize: 10, color: "#888" }}>
                            {user.broadcastCount} broadcast{user.broadcastCount !== 1 ? 's' : ''}
                          </div>
                          {isBanned && (
                            <>
                              <div style={{ fontSize: 9, color: "#e57373", marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>
                                BANNED
                              </div>
                              {user.ban_reason && (
                                <div style={{ fontSize: 9, color: "#999", marginTop: 2, fontStyle: "italic" }}>
                                  Reason: {user.ban_reason}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => openBanModal(user.uuid, user.email, isBanned ? 'unban' : 'ban')}
                          disabled={isProcessing}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: isBanned ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(244,67,54,0.4)",
                            background: isBanned ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)",
                            color: isBanned ? "#81c784" : "#e57373",
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: isProcessing ? "not-allowed" : "pointer"
                          }}
                        >
                          {isProcessing ? "..." : isBanned ? "Unban" : "Ban User"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#888" }}>Recent logs (last 50)</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {/* Log type filter */}
                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "#111122",
                      color: "#aaa",
                      fontSize: 10,
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="all">All Logs</option>
                    <option value="api_fetch">API Fetch</option>
                    <option value="admin_actions">Admin Actions</option>
                  </select>
                  <button
                    onClick={loadLogs}
                    disabled={loadingLogs}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "rgba(255,255,255,0.05)",
                      color: "#aaa",
                      fontSize: 10,
                      cursor: loadingLogs ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Icon name="refresh" size={10} />
                    {loadingLogs ? "..." : "Refresh"}
                  </button>
                </div>
              </div>

              {loadingLogs ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading logs...</div>
                </div>
              ) : logs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                  <Icon name="database" size={24} color="#444" style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No logs yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                  {logs.map(log => (
                    <div
                      key={log.id}
                      style={{
                        padding: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid #2a2a4a",
                        borderRadius: 8
                      }}
                    >
                      {log.type === 'api_fetch' ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: getStatusBg(log.status),
                                border: `1px solid ${getStatusBorder(log.status)}`,
                                color: getStatusColor(log.status),
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase"
                              }}>
                                {log.status}
                              </span>
                              <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                                {log.action_type}
                              </span>
                            </div>
                            <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5, fontFamily: "monospace" }}>
                            Date: {log.details.fetch_date} | Sport: {log.details.sport}<br />
                            Fetched: {log.details.matches_fetched} | Updated: {log.details.matches_updated}
                            {log.details.api_response_time_ms && ` | Time: ${log.details.api_response_time_ms}ms`}
                          </div>
                          {log.details.error_message && (
                            <div style={{ fontSize: 9, color: "#e57373", marginTop: 6, fontFamily: "monospace", background: "rgba(244,67,54,0.08)", padding: 6, borderRadius: 4 }}>
                              {log.details.error_message}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "rgba(124,77,255,0.15)",
                                border: "1px solid rgba(124,77,255,0.3)",
                                color: "#9c6dff",
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase"
                              }}>
                                ADMIN
                              </span>
                              <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                                {log.action_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                            Admin: {log.admin_email || 'System'}<br />
                            {log.target_user_email && `Target: ${log.target_user_email}`}
                            {log.details?.ban_reason && <><br />Reason: {log.details.ban_reason}</>}
                            {log.details?.unban_reason && <><br />Unban reason: {log.details.unban_reason}</>}
                            {log.details?.deleted_count && <><br />Deleted: {log.details.deleted_count} broadcast{log.details.deleted_count > 1 ? 's' : ''}</>}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
          title="Delete Broadcasts"
          message={`Are you sure you want to delete ${selectedBroadcasts.length} broadcast${selectedBroadcasts.length > 1 ? 's' : ''}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="#e53935"
        />
      )}

      {/* Ban/Unban Modal */}
      {showBanModal && banTarget && (
        <div onClick={() => setShowBanModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 400, border: "1px solid #2a2a4a" }}>
            <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 16 }}>
              {banAction === 'ban' ? 'Ban User' : 'Unban User'}
            </h3>
            <p style={{ color: "#aaa", fontSize: 13, marginBottom: 16 }}>
              {banAction === 'ban' ? `You are about to ban ${banTarget.email}. Please provide a reason.` : `You are about to unban ${banTarget.email}. Optionally provide a reason.`}
            </p>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={banAction === 'ban' ? 'Reason for ban (required)' : 'Reason for unban (optional)'}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #2a2a4a",
                background: "#111122",
                color: "#fff",
                fontSize: 12,
                outline: "none",
                resize: "vertical",
                minHeight: 80,
                marginBottom: 16,
                boxSizing: "border-box"
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowBanModal(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1px solid #2a2a4a",
                  background: "rgba(255,255,255,0.05)",
                  color: "#aaa",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBanAction}
                disabled={banAction === 'ban' && !banReason.trim()}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: (banAction === 'ban' && !banReason.trim()) ? "#2a2a4a" : (banAction === 'ban' ? "#e53935" : "#4caf50"),
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (banAction === 'ban' && !banReason.trim()) ? "not-allowed" : "pointer"
                }}
              >
                {banAction === 'ban' ? 'Ban User' : 'Unban User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
