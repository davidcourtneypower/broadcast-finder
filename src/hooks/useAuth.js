import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  // Create or update user profile when user signs in
  const ensureUserProfile = async (user) => {
    if (!user) return

    try {
      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected for new users
        console.error('Error fetching user profile:', fetchError)
        return
      }

      if (!existingProfile) {
        // Detect user's browser timezone
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

        // Create new profile with default preferences
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([{
            id: user.id,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url || null,
            preferences: {
              timezone: browserTimezone,
              timeFormat: '24h',
              dateFormat: 'YYYY-MM-DD',
            },
          }])

        if (insertError) {
          console.error('Error creating user profile:', insertError)
        } else {
          console.log('User profile created successfully')
        }
      } else {
        // Update existing profile with latest info from OAuth provider
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            display_name: user.user_metadata?.full_name || existingProfile.display_name,
            avatar_url: user.user_metadata?.avatar_url || existingProfile.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('Error updating user profile:', updateError)
        }
      }
    } catch (error) {
      console.error('Unexpected error in ensureUserProfile:', error)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureUserProfile(session.user)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureUserProfile(session.user)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  }
}
