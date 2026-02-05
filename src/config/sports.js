/**
 * Dynamic sports configuration
 * Sports are now fetched from TheSportsDB - this file provides helper functions
 * for UI presentation (colors, durations) for any sport dynamically
 */

/**
 * Default sport durations in minutes (for status calculation)
 * These are approximate durations used to determine if a match has ended
 */
const SPORT_DURATIONS = {
  'Soccer': 120,        // 90 min + halftime + extra time buffer
  'Football': 120,      // Alias for Soccer
  'Basketball': 150,    // 48 min game + timeouts + breaks
  'American Football': 210,
  'Ice Hockey': 150,
  'Tennis': 180,        // Variable, using average
  'Baseball': 210,
  'Rugby': 120,
  'Cricket': 480,       // Variable, T20 vs Test
  'Golf': 300,
  'Motorsport': 180,
  'Boxing': 60,
  'MMA': 60,
  'Volleyball': 120,
  'Handball': 90,
  'default': 150
}

/**
 * Sport color schemes for UI
 * Returns consistent colors for known sports, generates colors for unknown sports
 */
const SPORT_COLORS = {
  'Soccer': { accent: '#00e5ff', bg: 'rgba(0,229,255,0.12)' },
  'Football': { accent: '#00e5ff', bg: 'rgba(0,229,255,0.12)' },
  'Basketball': { accent: '#ff9f1c', bg: 'rgba(255,159,28,0.12)' },
  'American Football': { accent: '#8b4513', bg: 'rgba(139,69,19,0.12)' },
  'Ice Hockey': { accent: '#4fc3f7', bg: 'rgba(79,195,247,0.12)' },
  'Tennis': { accent: '#c8e600', bg: 'rgba(200,230,0,0.12)' },
  'Baseball': { accent: '#e53935', bg: 'rgba(229,57,53,0.12)' },
  'Rugby': { accent: '#2e7d32', bg: 'rgba(46,125,50,0.12)' },
  'Cricket': { accent: '#ff8f00', bg: 'rgba(255,143,0,0.12)' },
  'Golf': { accent: '#388e3c', bg: 'rgba(56,142,60,0.12)' },
  'Motorsport': { accent: '#d32f2f', bg: 'rgba(211,47,47,0.12)' },
  'Boxing': { accent: '#9c27b0', bg: 'rgba(156,39,176,0.12)' },
  'MMA': { accent: '#9c27b0', bg: 'rgba(156,39,176,0.12)' },
  'Volleyball': { accent: '#ffc107', bg: 'rgba(255,193,7,0.12)' },
  'Handball': { accent: '#03a9f4', bg: 'rgba(3,169,244,0.12)' },
}

/**
 * Default color for unknown sports
 */
const DEFAULT_COLORS = { accent: '#00e5ff', bg: 'rgba(0,229,255,0.12)' }

/**
 * Get match duration for a sport (used for status calculation)
 * @param {string} sportName - Sport name from TheSportsDB
 * @returns {number} Duration in minutes
 */
export const getSportDuration = (sportName) => {
  if (!sportName) return SPORT_DURATIONS.default
  return SPORT_DURATIONS[sportName] || SPORT_DURATIONS.default
}

/**
 * Get pregame window for a sport (minutes before match to show as "starting soon")
 * @param {string} sportName - Sport name
 * @returns {number} Pregame window in minutes
 */
export const getPregameWindow = (sportName) => {
  // Standard 15 minutes for all sports
  return 15
}

/**
 * Get sport color scheme
 * @param {string} sportName - Sport name
 * @returns {object} Color scheme with accent and bg properties
 */
export const getSportColors = (sportName) => {
  if (!sportName) return DEFAULT_COLORS
  return SPORT_COLORS[sportName] || DEFAULT_COLORS
}

/**
 * Get sport configuration (for backwards compatibility)
 * @param {string} sportName - Sport name
 * @returns {object} Sport configuration object
 */
export const getSportConfig = (sportName) => {
  if (!sportName) return null

  return {
    name: sportName,
    matchDuration: getSportDuration(sportName),
    pregameWindow: getPregameWindow(sportName),
    colors: getSportColors(sportName)
  }
}

// Legacy export for backwards compatibility
// No longer used for fetching - sports come from database
export const SPORTS_CONFIG = {}

/**
 * Get all configured sports
 * @deprecated Sports are now dynamic from database - use matches data instead
 * @returns {string[]} Empty array - sports come from database
 */
export const getAllSports = () => {
  console.warn('getAllSports() is deprecated - sports are now dynamic from database')
  return []
}
