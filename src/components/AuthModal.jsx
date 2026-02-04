import React, { useState } from 'react'
import { Icon } from './Icon'

export const AuthModal = ({ onClose, onLogin }) => {
  const [name, setName] = useState("")
  
  const handleSubmit = () => {
    if (name.trim()) onLogin(name.trim())
  }
  
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 32, width: "90%", maxWidth: 360, border: "1px solid #2a2a4a", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" }}>
          <Icon name="x" size={18} />
        </button>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#00e5ff,#b388ff)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Icon name="tv" size={28} color="#fff" />
          </div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 20 }}>Sign In</h2>
          <p style={{ color: "#666", margin: "6px 0 0", fontSize: 13 }}>Join the community</p>
        </div>
        <label style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>Display Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }} placeholder="e.g. SportsFan42" style={{ display: "block", width: "100%", marginTop: 6, marginBottom: 16, padding: "10px 14px", borderRadius: 8, border: "1px solid #2a2a4a", background: "#111122", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        <button disabled={!name.trim()} onClick={handleSubmit} style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: name.trim() ? "linear-gradient(135deg,#00e5ff,#7c4dff)" : "#2a2a4a", color: "#fff", fontSize: 15, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="logIn" size={16} /> Sign In
        </button>
      </div>
    </div>
  )
}
