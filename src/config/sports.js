/**
 * Centralized sports configuration
 * Add new sports here to extend the application
 */

export const SPORTS_CONFIG = {
  Football: {
    name: 'Football',
    apiKey: 'football',
    apiVersion: 'v3',
    apiEndpoint: 'fixtures',
    matchDuration: 120, // minutes (90 min + halftime + extra time)
    pregameWindow: 15, // minutes before match to show as "live"
    responseStructure: 'nested', // API returns data in fixture.fixture structure
    colors: {
      accent: '#00e5ff',
      bg: 'rgba(0,229,255,0.12)'
    },
    statusCodes: {
      live: ['LIVE', '1H', 'HT', '2H', 'ET', 'P', 'BT'],
      finished: ['FT', 'AET', 'PEN']
    },
    leagues: {
      // League ID: Popularity score (0-100)
      39: 95,   // Premier League
      140: 92,  // La Liga
      135: 90,  // Serie A
      61: 88,   // Ligue 1
      78: 93,   // Bundesliga
      2: 98,    // UEFA Champions League
      3: 82,    // UEFA Europa League
      848: 80,  // UEFA Europa Conference League
      4: 87,    // Euro Championship
      1: 89,    // World Cup
    },
    defaultPopularity: 70
  },

  Basketball: {
    name: 'Basketball',
    apiKey: 'basketball',
    apiVersion: 'v1',
    apiEndpoint: 'games',
    matchDuration: 150, // minutes (48 min game + timeouts + breaks)
    pregameWindow: 15,
    responseStructure: 'flat', // API returns data at root level
    colors: {
      accent: '#ff9f1c',
      bg: 'rgba(255,159,28,0.12)'
    },
    statusCodes: {
      live: ['LIVE', 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT'],
      finished: ['FT', 'AOT']
    },
    leagues: {
      12: 95,   // NBA
      117: 85,  // EuroLeague
      120: 75,  // EuroCup
      116: 80,  // NCAA
      20: 70,   // NBA G League
    },
    leagueNameMatches: {
      // Name patterns for fallback popularity scoring
      'nba': 95,
      'euroleague': 85,
      'eurocup': 75,
      'ncaa': 80,
      'fiba': 75,
      'olympics': 90,
      'world cup': 90,
      'g league': 70,
    },
    defaultPopularity: 50
  }
}

/**
 * Get sport configuration by name
 * @param {string} sportName - Sport name (case-insensitive)
 * @returns {object|null} Sport configuration or null if not found
 */
export const getSportConfig = (sportName) => {
  if (!sportName) {
    console.warn('getSportConfig called without sport name')
    return null
  }

  // Capitalize first letter for consistent key lookup
  const normalizedName = sportName.charAt(0).toUpperCase() + sportName.slice(1).toLowerCase()

  const config = SPORTS_CONFIG[normalizedName]

  if (!config) {
    console.warn(`No configuration found for sport: ${sportName}`)
    return null
  }

  return config
}

/**
 * Get API configuration for a sport
 * @param {string} sportName - Sport name
 * @returns {object|null} API configuration or null if sport not configured
 */
export const getApiConfig = (sportName) => {
  const config = getSportConfig(sportName)

  if (!config) {
    console.error(`Cannot get API config for unconfigured sport: ${sportName}`)
    return null
  }

  return {
    baseUrl: `https://${config.apiVersion}.${config.apiKey}.api-sports.io`,
    host: `${config.apiVersion}.${config.apiKey}.api-sports.io`,
    endpoint: config.apiEndpoint
  }
}

/**
 * Get all configured sports
 * @returns {string[]} Array of sport names
 */
export const getAllSports = () => {
  return Object.keys(SPORTS_CONFIG)
}

/**
 * Get sport color scheme
 * @param {string} sportName - Sport name
 * @returns {object} Color scheme with accent and bg properties, or default colors
 */
export const getSportColors = (sportName) => {
  const config = getSportConfig(sportName)

  if (!config) {
    // Return default colors for unconfigured sports
    return {
      accent: '#00e5ff',
      bg: 'rgba(0,229,255,0.12)'
    }
  }

  return config.colors
}

