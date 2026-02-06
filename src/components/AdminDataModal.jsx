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
  const [fetchBroadcastsToo, setFetchBroadcastsToo] = useState(true)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [fetchResult, setFetchResult] = useState(null)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [fixtures, setFixtures] = useState([])
  const [loadingFixtures, setLoadingFixtures] = useState(false)
  const [selectedFixtures, setSelectedFixtures] = useState([])
  const [deletingFixtures, setDeletingFixtures] = useState(false)
  const [showDeleteFixturesConfirm, setShowDeleteFixturesConfirm] = useState(false)
  const [searchFixture, setSearchFixture] = useState("")
  const [sportFilter, setSportFilter] = useState("all")
  const [expandedFixture, setExpandedFixture] = useState(null)
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
  const [importType, setImportType] = useState(null) // 'fixtures', 'broadcasts', 'legacy', or null
  const [importPreview, setImportPreview] = useState(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)

  // Detect and preview import data
  const detectImportType = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString)

      // TheSportsDB fixtures format
      if (parsed.events && Array.isArray(parsed.events)) {
        setImportType('fixtures')
        setImportPreview({
          count: parsed.events.length,
          sample: parsed.events.slice(0, 3).map(e => ({
            event: e.strEvent,
            sport: e.strSport,
            date: e.dateEvent
          }))
        })
        return
      }

      // TheSportsDB TV broadcasts format
      if (parsed.tvevents && Array.isArray(parsed.tvevents)) {
        setImportType('broadcasts')
        setImportPreview({
          count: parsed.tvevents.length,
          sample: parsed.tvevents.slice(0, 3).map(e => ({
            event: e.strEvent,
            channel: e.strTVStation || e.strChannel,
            country: e.strCountry
          }))
        })
        return
      }

      // Legacy array format
      if (Array.isArray(parsed)) {
        setImportType('legacy')
        setImportPreview({
          count: parsed.length,
          sample: parsed.slice(0, 3).map(m => ({
            teams: `${m.home} vs ${m.away}`,
            sport: m.sport,
            date: m.date
          }))
        })
        return
      }

      setImportType(null)
      setImportPreview(null)
    } catch {
      setImportType(null)
      setImportPreview(null)
    }
  }

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

      // TheSportsDB fixtures format
      if (parsed.events && Array.isArray(parsed.events)) {
        const events = parsed.events
        const matches = events.map(e => ({
          id: `sportsdb-${e.idEvent}`,
          sportsdb_event_id: e.idEvent,
          sport: e.strSport || 'Unknown',
          league: e.strLeague || 'Unknown League',
          home: e.strHomeTeam || 'TBD',
          away: e.strAwayTeam || 'TBD',
          match_date: e.dateEvent,
          match_time: e.strTime?.substring(0, 5) || '00:00',
          country: e.strCountry || 'Global',
          status: 'upcoming',
          popularity: 70
        }))

        const { error: dbError } = await supabase
          .from("matches")
          .upsert(matches, { onConflict: 'sportsdb_event_id' })

        if (dbError) {
          setError("Database error: " + dbError.message)
        } else {
          const sports = [...new Set(matches.map(m => m.sport))]
          setSuccess(`Imported ${matches.length} fixtures across ${sports.length} sport(s)!`)
          await logAdminAction('fixtures_imported', {
            extraData: { count: matches.length, sports, source: 'thesportsdb_json' }
          })
          setTimeout(() => { onUpdate() }, 1500)
        }
        setImporting(false)
        return
      }

      // TheSportsDB TV broadcasts format
      if (parsed.tvevents && Array.isArray(parsed.tvevents)) {
        const tvevents = parsed.tvevents
        let matched = 0
        let unmatched = 0
        let inserted = 0
        let skipped = 0
        const errors = []

        for (const tv of tvevents) {
          if (!tv.idEvent) {
            unmatched++
            continue
          }

          // Find the match by sportsdb_event_id
          const { data: match } = await supabase
            .from('matches')
            .select('id')
            .eq('sportsdb_event_id', tv.idEvent)
            .single()

          if (!match) {
            unmatched++
            continue
          }

          matched++

          // Parse TV stations (may be comma-separated)
          const stations = (tv.strTVStation || tv.strChannel || '').split(',').map(s => s.trim()).filter(Boolean)
          const country = tv.strCountry || 'Global'

          for (const channel of stations) {
            // Check if broadcast already exists
            const { data: existingList } = await supabase
              .from('broadcasts')
              .select('id')
              .eq('match_id', match.id)
              .eq('channel', channel)
              .eq('country', country)
              .limit(1)

            if (existingList && existingList.length > 0) {
              skipped++
              continue
            }

            // Insert new broadcast
            const { error: insertError } = await supabase
              .from('broadcasts')
              .insert({
                match_id: match.id,
                channel,
                country,
                source: 'thesportsdb',
                source_id: tv.idEvent,
                confidence_score: 100,
                created_by: 'system'
              })

            if (insertError) {
              errors.push(`${channel}: ${insertError.message}`)
            } else {
              inserted++
            }
          }
        }

        if (matched === 0 && unmatched > 0) {
          setError(`No matching fixtures found for ${unmatched} TV events. Import fixtures first.`)
        } else if (errors.length > 0) {
          setError(`Errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`)
        } else if (inserted === 0 && skipped === 0 && matched > 0) {
          setError(`Matched ${matched} fixtures but found no TV stations in data. Check strTVStation field.`)
        } else {
          const skipMsg = skipped > 0 ? `, ${skipped} skipped (duplicates)` : ''
          setSuccess(`Linked ${inserted} broadcasts to ${matched} fixtures${skipMsg}`)
          await logAdminAction('broadcasts_imported', {
            extraData: { matched, unmatched, inserted, skipped, source: 'thesportsdb_json' }
          })
          setTimeout(() => { onUpdate() }, 1500)
        }
        setImporting(false)
        return
      }

      // Legacy array format
      if (Array.isArray(parsed)) {
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
          setTimeout(() => { onUpdate() }, 1500)
        }
        setImporting(false)
        return
      }

      setError("Unrecognized format. Expected TheSportsDB events/tvevents or array of matches.")
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
    setBroadcastResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      // Step 1: Fetch fixtures
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

        // Step 2: Optionally fetch broadcasts
        if (fetchBroadcastsToo) {
          const broadcastResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-broadcasts`, {
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

          const broadcastData = await broadcastResponse.json()
          setBroadcastResult(broadcastData)

          if (broadcastData.success || broadcastData.status === 'partial') {
            setSuccess(`Fetched ${result.eventsFound} events across ${result.sportsFound} sports + ${broadcastData.broadcastsInserted} broadcasts!`)
          } else {
            setSuccess(`Fetched ${result.eventsFound} events across ${result.sportsFound} sports. Broadcasts failed: ${broadcastData.error || 'Unknown'}`)
          }
        } else {
          setSuccess(`Successfully fetched ${result.eventsFound} events across ${result.sportsFound} sports!`)
        }

        setTimeout(() => { onUpdate() }, 1000)
      } else {
        setError("Fetch failed: " + (result.error || 'Unknown error'))
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setFetching(false)
  }

  const handleCleanup = async () => {
    setCleaningUp(true)
    setError("")
    setSuccess("")
    setCleanupResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      const response = await fetch(`${supabaseUrl}/functions/v1/cleanup-old-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const result = await response.json()
      setCleanupResult(result)

      if (result.success) {
        const { matches, broadcasts, votes } = result.deleted
        if (matches === 0) {
          setSuccess('No old data to clean up')
        } else {
          setSuccess(`Cleaned up ${matches} match${matches !== 1 ? 'es' : ''}, ${broadcasts} broadcast${broadcasts !== 1 ? 's' : ''}, ${votes} vote${votes !== 1 ? 's' : ''}`)
          setTimeout(() => { onUpdate() }, 1000)
        }
      } else {
        setError('Cleanup failed: ' + (result.error || 'Unknown error'))
      }
    } catch (e) {
      setError('Error: ' + e.message)
    }
    setCleaningUp(false)
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

  const loadFixtures = async () => {
    setLoadingFixtures(true)
    try {
      // Fetch fixtures with their broadcasts
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          broadcasts (
            id,
            channel,
            country,
            source,
            created_by,
            created_at
          )
        `)
        .order('match_date', { ascending: false })
        .limit(500)

      if (error) throw error
      setFixtures(data || [])
    } catch (e) {
      console.error('Error loading fixtures:', e)
    }
    setLoadingFixtures(false)
  }

  const toggleFixtureExpand = (fixtureId) => {
    setExpandedFixture(prev => prev === fixtureId ? null : fixtureId)
  }

  const toggleFixtureSelection = (fixtureId) => {
    setSelectedFixtures(prev =>
      prev.includes(fixtureId)
        ? prev.filter(id => id !== fixtureId)
        : [...prev, fixtureId]
    )
  }

  const toggleSelectAllFixtures = () => {
    const filteredFixtures = getFilteredFixtures()
    if (selectedFixtures.length === filteredFixtures.length) {
      setSelectedFixtures([])
    } else {
      setSelectedFixtures(filteredFixtures.map(f => f.id))
    }
  }

  const confirmBulkDeleteFixtures = () => {
    if (selectedFixtures.length === 0) return
    setShowDeleteFixturesConfirm(true)
  }

  const handleBulkDeleteFixtures = async () => {
    if (selectedFixtures.length === 0) return

    setDeletingFixtures(true)
    try {
      // Delete fixtures - broadcasts and votes will cascade delete
      const { error } = await supabase
        .from('matches')
        .delete()
        .in('id', selectedFixtures)

      if (error) throw error

      // Log the bulk deletion
      await logAdminAction('fixtures_deleted', {
        extraData: {
          deleted_count: selectedFixtures.length,
          fixture_ids: selectedFixtures.slice(0, 10) // Log first 10 for reference
        }
      })

      setSuccess(`Successfully deleted ${selectedFixtures.length} fixture${selectedFixtures.length > 1 ? 's' : ''} (and associated broadcasts/votes)`)
      setSelectedFixtures([])
      await loadFixtures()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error deleting fixtures: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setDeletingFixtures(false)
    setShowDeleteFixturesConfirm(false)
  }

  const getFilteredFixtures = () => {
    return fixtures.filter(fixture => {
      // Sport filter
      if (sportFilter !== "all" && fixture.sport !== sportFilter) {
        return false
      }

      // Search filter
      if (searchFixture) {
        const searchTerm = searchFixture.toLowerCase()
        const teams = `${fixture.home} ${fixture.away}`.toLowerCase()
        const league = (fixture.league || '').toLowerCase()
        const sport = (fixture.sport || '').toLowerCase()

        if (!teams.includes(searchTerm) && !league.includes(searchTerm) && !sport.includes(searchTerm)) {
          return false
        }
      }

      return true
    })
  }

  const getUniqueSports = () => {
    return [...new Set(fixtures.map(f => f.sport))].sort()
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
    // Clear status messages when switching tabs
    setError("")
    setSuccess("")
    setFetchResult(null)
    setBroadcastResult(null)
    setCleanupResult(null)
    setImportType(null)
    setImportPreview(null)
    setJsonData("")
    setSelectedFixtures([])

    // Load data for specific tabs
    if (activeTab === 'logs') {
      loadLogs()
    } else if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab === 'fixtures') {
      loadFixtures()
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
            { id: 'import', label: 'Import', icon: 'upload' },
            { id: 'fetch', label: 'Fetch', icon: 'download' },
            { id: 'fixtures', label: 'Fixtures', icon: 'calendar' },
            { id: 'users', label: 'Users', icon: 'shield' },
            { id: 'logs', label: 'Logs', icon: 'list' }
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
                Paste JSON from TheSportsDB API responses. Supports:<br />
                • <span style={{ color: "#00e5ff" }}>{"{ events: [...] }"}</span> - Fixtures from eventsday.php<br />
                • <span style={{ color: "#ff9f1c" }}>{"{ tvevents: [...] }"}</span> - Broadcasts from eventstv.php
              </div>
              <textarea
                value={jsonData}
                onChange={(e) => {
                  setJsonData(e.target.value)
                  setError("")
                  setSuccess("")
                  detectImportType(e.target.value)
                }}
                placeholder='Paste TheSportsDB JSON response here...

Example fixtures:
{ "events": [{ "idEvent": "123", "strSport": "Soccer", ... }] }

Example broadcasts:
{ "tvevents": [{ "idEvent": "123", "strTVStation": "ESPN", ... }] }'
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
                  minHeight: 160
                }}
              />

              {/* Format detection preview */}
              {importType && importPreview && (
                <div style={{
                  padding: 10,
                  marginBottom: 12,
                  background: importType === 'fixtures' ? "rgba(0,229,255,0.08)" : importType === 'broadcasts' ? "rgba(255,159,28,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${importType === 'fixtures' ? "rgba(0,229,255,0.3)" : importType === 'broadcasts' ? "rgba(255,159,28,0.3)" : "#2a2a4a"}`,
                  borderRadius: 8
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon name={importType === 'fixtures' ? 'calendar' : importType === 'broadcasts' ? 'tv' : 'list'} size={12} color={importType === 'fixtures' ? '#00e5ff' : importType === 'broadcasts' ? '#ff9f1c' : '#aaa'} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: importType === 'fixtures' ? '#00e5ff' : importType === 'broadcasts' ? '#ff9f1c' : '#aaa',
                      textTransform: 'uppercase'
                    }}>
                      {importType === 'fixtures' ? 'TheSportsDB Fixtures' : importType === 'broadcasts' ? 'TheSportsDB Broadcasts' : 'Legacy Format'}
                    </span>
                    <span style={{ fontSize: 10, color: "#666" }}>
                      ({importPreview.count} items)
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5, fontFamily: "monospace" }}>
                    {importPreview.sample.map((item, i) => (
                      <div key={i} style={{ marginBottom: 2 }}>
                        {importType === 'fixtures' && `• ${item.sport}: ${item.event} (${item.date})`}
                        {importType === 'broadcasts' && `• ${item.event} → ${item.channel} (${item.country})`}
                        {importType === 'legacy' && `• ${item.sport}: ${item.teams} (${item.date})`}
                      </div>
                    ))}
                    {importPreview.count > 3 && <div style={{ color: "#555" }}>...and {importPreview.count - 3} more</div>}
                  </div>
                  {importType === 'broadcasts' && (
                    <div style={{ fontSize: 9, color: "#ff9f1c", marginTop: 6, fontStyle: "italic" }}>
                      Note: Broadcasts will be linked to fixtures by event ID. Import fixtures first if needed.
                    </div>
                  )}
                </div>
              )}

              {error && <div style={{ padding: 8, marginBottom: 12, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 12, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}
              <button onClick={handleImport} disabled={!jsonData.trim() || importing} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: jsonData.trim() && !importing ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: jsonData.trim() && !importing ? "pointer" : "not-allowed" }}>
                {importing ? "Importing..." : importType === 'fixtures' ? 'Import Fixtures' : importType === 'broadcasts' ? 'Import Broadcasts' : 'Import'}
              </button>
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
                  {['today', 'tomorrow', 'day_after_tomorrow'].map(date => {
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
                        {date === 'day_after_tomorrow' ? 'Day After' : date.charAt(0).toUpperCase() + date.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Also fetch broadcasts toggle */}
              <div
                onClick={() => setFetchBroadcastsToo(!fetchBroadcastsToo)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: fetchBroadcastsToo ? "1px solid rgba(0,229,255,0.3)" : "1px solid #2a2a4a",
                  background: fetchBroadcastsToo ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.02)",
                  cursor: "pointer"
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: fetchBroadcastsToo ? "2px solid #00e5ff" : "2px solid #444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: fetchBroadcastsToo ? "#00e5ff" : "transparent",
                  flexShrink: 0
                }}>
                  {fetchBroadcastsToo && <Icon name="check" size={12} color="#000" />}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: fetchBroadcastsToo ? "#00e5ff" : "#aaa", fontWeight: 600 }}>
                    Also fetch TV broadcasts
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                    Link broadcast channels to fixtures from TheSportsDB
                  </div>
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

              {broadcastResult && (
                <div style={{
                  padding: 12,
                  background: getStatusBg(broadcastResult.status),
                  border: `1px solid ${getStatusBorder(broadcastResult.status)}`,
                  borderRadius: 8
                }}>
                  <div style={{ fontSize: 12, color: getStatusColor(broadcastResult.status), marginBottom: 8, fontWeight: 600 }}>
                    Broadcasts {broadcastResult.status === 'success' ? 'Linked' : broadcastResult.status === 'partial' ? 'Partially Linked' : 'Failed'}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>
                    • TV Events Found: {broadcastResult.tvEventsFound}<br />
                    • Matched: {broadcastResult.matched}<br />
                    • Broadcasts Inserted: {broadcastResult.broadcastsInserted}
                    {broadcastResult.unmatched > 0 && <><br />• Unmatched: {broadcastResult.unmatched}</>}
                  </div>
                </div>
              )}

              {error && <div style={{ padding: 8, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              <button
                onClick={handleFetch}
                disabled={selectedDates.length === 0 || fetching}
                style={{
                  width: "100%",
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
                {fetching ? "Fetching..." : `Fetch All Sports${fetchBroadcastsToo ? ' + Broadcasts' : ''}`}
              </button>

              {/* Cleanup section */}
              <div style={{ borderTop: "1px solid #2a2a4a", paddingTop: 16 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
                  Remove all fixtures, broadcasts, and votes for past matches (before today).
                </div>

                {cleanupResult && cleanupResult.success && cleanupResult.deleted?.matches > 0 && (
                  <div style={{
                    padding: 12,
                    marginBottom: 10,
                    background: "rgba(76,175,80,0.15)",
                    border: "1px solid rgba(76,175,80,0.3)",
                    borderRadius: 8
                  }}>
                    <div style={{ fontSize: 11, color: "#81c784", lineHeight: 1.6 }}>
                      Deleted: {cleanupResult.deleted.matches} matches, {cleanupResult.deleted.broadcasts} broadcasts, {cleanupResult.deleted.votes} votes
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCleanup}
                  disabled={cleaningUp}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "1px solid rgba(244,67,54,0.4)",
                    background: !cleaningUp ? "rgba(244,67,54,0.15)" : "#2a2a4a",
                    color: !cleaningUp ? "#e57373" : "#666",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: !cleaningUp ? "pointer" : "not-allowed"
                  }}
                >
                  {cleaningUp ? "Cleaning up..." : "Cleanup Old Data"}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'fixtures' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {fixtures.length} fixture{fixtures.length !== 1 ? 's' : ''} total
                    {selectedFixtures.length > 0 && ` • ${selectedFixtures.length} selected`}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {selectedFixtures.length > 0 && (
                      <button
                        onClick={confirmBulkDeleteFixtures}
                        disabled={deletingFixtures}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid rgba(244,67,54,0.4)",
                          background: "rgba(244,67,54,0.15)",
                          color: "#e57373",
                          fontSize: 10,
                          cursor: deletingFixtures ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 600
                        }}
                      >
                        <Icon name="x" size={10} />
                        {deletingFixtures ? "Deleting..." : `Delete (${selectedFixtures.length})`}
                      </button>
                    )}
                    <button
                      onClick={loadFixtures}
                      disabled={loadingFixtures}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #2a2a4a",
                        background: "rgba(255,255,255,0.05)",
                        color: "#aaa",
                        fontSize: 10,
                        cursor: loadingFixtures ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Icon name="refresh" size={10} />
                      {loadingFixtures ? "..." : "Refresh"}
                    </button>
                  </div>
                </div>

                {/* Filters row */}
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Sport filter */}
                  <select
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "#111122",
                      color: "#aaa",
                      fontSize: 11,
                      outline: "none",
                      cursor: "pointer",
                      minWidth: 120
                    }}
                  >
                    <option value="all">All Sports</option>
                    {getUniqueSports().map(sport => (
                      <option key={sport} value={sport}>{sport}</option>
                    ))}
                  </select>

                  {/* Search input */}
                  <div style={{ position: "relative", flex: 1 }}>
                    <Icon name="search" size={12} color="#555" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      value={searchFixture}
                      onChange={(e) => setSearchFixture(e.target.value)}
                      placeholder="Search teams, leagues..."
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
              </div>

              {error && <div style={{ padding: 8, marginBottom: 8, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 8, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              {loadingFixtures ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading fixtures...</div>
                </div>
              ) : fixtures.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                  <Icon name="calendar" size={24} color="#444" style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No fixtures yet</p>
                </div>
              ) : (
                <>
                  {getFilteredFixtures().length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 4 }}>
                      <button
                        onClick={toggleSelectAllFixtures}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: selectedFixtures.length === getFilteredFixtures().length ? "2px solid #00e5ff" : "2px solid #444",
                          background: selectedFixtures.length === getFilteredFixtures().length ? "#00e5ff" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        {selectedFixtures.length === getFilteredFixtures().length && <Icon name="check" size={12} color="#000" />}
                      </button>
                      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>
                        Select All ({getFilteredFixtures().length})
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 350, overflowY: "auto" }}>
                    {getFilteredFixtures().map(fixture => {
                      const isSelected = selectedFixtures.includes(fixture.id)
                      const isExpanded = expandedFixture === fixture.id
                      const broadcastCount = fixture.broadcasts?.length || 0
                      return (
                        <div key={fixture.id}>
                          <div
                            style={{
                              padding: 10,
                              background: isSelected ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.03)",
                              border: isSelected ? "1px solid rgba(0,229,255,0.3)" : "1px solid #2a2a4a",
                              borderRadius: isExpanded ? "6px 6px 0 0" : 6,
                              display: "flex",
                              alignItems: "center",
                              gap: 10
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFixtureSelection(fixture.id)
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
                            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggleFixtureExpand(fixture.id)}>
                              <div style={{ fontSize: 11, color: "#fff", marginBottom: 4, fontWeight: 500 }}>
                                {fixture.home} vs {fixture.away}
                              </div>
                              <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>
                                {fixture.sport} • {fixture.league}<br />
                                {fixture.match_date} {fixture.match_time}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFixtureExpand(fixture.id)
                              }}
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: broadcastCount > 0 ? "rgba(255,159,28,0.15)" : "rgba(255,255,255,0.05)",
                                border: broadcastCount > 0 ? "1px solid rgba(255,159,28,0.3)" : "1px solid #2a2a4a",
                                fontSize: 9,
                                color: broadcastCount > 0 ? "#ff9f1c" : "#666",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              <Icon name="tv" size={10} />
                              {broadcastCount}
                            </button>
                          </div>
                          {isExpanded && (
                            <div style={{
                              padding: 10,
                              background: "rgba(0,0,0,0.2)",
                              border: "1px solid #2a2a4a",
                              borderTop: "none",
                              borderRadius: "0 0 6px 6px"
                            }}>
                              {broadcastCount === 0 ? (
                                <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: 8 }}>
                                  No broadcasts linked
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {fixture.broadcasts.map(broadcast => (
                                    <div key={broadcast.id} style={{
                                      padding: "6px 8px",
                                      background: "rgba(255,255,255,0.03)",
                                      borderRadius: 4,
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center"
                                    }}>
                                      <div>
                                        <span style={{ fontSize: 10, color: "#ff9f1c", fontWeight: 600 }}>{broadcast.channel}</span>
                                        <span style={{ fontSize: 9, color: "#666", marginLeft: 6 }}>({broadcast.country})</span>
                                      </div>
                                      <span style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>
                                        {broadcast.source || 'user'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
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

      {/* Confirm Delete Broadcasts Modal */}
      {/* Confirm Delete Fixtures Modal */}
      {showDeleteFixturesConfirm && (
        <ConfirmModal
          onClose={() => setShowDeleteFixturesConfirm(false)}
          onConfirm={handleBulkDeleteFixtures}
          title="Delete Fixtures"
          message={`Are you sure you want to delete ${selectedFixtures.length} fixture${selectedFixtures.length > 1 ? 's' : ''}? This will also delete all associated broadcasts and votes. This action cannot be undone.`}
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
