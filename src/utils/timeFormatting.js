/**
 * Time formatting utilities for converting UTC times to user timezone
 */

/**
 * Format a match date/time according to user preferences
 * @param {string} matchDate - Date string in YYYY-MM-DD format (UTC)
 * @param {string} matchTime - Time string in HH:MM format (UTC)
 * @param {object} preferences - User preferences object with timezone and timeFormat
 * @returns {object} Formatted time and date strings
 */
export const formatMatchTime = (matchDate, matchTime, preferences = {}) => {
  try {
    // Validate inputs
    if (!matchDate || !matchTime) {
      console.warn('Invalid match date or time:', { matchDate, matchTime })
      return {
        time: matchTime || '--:--',
        date: matchDate || 'Unknown',
        dayLabel: 'Unknown',
        fullDateTime: 'Invalid date',
      }
    }

    // Handle time format - could be HH:MM or HH:MM:SS
    let timeStr = matchTime.trim()
    // If time doesn't have seconds, add them
    if (timeStr.split(':').length === 2) {
      timeStr = `${timeStr}:00`
    }

    // Parse UTC datetime
    const utcDateTime = new Date(`${matchDate}T${timeStr}Z`)

    // Check if date is valid
    if (isNaN(utcDateTime.getTime())) {
      console.error('❌ Invalid date format detected:', {
        matchDate,
        matchTime,
        timeStr,
        attemptedParse: `${matchDate}T${timeStr}Z`
      })
      return {
        time: matchTime,
        date: matchDate,
        dayLabel: matchDate,
        fullDateTime: `${matchDate} ${matchTime}`,
      }
    }

    // Get timezone and format from preferences
    const timezone = preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const use12Hour = preferences.timeFormat === '12h'

    // Format time
    const timeOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: use12Hour,
    }
    const formattedTime = utcDateTime.toLocaleString('en-US', timeOptions)

    // Format date
    const dateOptions = {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }
    const formattedDate = utcDateTime.toLocaleString('en-US', dateOptions)

    // Get day label (Today, Tomorrow, etc.)
    const now = new Date()
    const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const matchLocalDate = new Date(utcDateTime.toLocaleString('en-US', { timeZone: timezone }))

    const diffDays = Math.floor((matchLocalDate.setHours(0, 0, 0, 0) - userNow.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))

    let dayLabel = formattedDate
    if (diffDays === 0) dayLabel = 'Today'
    else if (diffDays === 1) dayLabel = 'Tomorrow'
    else if (diffDays === -1) dayLabel = 'Yesterday'

    return {
      time: formattedTime,
      date: formattedDate,
      dayLabel,
      fullDateTime: utcDateTime.toLocaleString('en-US', {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: use12Hour,
      }),
    }
  } catch (error) {
    console.error('Error formatting match time:', error)
    // Fallback to original values
    return {
      time: matchTime,
      date: matchDate,
      dayLabel: matchDate,
      fullDateTime: `${matchDate} ${matchTime}`,
    }
  }
}

/**
 * Get match status based on current time in user's timezone
 * @param {string} matchDate - Date string in YYYY-MM-DD format (UTC)
 * @param {string} matchTime - Time string in HH:MM format (UTC)
 * @param {string} sport - Sport type (for duration)
 * @param {string} timezone - User's timezone (optional, defaults to browser timezone)
 * @returns {string} Match status: "upcoming", "starting-soon", "live", "finished"
 */
