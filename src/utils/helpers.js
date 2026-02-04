import { FLAG_MAP } from '../config/constants'
import { getSportConfig } from '../config/sports'

export const toDateStr = (date) => date.toISOString().split("T")[0]

export const addDays = (baseDate, numDays) => {
  const date = new Date(baseDate.getTime())
  date.setDate(date.getDate() + numDays)
  return date
}

export const getTodayStr = () => toDateStr(new Date())
export const getTomorrowStr = () => toDateStr(addDays(new Date(), 1))

export const getFlag = (country) => FLAG_MAP[country] || "🌍"

export const getDateLabel = (dateStr) => {
  const today = getTodayStr()
  const tomorrow = getTomorrowStr()

  if (dateStr === today) return "Today"
  if (dateStr === tomorrow) return "Tomorrow"
  return "This Week"
}

/**
 * Calculate match status based on current time vs match time
 * Always calculates dynamically - does not use database status
 * @param {string} matchDate - Date in YYYY-MM-DD format
 * @param {string} matchTime - Time in HH:MM format
 * @param {string} sport - Sport type for duration calculation
 * @returns {string} - 'upcoming', 'live', or 'finished'
 */
export const calculateMatchStatus = (matchDate, matchTime, sport = 'Football') => {
  try {
    // Parse match datetime (assume UTC)
    const matchDateTime = new Date(`${matchDate}T${matchTime}:00Z`)
    const now = new Date()

    // Calculate time difference in minutes
    const diffMinutes = (now - matchDateTime) / (1000 * 60)

    // Get sport-specific configuration
    const sportConfig = getSportConfig(sport)

    // Use sensible defaults if sport not configured
    const matchDuration = sportConfig?.matchDuration || 120
    const pregameWindow = sportConfig?.pregameWindow || 15

    if (!sportConfig) {
      console.warn(`Using default match duration for unconfigured sport: ${sport}`)
    }

    // Status logic:
    // - If match hasn't started yet (> pregame window before): upcoming
    // - If match is within start time to end time window: live
    // - If match ended: finished

    if (diffMinutes < -pregameWindow) {
      return 'upcoming'
    } else if (diffMinutes >= -pregameWindow && diffMinutes <= matchDuration) {
      return 'live'
    } else {
      return 'finished'
    }
  } catch (error) {
    console.error('Error calculating match status:', error, { matchDate, matchTime })
    // Default to upcoming if calculation fails
    return 'upcoming'
  }
}
