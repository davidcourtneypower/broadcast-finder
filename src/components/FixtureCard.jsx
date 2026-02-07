import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { BroadcastPill } from './BroadcastPill'
import { getTimezoneAbbreviation } from '../utils/timeFormatting'

export const FixtureCard = ({ match, user, onVote, onRequestAuth, onAddBroadcast, onDeleteBroadcast, isAdmin, getSportColors, getFlag, formatTime, getStatus, getRelative, preferences }) => {
  const [expanded, setExpanded] = useState(false)
  const [relativeTime, setRelativeTime] = useState('')
  const [sortBy, setSortBy] = useState('votes')
  const [sortAsc, setSortAsc] = useState(false)
  const col = getSportColors ? getSportColors(match.sport) : { accent: "#00e5ff", bg: "rgba(0,229,255,0.12)", glow: "rgba(0,229,255,0.25)" }

  // Format match time in user's timezone
  const { time: displayTime, dayLabel, fullDateTime } = formatTime(match.match_date, match.match_time)

  // Use DB-driven status (set by livescore edge function, with starting-soon overlay from App.jsx)
  const matchStatus = match.status || 'upcoming'
  const isLive = matchStatus === "live"

  // Get timezone abbreviation for display
  const tzAbbr = getTimezoneAbbreviation(preferences.timezone)

  // Update relative time every minute
  useEffect(() => {
    const updateRelativeTime = () => {
      setRelativeTime(getRelative(match.match_date, match.match_time))
    }

    updateRelativeTime()
    const timer = setInterval(updateRelativeTime, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [match.match_date, match.match_time, getRelative])

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
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#7c4dff", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>STARTING SOON</span>
        )}
        {matchStatus === "finished" && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#666", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>FINISHED</span>
        )}
        {matchStatus === "upcoming" && (
          <span style={{ fontSize: 9, fontWeight: 600, color: "#26a69a", background: "rgba(38,166,154,0.15)", padding: "1px 5px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", flexShrink: 0 }}>UPCOMING</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", gap: 8 }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.home}</span>
        <span style={{ color: "#555", fontSize: 12, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>VS</span>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.away}</span>
      </div>
      {/* Time display with timezone conversion */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 12px 8px", flexWrap: "wrap" }}>
        <Icon name="clock" size={10} color="#555" />
        <span
          style={{ fontSize: 11, color: "#fff", fontFamily: "monospace", fontWeight: 600 }}
          title={`${fullDateTime} (${preferences.timezone})`}
        >
          {displayTime}
        </span>
        <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
          {tzAbbr}
        </span>
        <span style={{ color: "#333", fontSize: 10 }}>·</span>
        <span style={{ fontSize: 10, color: "#888" }}>{dayLabel}</span>
        {/* Relative time countdown/indicator */}
        {relativeTime && matchStatus !== "finished" && (
          <>
            <span style={{ color: "#333", fontSize: 10 }}>·</span>
            <span
              style={{
                fontSize: 10,
                color: matchStatus === "live" ? "#4caf50" : matchStatus === "starting-soon" ? "#7c4dff" : "#26a69a",
                fontFamily: "monospace",
                fontWeight: 600
              }}
            >
              {matchStatus === "live" ? "LIVE NOW" : relativeTime}
            </span>
          </>
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.03)",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          color: "#aaa",
          fontSize: 11,
          padding: "6px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "monospace"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="wifi" size={11} color="#555" />
          {expanded ? "Hide Broadcasts" : "See Broadcasts"}
        </span>
        <Icon name={expanded ? "chevUp" : "chevDown"} size={12} />
      </button>
      {expanded && (
        <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {match.broadcasts && match.broadcasts.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 2 }}>Sort</span>
              {[
                { key: 'votes', label: 'Votes' },
                { key: 'country', label: 'Country' },
                { key: 'channel', label: 'Channel' },
              ].map(opt => {
                const isActive = sortBy === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      if (isActive) {
                        setSortAsc(prev => !prev)
                      } else {
                        setSortBy(opt.key)
                        setSortAsc(opt.key === 'votes' ? false : true)
                      }
                    }}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: `1px solid ${isActive ? "rgba(0,229,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                      background: isActive ? "rgba(0,229,255,0.1)" : "rgba(255,255,255,0.03)",
                      color: isActive ? "#00e5ff" : "#666",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {opt.label}
                    {isActive && <Icon name={sortAsc ? "sortDesc" : "sortAsc"} size={10} color="#00e5ff" />}
                  </button>
                )
              })}
            </div>
          )}
          {match.broadcasts && match.broadcasts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {[...match.broadcasts].sort((a, b) => {
                let result
                if (sortBy === 'country') {
                  result = (a.country || '').localeCompare(b.country || '')
                } else if (sortBy === 'channel') {
                  result = (a.channel || '').localeCompare(b.channel || '')
                } else {
                  const aNet = (a.voteStats?.up || 0) - (a.voteStats?.down || 0)
                  const bNet = (b.voteStats?.up || 0) - (b.voteStats?.down || 0)
                  result = bNet - aNet
                }
                return sortAsc ? -result : result
              }).map(b => (
                <BroadcastPill
                  key={b.id}
                  broadcast={b}
                  voteStats={b.voteStats || {}}
                  user={user}
                  onVote={onVote}
                  onRequestAuth={onRequestAuth}
                  onDelete={onDeleteBroadcast}
                  isAdmin={isAdmin}
                  getFlag={getFlag}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#555" }}>No broadcast info yet</div>
            </div>
          )}
          {user ? (
            <button
              onClick={() => onAddBroadcast(match)}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 6,
                border: `1px solid ${col.accent}40`,
                background: col.bg,
                color: col.accent,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4
              }}
            >
              <Icon name="plus" size={12} /> Add Broadcast
            </button>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <button
                onClick={onRequestAuth}
                style={{
                  color: "#00e5ff",
                  fontSize: 11,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                Sign in to add broadcast
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
