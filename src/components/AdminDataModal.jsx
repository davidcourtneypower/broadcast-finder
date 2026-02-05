import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { supabase } from '../config/supabase'

export const AdminDataModal = ({ onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('import')
  const [jsonData, setJsonData] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [importing, setImporting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [selectedDates, setSelectedDates] = useState(['today', 'tomorrow'])
  const [selectedSport, setSelectedSport] = useState('football')
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [fetchResult, setFetchResult] = useState(null)
  const [broadcasts, setBroadcasts] = useState([])
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false)
  const [selectedBroadcasts, setSelectedBroadcasts] = useState([])
  const [deletingBroadcasts, setDeletingBroadcasts] = useState(false)

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

      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-fixtures`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sport: selectedSport,
          dates: selectedDates,
          trigger: 'manual'
        })
      })

      const result = await response.json()

      if (result.success || result.status === 'partial') {
        setFetchResult(result)
        setSuccess(`Successfully fetched ${result.fetched} fixtures and updated ${result.updated} matches!`)
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
      const { data, error } = await supabase
        .from('api_fetch_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setLogs(data || [])
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
        .limit(100)

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
    if (selectedBroadcasts.length === broadcasts.length) {
      setSelectedBroadcasts([])
    } else {
      setSelectedBroadcasts(broadcasts.map(b => b.id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedBroadcasts.length === 0) return

    const confirmed = window.confirm(
      `Delete ${selectedBroadcasts.length} broadcast${selectedBroadcasts.length > 1 ? 's' : ''}? This action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingBroadcasts(true)
    try {
      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .in('id', selectedBroadcasts)

      if (error) throw error

      setSuccess(`Successfully deleted ${selectedBroadcasts.length} broadcast${selectedBroadcasts.length > 1 ? 's' : ''}`)
      setSelectedBroadcasts([])
      await loadBroadcasts()
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) {
      setError('Error deleting broadcasts: ' + e.message)
      setTimeout(() => setError(""), 3000)
    }
    setDeletingBroadcasts(false)
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    } else if (activeTab === 'broadcasts') {
      loadBroadcasts()
    }
  }, [activeTab])

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
                Manually fetch fixtures from API-Sports.io. This will retrieve all fixtures for the selected sport and dates with a 15-second timeout.
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600 }}>Select Sport</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {['football', 'basketball'].map(sport => {
                    const selected = selectedSport === sport
                    return (
                      <button
                        key={sport}
                        onClick={() => setSelectedSport(sport)}
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
                          textTransform: "capitalize"
                        }}
                      >
                        {sport}
                      </button>
                    )
                  })}
                </div>
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
                    • Fetched: {fetchResult.fetched} fixtures<br />
                    • Updated: {fetchResult.updated} matches<br />
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
                  {fetching ? "Fetching..." : "Fetch from API-Sports.io"}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'broadcasts' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {broadcasts.length} broadcast{broadcasts.length !== 1 ? 's' : ''} total
                  {selectedBroadcasts.length > 0 && ` • ${selectedBroadcasts.length} selected`}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {selectedBroadcasts.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
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
                  {broadcasts.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 4 }}>
                      <button
                        onClick={toggleSelectAll}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: selectedBroadcasts.length === broadcasts.length ? "2px solid #00e5ff" : "2px solid #444",
                          background: selectedBroadcasts.length === broadcasts.length ? "#00e5ff" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        {selectedBroadcasts.length === broadcasts.length && <Icon name="check" size={12} color="#000" />}
                      </button>
                      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>Select All</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                    {broadcasts.map(broadcast => {
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
                              Added: {new Date(broadcast.created_at).toLocaleString()}
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

          {activeTab === 'logs' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#888" }}>Recent operations (last 20)</div>
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
                            {log.fetch_type}
                          </span>
                        </div>
                        <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5, fontFamily: "monospace" }}>
                        Date: {log.fetch_date} | Sport: {log.sport}<br />
                        Fetched: {log.matches_fetched} | Updated: {log.matches_updated}
                        {log.api_response_time_ms && ` | Time: ${log.api_response_time_ms}ms`}
                      </div>
                      {log.error_message && (
                        <div style={{ fontSize: 9, color: "#e57373", marginTop: 6, fontFamily: "monospace", background: "rgba(244,67,54,0.08)", padding: 6, borderRadius: 4 }}>
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
