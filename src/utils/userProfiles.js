import { supabase } from '../config/supabase'

/**
 * Fetch a user profile by user ID
 */
export const getUserProfile = async (userId) => {
  if (!userId) return null

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Unexpected error fetching user profile:', error)
    return null
  }
}

/**
 * Fetch multiple user profiles by user IDs
 */
export const getUserProfiles = async (userIds) => {
  if (!userIds || userIds.length === 0) return []

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds)

    if (error) {
      console.error('Error fetching user profiles:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Unexpected error fetching user profiles:', error)
    return []
  }
}

/**
 * Update the current user's profile
 */
export const updateUserProfile = async (userId, updates) => {
  if (!userId) return { error: 'User ID is required' }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return { error }
    }

    return { data }
  } catch (error) {
    console.error('Unexpected error updating user profile:', error)
    return { error }
  }
}

/**
 * Get a user's preferences
 */
export const getUserPreferences = async (userId) => {
  if (!userId) return null

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user preferences:', error)
      return null
    }

    return data?.preferences || {}
  } catch (error) {
    console.error('Unexpected error fetching user preferences:', error)
    return null
  }
}

/**
 * Update a specific user preference
 * @param {string} userId - The user ID
 * @param {string} key - The preference key (e.g., 'timezone', 'theme')
 * @param {any} value - The preference value
 */
export const updateUserPreference = async (userId, key, value) => {
  if (!userId || !key) return { error: 'User ID and key are required' }

  try {
    // Get current preferences
    const currentPreferences = await getUserPreferences(userId)

    // Update the specific preference
    const updatedPreferences = {
      ...currentPreferences,
      [key]: value,
    }

    // Save back to database
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user preference:', error)
      return { error }
    }

    return { data }
  } catch (error) {
    console.error('Unexpected error updating user preference:', error)
    return { error }
  }
}

/**
 * Update multiple user preferences at once
 * @param {string} userId - The user ID
 * @param {object} preferences - Object with preference key-value pairs
 */
export const updateUserPreferences = async (userId, preferences) => {
  if (!userId || !preferences) return { error: 'User ID and preferences are required' }

  try {
    // Get current preferences
    const currentPreferences = await getUserPreferences(userId)

    // Merge with new preferences
    const updatedPreferences = {
      ...currentPreferences,
      ...preferences,
    }

    // Save back to database
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user preferences:', error)
      return { error }
    }

    return { data }
  } catch (error) {
    console.error('Unexpected error updating user preferences:', error)
    return { error }
  }
}

/**
 * Get the user's timezone preference with fallback to browser/UTC
 */
export const getUserTimezone = async (userId) => {
  if (!userId) {
    // Fallback to browser timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  }

  try {
    const preferences = await getUserPreferences(userId)
    return preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch (error) {
    console.error('Error getting user timezone:', error)
    return 'UTC'
  }
}
