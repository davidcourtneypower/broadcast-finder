import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { getUserPreferences, updateUserPreferences } from '../utils/userProfiles'

// Common timezones grouped by region
const TIMEZONE_GROUPS = {
  'Americas': [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Toronto', label: 'Toronto' },
    { value: 'America/Mexico_City', label: 'Mexico City' },
    { value: 'America/Sao_Paulo', label: 'São Paulo' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  ],
  'Europe': [
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)' },
    { value: 'Europe/Rome', label: 'Rome (CET)' },
    { value: 'Europe/Athens', label: 'Athens (EET)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Europe/Istanbul', label: 'Istanbul' },
  ],
  'Asia & Pacific': [
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT)' },
  ],
  'Africa & Middle East': [
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
  ],
}

export const UserSettingsModal = ({ onClose, onSave, user, headerRef }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState({
    timezone: 'UTC',
    timeFormat: '24h',
    dateFormat: 'YYYY-MM-DD',
  })

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return

      const prefs = await getUserPreferences(user.id)
      if (prefs) {
        setPreferences({
          timezone: prefs.timezone || 'UTC',
          timeFormat: prefs.timeFormat || '24h',
          dateFormat: prefs.dateFormat || 'YYYY-MM-DD',
        })
      }
      setLoading(false)
    }

    loadPreferences()
  }, [user])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    const { error } = await updateUserPreferences(user.id, preferences)

    if (error) {
      console.error('Error saving preferences:', error)
      alert('Failed to save preferences')
      setSaving(false)
    } else {
      // Call onSave callback if provided, otherwise just close
      if (onSave) {
        onSave()
      } else {
        onClose()
      }
      setSaving(false)
    }
  }

  const handleTimezoneChange = (e) => {
    setPreferences({ ...preferences, timezone: e.target.value })
  }

  const handleTimeFormatChange = (e) => {
    setPreferences({ ...preferences, timeFormat: e.target.value })
  }

  const detectBrowserTimezone = () => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setPreferences({ ...preferences, timezone: browserTimezone })
  }

  const headerHeight = headerRef?.current?.offsetHeight || 56

  return (
    <>
      <div className={`filter-panel-backdrop ${isVisible ? 'visible' : ''}`} onClick={handleClose} />
      <div
        className={`filter-panel ${isVisible ? 'visible' : ''}`}
        style={{
          top: headerHeight,
          maxWidth: 440,
          width: "95%",
          margin: "0 auto",
          background: "#1a1a2e",
          borderRadius: "0 0 16px 16px",
          borderTop: "none",
          border: "1px solid #2a2a4a",
          borderTopColor: "transparent",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: "#fff", margin: "0 0 4px", fontSize: 18 }}>Settings</h2>
            <p style={{ color: "#666", margin: 0, fontSize: 12 }}>Customize your experience</p>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#666" }}>
            Loading preferences...
          </div>
        ) : (
          <>
            {/* Timezone Setting */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Timezone
              </label>
              <button
                onClick={detectBrowserTimezone}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(0,229,255,0.4)",
                  background: "rgba(0,229,255,0.15)",
                  color: "#00e5ff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <Icon name="clock" size={13} />
                Auto-Detect from Device
              </button>

              <div style={{ marginBottom: 8 }}>
                <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>
                  Or select manually:
                </div>
                <select
                  value={preferences.timezone}
                  onChange={handleTimezoneChange}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #2a2a4a",
                    background: "#111122",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  {Object.entries(TIMEZONE_GROUPS).map(([region, timezones]) => (
                    <optgroup key={region} label={region} style={{ background: "#1a1a2e", color: "#aaa" }}>
                      {timezones.map(tz => (
                        <option key={tz.value} value={tz.value} style={{ background: "#1a1a2e", color: "#fff" }}>
                          {tz.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="Other" style={{ background: "#1a1a2e", color: "#aaa" }}>
                    <option value="UTC" style={{ background: "#1a1a2e", color: "#fff" }}>UTC</option>
                  </optgroup>
                </select>
              </div>
              <div style={{
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)"
              }}>
                <div style={{ color: "#666", fontSize: 10, marginBottom: 2 }}>Currently Selected:</div>
                <div style={{ color: "#00e5ff", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
                  {preferences.timezone}
                </div>
              </div>
            </div>

            {/* Time Format Setting */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#aaa", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Time Format
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setPreferences({ ...preferences, timeFormat: '12h' })}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: preferences.timeFormat === '12h' ? "1px solid rgba(0,229,255,0.5)" : "1px solid #2a2a4a",
                    background: preferences.timeFormat === '12h' ? "rgba(0,229,255,0.15)" : "#111122",
                    color: preferences.timeFormat === '12h' ? "#00e5ff" : "#aaa",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  12-hour (3:00 PM)
                </button>
                <button
                  onClick={() => setPreferences({ ...preferences, timeFormat: '24h' })}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: preferences.timeFormat === '24h' ? "1px solid rgba(0,229,255,0.5)" : "1px solid #2a2a4a",
                    background: preferences.timeFormat === '24h' ? "rgba(0,229,255,0.15)" : "#111122",
                    color: preferences.timeFormat === '24h' ? "#00e5ff" : "#aaa",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  24-hour (15:00)
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "1px solid #2a2a4a",
                  background: "rgba(255,255,255,0.03)",
                  color: "#aaa",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "none",
                  background: saving ? "#2a2a4a" : "linear-gradient(135deg,#00e5ff,#7c4dff)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  )
}
