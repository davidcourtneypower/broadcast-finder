import { useState, useEffect } from 'react'
import { getUserPreferences } from '../utils/userProfiles'
import { formatMatchTime, getMatchStatus, getRelativeTime } from '../utils/timeFormatting'

/**
 * Hook to access user preferences and time formatting utilities
 * @param {object} user - The authenticated user object
 * @returns {object} User preferences and formatting functions
 */
export const useUserPreferences = (user) => {
  const [preferences, setPreferences] = useState({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    timeFormat: '24h',
    dateFormat: 'YYYY-MM-DD',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) {
        // Use default preferences for non-authenticated users
        setLoading(false)
        return
      }

      try {
        const userPrefs = await getUserPreferences(user.id)
        if (userPrefs) {
          setPreferences({
            timezone: userPrefs.timezone || preferences.timezone,
            timeFormat: userPrefs.timeFormat || preferences.timeFormat,
            dateFormat: userPrefs.dateFormat || preferences.dateFormat,
          })
        }
      } catch (error) {
        console.error('Error loading user preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [user?.id])

  // Helper functions that use the loaded preferences
  const formatTime = (matchDate, matchTime) => {
    return formatMatchTime(matchDate, matchTime, preferences)
  }

  const getStatus = (matchDate, matchTime, sport) => {
    return getMatchStatus(matchDate, matchTime, sport, preferences.timezone)
  }

  const getRelative = (matchDate, matchTime) => {
    return getRelativeTime(matchDate, matchTime, preferences.timezone)
  }

  return {
    preferences,
    loading,
    formatTime,
    getStatus,
    getRelative,
  }
}
