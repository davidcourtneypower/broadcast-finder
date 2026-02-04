/**
 * Backend sports configuration (TypeScript version)
 * This mirrors the frontend sports.js configuration
 */

interface SportConfig {
  name: string
  apiKey: string
  apiVersion: string
  apiEndpoint: string
  matchDuration: number
  pregameWindow: number
  responseStructure: 'nested' | 'flat' // 'nested' = football-style, 'flat' = basketball-style
  statusCodes: {
    live: string[]
    finished: string[]
  }
  leagues: Record<number, number>
  leagueNameMatches?: Record<string, number>
  defaultPopularity: number
}

export const SPORTS_CONFIG: Record<string, SportConfig> = {
  football: {
    name: 'Football',
    apiKey: 'football',
    apiVersion: 'v3',
    apiEndpoint: 'fixtures',
    matchDuration: 120,
    pregameWindow: 15,
    responseStructure: 'nested', // Uses fixture.fixture structure
    statusCodes: {
      live: ['LIVE', '1H', 'HT', '2H', 'ET', 'P', 'BT'],
      finished: ['FT', 'AET', 'PEN']
    },
    leagues: {
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

  basketball: {
    name: 'Basketball',
    apiKey: 'basketball',
    apiVersion: 'v1',
    apiEndpoint: 'games',
    matchDuration: 150,
    pregameWindow: 15,
    responseStructure: 'flat', // Uses flat structure
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

export function getSportConfig(sport: string): SportConfig | null {
  if (!sport) {
    console.warn('getSportConfig called without sport name')
    return null
  }

  const normalizedSport = sport.toLowerCase()
  const config = SPORTS_CONFIG[normalizedSport]

  if (!config) {
    console.warn(`No configuration found for sport: ${sport}`)
    return null
  }

  return config
}

export function getApiConfig(sport: string) {
  const config = getSportConfig(sport)

  if (!config) {
    throw new Error(`Cannot get API config for unconfigured sport: ${sport}. Please add configuration in sports-config.ts`)
  }

  return {
    baseUrl: `https://${config.apiVersion}.${config.apiKey}.api-sports.io`,
    host: `${config.apiVersion}.${config.apiKey}.api-sports.io`,
    endpoint: config.apiEndpoint
  }
}
