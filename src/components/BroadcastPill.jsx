import React from 'react'
import { Icon } from './Icon'
import { getFlag } from '../utils/helpers'

export const BroadcastPill = ({ broadcast, voteStats, user, onVote, onRequestAuth, onDelete }) => {
  const upCount = voteStats.up || 0
  const downCount = voteStats.down || 0
  const myVote = voteStats.myVote

  // Check if current user is the creator
  const isCreator = user && broadcast.created_by_uuid === user.id

  // Determine source type and styling
  const isAutomatic = broadcast.source && broadcast.source !== 'user'
  const sourceLabel = isAutomatic ? '🤖 Auto' : '👤 User'
  const sourceColor = isAutomatic ? '#00e5ff' : '#9c27b0'
  const sourceBg = isAutomatic ? 'rgba(0,229,255,0.12)' : 'rgba(156,39,176,0.12)'

  const handleVote = (dir) => {
    if (!user) {
      onRequestAuth()
      return
    }
    // Prevent creator from changing their vote
    if (isCreator) {
      return
    }
    onVote(broadcast.id, dir)
  }

  const handleDelete = () => {
    if (window.confirm('Delete this broadcast?')) {
      onDelete(broadcast.id)
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>{getFlag(broadcast.country)}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "#ccc", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{broadcast.channel}</span>
            <span
              style={{
                fontSize: 8,
                fontFamily: "monospace",
                color: sourceColor,
                background: sourceBg,
                padding: "1px 4px",
                borderRadius: 3,
                fontWeight: 600,
                letterSpacing: 0.3,
                flexShrink: 0
              }}
              title={isAutomatic ? `Auto-scraped from ${broadcast.source}` : 'User contributed'}
            >
              {sourceLabel}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {isCreator ? (
          <>
            {/* Creator sees their locked vote and delete button */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(76,175,80,0.2)", border: "1px solid rgba(76,175,80,0.5)", borderRadius: 4, padding: "2px 6px", color: "#81c784", opacity: 0.7 }}>
              <Icon name="thumbUp" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{upCount}</span>
            </div>
            <button onClick={handleDelete} style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.4)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: "#e57373" }} title="Delete this broadcast">
              <Icon name="x" size={11} />
            </button>
          </>
        ) : (
          <>
            {/* Non-creators can vote */}
            <button onClick={() => handleVote("up")} style={{ display: "flex", alignItems: "center", gap: 3, background: myVote === "up" ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.03)", border: myVote === "up" ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: myVote === "up" ? "#81c784" : "#777" }}>
              <Icon name="thumbUp" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{upCount}</span>
            </button>
            <button onClick={() => handleVote("down")} style={{ display: "flex", alignItems: "center", gap: 3, background: myVote === "down" ? "rgba(244,67,54,0.2)" : "rgba(255,255,255,0.03)", border: myVote === "down" ? "1px solid rgba(244,67,54,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: myVote === "down" ? "#e57373" : "#777" }}>
              <Icon name="thumbDown" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{downCount}</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
