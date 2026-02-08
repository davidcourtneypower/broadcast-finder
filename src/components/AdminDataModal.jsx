import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from './Icon'
import { supabase } from '../config/supabase'
import { ConfirmModal } from './ConfirmModal'

export const AdminDataModal = ({ onClose, onUpdate, currentUserEmail, headerRef }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const [activeTab, setActiveTab] = useState('import')
  const [jsonData, setJsonData] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [importing, setImporting] = useState(false)
  const [fetchingEvents, setFetchingEvents] = useState(false)
  const [fetchingBroadcasts, setFetchingBroadcasts] = useState(false)
  const [fetchingLivestatus, setFetchingLivestatus] = useState(false)
  const [livestatusResult, setLivestatusResult] = useState(null)
  const [selectedDates, setSelectedDates] = useState(['today', 'tomorrow'])
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [eventsResult, setEventsResult] = useState(null)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [adminEvents, setAdminEvents] = useState([])
  const [loadingAdminEvents, setLoadingAdminEvents] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState([])
  const [deletingEvents, setDeletingEvents] = useState(false)
  const [showDeleteEventsConfirm, setShowDeleteEventsConfirm] = useState(false)
  const [searchEvent, setSearchEvent] = useState("")
  const [sportFilter, setSportFilter] = useState("all")
  const [expandedEvent, setExpandedEvent] = useState(null)
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
  const [importType, setImportType] = useState(null) // 'events', 'broadcasts', 'livestatus', or null (user-selected)
  const [importPreview, setImportPreview] = useState(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)
  const [fetchingReferenceData, setFetchingReferenceData] = useState(false)
  const [referenceDataResult, setReferenceDataResult] = useState(null)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const [statusMappings, setStatusMappings] = useState([])
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [newStatusCode, setNewStatusCode] = useState('')
  const [newStatusCategory, setNewStatusCategory] = useState('live')
  const [newStatusDesc, setNewStatusDesc] = useState('')
  const [statusCategoryFilter, setStatusCategoryFilter] = useState('all')
  // Config tab state
  const [configItems, setConfigItems] = useState([])
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [editedConfig, setEditedConfig] = useState({}) // { key: newValue }
  const [savingConfig, setSavingConfig] = useState(null) // key being saved
  // Cron job toggle state
  const [cronJobs, setCronJobs] = useState([])
  const [togglingJob, setTogglingJob] = useState(null)
  // Channels tab state
  const [countries, setCountries] = useState([])
  const [channels, setChannels] = useState([])
  const [blockedBroadcasts, setBlockedBroadcasts] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [newCountryName, setNewCountryName] = useState('')
  const [newCountryFlag, setNewCountryFlag] = useState('')
  const [newCountryCode, setNewCountryCode] = useState('')
  const [newChannelCountry, setNewChannelCountry] = useState('')
  const [newChannelName, setNewChannelName] = useState('')
  const [addingCountry, setAddingCountry] = useState(false)
  const [addingChannel, setAddingChannel] = useState(false)
  const scrollRef = useRef(null)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollHint(el.scrollHeight - el.scrollTop - el.clientHeight > 10)
  }, [])

  // Preview import data based on user-selected type
  const previewImportData = (jsonString, type) => {
    try {
      const parsed = JSON.parse(jsonString)

      if (type === 'events' && parsed.events && Array.isArray(parsed.events)) {
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

      if (type === 'broadcasts' && parsed.tvevents && Array.isArray(parsed.tvevents)) {
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

      if (type === 'livestatus' && parsed.events && Array.isArray(parsed.events)) {
        setImportPreview({
          count: parsed.events.length,
          sample: parsed.events.slice(0, 3).map(e => ({
            event: e.strEvent,
            status: e.strStatus || e.strProgress,
            score: `${e.intHomeScore ?? '?'} - ${e.intAwayScore ?? '?'}`
          }))
        })
        return
      }

      setImportPreview(null)
    } catch {
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
        event_id: details.matchId,
        details: details.extraData || {}
      }])
    } catch (e) {
      console.error('Error logging admin action:', e)
      // Don't throw - logging failure shouldn't break the main action
    }
  }

  const handleImport = async () => {
    if (!importType) {
      setError("Please select an import type first.")
      return
    }
    setImporting(true)
    setError("")
    setSuccess("")

    try {
      const parsed = JSON.parse(jsonData)

      // Events import
      if (importType === 'events') {
        if (!parsed.events || !Array.isArray(parsed.events)) {
          setError('Expected { "events": [...] } format for events import.')
          setImporting(false)
          return
        }
        const events = parsed.events

        // Ensure sports exist and build name→id map
        const uniqueSports = [...new Set(events.map(e => e.strSport).filter(Boolean))]
        if (uniqueSports.length > 0) {
          await supabase.from('sports').upsert(
            uniqueSports.map(name => ({ name })),
            { onConflict: 'name', ignoreDuplicates: true }
          )
        }
        const { data: sportsData } = await supabase.from('sports').select('id, name')
        const sportMap = Object.fromEntries((sportsData || []).map(s => [s.name, s.id]))

        const rows = events.map(e => {
          const sportId = sportMap[e.strSport]
          if (!sportId) return null
          return {
            id: `sportsdb-${e.idEvent}`,
            sportsdb_event_id: e.idEvent,
            sport_id: sportId,
            league: e.strLeague || 'Unknown League',
            home: e.strHomeTeam || null,
            away: e.strAwayTeam || null,
            event_name: (!e.strHomeTeam || !e.strAwayTeam) ? (e.strEvent || null) : null,
            event_date: e.dateEvent,
            event_time: e.strTime?.substring(0, 5) || '00:00',
            country: e.strCountry || 'Global',
            status: 'upcoming',
            popularity: 70
          }
        }).filter(Boolean)

        const { error: dbError } = await supabase
          .from("events")
          .upsert(rows, { onConflict: 'sportsdb_event_id' })

        if (dbError) {
          setError("Database error: " + dbError.message)
        } else {
          const sports = uniqueSports
          setSuccess(`Imported ${rows.length} events across ${sports.length} sport(s)!`)
          await logAdminAction('events_imported', {
            extraData: { count: rows.length, sports, source: 'thesportsdb_json' }
          })
          setTimeout(() => { onUpdate() }, 1500)
        }
        setImporting(false)
        return
      }

      // Broadcasts import
      if (importType === 'broadcasts') {
        if (!parsed.tvevents || !Array.isArray(parsed.tvevents)) {
          setError('Expected { "tvevents": [...] } format for broadcasts import.')
          setImporting(false)
          return
        }
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

          const { data: match } = await supabase
            .from('events')
            .select('id')
            .eq('sportsdb_event_id', tv.idEvent)
            .single()

          if (!match) {
            unmatched++
            continue
          }

          matched++

          const stations = (tv.strTVStation || tv.strChannel || '').split(',').map(s => s.trim()).filter(Boolean)
          const country = tv.strCountry || 'Global'

          for (const channel of stations) {
            const { data: existingList } = await supabase
              .from('broadcasts')
              .select('id')
              .eq('event_id', match.id)
              .eq('channel', channel)
              .eq('country', country)
              .limit(1)

            if (existingList && existingList.length > 0) {
              skipped++
              continue
            }

            const { error: insertError } = await supabase
              .from('broadcasts')
              .insert({
                event_id: match.id,
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
          setError(`No matching events found for ${unmatched} TV events. Import events first.`)
        } else if (errors.length > 0) {
          setError(`Errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`)
        } else if (inserted === 0 && skipped === 0 && matched > 0) {
          setError(`Matched ${matched} events but found no TV stations in data. Check strTVStation field.`)
        } else {
          const skipMsg = skipped > 0 ? `, ${skipped} skipped (duplicates)` : ''
          setSuccess(`Linked ${inserted} broadcasts to ${matched} events${skipMsg}`)
          await logAdminAction('broadcasts_imported', {
            extraData: { matched, unmatched, inserted, skipped, source: 'thesportsdb_json' }
          })
          setTimeout(() => { onUpdate() }, 1500)
        }
        setImporting(false)
        return
      }

      // Live status import
      if (importType === 'livestatus') {
        if (!parsed.events || !Array.isArray(parsed.events)) {
          setError('Expected { "events": [...] } format for live status import.')
          setImporting(false)
          return
        }
        const events = parsed.events
        let updated = 0
        let notFound = 0
        const errors = []

        for (const event of events) {
          if (!event.idEvent) continue

          const status = event.strStatus || event.strProgress || 'NS'
          const homeScore = event.intHomeScore !== null && event.intHomeScore !== '' ? parseInt(event.intHomeScore, 10) : null
          const awayScore = event.intAwayScore !== null && event.intAwayScore !== '' ? parseInt(event.intAwayScore, 10) : null

          const { data, error: updateError } = await supabase
            .from('events')
            .update({
              status,
              home_score: isNaN(homeScore) ? null : homeScore,
              away_score: isNaN(awayScore) ? null : awayScore,
              last_live_update: new Date().toISOString()
            })
            .eq('sportsdb_event_id', event.idEvent)
            .select('id')

          if (updateError) {
            errors.push(`${event.idEvent}: ${updateError.message}`)
          } else if (!data || data.length === 0) {
            notFound++
          } else {
            updated++
          }
        }

        if (errors.length > 0) {
          setError(`${errors.length} error(s): ${errors.slice(0, 3).join('; ')}`)
        } else if (updated === 0 && notFound > 0) {
          setError(`No matching events found for ${notFound} events. Import events first.`)
        } else {
          setSuccess(`Updated ${updated} event score(s)${notFound > 0 ? `, ${notFound} not found` : ''}`)
          await logAdminAction('livestatus_imported', {
            extraData: { updated, notFound, source: 'thesportsdb_json' }
          })
          setTimeout(() => { onUpdate() }, 1500)
        }
        setImporting(false)
        return
      }

      setError("Please select an import type.")
    } catch (e) {
      setError("Error: " + e.message)
    }
    setImporting(false)
  }

  const handleFetchEvents = async () => {
    setFetchingEvents(true)
    setError("")
    setSuccess("")
    setEventsResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-events', {
        body: { dates: selectedDates, trigger: 'manual' }
      })

      if (fnError) {
        let detail = fnError.message
        try { if (fnError.context?.json) { const body = await fnError.context.json(); detail = body.error || JSON.stringify(body) } } catch {}
        throw new Error(detail)
      }
      setEventsResult(data)

      if (data.success || data.status === 'partial') {
        setSuccess(`Fetched ${data.eventsFound} events across ${data.sportsFound} sports!`)
        setTimeout(() => { onUpdate() }, 1000)
      } else {
        setError("Fetch failed: " + (data.error || 'Unknown error'))
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setFetchingEvents(false)
  }

  const handleFetchBroadcasts = async () => {
    setFetchingBroadcasts(true)
    setError("")
    setSuccess("")
    setBroadcastResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-broadcasts', {
        body: { dates: selectedDates, trigger: 'manual' }
      })

      if (fnError) {
        let detail = fnError.message
        try { if (fnError.context?.json) { const body = await fnError.context.json(); detail = body.error || JSON.stringify(body) } } catch {}
        throw new Error(detail)
      }
      setBroadcastResult(data)

      if (data.success || data.status === 'partial') {
        setTimeout(() => { onUpdate() }, 1000)
      } else {
        setError("Broadcast fetch failed: " + (data.error || 'Unknown error'))
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setFetchingBroadcasts(false)
  }

  const handleCleanup = async () => {
    setCleaningUp(true)
    setError("")
    setSuccess("")
    setCleanupResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cleanup-old-data', {
        body: {}
      })

      if (fnError) {
        let detail = fnError.message
        try { if (fnError.context?.json) { const body = await fnError.context.json(); detail = body.error || JSON.stringify(body) } } catch {}
        throw new Error(detail)
      }
      setCleanupResult(data)

      if (data.success) {
        const { events, broadcasts, votes } = data.deleted
        if (events === 0) {
          setSuccess('No old data to clean up')
        } else {
          setSuccess(`Cleaned up ${events} event${events !== 1 ? 's' : ''}, ${broadcasts} broadcast${broadcasts !== 1 ? 's' : ''}, ${votes} vote${votes !== 1 ? 's' : ''}`)
          setTimeout(() => { onUpdate() }, 1000)
        }
      } else {
        setError('Cleanup failed: ' + (data.error || 'Unknown error'))
      }
    } catch (e) {
      setError('Error: ' + e.message)
    }
    setCleaningUp(false)
  }

  const handleFetchLivestatus = async () => {
    setFetchingLivestatus(true)
    setError("")
    setSuccess("")
    setLivestatusResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-livestatus', {
        body: { trigger: 'manual' }
      })

      if (fnError) {
        let detail = fnError.message
        try { if (fnError.context?.json) { const body = await fnError.context.json(); detail = body.error || JSON.stringify(body) } } catch {}
        throw new Error(detail)
      }
      setLivestatusResult(data)

      if (data.success) {
        setSuccess(`Live status: ${data.updated} updated, ${data.disappearedFinished || 0} finished`)
        setTimeout(() => { onUpdate() }, 1000)
      } else {
        setError('Live status fetch failed: ' + (data.error || 'Unknown error'))
      }
    } catch (e) {
      setError('Error: ' + e.message)
    }
    setFetchingLivestatus(false)
  }

  const handleFetchReferenceData = async () => {
    setFetchingReferenceData(true)
    setError("")
    setSuccess("")
    setReferenceDataResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-reference-data', {
        body: { trigger: 'manual' }
      })

      if (fnError) {
        let detail = fnError.message
        try { if (fnError.context?.json) { const body = await fnError.context.json(); detail = body.error || JSON.stringify(body) } } catch {}
        throw new Error(detail)
      }
      setReferenceDataResult(data)

      if (data.success || data.status === 'partial') {
        setSuccess(`Reference data: ${data.sports?.upserted || 0} sports, ${data.countries?.upserted || 0} countries, ${data.leagues?.upserted || 0} leagues`)
        setTimeout(() => { onUpdate() }, 1000)
      } else {
        setError('Reference data fetch failed: ' + (data.error || 'Unknown error'))
      }
    } catch (e) {
      setError('Error: ' + e.message)
    }
    setFetchingReferenceData(false)
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      let allLogs = []

      if (logTypeFilter === "all" || logTypeFilter === "api_fetch") {
        const { data, error } = await supabase
          .from('api_fetch_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          console.error('Error loading api_fetch_logs:', error)
        } else if (data) {
          const apiLogs = data.map(log => ({
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
          allLogs = [...allLogs, ...apiLogs]
        }
      }

      if (logTypeFilter === "all" || logTypeFilter === "admin_actions") {
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
          allLogs = [...allLogs, ...actionLogs]
        }
      }

      // Sort combined logs by date and limit
      allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setLogs(allLogs.slice(0, 50))
    } catch (e) {
      console.error('Error loading logs:', e)
    }
    setLoadingLogs(false)
  }

  const loadAdminEvents = async () => {
    setLoadingAdminEvents(true)
    try {
      // Fetch all events with their broadcasts using pagination
      let allEvents = []
      const PAGE_SIZE = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            sport:sports(name),
            broadcasts (
              id,
              channel,
              country,
              source,
              created_by,
              created_at
            )
          `)
          .order('event_date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)

        if (error) throw error
        // Flatten sport join into sport_name for downstream use
        const flattened = (data || []).map(f => ({ ...f, sport_name: f.sport?.name || 'Unknown' }))
        allEvents = allEvents.concat(flattened)
        if (!data || data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      setAdminEvents(allEvents)
    } catch (e) {
      console.error('Error loading events:', e)
    }
    setLoadingAdminEvents(false)
  }

  const toggleEventExpand = (eventId) => {
    setExpandedEvent(prev => prev === eventId ? null : eventId)
  }

  const toggleEventSelection = (eventId) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    )
  }

  const toggleSelectAllEvents = () => {
    const filteredEvents = getFilteredEvents()
    if (selectedEvents.length === filteredEvents.length) {
      setSelectedEvents([])
    } else {
      setSelectedEvents(filteredEvents.map(f => f.id))
    }
  }

  const confirmBulkDeleteEvents = () => {
    if (selectedEvents.length === 0) return
    setShowDeleteEventsConfirm(true)
  }

  const handleBulkDeleteEvents = async () => {
    if (selectedEvents.length === 0) return

    setDeletingEvents(true)
    try {
      // Delete events - broadcasts and votes will cascade delete
      const { error } = await supabase
        .from('events')
        .delete()
        .in('id', selectedEvents)

      if (error) throw error

      // Log the bulk deletion
      await logAdminAction('events_deleted', {
        extraData: {
          deleted_count: selectedEvents.length,
          event_ids: selectedEvents.slice(0, 10) // Log first 10 for reference
        }
      })

      setSuccess(`Successfully deleted ${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''} (and associated broadcasts/votes)`)
      setSelectedEvents([])
      await loadAdminEvents()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error deleting events: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setDeletingEvents(false)
    setShowDeleteEventsConfirm(false)
  }

  const getFilteredEvents = () => {
    return adminEvents.filter(evt => {
      // Sport filter
      if (sportFilter !== "all" && evt.sport_name !== sportFilter) {
        return false
      }

      // Search filter
      if (searchEvent) {
        const searchTerm = searchEvent.toLowerCase()
        const teams = `${evt.home || ''} ${evt.away || ''} ${evt.event_name || ''}`.toLowerCase()
        const league = (evt.league || '').toLowerCase()
        const sport = (evt.sport_name || '').toLowerCase()

        if (!teams.includes(searchTerm) && !league.includes(searchTerm) && !sport.includes(searchTerm)) {
          return false
        }
      }

      return true
    })
  }

  const getUniqueSports = () => {
    return [...new Set(adminEvents.map(f => f.sport_name))].sort()
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

  // --- Cron job toggle functions ---
  const CRON_JOB_LABELS = {
    'fetch-events': 'Fetch Events',
    'fetch-broadcasts': 'Fetch Broadcasts',
    'fetch-livestatus': 'Fetch Livestatus',
    'fetch-reference-data': 'Fetch Reference Data',
    'cleanup-old-data': 'Cleanup Old Data'
  }

  const loadCronJobs = async () => {
    try {
      const { data, error } = await supabase.rpc('get_cron_jobs')
      if (error) throw error
      setCronJobs(data || [])
    } catch (e) {
      console.error('Error loading cron jobs:', e)
    }
  }

  const handleToggleCronJob = async (jobName, currentActive) => {
    setTogglingJob(jobName)
    try {
      const { error } = await supabase.rpc('toggle_cron_job', {
        job_name: jobName,
        is_active: !currentActive
      })
      if (error) throw error
      setSuccess(`${CRON_JOB_LABELS[jobName] || jobName} ${!currentActive ? 'enabled' : 'disabled'}`)
      setTimeout(() => setSuccess(""), 3000)
      await loadCronJobs()
    } catch (e) {
      setError(`Failed to toggle job: ${e.message}`)
      setTimeout(() => setError(""), 3000)
    }
    setTogglingJob(null)
  }

  // --- Config tab functions ---
  const CRON_JOB_MAP = {
    'cron_fetch_events': 'fetch-events',
    'cron_fetch_broadcasts': 'fetch-broadcasts',
    'cron_fetch_livestatus': 'fetch-livestatus',
    'cron_fetch_reference_data': 'fetch-reference-data',
    'cron_cleanup': 'cleanup-old-data'
  }

  const loadConfigData = async () => {
    setLoadingConfig(true)
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .order('category')
        .order('key')
      if (error) throw error
      setConfigItems(data || [])
      setEditedConfig({})
    } catch (e) {
      console.error('Error loading config:', e)
    }
    setLoadingConfig(false)
  }

  const handleSaveConfig = async (item) => {
    const newValue = editedConfig[item.key]
    if (newValue === undefined || newValue === item.value) return

    setSavingConfig(item.key)
    setError("")
    try {
      const { error } = await supabase
        .from('app_config')
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('key', item.key)
      if (error) throw error

      // If it's a cron key, also update the pg_cron schedule
      if (CRON_JOB_MAP[item.key]) {
        const { error: rpcError } = await supabase.rpc('update_cron_schedule', {
          job_name: CRON_JOB_MAP[item.key],
          new_schedule: newValue
        })
        if (rpcError) {
          console.error('Error updating cron schedule:', rpcError)
          setError(`Config saved but cron schedule update failed: ${rpcError.message}`)
          setTimeout(() => setError(""), 5000)
        }
      }

      setSuccess(`Updated: ${item.label}`)
      setEditedConfig(prev => { const n = { ...prev }; delete n[item.key]; return n })
      await loadConfigData()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error saving config: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setSavingConfig(null)
  }

  useEffect(() => {
    // Clear status messages when switching tabs
    setError("")
    setSuccess("")
    setEventsResult(null)
    setBroadcastResult(null)
    setCleanupResult(null)
    setImportType(null)
    setImportPreview(null)
    setJsonData("")
    setSelectedEvents([])

    // Load data for specific tabs
    if (activeTab === 'fetch') {
      loadCronJobs()
    } else if (activeTab === 'logs') {
      loadLogs()
    } else if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab === 'events') {
      loadAdminEvents()
    } else if (activeTab === 'status') {
      loadStatusMappings()
    } else if (activeTab === 'channels') {
      loadChannelsData()
    } else if (activeTab === 'config') {
      loadConfigData()
    }
  }, [activeTab, logTypeFilter])

  // Re-check scroll indicator when tab or data changes
  useEffect(() => {
    requestAnimationFrame(checkScroll)
  }, [activeTab, adminEvents, users, logs, statusMappings, countries, channels, blockedBroadcasts, configItems, cronJobs, checkScroll])

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
      // Filter out current admin
      if (currentUserEmail && user.email === currentUserEmail) {
        return false
      }

      // Search filter (search email and display name)
      if (searchUser) {
        const email = (user.email || '').toLowerCase()
        const name = (user.displayName || '').toLowerCase()
        const query = searchUser.toLowerCase()
        if (!email.includes(query) && !name.includes(query)) {
          return false
        }
      }

      return true
    })
  }

  const loadStatusMappings = async () => {
    setLoadingStatuses(true)
    try {
      const { data, error } = await supabase
        .from('status_mappings')
        .select('*')
        .order('display_category')
        .order('raw_status')
      if (error) throw error
      setStatusMappings(data || [])
    } catch (e) {
      console.error('Error loading status mappings:', e)
    }
    setLoadingStatuses(false)
  }

  const handleAddStatusMapping = async () => {
    if (!newStatusCode.trim()) return
    setError("")
    setSuccess("")
    try {
      const { error } = await supabase
        .from('status_mappings')
        .insert({
          raw_status: newStatusCode.toUpperCase().trim(),
          display_category: newStatusCategory,
          description: newStatusDesc.trim() || null
        })
      if (error) throw error
      setSuccess(`Added: ${newStatusCode.toUpperCase().trim()} → ${newStatusCategory}`)
      setNewStatusCode('')
      setNewStatusDesc('')
      await loadStatusMappings()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error adding mapping: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleDeleteStatusMapping = async (id, rawStatus) => {
    setError("")
    setSuccess("")
    try {
      const { error } = await supabase
        .from('status_mappings')
        .delete()
        .eq('id', id)
      if (error) throw error
      setSuccess(`Removed: ${rawStatus}`)
      await loadStatusMappings()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error deleting mapping: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
  }

  // --- Channels tab functions ---
  const loadChannelsData = async () => {
    setLoadingChannels(true)
    try {
      const [countriesRes, channelsRes, blockedRes] = await Promise.all([
        supabase.from('countries').select('*').order('name'),
        supabase.from('country_channels').select('*, countries(name)').order('channel_name'),
        supabase.from('blocked_broadcasts').select('*, events(home, away, event_name, league, event_date)').order('blocked_at', { ascending: false })
      ])
      setCountries(countriesRes.data || [])
      setChannels(channelsRes.data || [])
      setBlockedBroadcasts(blockedRes.data || [])
    } catch (e) {
      console.error('Error loading channels data:', e)
    }
    setLoadingChannels(false)
  }

  const handleAddCountry = async () => {
    if (!newCountryName.trim()) return
    setAddingCountry(true)
    setError("")
    try {
      const { error } = await supabase.from('countries').insert({
        name: newCountryName.trim(),
        flag_emoji: newCountryFlag.trim() || null,
        code: newCountryCode.trim().toUpperCase() || null
      })
      if (error) throw error
      setSuccess(`Added country: ${newCountryName.trim()}`)
      setNewCountryName('')
      setNewCountryFlag('')
      setNewCountryCode('')
      await loadChannelsData()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error adding country: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setAddingCountry(false)
  }

  const handleAddChannel = async () => {
    if (!newChannelCountry || !newChannelName.trim()) return
    setAddingChannel(true)
    setError("")
    try {
      const { error } = await supabase.from('country_channels').insert({
        country_id: newChannelCountry,
        channel_name: newChannelName.trim()
      })
      if (error) throw error
      setSuccess(`Added channel: ${newChannelName.trim()}`)
      setNewChannelName('')
      await loadChannelsData()
      onUpdate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error adding channel: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setAddingChannel(false)
  }

  const handleUnblock = async (blockedId) => {
    setError("")
    try {
      const { error } = await supabase
        .from('blocked_broadcasts')
        .delete()
        .eq('id', blockedId)
      if (error) throw error
      setSuccess('Broadcast unblocked')
      setBlockedBroadcasts(prev => prev.filter(b => b.id !== blockedId))
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error unblocking: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
  }

  const getCategoryLabel = (cat) => {
    const labels = { frontend: 'Frontend', moderation: 'Moderation', edge_functions: 'Edge Functions', cron: 'Cron Schedules' }
    return labels[cat] || cat
  }

  const getFilteredStatusMappings = () => {
    if (statusCategoryFilter === 'all') return statusMappings
    return statusMappings.filter(m => m.display_category === statusCategoryFilter)
  }

  const getCategoryColor = (cat) => {
    if (cat === 'live') return '#e53935'
    if (cat === 'upcoming') return '#26a69a'
    if (cat === 'finished') return '#666'
    if (cat === 'cancelled') return '#ff9800'
    return '#888'
  }

  const getCategoryBg = (cat) => {
    if (cat === 'live') return 'rgba(229,57,53,0.15)'
    if (cat === 'upcoming') return 'rgba(38,166,154,0.15)'
    if (cat === 'finished') return 'rgba(102,102,102,0.15)'
    if (cat === 'cancelled') return 'rgba(255,152,0,0.15)'
    return 'rgba(136,136,136,0.15)'
  }

  const headerHeight = headerRef?.current?.offsetHeight || 56

  return (
    <>
      <div className={`filter-panel-backdrop ${isVisible ? 'visible' : ''}`} onClick={handleClose} />
      <div
        className={`filter-panel ${isVisible ? 'visible' : ''}`}
        style={{
          top: headerHeight,
          maxWidth: 600,
          width: "95%",
          margin: "0 auto",
          background: "#1a1a2e",
          borderRadius: "0 0 16px 16px",
          borderTop: "none",
          border: "1px solid #2a2a4a",
          borderTopColor: "transparent",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          height: `calc(90dvh - ${headerHeight}px)`,
          display: "flex",
          flexDirection: "column",
          padding: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: "#fff", margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="shield" size={16} color="#00e5ff" /> Admin Panel
          </h3>
          <button onClick={handleClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: "1px solid #2a2a4a", paddingBottom: 0 }}>
          {[
            { id: 'import', label: 'Import' },
            { id: 'fetch', label: 'Manage' },
            { id: 'events', label: 'Events' },
            { id: 'status', label: 'Statuses' },
            { id: 'channels', label: 'Channels' },
            { id: 'config', label: 'Config' },
            { id: 'users', label: 'Users' },
            { id: 'logs', label: 'Logs' }
          ].map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  background: active ? "rgba(0,229,255,0.15)" : "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid #00e5ff" : "2px solid transparent",
                  color: active ? "#00e5ff" : "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={scrollRef} onScroll={checkScroll} className="hidden-scrollbar" style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
          {activeTab === 'import' && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
                Select import type, then paste the JSON data.
              </div>

              {/* Import type selector */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[
                  { key: 'events', label: 'Events', color: '#00e5ff', icon: 'calendar', desc: '{ events: [...] }' },
                  { key: 'broadcasts', label: 'Broadcasts', color: '#ff9f1c', icon: 'tv', desc: '{ tvevents: [...] }' },
                  { key: 'livestatus', label: 'Live Status', color: '#4caf50', icon: 'clock', desc: '{ events: [...] }' },
                ].map(opt => {
                  const active = importType === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setImportType(active ? null : opt.key)
                        setImportPreview(null)
                        setError("")
                        setSuccess("")
                        if (!active && jsonData.trim()) {
                          previewImportData(jsonData, opt.key)
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: active ? `1px solid ${opt.color}80` : "1px solid #2a2a4a",
                        background: active ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                        color: active ? opt.color : "#666",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Icon name={opt.icon} size={14} color={active ? opt.color : "#555"} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {importType && (
                <>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 8, fontFamily: "monospace" }}>
                    Expected format: {importType === 'broadcasts' ? '{ "tvevents": [...] }' : '{ "events": [...] }'}
                  </div>
                  <textarea
                    value={jsonData}
                    onChange={(e) => {
                      setJsonData(e.target.value)
                      setError("")
                      setSuccess("")
                      previewImportData(e.target.value, importType)
                    }}
                    placeholder={
                      importType === 'events' ? 'Paste TheSportsDB eventsday.php response...\n\n{ "events": [{ "idEvent": "123", "strSport": "Soccer", ... }] }' :
                      importType === 'broadcasts' ? 'Paste TheSportsDB eventstv.php response...\n\n{ "tvevents": [{ "idEvent": "123", "strTVStation": "ESPN", ... }] }' :
                      'Paste TheSportsDB live status response...\n\n{ "events": [{ "idEvent": "123", "strStatus": "1H", "intHomeScore": "1", ... }] }'
                    }
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

                  {/* Data preview */}
                  {importPreview && (
                    <div style={{
                      padding: 10,
                      marginBottom: 12,
                      background: importType === 'events' ? "rgba(0,229,255,0.08)" : importType === 'broadcasts' ? "rgba(255,159,28,0.08)" : importType === 'livestatus' ? "rgba(76,175,80,0.08)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${importType === 'events' ? "rgba(0,229,255,0.3)" : importType === 'broadcasts' ? "rgba(255,159,28,0.3)" : importType === 'livestatus' ? "rgba(76,175,80,0.3)" : "#2a2a4a"}`,
                      borderRadius: 8
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: "#666" }}>
                          {importPreview.count} items detected
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5, fontFamily: "monospace" }}>
                        {importPreview.sample.map((item, i) => (
                          <div key={i} style={{ marginBottom: 2 }}>
                            {importType === 'events' && `• ${item.sport}: ${item.event} (${item.date})`}
                            {importType === 'broadcasts' && `• ${item.event} → ${item.channel} (${item.country})`}
                            {importType === 'livestatus' && `• ${item.event} [${item.status}] ${item.score}`}
                          </div>
                        ))}
                        {importPreview.count > 3 && <div style={{ color: "#555" }}>...and {importPreview.count - 3} more</div>}
                      </div>
                      {importType === 'broadcasts' && (
                        <div style={{ fontSize: 9, color: "#ff9f1c", marginTop: 6, fontStyle: "italic" }}>
                          Note: Broadcasts will be linked to events by event ID. Import events first if needed.
                        </div>
                      )}
                      {importType === 'livestatus' && (
                        <div style={{ fontSize: 9, color: "#4caf50", marginTop: 6, fontStyle: "italic" }}>
                          This will update statuses and scores for existing events.
                        </div>
                      )}
                    </div>
                  )}

                  {error && <div style={{ padding: 8, marginBottom: 12, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
                  {success && <div style={{ padding: 8, marginBottom: 12, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}
                  <button onClick={handleImport} disabled={!jsonData.trim() || importing} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: jsonData.trim() && !importing ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: jsonData.trim() && !importing ? "pointer" : "not-allowed" }}>
                    {importing ? "Importing..." : importType === 'events' ? 'Import Events' : importType === 'broadcasts' ? 'Import Broadcasts' : importType === 'livestatus' ? 'Import Live Status' : 'Import'}
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'fetch' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Scheduled Jobs */}
              {cronJobs.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600 }}>Scheduled Jobs</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {cronJobs.map(job => (
                      <div key={job.jobname} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                        border: "1px solid #2a2a4a"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 12, color: "#ddd", fontWeight: 600 }}>
                            {CRON_JOB_LABELS[job.jobname] || job.jobname}
                          </span>
                          <span style={{ fontSize: 10, color: "#666", fontFamily: "monospace" }}>
                            {job.schedule}
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggleCronJob(job.jobname, job.active)}
                          disabled={togglingJob === job.jobname}
                          style={{
                            width: 40,
                            height: 22,
                            borderRadius: 11,
                            border: "none",
                            background: job.active ? "#00e5ff" : "#333",
                            cursor: togglingJob === job.jobname ? "not-allowed" : "pointer",
                            position: "relative",
                            transition: "background 0.2s",
                            opacity: togglingJob === job.jobname ? 0.5 : 1
                          }}
                        >
                          <div style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            background: "#fff",
                            position: "absolute",
                            top: 3,
                            left: job.active ? 21 : 3,
                            transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                          }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600 }}>Select Dates</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {['today', 'tomorrow', 'day_after_tomorrow'].map(date => {
                    const selected = selectedDates.includes(date)
                    return (
                      <button
                        key={date}
                        onClick={() => toggleDate(date)}
                        style={{
                          flex: 1,
                          padding: "8px 4px",
                          borderRadius: 8,
                          border: selected ? "1px solid rgba(0,229,255,0.5)" : "1px solid #2a2a4a",
                          background: selected ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.04)",
                          color: selected ? "#00e5ff" : "#666",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          minWidth: 0
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

              {error && <div style={{ padding: 8, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              {/* Fetch Events */}
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                  Fetch all sports events from TheSportsDB for selected dates.
                </div>
                <button
                  onClick={handleFetchEvents}
                  disabled={selectedDates.length === 0 || fetchingEvents}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: selectedDates.length > 0 && !fetchingEvents ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: selectedDates.length > 0 && !fetchingEvents ? "pointer" : "not-allowed"
                  }}
                >
                  {fetchingEvents ? "Fetching..." : "Fetch Events"}
                </button>
              </div>

              {/* Fetch Broadcasts */}
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                  Fetch TV broadcast data and link to existing events.
                </div>
                <button
                  onClick={handleFetchBroadcasts}
                  disabled={selectedDates.length === 0 || fetchingBroadcasts}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: selectedDates.length > 0 && !fetchingBroadcasts ? "linear-gradient(135deg,#ff9f1c,#ff6d00)" : "#2a2a4a",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: selectedDates.length > 0 && !fetchingBroadcasts ? "pointer" : "not-allowed"
                  }}
                >
                  {fetchingBroadcasts ? "Fetching..." : "Fetch Broadcasts"}
                </button>
              </div>

              {/* Fetch Live Status */}
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                  Fetch live scores and update statuses in real-time.
                </div>
                <button
                  onClick={handleFetchLivestatus}
                  disabled={fetchingLivestatus}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: !fetchingLivestatus ? "linear-gradient(135deg,#4caf50,#2e7d32)" : "#2a2a4a",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: !fetchingLivestatus ? "pointer" : "not-allowed"
                  }}
                >
                  {fetchingLivestatus ? "Fetching..." : "Fetch Live Status"}
                </button>
              </div>

              {/* Fetch Reference Data */}
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                  Fetch all sports, countries, and leagues from TheSportsDB.
                </div>
                <button
                  onClick={handleFetchReferenceData}
                  disabled={fetchingReferenceData}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: !fetchingReferenceData ? "linear-gradient(135deg,#ab47bc,#7b1fa2)" : "#2a2a4a",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: !fetchingReferenceData ? "pointer" : "not-allowed"
                  }}
                >
                  {fetchingReferenceData ? "Fetching..." : "Fetch Reference Data"}
                </button>
              </div>

              {/* Cleanup section */}
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
                  Remove all events, broadcasts, and votes for past events (before today).
                </div>
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

              {/* Combined results area - below all actions */}
              {(eventsResult || broadcastResult || livestatusResult || referenceDataResult || (cleanupResult && cleanupResult.success && cleanupResult.deleted?.matches > 0)) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {eventsResult && (
                    <div style={{
                      padding: 10,
                      background: getStatusBg(eventsResult.status),
                      border: `1px solid ${getStatusBorder(eventsResult.status)}`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Icon name="calendar" size={12} color="#00e5ff" />
                      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                        Found {eventsResult.eventsFound} events across {eventsResult.sportsFound} sports, inserted {eventsResult.eventsInserted}
                      </div>
                    </div>
                  )}
                  {broadcastResult && (
                    <div style={{
                      padding: 10,
                      background: getStatusBg(broadcastResult.status),
                      border: `1px solid ${getStatusBorder(broadcastResult.status)}`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Icon name="tv" size={12} color="#ff9f1c" />
                      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                        Found {broadcastResult.tvEventsFound} TV events, matched {broadcastResult.matched}, inserted {broadcastResult.broadcastsInserted} broadcasts
                        {broadcastResult.unmatched > 0 && `, ${broadcastResult.unmatched} unmatched`}
                      </div>
                    </div>
                  )}
                  {livestatusResult && (
                    <div style={{
                      padding: 10,
                      background: getStatusBg(livestatusResult.status),
                      border: `1px solid ${getStatusBorder(livestatusResult.status)}`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Icon name="clock" size={12} color="#4caf50" />
                      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                        Processed {livestatusResult.totalEvents} events, updated {livestatusResult.updated}
                        {livestatusResult.disappearedFinished > 0 && `, ${livestatusResult.disappearedFinished} marked finished`}
                        {livestatusResult.errors?.length > 0 && `, ${livestatusResult.errors.length} errors`}
                      </div>
                    </div>
                  )}
                  {referenceDataResult && (
                    <div style={{
                      padding: 10,
                      background: getStatusBg(referenceDataResult.status),
                      border: `1px solid ${getStatusBorder(referenceDataResult.status)}`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Icon name="database" size={12} color="#ab47bc" />
                      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                        Sports: {referenceDataResult.sports?.upserted || 0}, Countries: {referenceDataResult.countries?.upserted || 0}, Leagues: {referenceDataResult.leagues?.upserted || 0}
                      </div>
                    </div>
                  )}
                  {cleanupResult && cleanupResult.success && cleanupResult.deleted?.matches > 0 && (
                    <div style={{
                      padding: 10,
                      background: "rgba(76,175,80,0.15)",
                      border: "1px solid rgba(76,175,80,0.3)",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Icon name="check" size={12} color="#81c784" />
                      <div style={{ fontSize: 11, color: "#81c784", lineHeight: 1.4 }}>
                        Deleted: {cleanupResult.deleted.matches} matches, {cleanupResult.deleted.broadcasts} broadcasts, {cleanupResult.deleted.votes} votes
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {adminEvents.length} event{adminEvents.length !== 1 ? 's' : ''} total
                    {selectedEvents.length > 0 && ` • ${selectedEvents.length} selected`}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {selectedEvents.length > 0 && (
                      <button
                        onClick={confirmBulkDeleteEvents}
                        disabled={deletingEvents}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid rgba(244,67,54,0.4)",
                          background: "rgba(244,67,54,0.15)",
                          color: "#e57373",
                          fontSize: 10,
                          cursor: deletingEvents ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 600
                        }}
                      >
                        <Icon name="x" size={10} />
                        {deletingEvents ? "Deleting..." : `Delete (${selectedEvents.length})`}
                      </button>
                    )}
                    <button
                      onClick={loadAdminEvents}
                      disabled={loadingAdminEvents}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #2a2a4a",
                        background: "rgba(255,255,255,0.05)",
                        color: "#aaa",
                        fontSize: 10,
                        cursor: loadingAdminEvents ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Icon name="refresh" size={10} />
                      {loadingAdminEvents ? "..." : "Refresh"}
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
                      value={searchEvent}
                      onChange={(e) => setSearchEvent(e.target.value)}
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

              {loadingAdminEvents ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading events...</div>
                </div>
              ) : adminEvents.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                  <Icon name="calendar" size={24} color="#444" style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No events yet</p>
                </div>
              ) : (
                <>
                  {getFilteredEvents().length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 4 }}>
                      <button
                        onClick={toggleSelectAllEvents}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: selectedEvents.length === getFilteredEvents().length ? "2px solid #00e5ff" : "2px solid #444",
                          background: selectedEvents.length === getFilteredEvents().length ? "#00e5ff" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        {selectedEvents.length === getFilteredEvents().length && <Icon name="check" size={12} color="#000" />}
                      </button>
                      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>
                        Select All ({getFilteredEvents().length})
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {getFilteredEvents().map(evt => {
                      const isSelected = selectedEvents.includes(evt.id)
                      const isExpanded = expandedEvent === evt.id
                      const broadcastCount = evt.broadcasts?.length || 0
                      return (
                        <div key={evt.id}>
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
                                toggleEventSelection(evt.id)
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
                            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggleEventExpand(evt.id)}>
                              <div style={{ fontSize: 11, color: "#fff", marginBottom: 4, fontWeight: 500 }}>
                                {evt.home && evt.away ? `${evt.home} vs ${evt.away}` : evt.event_name || evt.league || 'Event'}
                              </div>
                              <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>
                                {evt.sport_name} • {evt.league}<br />
                                {evt.event_date} {evt.event_time}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleEventExpand(evt.id)
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
                                  {evt.broadcasts.map(broadcast => (
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

          {activeTab === 'status' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {statusMappings.length} mapping{statusMappings.length !== 1 ? 's' : ''} total
                  </div>
                  <button
                    onClick={loadStatusMappings}
                    disabled={loadingStatuses}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #2a2a4a",
                      background: "rgba(255,255,255,0.05)",
                      color: "#aaa",
                      fontSize: 10,
                      cursor: loadingStatuses ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Icon name="refresh" size={10} />
                    {loadingStatuses ? "..." : "Refresh"}
                  </button>
                </div>

                {/* Category filter */}
                <select
                  value={statusCategoryFilter}
                  onChange={(e) => setStatusCategoryFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #2a2a4a",
                    background: "#111122",
                    color: "#aaa",
                    fontSize: 11,
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="all">All Categories</option>
                  <option value="live">Live</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="finished">Finished</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {error && <div style={{ padding: 8, marginBottom: 4, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 4, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              {/* Add new mapping form */}
              <div style={{
                padding: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #2a2a4a",
                borderRadius: 6,
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap"
              }}>
                <input
                  value={newStatusCode}
                  onChange={(e) => setNewStatusCode(e.target.value)}
                  placeholder="Code (e.g. R1)"
                  style={{
                    padding: "6px 8px",
                    borderRadius: 4,
                    border: "1px solid #2a2a4a",
                    background: "#111122",
                    color: "#fff",
                    fontSize: 11,
                    outline: "none",
                    width: 80,
                    fontFamily: "monospace"
                  }}
                />
                <select
                  value={newStatusCategory}
                  onChange={(e) => setNewStatusCategory(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 4,
                    border: "1px solid #2a2a4a",
                    background: "#111122",
                    color: "#aaa",
                    fontSize: 11,
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="live">live</option>
                  <option value="upcoming">upcoming</option>
                  <option value="finished">finished</option>
                  <option value="cancelled">cancelled</option>
                </select>
                <input
                  value={newStatusDesc}
                  onChange={(e) => setNewStatusDesc(e.target.value)}
                  placeholder="Description"
                  style={{
                    padding: "6px 8px",
                    borderRadius: 4,
                    border: "1px solid #2a2a4a",
                    background: "#111122",
                    color: "#fff",
                    fontSize: 11,
                    outline: "none",
                    flex: 1,
                    minWidth: 80
                  }}
                />
                <button
                  onClick={handleAddStatusMapping}
                  disabled={!newStatusCode.trim()}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "none",
                    background: newStatusCode.trim() ? "#00e5ff" : "#2a2a4a",
                    color: newStatusCode.trim() ? "#000" : "#666",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: newStatusCode.trim() ? "pointer" : "not-allowed"
                  }}
                >
                  Add
                </button>
              </div>

              {/* Mappings list */}
              {loadingStatuses ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading status mappings...</div>
                </div>
              ) : getFilteredStatusMappings().length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                  <p style={{ margin: 0, fontSize: 12 }}>No mappings found</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {getFilteredStatusMappings().map(mapping => (
                    <div
                      key={mapping.id}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid #2a2a4a",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      <span style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#fff",
                        fontWeight: 600,
                        minWidth: 40
                      }}>
                        {mapping.raw_status}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: getCategoryBg(mapping.display_category),
                        color: getCategoryColor(mapping.display_category),
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase"
                      }}>
                        {mapping.display_category}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: "#666" }}>
                        {mapping.description || ''}
                      </span>
                      <button
                        onClick={() => handleDeleteStatusMapping(mapping.id, mapping.raw_status)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid rgba(244,67,54,0.3)",
                          background: "transparent",
                          color: "#e57373",
                          fontSize: 10,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center"
                        }}
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  ))}
                </div>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                          <div style={{ fontSize: 12, color: "#fff", marginBottom: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {user.email && user.email !== 'Unknown' ? user.email : user.displayName || 'Anonymous'}
                          </div>
                          {user.displayName && user.email && user.email !== 'Unknown' && (
                            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>{user.displayName}</div>
                          )}
                          <div style={{ fontSize: 10, color: "#888" }}>
                            {user.broadcastCount} broadcast{user.broadcastCount !== 1 ? 's' : ''}
                            {(!user.email || user.email === 'Unknown') && <span style={{ color: "#555" }}> · no email on record</span>}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

          {activeTab === 'config' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {configItems.length} setting{configItems.length !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={loadConfigData}
                  disabled={loadingConfig}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #2a2a4a",
                    background: "rgba(255,255,255,0.05)",
                    color: "#aaa",
                    fontSize: 10,
                    cursor: loadingConfig ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Icon name="refresh" size={10} />
                  {loadingConfig ? "..." : "Refresh"}
                </button>
              </div>

              {error && <div style={{ padding: 8, marginBottom: 4, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
              {success && <div style={{ padding: 8, marginBottom: 4, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}

              {loadingConfig ? (
                <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                  <div style={{ fontSize: 12 }}>Loading config...</div>
                </div>
              ) : (
                // Group by category
                [...new Set(configItems.map(c => c.category))].map(category => (
                  <div key={category} style={{ marginBottom: 12 }}>
                    <h4 style={{ color: "#00e5ff", fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px", borderBottom: "1px solid #2a2a4a", paddingBottom: 6 }}>
                      {getCategoryLabel(category)}
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {configItems.filter(c => c.category === category).map(item => {
                        const edited = editedConfig[item.key]
                        const hasChanges = edited !== undefined && edited !== item.value
                        const isSaving = savingConfig === item.key
                        return (
                          <div key={item.key} style={{
                            padding: "8px 10px",
                            background: "rgba(255,255,255,0.03)",
                            border: hasChanges ? "1px solid rgba(0,229,255,0.4)" : "1px solid #2a2a4a",
                            borderRadius: 6
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 11, color: "#ccc", fontWeight: 600 }}>{item.label}</span>
                              <span style={{ fontSize: 9, color: "#444", fontFamily: "monospace" }}>{item.key}</span>
                            </div>
                            {item.description && (
                              <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>{item.description}</div>
                            )}
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                value={edited !== undefined ? edited : item.value}
                                onChange={(e) => setEditedConfig(prev => ({ ...prev, [item.key]: e.target.value }))}
                                style={{
                                  flex: 1,
                                  padding: "5px 8px",
                                  borderRadius: 4,
                                  border: hasChanges ? "1px solid rgba(0,229,255,0.4)" : "1px solid #2a2a4a",
                                  background: "#111122",
                                  color: "#fff",
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  outline: "none"
                                }}
                              />
                              {hasChanges && (
                                <>
                                  <button
                                    onClick={() => handleSaveConfig(item)}
                                    disabled={isSaving}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 4,
                                      border: "none",
                                      background: isSaving ? "#2a2a4a" : "#00e5ff",
                                      color: isSaving ? "#666" : "#000",
                                      fontSize: 10,
                                      fontWeight: 700,
                                      cursor: isSaving ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    {isSaving ? "..." : "Save"}
                                  </button>
                                  <button
                                    onClick={() => setEditedConfig(prev => { const n = { ...prev }; delete n[item.key]; return n })}
                                    style={{
                                      padding: "4px 6px",
                                      borderRadius: 4,
                                      border: "1px solid #2a2a4a",
                                      background: "transparent",
                                      color: "#888",
                                      fontSize: 10,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center"
                                    }}
                                  >
                                    <Icon name="x" size={10} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'channels' && (
            <div>
              {loadingChannels ? (
                <div style={{ textAlign: "center", padding: 20, color: "#555" }}>Loading...</div>
              ) : (
                <>
                  {/* Add Country */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Add Country</h4>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input
                        value={newCountryName}
                        onChange={(e) => setNewCountryName(e.target.value)}
                        placeholder="Country name"
                        style={{ flex: 2, padding: "6px 10px", borderRadius: 6, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 12, outline: "none" }}
                      />
                      <input
                        value={newCountryFlag}
                        onChange={(e) => setNewCountryFlag(e.target.value)}
                        placeholder="Flag"
                        style={{ width: 48, padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" }}
                      />
                      <input
                        value={newCountryCode}
                        onChange={(e) => setNewCountryCode(e.target.value)}
                        placeholder="Code"
                        style={{ width: 48, padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" }}
                      />
                      <button
                        onClick={handleAddCountry}
                        disabled={!newCountryName.trim() || addingCountry}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "none",
                          background: newCountryName.trim() ? "rgba(0,229,255,0.2)" : "#2a2a4a",
                          color: newCountryName.trim() ? "#00e5ff" : "#555",
                          fontSize: 11, fontWeight: 600, cursor: newCountryName.trim() ? "pointer" : "not-allowed"
                        }}
                      >
                        {addingCountry ? "..." : "Add"}
                      </button>
                    </div>
                    {countries.length > 0 && (
                      <div style={{ maxHeight: 120, overflow: "auto", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 6, border: "1px solid #2a2a4a" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {countries.map(c => (
                            <span key={c.id} style={{ fontSize: 10, color: "#888", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                              {c.flag_emoji || ''} {c.name} {c.code ? `(${c.code})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Channel */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Add Channel</h4>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <select
                        value={newChannelCountry}
                        onChange={(e) => setNewChannelCountry(e.target.value)}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 12, outline: "none" }}
                      >
                        <option value="">Select country...</option>
                        {countries.map(c => (
                          <option key={c.id} value={c.id}>{c.flag_emoji || ''} {c.name}</option>
                        ))}
                      </select>
                      <input
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder="Channel name"
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 12, outline: "none" }}
                      />
                      <button
                        onClick={handleAddChannel}
                        disabled={!newChannelCountry || !newChannelName.trim() || addingChannel}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "none",
                          background: newChannelCountry && newChannelName.trim() ? "rgba(0,229,255,0.2)" : "#2a2a4a",
                          color: newChannelCountry && newChannelName.trim() ? "#00e5ff" : "#555",
                          fontSize: 11, fontWeight: 600, cursor: newChannelCountry && newChannelName.trim() ? "pointer" : "not-allowed"
                        }}
                      >
                        {addingChannel ? "..." : "Add"}
                      </button>
                    </div>
                    {channels.length > 0 && (
                      <div style={{ maxHeight: 160, overflow: "auto", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8, border: "1px solid #2a2a4a" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {channels.map(ch => (
                            <div key={ch.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#888", fontFamily: "monospace", padding: "2px 4px" }}>
                              <span>{ch.countries?.name || '?'} - {ch.channel_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Blocked Broadcasts */}
                  <div>
                    <h4 style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>
                      Blocked Broadcasts ({blockedBroadcasts.length})
                    </h4>
                    {blockedBroadcasts.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 16, color: "#555", fontSize: 11 }}>
                        No blocked broadcasts
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {blockedBroadcasts.map(b => (
                          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a4a", borderRadius: 6 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#ccc", marginBottom: 2 }}>
                                {b.country} - {b.channel}
                              </div>
                              <div style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
                                {b.events ? (b.events.home && b.events.away ? `${b.events.home} vs ${b.events.away}` : b.events.event_name || b.events.league || 'Event') : b.event_id}
                                {' · '}{b.reason}
                                {' · '}{new Date(b.blocked_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnblock(b.id)}
                              style={{
                                padding: "4px 10px", borderRadius: 4, border: "none",
                                background: "rgba(76,175,80,0.15)", color: "#4caf50",
                                fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0
                              }}
                            >
                              Unblock
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
          {showScrollHint && (
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 32,
              background: "linear-gradient(transparent, #1a1a2e)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 4,
              pointerEvents: "none",
            }}>
              <Icon name="chevDown" size={14} color="#666" />
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Broadcasts Modal */}
      {/* Confirm Delete Events Modal */}
      {showDeleteEventsConfirm && (
        <ConfirmModal
          onClose={() => setShowDeleteEventsConfirm(false)}
          onConfirm={handleBulkDeleteEvents}
          title="Delete Events"
          message={`Are you sure you want to delete ${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''}? This will also delete all associated broadcasts and votes. This action cannot be undone.`}
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
    </>
  )
}
