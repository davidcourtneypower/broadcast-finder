import React, { useState } from 'react'
import { Icon } from './Icon'
import { SPORT_COLORS } from '../config/constants'

export const FilterModal = ({ onClose, filters, onApply, allSports, matches }) => {
  const [localSports, setLocalSports] = useState(filters.sports || [])
  const [localCountries, setLocalCountries] = useState(filters.countries || [])
  const [localEvents, setLocalEvents] = useState(filters.events || [])
  const [localStatuses, setLocalStatuses] = useState(filters.statuses || [])

  // Filter countries based on selected sports
  const getFilteredCountries = () => {
    if (!matches || matches.length === 0 || localSports.length === 0) return []

    const filteredMatches = matches.filter(m => localSports.includes(m.sport))
    const countries = [...new Set(filteredMatches.map(m => m.country))].sort()
    return countries
  }

  // Filter events based on selected sports and countries
  const getFilteredEvents = () => {
    if (!matches || matches.length === 0 || localSports.length === 0) return []

    let filteredMatches = matches

    // Filter by selected sports
    if (localSports.length > 0) {
      filteredMatches = filteredMatches.filter(m => localSports.includes(m.sport))
    }

    // Filter by selected countries
    if (localCountries.length > 0) {
      filteredMatches = filteredMatches.filter(m => localCountries.includes(m.country))
    }

    // Extract unique leagues from filtered matches
    const leagues = [...new Set(filteredMatches.map(m => m.league))].sort()
    return leagues
  }

  const filteredCountries = getFilteredCountries()
  const filteredEvents = getFilteredEvents()
  
  const toggleSport = (sport) => {
    setLocalSports(prev => {
      const newSports = prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]

      // If no sports selected, clear countries and events
      if (newSports.length === 0) {
        setLocalCountries([])
        setLocalEvents([])
      } else if (matches) {
        // Clear country and event selections that won't be visible after sport filter change
        const sportFilteredMatches = matches.filter(m => newSports.includes(m.sport))
        const availableCountries = [...new Set(sportFilteredMatches.map(m => m.country))]
        setLocalCountries(prevCountries => prevCountries.filter(c => availableCountries.includes(c)))

        const availableEvents = [...new Set(sportFilteredMatches.map(m => m.league))]
        setLocalEvents(prevEvents => prevEvents.filter(e => availableEvents.includes(e)))
      }

      return newSports
    })
  }

  const toggleCountry = (country) => {
    setLocalCountries(prev => {
      const newCountries = prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
      // Clear event selections that won't be visible after country filter change
      if (matches) {
        const availableEvents = getFilteredEvents()
        setLocalEvents(prevEvents => prevEvents.filter(e => availableEvents.includes(e)))
      }
      return newCountries
    })
  }
  
  const toggleEvent = (event) => {
    setLocalEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event])
  }

  const toggleStatus = (status) => {
    setLocalStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])
  }

  const clearAll = () => {
    setLocalSports([])
    setLocalCountries([])
    setLocalEvents([])
    setLocalStatuses([])
  }

  const apply = () => {
    onApply({ sports: localSports, countries: localCountries, events: localEvents, statuses: localStatuses })
    onClose()
  }

  const activeCount = localSports.length + localCountries.length + localEvents.length + localStatuses.length
  
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 380, border: "1px solid #2a2a4a", position: "relative", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: "#fff", margin: 0, fontSize: 18 }}>Filters</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
          {/* Status Filter */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", marginBottom: 8 }}>
              Status
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { value: 'live', label: 'LIVE', color: '#e53935' },
                { value: 'starting-soon', label: 'STARTING SOON', color: '#ff9800' },
                { value: 'upcoming', label: 'UPCOMING', color: '#00e5ff' },
                { value: 'finished', label: 'FINISHED', color: '#666' }
              ].map(status => {
                const isSelected = localStatuses.includes(status.value)
                return (
                  <button
                    key={status.value}
                    onClick={() => toggleStatus(status.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? status.color : "#2a2a4a"}`,
                      background: isSelected ? `${status.color}22` : "#111122",
                      color: isSelected ? status.color : "#888",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: 0.5
                    }}
                  >
                    {status.label}
                  </button>
                )
              })}
            </div>
          </div>

          {allSports.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", marginBottom: 8 }}>
                Sport ({allSports.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {allSports.map(sport => {
                  const isSelected = localSports.includes(sport)
                  const col = SPORT_COLORS[sport] || { accent: "#00e5ff", bg: "rgba(0,229,255,0.12)" }
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleSport(sport)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${isSelected ? col.accent : "#2a2a4a"}`,
                        background: isSelected ? col.bg : "#111122",
                        color: isSelected ? col.accent : "#888",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {sport}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          
          {localSports.length > 0 && filteredCountries.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", marginBottom: 8 }}>
                Country ({filteredCountries.length})
                <span style={{ color: "#555", fontSize: 10, marginLeft: 4 }}>(for selected sports)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {filteredCountries.map(country => {
                  const isSelected = localCountries.includes(country)
                  return (
                    <button
                      key={country}
                      onClick={() => toggleCountry(country)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${isSelected ? "#666" : "#2a2a4a"}`,
                        background: isSelected ? "rgba(255,255,255,0.1)" : "#111122",
                        color: isSelected ? "#ddd" : "#888",
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      {country}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          
          {localSports.length > 0 && filteredEvents.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", marginBottom: 8 }}>
                League ({filteredEvents.length})
                {localCountries.length > 0 && (
                  <span style={{ color: "#555", fontSize: 10, marginLeft: 4 }}>(filtered by country)</span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {filteredEvents.map(event => {
                  const isSelected = localEvents.includes(event)
                  return (
                    <button
                      key={event}
                      onClick={() => toggleEvent(event)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${isSelected ? "#00e5ff" : "#2a2a4a"}`,
                        background: isSelected ? "rgba(0,229,255,0.15)" : "#111122",
                        color: isSelected ? "#00e5ff" : "#888",
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      {event}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={clearAll}
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
            Clear
          </button>
          <button
            onClick={apply}
            style={{
              flex: 2,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg,#00e5ff,#7c4dff)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Apply {activeCount > 0 ? `(${activeCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  )
}
