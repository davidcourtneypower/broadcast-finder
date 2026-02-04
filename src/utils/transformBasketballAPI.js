/**
 * Transform Basketball API-Sports.io response to BroadcastFinder format
 *
 * Usage:
 * 1. Get API response from: https://v1.basketball.api-sports.io/games?date=YYYY-MM-DD
 * 2. Copy the response JSON
 * 3. Use this function to transform it
 * 4. Import the result via Admin Panel
 */

/**
 * Transform a single basketball game to match format
 * @param {Object} game - Basketball game object from API
 * @returns {Object} Match object for database
 */
function transformGame(game) {
  // Extract date (YYYY-MM-DD format)
  const date = game.date.split('T')[0]

  // Extract time (HH:MM format)
  const time = game.time

  // Determine status
  let status = 'upcoming'
  if (game.status.short === 'LIVE' || game.status.short === 'Q1' ||
      game.status.short === 'Q2' || game.status.short === 'Q3' ||
      game.status.short === 'Q4' || game.status.short === 'OT' ||
      game.status.short === 'HT') {
    status = 'live'
  } else if (game.status.short === 'FT' || game.status.short === 'AOT') {
    status = 'finished'
  }

  // Determine popularity based on league
  let popularity = 50 // default
  const leagueName = game.league.name.toLowerCase()

  if (leagueName.includes('nba') && !leagueName.includes('g league')) {
    popularity = 95 // NBA is very popular
  } else if (leagueName.includes('euroleague')) {
    popularity = 85
  } else if (leagueName.includes('eurocup')) {
    popularity = 75
  } else if (leagueName.includes('g league')) {
    popularity = 70
  } else if (leagueName.includes('ncaa')) {
    popularity = 80
  } else if (leagueName.includes('fiba')) {
    popularity = 75
  } else if (leagueName.includes('olympics') || leagueName.includes('world cup')) {
    popularity = 90
  }

  return {
    id: `basketball-${game.id}`,
    sport: 'Basketball',
    league: game.league.name,
    home: game.teams.home.name,
    away: game.teams.away.name,
    date: date,
    time: time,
    country: game.country.name,
    status: status,
    popularity: popularity
  }
}

/**
 * Transform full Basketball API response to matches array
 * @param {Object} apiResponse - Full API response with response array
 * @returns {Array} Array of match objects ready for import
 */
export function transformBasketballResponse(apiResponse) {
  if (!apiResponse.response || !Array.isArray(apiResponse.response)) {
    throw new Error('Invalid API response format. Expected response array.')
  }

  return apiResponse.response
    .filter(game => game.teams && game.teams.home && game.teams.away) // Filter out invalid games
    .map(transformGame)
}

/**
 * Usage example in browser console:
 *
 * // 1. Import the function (if using as module)
 * import { transformBasketballResponse } from './utils/transformBasketballAPI.js'
 *
 * // 2. Paste your API response as apiData
 * const apiData = { "get": "games", "response": [...] }
 *
 * // 3. Transform it
 * const matches = transformBasketballResponse(apiData)
 *
 * // 4. Copy to clipboard
 * copy(JSON.stringify(matches, null, 2))
 *
 * // 5. Paste into Admin Panel Import tab
 */

// For Node.js or direct usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { transformBasketballResponse }
}

// For browser console usage - attach to window
if (typeof window !== 'undefined') {
  window.transformBasketballResponse = transformBasketballResponse
}
