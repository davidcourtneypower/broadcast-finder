import React from 'react'
import { Icon } from './Icon'
import { getFlag } from '../utils/helpers'

export const BroadcastPill = ({ broadcast, voteStats, user, onVote, onRequestAuth }) => {
  const upCount = voteStats.up || 0
  const downCount = voteStats.down || 0
  const myVote = voteStats.myVote
  
  const handleVote = (dir) => {
    if (!user) {
      onRequestAuth()
      return
    }
    onVote(broadcast.id, dir)
  }
  
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>{getFlag(broadcast.country)}</span>
        <span style={{ color: "#ccc", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{broadcast.channel}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button onClick={() => handleVote("up")} style={{ display: "flex", alignItems: "center", gap: 3, background: myVote === "up" ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.03)", border: myVote === "up" ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: myVote === "up" ? "#81c784" : "#777" }}>
          <Icon name="thumbUp" size={11} />
          <span style={{ fontSize: 11, fontFamily: "monospace" }}>{upCount}</span>
        </button>
        <button onClick={() => handleVote("down")} style={{ display: "flex", alignItems: "center", gap: 3, background: myVote === "down" ? "rgba(244,67,54,0.2)" : "rgba(255,255,255,0.03)", border: myVote === "down" ? "1px solid rgba(244,67,54,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: myVote === "down" ? "#e57373" : "#777" }}>
          <Icon name="thumbDown" size={11} />
          <span style={{ fontSize: 11, fontFamily: "monospace" }}>{downCount}</span>
        </button>
      </div>
    </div>
  )
}
