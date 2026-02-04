import React, { useState } from 'react'
import { Icon } from './Icon'
import { supabase } from '../config/supabase'

export const AdminImportModal = ({ onClose, onImport }) => {
  const [jsonData, setJsonData] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [importing, setImporting] = useState(false)
  
  const handleImport = async () => {
    setImporting(true)
    setError("")
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
        setTimeout(() => { onImport(); onClose() }, 1500)
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setImporting(false)
  }
  
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 500, border: "1px solid #2a2a4a", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#888", cursor: "pointer" }}>
          <Icon name="x" size={16} />
        </button>
        <h3 style={{ color: "#fff", margin: "0 0 12px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="upload" size={16} color="#00e5ff" /> Import to Database
        </h3>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>Paste the parsed matches JSON array. This will sync to Supabase.</div>
        <textarea value={jsonData} onChange={(e) => { setJsonData(e.target.value); setError(""); setSuccess("") }} placeholder='[{"id":"123","sport":"Football or Basketball","league":"Premier League or NBA","home":"Team A","away":"Team B","date":"2026-02-04","time":"20:00","country":"UK","status":"upcoming","popularity":85}]' style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 11, fontFamily: "monospace", outline: "none", resize: "none", marginBottom: 12 }} />
        {error && <div style={{ padding: 8, marginBottom: 12, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 6, color: "#e57373", fontSize: 11 }}>{error}</div>}
        {success && <div style={{ padding: 8, marginBottom: 12, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 6, color: "#81c784", fontSize: 11 }}>{success}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #2a2a4a", background: "rgba(255,255,255,0.05)", color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleImport} disabled={!jsonData.trim() || importing} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: jsonData.trim() && !importing ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: jsonData.trim() && !importing ? "pointer" : "not-allowed" }}>
            {importing ? "Importing..." : "Import to Supabase"}
          </button>
        </div>
      </div>
    </div>
  )
}
