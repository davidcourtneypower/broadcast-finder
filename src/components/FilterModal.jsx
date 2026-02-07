import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'

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
  { value: 'starting-soon', label: 'SOON', color: '#7c4dff' },
  { value: 'upcoming', label: 'UPCOMING', color: '#26a69a' },
  { value: 'finished', label: 'FINISHED', color: '#666' }
]

const SectionHeader = ({ title, count, disabled, style }) => (
  <div style={{
    fontSize: 11,
    color: disabled ? "#444" : "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "monospace",
    fontWeight: 600,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    ...style,
  }}>
    {title}
    {count > 0 && <span style={{ color: "#555", fontWeight: 400 }}>({count})</span>}
  </div>
)

const StatusGridItem = ({ status, isSelected, onToggle }) => (
  <button
    onClick={() => onToggle(status.value)}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "10px 4px",
      cursor: "pointer",
      borderRadius: 8,
      background: isSelected ? `${status.color}18` : "transparent",
      border: `1px solid ${isSelected ? (status.color === '#666' ? '#999' : `${status.color}88`) : "transparent"}`,
    }}
  >
    <div style={{
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: status.color,
      opacity: isSelected ? 1 : 0.3,
      transition: "opacity 0.15s ease",
    }} />
    <span style={{
      fontSize: 9,
      fontWeight: 600,
      color: isSelected ? status.color : "#666",
      textTransform: "uppercase",
      letterSpacing: 0.3,
      textAlign: "center",
      lineHeight: 1.2,
    }}>
      {status.label}
    </span>
  </button>
)

const SportGridItem = ({ sport, isSelected, onToggle, colors }) => (
  <button
    onClick={() => onToggle(sport)}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "8px 4px",
      cursor: "pointer",
      borderRadius: 8,
      background: "transparent",
      border: "none",
    }}
  >
    <div style={{
      width: 48,
      height: 48,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `2px solid ${isSelected ? colors.accent : "#2a2a4a"}`,
      background: isSelected ? colors.bg : "#111122",
      transition: "all 0.15s ease",
    }}>
      <Icon name={sport.toLowerCase()} size={22} color={isSelected ? colors.accent : "#666"} />
    </div>
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      color: isSelected ? colors.accent : "#888",
      textAlign: "center",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    }}>
      {sport}
    </span>
  </button>
)

const CountryGridItem = ({ country, flag, isSelected, onToggle }) => (
  <button
    onClick={() => onToggle(country)}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "8px 4px",
      cursor: "pointer",
      borderRadius: 8,
      background: "transparent",
      border: "none",
    }}
  >
    <div style={{
      width: 48,
      height: 48,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `2px solid ${isSelected ? "#00e5ff" : "#2a2a4a"}`,
      background: isSelected ? "rgba(0,229,255,0.12)" : "#111122",
      fontSize: 22,
      transition: "all 0.15s ease",
    }}>
      {flag}
    </div>
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      color: isSelected ? "#ddd" : "#888",
      textAlign: "center",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    }}>
      {country}
    </span>
  </button>
)

const LeagueGridItem = ({ league, isSelected, onToggle, sportColors }) => (
  <button
    onClick={() => onToggle(league)}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "8px 4px",
      cursor: "pointer",
      borderRadius: 8,
      background: "transparent",
      border: "none",
    }}
  >
    <div style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `2px solid ${isSelected ? sportColors.accent : "#2a2a4a"}`,
      background: isSelected ? sportColors.bg : "#111122",
      transition: "all 0.15s ease",
    }}>
      <Icon name={sportColors.sportName || ""} size={20} color={isSelected ? sportColors.accent : "#666"} />
    </div>
    <span style={{
      fontSize: 9,
      color: isSelected ? sportColors.accent : "#888",
      fontWeight: 600,
      textAlign: "center",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    }}>
      {league}
    </span>
  </button>
)

