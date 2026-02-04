import React, { useState } from 'react'
import { Icon } from './Icon'
import { getFlag } from '../utils/helpers'
import { CHANNELS_BY_COUNTRY, COUNTRIES } from '../config/constants'

export const AddBroadcastModal = ({ onClose, match, onAdd, user }) => {
  const [selectedCountry, setSelectedCountry] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")
  const [adding, setAdding] = useState(false)
  const availableChannels = selectedCountry ? CHANNELS_BY_COUNTRY[selectedCountry] : []
  
  const handleAdd = async () => {
    if (!selectedCountry || !selectedChannel) return
    setAdding(true)
    await onAdd(match.id, selectedCountry, selectedChannel, user)
    setAdding(false)
    onClose()
  }
  
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 380, border: "1px solid #2a2a4a", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" }}>
          <Icon name="x" size={16} />
        </button>
        <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 16 }}>Add Broadcast Info</h3>
        <div style={{ marginBottom: 12, padding: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{match.league}</div>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{match.home} vs {match.away}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Country/Region</label>
          <select value={selectedCountry} onChange={(e) => { setSelectedCountry(e.target.value); setSelectedChannel("") }} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 13, outline: "none" }}>
            <option value="">Select country...</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{getFlag(c)} {c}</option>)}
          </select>
        </div>
        {selectedCountry && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Channel/Service</label>
            <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 13, outline: "none" }}>
              <option value="">Select channel...</option>
              {availableChannels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
          </div>
        )}
        <button onClick={handleAdd} disabled={!selectedCountry || !selectedChannel || adding} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: selectedCountry && selectedChannel && !adding ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: selectedCountry && selectedChannel && !adding ? "pointer" : "not-allowed" }}>
          {adding ? "Adding..." : "Add Broadcast"}
        </button>
      </div>
    </div>
  )
}
