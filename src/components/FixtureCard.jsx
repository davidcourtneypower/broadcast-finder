import React, { useState } from 'react'
import { Icon } from './Icon'
import { BroadcastPill } from './BroadcastPill'
import { getDateLabel } from '../utils/helpers'
import { SPORT_COLORS } from '../config/constants'
import { getSportConfig } from '../config/sports'

export const FixtureCard = ({ match, user, onVote, onRequestAuth, onAddBroadcast }) => {
  const [expanded, setExpanded] = useState(false)
  const col = SPORT_COLORS[match.sport] || { accent: "#00e5ff", bg: "rgba(0,229,255,0.12)", glow: "rgba(0,229,255,0.25)" }

  // Calculate status based on current time vs match time (sport-specific)
  const getMatchStatus = () => {
    try {
      const matchDateTime = new Date(`${match.match_date}T${match.match_time}:00`)
      const now = new Date()
      const diffMinutes = (now - matchDateTime) / (1000 * 60)

      // Get sport-specific configuration
      const config = getSportConfig(match.sport)
      const matchDuration = config?.matchDuration || 180 // Default 180 minutes if no config
      const pregameWindow = 15 // 15 minutes for "Starting Soon"

      // Status logic with "Starting Soon":
      // Upcoming: More than 15 minutes before match start
      // Starting Soon: 0-15 minutes before match start
      // Live: From match start to match duration after
      // Finished: After match duration

      if (diffMinutes < -pregameWindow) return "upcoming"
      if (diffMinutes >= -pregameWindow && diffMinutes < 0) return "starting-soon"
      if (diffMinutes >= 0 && diffMinutes <= matchDuration) return "live"
      return "finished"
    } catch (error) {
      console.error('Error calculating match status:', error)
      return "upcoming"
    }
  }

  const matchStatus = getMatchStatus()
  const isLive = matchStatus === "live"

  // Get icon name based on sport (lowercase)
  const sportIcon = match.sport ? match.sport.toLowerCase() : ''

  return (
    <div style={{ background: "#16162a", borderRadius: 10, border: `2px solid ${col.accent}`, overflow: "hidden", boxShadow: isLive ? `0 0 16px ${col.glow}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 11px 4px", gap: 8, background: col.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Icon name={sportIcon} size={12} color={col.accent} />
          <span style={{ fontSize: 10, color: col.accent, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{match.sport}</span>
          <span style={{ color: "#444", fontSize: 10 }}>·</span>
          <span style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.league}</span>
        </div>
        {/* Status Badge */}
        {matchStatus === "live" && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#e53935", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>LIVE</span>
        )}
        {matchStatus === "starting-soon" && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#ff9800", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>STARTING SOON</span>
        )}
        {matchStatus === "finished" && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#666", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>FINISHED</span>
        )}
        {matchStatus === "upcoming" && (
          <span style={{ fontSize: 9, fontWeight: 600, color: "#00e5ff", background: "rgba(0,229,255,0.15)", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>UPCOMING</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", gap: 8 }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.home}</span>
        <span style={{ color: "#555", fontSize: 12, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>VS</span>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.away}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 12px 8px" }}>
        <Icon name="clock" size={10} color="#555" />
        <span style={{ fontSize: 11, color: "#777", fontFamily: "monospace" }}>{match.match_time}</span>
        <span style={{ color: "#333", fontSize: 10 }}>·</span>
        <span style={{ fontSize: 10, color: "#555" }}>{getDateLabel(match.match_date)}</span>
      </div>
      <button onClick={() => setExpanded(!expanded)} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", color: "#aaa", fontSize: 11, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "monospace" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="wifi" size={11} color="#555" />
          {match.broadcasts && match.broadcasts.length > 0 ? `${expanded ? "Hide " : "Show "}${match.broadcasts.length} broadcast${match.broadcasts.length === 1 ? "" : "s"}` : "No broadcasts yet"}
        </span>
        <Icon name={expanded ? "chevUp" : "chevDown"} size={12} />
      </button>
      {expanded && (
        <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {match.broadcasts && match.broadcasts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {match.broadcasts.map(b => <BroadcastPill key={b.id} broadcast={b} voteStats={b.voteStats || {}} user={user} onVote={onVote} onRequestAuth={onRequestAuth} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0", marginBottom: 8 }}><div style={{ fontSize: 11, color: "#555" }}>No broadcast info yet</div></div>
          )}
          {user ? (
            <button onClick={() => onAddBroadcast(match)} style={{ width: "100%", padding: "8px 0", borderRadius: 6, border: "1px solid rgba(0,229,255,0.3)", background: "rgba(0,229,255,0.1)", color: "#00e5ff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Icon name="plus" size={12} /> Add Broadcast
            </button>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}><button onClick={onRequestAuth} style={{ color: "#00e5ff", fontSize: 11, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Sign in to add broadcast</button></div>
          )}
        </div>
      )}
    </div>
  )
}
