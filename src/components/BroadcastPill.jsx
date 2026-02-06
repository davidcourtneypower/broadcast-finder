import React from 'react'
import { Icon } from './Icon'
import { getFlag } from '../utils/helpers'

export const BroadcastPill = ({ broadcast, voteStats, user, onVote, onRequestAuth, onDelete, isAdmin }) => {
  const upCount = voteStats.up || 0
  const downCount = voteStats.down || 0
  const myVote = voteStats.myVote

  // Check if current user is the creator
  const isCreator = user && broadcast.created_by_uuid === user.id

  // Can delete if user is creator or admin
  const canDelete = isCreator || isAdmin

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Top row: Country flag, name, and channel */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{getFlag(broadcast.country)}</span>
        <span style={{ color: "#aaa", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{broadcast.country}</span>
        <span style={{ color: "#444" }}>·</span>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{broadcast.channel}</span>
      </div>

      {/* Bottom row: Source indicator on left, vote buttons and delete button on right */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10,
            color: sourceColor,
            background: sourceBg,
            padding: "2px 6px",
            borderRadius: 3,
            fontWeight: 500
          }}
        >
          {sourceLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isCreator ? (
          <>
            {/* Creator sees their locked upvote and downvote count (non-interactive) */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(76,175,80,0.2)", border: "1px solid rgba(76,175,80,0.5)", borderRadius: 4, padding: "3px 7px", color: "#81c784", opacity: 0.7 }} title="You automatically upvoted your broadcast">
              <Icon name="thumbUp" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{upCount}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 7px", color: "#555", opacity: 0.5 }}>
              <Icon name="thumbDown" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{downCount}</span>
            </div>
          </>
        ) : (
          <>
            {/* Non-creators can vote - click same button again to remove vote */}
            <button
              onClick={() => handleVote("up")}
              style={{ display: "flex", alignItems: "center", gap: 3, background: myVote === "up" ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.03)", border: myVote === "up" ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 7px", cursor: "pointer", color: myVote === "up" ? "#81c784" : "#777" }}
              title={myVote === "up" ? "Click again to remove upvote" : "Upvote this broadcast"}
            >
              <Icon name="thumbUp" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{upCount}</span>
            </button>
            <button
              onClick={() => handleVote("down")}
              style={{ display: "flex", alignItems: "center", gap: 3, background: myVote === "down" ? "rgba(244,67,54,0.2)" : "rgba(255,255,255,0.03)", border: myVote === "down" ? "1px solid rgba(244,67,54,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 7px", cursor: "pointer", color: myVote === "down" ? "#e57373" : "#777" }}
              title={myVote === "down" ? "Click again to remove downvote" : "Downvote this broadcast"}
            >
              <Icon name="thumbDown" size={11} />
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>{downCount}</span>
            </button>
          </>
        )}
          {/* Delete button for creators or admins */}
          {canDelete && (
            <button onClick={handleDelete} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.4)", borderRadius: 4, padding: "3px 7px", cursor: "pointer", color: "#e57373", minWidth: 30 }} title="Delete this broadcast">
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