export const FilterModal = ({ onClose, filters, onApply, allSports, matches, getSportColors, getFlag, headerRef }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [localSports, setLocalSports] = useState(filters.sports || [])
  const [localCountries, setLocalCountries] = useState(filters.countries || [])
  const [localEvents, setLocalEvents] = useState(filters.events || [])
  const [localStatuses, setLocalStatuses] = useState(filters.statuses || [])
  const [sportSearch, setSportSearch] = useState("")
  const [countrySearch, setCountrySearch] = useState("")
  const [leagueSearch, setLeagueSearch] = useState("")

  const headerHeight = headerRef?.current?.offsetHeight || 0

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleApply = () => {
    onApply({ sports: localSports, countries: localCountries, events: localEvents, statuses: localStatuses })
    handleClose()
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

  const displayedCountries = countrySearch
    ? filteredCountries.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))
    : filteredCountries

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

  const activeCount = localSports.length + localCountries.length + localEvents.length + localStatuses.length
  const countriesDisabled = localSports.length === 0
  const leaguesDisabled = localSports.length === 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`filter-panel-backdrop ${isVisible ? 'visible' : ''}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`filter-panel ${isVisible ? 'visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: headerHeight,
          maxWidth: 440,
          margin: "0 auto",
          maxHeight: `calc(100vh - ${headerHeight}px - 20px)`,
          background: "#1a1a2e",
          borderRadius: "0 0 16px 16px",
          border: "1px solid #2a2a4a",
          borderTop: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Panel Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <h3 style={{ color: "#fff", margin: 0, fontSize: 16, fontWeight: 700 }}>Filters</h3>
          <button onClick={handleClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="dark-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

          {/* Status */}
          <SectionHeader title="Status" count={4} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {STATUS_OPTIONS.map(status => (
              <StatusGridItem
                key={status.value}
                status={status}
                isSelected={localStatuses.includes(status.value)}
                onToggle={toggleStatus}
              />
            ))}
          </div>

          {/* Sport */}
          <SectionHeader title="Sport" count={allSports.length} style={{ marginTop: 12 }} />
          {allSports.length > 8 && (
            <SearchInput value={sportSearch} onChange={setSportSearch} placeholder="Search sports..." />
          )}
          <div className="dark-scrollbar" style={{ maxHeight: 260, overflowY: "auto", marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {displayedSports.map(sport => {
                const col = getSportColors ? getSportColors(sport) : { accent: "#00e5ff", bg: "rgba(0,229,255,0.12)" }
                return (
                  <SportGridItem
                    key={sport}
                    sport={sport}
                    isSelected={localSports.includes(sport)}
                    onToggle={toggleSport}
                    colors={col}
                  />
                )
              })}
            </div>
          </div>
          {sportSearch && displayedSports.length === 0 && (
            <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No matches</div>
          )}

          {/* Country */}
          <SectionHeader title="Country" count={filteredCountries.length} disabled={countriesDisabled} style={{ marginTop: 12 }} />
          {countriesDisabled ? (
            <div style={{ fontSize: 11, color: "#444", fontStyle: "italic", padding: "4px 0 8px" }}>Select a sport first</div>
          ) : (
            <>
              {filteredCountries.length > 6 && (
                <SearchInput value={countrySearch} onChange={setCountrySearch} placeholder="Search countries..." />
              )}
              <div className="dark-scrollbar" style={{ maxHeight: 220, overflowY: "auto", marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                  {displayedCountries.map(country => (
                    <CountryGridItem
                      key={country}
                      country={country}
                      flag={getFlag ? getFlag(country) : "🌍"}
                      isSelected={localCountries.includes(country)}
                      onToggle={toggleCountry}
                    />
                  ))}
                </div>
              </div>
              {countrySearch && displayedCountries.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No matches</div>
              )}
              {!countrySearch && filteredCountries.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No countries for selected sports</div>
              )}
            </>
          )}

          {/* League */}
          <SectionHeader title="League" count={filteredEvents.length} disabled={leaguesDisabled} style={{ marginTop: 12 }} />
          {leaguesDisabled ? (
            <div style={{ fontSize: 11, color: "#444", fontStyle: "italic", padding: "4px 0 8px" }}>Select a sport first</div>
          ) : (
            <>
              <SearchInput value={leagueSearch} onChange={setLeagueSearch} placeholder="Search leagues..." />
              <div className="dark-scrollbar" style={{ maxHeight: 220, overflowY: "auto", marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {displayedLeagues.map(event => {
                    const sport = getSportForLeague(event)
                    const sportCol = sport && getSportColors ? getSportColors(sport) : { accent: "#00e5ff", bg: "rgba(0,229,255,0.15)" }
                    return (
                      <LeagueGridItem
                        key={event}
                        league={event}
                        isSelected={localEvents.includes(event)}
                        onToggle={toggleEvent}
                        sportColors={{ ...sportCol, sportName: sport ? sport.toLowerCase() : "" }}
                      />
                    )
                  })}
                </div>
              </div>
              {leagueSearch && displayedLeagues.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No matches</div>
              )}
              {!leagueSearch && filteredEvents.length === 0 && (
                <div style={{ fontSize: 11, color: "#555", padding: "4px 0" }}>No leagues for selected filters</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}>
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
              cursor: "pointer",
            }}
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 2,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg,#00e5ff,#7c4dff)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply {activeCount > 0 ? `(${activeCount})` : ""}
          </button>
        </div>
      </div>
    </>
  )
}
