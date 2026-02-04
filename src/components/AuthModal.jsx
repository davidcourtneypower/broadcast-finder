import React, { useState } from 'react'
import { Icon } from './Icon'

export const AuthModal = ({ onClose, signInWithGoogle }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)

    const { error } = await signInWithGoogle()

    if (error) {
      console.error('Error signing in with Google:', error)
      setError(error.message)
      setLoading(false)
    } else {
      // OAuth will redirect, so we keep loading state
      // The modal will close automatically when auth state changes
    }
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
          <p style={{ color: "#666", margin: "6px 0 0", fontSize: 13 }}>Join the community to vote and add broadcasts</p>
        </div>

        {error && (
          <div style={{ background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ color: "#ef5350", margin: 0, fontSize: 12 }}>{error}</p>
          </div>
        )}

        <button
          disabled={loading}
          onClick={handleGoogleSignIn}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: loading ? "#2a2a4a" : "#fff",
            color: loading ? "#666" : "#333",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "all 0.2s"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p style={{ color: "#555", margin: "16px 0 0", fontSize: 11, textAlign: "center", lineHeight: 1.4 }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
