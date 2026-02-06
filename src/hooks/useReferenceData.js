import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'

// Fallback sport durations (matches current sports.js values)
const FALLBACK_DURATIONS = {
  'Soccer': 120, 'Football': 120, 'Basketball': 150,
  'American Football': 210, 'Ice Hockey': 150, 'Tennis': 180,
  'Baseball': 210, 'Rugby': 120, 'Cricket': 480, 'Golf': 300,
  'Motorsport': 180, 'Boxing': 60, 'MMA': 60,
  'Volleyball': 120, 'Handball': 90,
  'Field Hockey': 90, 'Fighting': 60, 'Olympics': 180,
  'Skating': 120, 'Snooker': 300, 'Wintersports': 150,
  'Gaelic': 90, 'Skiing': 150
}

// Fallback sport colors (matches current sports.js values)
const FALLBACK_COLORS = {
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
  'Field Hockey': { accent: '#1b5e20', bg: 'rgba(27,94,32,0.12)' },
  'Fighting': { accent: '#b71c1c', bg: 'rgba(183,28,28,0.12)' },
  'Olympics': { accent: '#ffd700', bg: 'rgba(255,215,0,0.12)' },
  'Skating': { accent: '#80deea', bg: 'rgba(128,222,234,0.12)' },
  'Snooker': { accent: '#558b2f', bg: 'rgba(85,139,47,0.12)' },
  'Wintersports': { accent: '#b3e5fc', bg: 'rgba(179,229,252,0.12)' },
  'Gaelic': { accent: '#e65100', bg: 'rgba(230,81,0,0.12)' },
  'Skiing': { accent: '#90caf9', bg: 'rgba(144,202,249,0.12)' },
}

const DEFAULT_ACCENT = '#00e5ff'
const DEFAULT_BG = 'rgba(0,229,255,0.12)'
const DEFAULT_DURATION = 150
const DEFAULT_PREGAME = 15

// Fallback flag map (matches current constants.js FLAG_MAP)
const FALLBACK_FLAGS = {
  USA: '🇺🇸', UK: '🇬🇧', Canada: '🇨🇦', Australia: '🇦🇺',
  India: '🇮🇳', Germany: '🇩🇪', France: '🇫🇷', Spain: '🇪🇸',
  Italy: '🇮🇹', Portugal: '🇵🇹', Sudan: '🇸🇩',
  China: '🇨🇳', Turkey: '🇹🇷', Greece: '🇬🇷', Lithuania: '🇱🇹',
  Serbia: '🇷🇸', Russia: '🇷🇺', Argentina: '🇦🇷', Brazil: '🇧🇷',
  Mexico: '🇲🇽', Japan: '🇯🇵',
  Latvia: '🇱🇻', 'New Zealand': '🇳🇿', Poland: '🇵🇱', Slovenia: '🇸🇮',
  Croatia: '🇭🇷', Czechia: '🇨🇿', Switzerland: '🇨🇭', Austria: '🇦🇹',
  Belgium: '🇧🇪', Norway: '🇳🇴', Finland: '🇫🇮', Slovakia: '🇸🇰',
  Ireland: '🇮🇪', Sweden: '🇸🇪', 'South Africa': '🇿🇦', Paraguay: '🇵🇾',
  Bulgaria: '🇧🇬', Denmark: '🇩🇰', Iceland: '🇮🇸', 'The Netherlands': '🇳🇱',
  Azerbaijan: '🇦🇿', Indonesia: '🇮🇩', Vietnam: '🇻🇳', Romania: '🇷🇴',
  Qatar: '🇶🇦', 'Saudi Arabia': '🇸🇦', Israel: '🇮🇱', Thailand: '🇹🇭',
  Singapore: '🇸🇬', Malaysia: '🇲🇾', 'Bosnia and Herzegovina': '🇧🇦',
  Chile: '🇨🇱', Colombia: '🇨🇴', Ukraine: '🇺🇦', Belarus: '🇧🇾',
  Nicaragua: '🇳🇮', Guatemala: '🇬🇹', Peru: '🇵🇪', 'El Salvador': '🇸🇻',
  Honduras: '🇭🇳', Estonia: '🇪🇪', 'Costa Rica': '🇨🇷', Albania: '🇦🇱',
  'South Korea': '🇰🇷', Philippines: '🇵🇭', Hungary: '🇭🇺',
  Global: '🌍'
}

export const useReferenceData = () => {
  const [sports, setSports] = useState([])
  const [leagues, setLeagues] = useState([])
  const [countries, setCountries] = useState([])
  const [countryChannels, setCountryChannels] = useState([])
  const [loading, setLoading] = useState(true)

  const loadReferenceData = useCallback(async () => {
    setLoading(true)
    try {
      const [sportsRes, leaguesRes, countriesRes, channelsRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('leagues').select('*').order('name'),
        supabase.from('countries').select('*').order('name'),
        supabase.from('country_channels').select('*').order('channel_name')
      ])

      setSports(sportsRes.data || [])
      setLeagues(leaguesRes.data || [])
      setCountries(countriesRes.data || [])
      setCountryChannels(channelsRes.data || [])
    } catch (error) {
      console.error('Error loading reference data:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  // Get sport config (for status calculation) with fallback
  const getSportConfig = useCallback((sportName) => {
    if (!sportName) return null

    const dbSport = sports.find(s => s.name === sportName)
    if (dbSport) {
      return {
        name: sportName,
        matchDuration: dbSport.duration_minutes,
        pregameWindow: dbSport.pregame_window_minutes,
        colors: { accent: dbSport.accent_color, bg: dbSport.bg_color }
      }
    }

    // Fallback to hardcoded values
    const fallbackColors = FALLBACK_COLORS[sportName] || { accent: DEFAULT_ACCENT, bg: DEFAULT_BG }
    return {
      name: sportName,
      matchDuration: FALLBACK_DURATIONS[sportName] || DEFAULT_DURATION,
      pregameWindow: DEFAULT_PREGAME,
      colors: fallbackColors
    }
  }, [sports])

  // Get sport colors with fallback
  const getSportColors = useCallback((sportName) => {
    if (!sportName) return { accent: DEFAULT_ACCENT, bg: DEFAULT_BG, glow: 'rgba(0,229,255,0.25)' }

    const dbSport = sports.find(s => s.name === sportName)
    const accent = dbSport?.accent_color || FALLBACK_COLORS[sportName]?.accent || DEFAULT_ACCENT
    const bg = dbSport?.bg_color || FALLBACK_COLORS[sportName]?.bg || DEFAULT_BG
    const glow = accent.replace(')', ', 0.25)').replace('rgb', 'rgba')

    return { accent, bg, glow }
  }, [sports])

  // Get flag for country with fallback
  const getFlag = useCallback((countryName) => {
    const dbCountry = countries.find(c => c.name === countryName)
    return dbCountry?.flag_emoji || FALLBACK_FLAGS[countryName] || '🌍'
  }, [countries])

  // Get channels for a country from DB
  const getChannelsForCountry = useCallback((countryName) => {
    const country = countries.find(c => c.name === countryName)
    if (!country) return []
    return countryChannels
      .filter(cc => cc.country_id === country.id)
      .map(cc => cc.channel_name)
      .sort()
  }, [countries, countryChannels])

  // Get all country names from DB
  const getCountryNames = useCallback(() => {
    return countries.map(c => c.name).sort()
  }, [countries])

  return {
    sports, leagues, countries, countryChannels,
    loading, reload: loadReferenceData,
    getSportConfig, getSportColors, getFlag,
    getChannelsForCountry, getCountryNames
  }
}