export const getMatchStatus = (matchDate, matchTime, sport, timezone) => {
  try {
    // Validate inputs
    if (!matchDate || !matchTime) {
      return "upcoming"
    }

    // Clean and validate time format
    let cleanTime = matchTime.trim()

    // Handle different time formats
    if (cleanTime.includes(':')) {
      // Already has colons - could be HH:MM or HH:MM:SS
      const parts = cleanTime.split(':')
      if (parts.length === 2) {
        // HH:MM - add seconds
        cleanTime = `${cleanTime}:00`
      } else if (parts.length === 3) {
        // HH:MM:SS - already correct
      } else {
        return "upcoming"
      }
    } else if (cleanTime.length === 4) {
      // Format might be HHMM, convert to HH:MM:SS
      cleanTime = `${cleanTime.substring(0, 2)}:${cleanTime.substring(2)}:00`
    } else {
      return "upcoming"
    }

    // Parse UTC datetime
    const dateStr = matchDate.trim()
    const matchDateTime = new Date(`${dateStr}T${cleanTime}Z`)

    // Check if date is valid
    if (isNaN(matchDateTime.getTime())) {
      return "upcoming"
    }

    const now = new Date()
    const diffMinutes = (now - matchDateTime) / (1000 * 60)

    // Sport-specific durations (in minutes)
    const sportDurations = {
      'Football': 120,
      'Basketball': 150,
      'Baseball': 180,
      'Hockey': 150,
      'Tennis': 180,
      'Rugby': 100,
      'Cricket': 300,
    }

    const matchDuration = sportDurations[sport] || 180
    const pregameWindow = 15

    if (diffMinutes < -pregameWindow) return "upcoming"
    if (diffMinutes >= -pregameWindow && diffMinutes < 0) return "starting-soon"
    if (diffMinutes >= 0 && diffMinutes <= matchDuration) return "live"
    return "finished"
  } catch (error) {
    console.error('Error calculating match status:', error)
    return "upcoming"
  }
}

/**
 * Get relative time string (e.g., "in 2 hours", "5 minutes ago")
 * @param {string} matchDate - Date string in YYYY-MM-DD format (UTC)
 * @param {string} matchTime - Time string in HH:MM format (UTC)
 * @param {string} timezone - User's timezone (optional)
 * @returns {string} Relative time string
 */
export const getRelativeTime = (matchDate, matchTime, timezone) => {
  try {
    // Handle time format - could be HH:MM or HH:MM:SS
    let timeStr = matchTime.trim()
    // If time doesn't have seconds, add them
    if (timeStr.split(':').length === 2) {
      timeStr = `${timeStr}:00`
    }

    const matchDateTime = new Date(`${matchDate}T${timeStr}Z`)

    // Check if date is valid
    if (isNaN(matchDateTime.getTime())) {
      return ''
    }

    const now = new Date()
    const diffMs = matchDateTime - now
    const diffMinutes = Math.abs(Math.floor(diffMs / (1000 * 60)))
    const diffHours = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)))
    const diffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)))

    const isPast = diffMs < 0

    if (diffMinutes < 1) return 'now'
    if (diffMinutes < 60) {
      return isPast ? `${diffMinutes} min ago` : `in ${diffMinutes} min`
    }
    if (diffHours < 24) {
      return isPast ? `${diffHours}h ago` : `in ${diffHours}h`
    }
    return isPast ? `${diffDays}d ago` : `in ${diffDays}d`
  } catch (error) {
    console.error('Error calculating relative time:', error)
    return ''
  }
}

/**
 * Convert UTC time to user's timezone for display
 * @param {Date} utcDate - UTC Date object
 * @param {string} timezone - Target timezone
 * @returns {Date} Date object representing the same moment in the target timezone
 */
export const convertToUserTimezone = (utcDate, timezone) => {
  try {
    const tzString = utcDate.toLocaleString('en-US', { timeZone: timezone })
    return new Date(tzString)
  } catch (error) {
    console.error('Error converting to user timezone:', error)
    return utcDate
  }
}

/**
 * Get a human-readable timezone abbreviation (e.g., "PST", "EST")
 * @param {string} timezone - IANA timezone string
 * @returns {string} Timezone abbreviation
 */
export const getTimezoneAbbreviation = (timezone) => {
  try {
    const date = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })

    const parts = formatter.formatToParts(date)
    const tzPart = parts.find(part => part.type === 'timeZoneName')
    return tzPart ? tzPart.value : timezone
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error)
    return timezone
  }
}
