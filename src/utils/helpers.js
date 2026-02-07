import { FLAG_MAP } from '../config/constants'

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

// Raw TheSportsDB strStatus values that indicate the match is in play
const LIVE_STATUSES = new Set([
  '1H', '2H', 'HT', 'ET', 'P', 'BT',
  'Q1', 'Q2', 'Q3', 'Q4', 'OT',
  'P1', 'P2', 'P3', 'PT',
  'IN1', 'IN2', 'IN3', 'IN4', 'IN5', 'IN6', 'IN7', 'IN8', 'IN9',
  'S1', 'S2', 'S3', 'S4', 'S5',
])

const FINISHED_STATUSES = new Set(['FT', 'AET', 'AOT', 'PEN', 'AP'])

const CANCELLED_STATUSES = new Set([
  'CANC', 'PST', 'ABD', 'SUSP', 'INT', 'INTR', 'POST', 'AWD', 'WO', 'AW',
])

/**
 * Create a status mapper that uses DB-loaded mappings with hardcoded fallback.
 * @param {Object|null} dbStatusMap - Map of raw_status (uppercased) -> display_category from DB
 * @returns {function} - Mapping function: (rawStatus) => 'upcoming'|'live'|'finished'|'cancelled'
 */
export const createStatusMapper = (dbStatusMap) => (rawStatus) => {
  if (!rawStatus) return 'upcoming'
  const s = rawStatus.toUpperCase().trim()
  if (s === '') return 'upcoming'

  // DB mappings first (if loaded)
  if (dbStatusMap && dbStatusMap[s]) return dbStatusMap[s]

  // Hardcoded fallback (identical to seed data — works if DB empty)
  if (s === 'NS' || s === 'TBD' || s === 'UPCOMING') return 'upcoming'
  if (LIVE_STATUSES.has(s)) return 'live'
  if (FINISHED_STATUSES.has(s)) return 'finished'
  if (CANCELLED_STATUSES.has(s)) return 'cancelled'
  if (/^\d+$/.test(s)) return 'live'
  return 'live'
}

// Standalone mapper using hardcoded fallback only (backward compatibility)
export const mapApiStatusToDisplay = createStatusMapper(null)
