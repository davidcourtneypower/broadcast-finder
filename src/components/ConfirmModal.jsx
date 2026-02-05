import React from 'react'
import { Icon } from './Icon'

export const ConfirmModal = ({ onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", confirmColor = "#e53935" }) => {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 380, border: "1px solid #2a2a4a", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" }}>
          <Icon name="x" size={16} />
        </button>

        <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="shield" size={16} color={confirmColor} />
          {title}
        </h3>

        <p style={{ color: "#aaa", margin: "0 0 20px", fontSize: 13, lineHeight: 1.6 }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
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
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: confirmColor,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
