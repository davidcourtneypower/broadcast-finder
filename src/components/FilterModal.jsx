import React, { useState } from 'react'
import { Icon } from './Icon'

const AccordionSection = ({ title, count, selectedItems, isOpen, onToggle, disabled, disabledHint, children }) => (
  <div style={{ marginBottom: 4 }}>
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${disabled ? "#222238" : "#2a2a4a"}`,
        borderRadius: isOpen && !disabled ? "8px 8px 0 0" : 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", fontWeight: 600, flexShrink: 0 }}>
          {title}
        </span>
        {count > 0 && (
          <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>({count})</span>
        )}
        {!isOpen && selectedItems.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginLeft: 4, overflow: "hidden", flexShrink: 1, minWidth: 0 }}>
            {selectedItems.slice(0, 3).map(item => (
              <span key={item} style={{
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(0,229,255,0.12)",
                border: "1px solid rgba(0,229,255,0.25)",
                color: "#00e5ff",
                fontSize: 9,
                fontWeight: 600,
                whiteSpace: "nowrap",
                maxWidth: 70,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {item}
              </span>
            ))}
            {selectedItems.length > 3 && (
              <span style={{
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(0,229,255,0.08)",
                color: "rgba(0,229,255,0.7)",
                fontSize: 9,
                fontWeight: 600,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                +{selectedItems.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      {disabled ? (
        <span style={{ fontSize: 10, color: "#444", fontStyle: "italic", flexShrink: 0 }}>{disabledHint}</span>
      ) : (
        <Icon name={isOpen ? "chevUp" : "chevDown"} size={14} color="#555" />
      )}
    </button>
    {isOpen && !disabled && (
      <div className="dark-scrollbar" style={{
        maxHeight: 180,
        overflowY: "auto",
        padding: "10px 12px",
        background: "rgba(0,0,0,0.15)",
        border: "1px solid #2a2a4a",
        borderTop: "none",
        borderRadius: "0 0 8px 8px",
      }}>
        {children}
      </div>
    )}
  </div>
)

const SearchInput = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative", marginBottom: 8 }}>
    <Icon name="search" size={12} color="#555" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        padding: "6px 8px 6px 26px",
        borderRadius: 6,
        border: "1px solid #2a2a4a",
        background: "#111122",
        color: "#fff",
        fontSize: 11,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  </div>
)

const STATUS_OPTIONS = [
  { value: 'live', label: 'LIVE', color: '#e53935' },
  { value: 'starting-soon', label: 'STARTING SOON', color: '#7c4dff' },
  { value: 'upcoming', label: 'UPCOMING', color: '#26a69a' },
  { value: 'finished', label: 'FINISHED', color: '#666' }
]

const STATUS_LABEL_MAP = { 'live': 'LIVE', 'starting-soon': 'SOON', 'upcoming': 'UPCOMING', 'finished': 'FINISHED' }

export const FilterModal = ({ onClose, filters, onApply, allSports, matches, getSportColors }) => {
  const [localSports, setLocalSports] = useState(filters.sports || [])
  const [localCountries, setLocalCountries] = useState(filters.countries || [])
  const [localEvents, setLocalEvents] = useState(filters.events || [])
  const [localStatuses, setLocalStatuses] = useState(filters.statuses || [])

  const [openSections, setOpenSections] = useState({
    status: true, sport: true, country: false, league: false
  })
  const [sportSearch, setSportSearch] = useState("")
  const [leagueSearch, setLeagueSearch] = useState("")

  const toggleSection = (section) => {
    setOpenSections(prev => {
      const newState = { ...prev, [section]: !prev[section] }
      if (!newState[section]) {
        if (section === 'sport') setSportSearch("")
        if (section === 'league') setLeagueSearch("")
      }
      return newState
    })
  }

  // Filter countries based on selected sports
  const getFilteredCountries = () => {
    if (!matches || matches.length === 0 || localSports.length === 0) return []
    const filteredMatches = matches.filter(m => localSports.includes(m.sport))
    return [...new Set(filteredMatches.map(m => m.country))].sort()
  }

  // Filter events based on selected sports and countries
  const getFilteredEvents = () => {
    if (!matches || matches.length === 0 || localSports.length === 0) return []
    let filteredMatches = matches.filter(m => localSports.includes(m.sport))
    if (localCountries.length > 0) {
      filteredMatches = filteredMatches.filter(m => localCountries.includes(m.country))
    }
    return [...new Set(filteredMatches.map(m => m.league))].sort()
  }

  const filteredCountries = getFilteredCountries()
  const filteredEvents = getFilteredEvents()

  const displayedSports = sportSearch
    ? allSports.filter(s => s.toLowerCase().includes(sportSearch.toLowerCase()))
    : allSports

  const displayedLeagues = leagueSearch
    ? filteredEvents.filter(e => e.toLowerCase().includes(leagueSearch.toLowerCase()))
    : filteredEvents

  const getSportForLeague = (league) => {
    if (!matches || matches.length === 0) return null
    const match = matches.find(m => m.league === league)
    return match ? match.sport : null
  }

  const toggleSport = (sport) => {
    setLocalSports(prev => {
      const newSports = prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]

      if (newSports.length === 0) {
        setLocalCountries([])
        setLocalEvents([])
        setOpenSections(prev => ({ ...prev, country: false, league: false }))
      } else if (matches) {
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
  const countriesDisabled = localSports.length === 0
  const leaguesDisabled = localSports.length === 0

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 20, width: "90%", maxWidth: 380, border: "1px solid #2a2a4a", position: "relative", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: "#fff", margin: 0, fontSize: 18 }}>Filters</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="dark-scrollbar" style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
          {/* Status */}
          <AccordionSection
            title="Status"
            count={4}
            selectedItems={localStatuses.map(s => STATUS_LABEL_MAP[s] || s)}
            isOpen={openSections.status}
            onToggle={() => toggleSection('status')}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUS_OPTIONS.map(status => {
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
          </AccordionSection>

          {/* Sport */}
          <AccordionSection
            title="Sport"
            count={allSports.length}
            selectedItems={localSports}
            isOpen={openSections.sport}
            onToggle={() => toggleSection('sport')}
          >
            {allSports.length > 8 && (
              <SearchInput value={sportSearch} onChange={setSportSearch} placeholder="Search sports..." />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {displayedSports.map(sport => {
                const isSelected = localSports.includes(sport)
                const col = getSportColors ? getSportColors(sport) : { accent: "#00e5ff", bg: "rgba(0,229,255,0.12)" }
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
              {sportSearch && displayedSports.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No matches</div>
              )}
            </div>
          </AccordionSection>

          {/* Country */}
          <AccordionSection
            title="Country"
            count={filteredCountries.length}
            selectedItems={localCountries}
            isOpen={openSections.country}
            onToggle={() => toggleSection('country')}
            disabled={countriesDisabled}
            disabledHint="Select a sport"
          >
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
              {filteredCountries.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No countries for selected sports</div>
              )}
            </div>
          </AccordionSection>

          {/* League */}
          <AccordionSection
            title="League"
            count={filteredEvents.length}
            selectedItems={localEvents}
            isOpen={openSections.league}
            onToggle={() => toggleSection('league')}
            disabled={leaguesDisabled}
            disabledHint="Select a sport"
          >
            {filteredEvents.length > 8 && (
              <SearchInput value={leagueSearch} onChange={setLeagueSearch} placeholder="Search leagues..." />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {displayedLeagues.map(event => {
                const isSelected = localEvents.includes(event)
                const sport = getSportForLeague(event)
                const sportColors = sport && getSportColors ? getSportColors(sport) : { accent: "#00e5ff", bg: "rgba(0,229,255,0.15)" }
                return (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1px solid ${isSelected ? sportColors.accent : "#2a2a4a"}`,
                      background: isSelected ? sportColors.bg : "#111122",
                      color: isSelected ? sportColors.accent : "#888",
                      fontSize: 11,
                      cursor: "pointer"
                    }}
                  >
                    {event}
                  </button>
                )
              })}
              {leagueSearch && displayedLeagues.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No matches</div>
              )}
              {!leagueSearch && filteredEvents.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No leagues for selected filters</div>
              )}
            </div>
          </AccordionSection>
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
