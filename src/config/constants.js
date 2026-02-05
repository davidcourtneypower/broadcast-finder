import { getSportColors } from './sports'

/**
 * Dynamic sport colors - generates colors for any sport
 * @param {string} sportName - Sport name
 * @returns {object} Color scheme with accent, bg, and glow properties
 */
export const getSportColorScheme = (sportName) => {
  const colors = getSportColors(sportName)
  return {
    ...colors,
    glow: colors.accent.replace(')', ', 0.25)').replace('rgb', 'rgba')
  }
}

// Legacy export - kept for backwards compatibility but now uses dynamic colors
export const SPORT_COLORS = new Proxy({}, {
  get: (target, prop) => {
    if (typeof prop === 'string') {
      return getSportColorScheme(prop)
    }
    return undefined
  }
})

// Channels by country - used for user-submitted broadcasts
// Users can still add broadcasts from these channels
export const CHANNELS_BY_COUNTRY = {
  "USA": ["ESPN", "ESPN+", "FOX", "CBS", "NBC", "ABC", "TNT", "NBA TV", "Peacock", "Paramount+", "Hulu Live", "fuboTV", "Bally Sports"],
  "UK": ["Sky Sports", "BT Sport", "BBC", "ITV", "Amazon Prime Video UK", "DAZN UK", "TNT Sports"],
  "Canada": ["TSN", "Sportsnet", "CBC", "RDS", "DAZN Canada"],
  "Australia": ["Fox Sports", "Kayo Sports", "Optus Sport", "ESPN Australia"],
  "India": ["Star Sports", "Hotstar", "JioTV", "Sports18", "Sony LIV"],
  "Germany": ["Sky Deutschland", "DAZN Germany", "Sport1", "MagentaSport"],
  "France": ["Canal+", "beIN Sports France", "RMC Sport"],
  "Spain": ["Movistar+", "DAZN Spain", "LaLiga TV"],
  "Italy": ["Sky Italia", "DAZN Italy", "Rai Sport"],
  "China": ["CCTV-5", "Tencent Sports", "iQIYI Sports", "Migu Video"],
  "Turkey": ["beIN Sports Turkey", "S Sport", "TRT Spor"],
  "Greece": ["Cosmote Sport", "ERT Sports", "Nova Sports"],
  "Lithuania": ["TV3 Sport", "Go3"],
  "Serbia": ["Arena Sport", "RTS"],
  "Russia": ["Match TV", "Okko Sport"],
  "Argentina": ["ESPN Argentina", "TyC Sports", "DeporTV"],
  "Brazil": ["ESPN Brasil", "SporTV", "Band Sports"],
  "Mexico": ["ESPN Mexico", "FOX Sports Mexico", "TUDN"],
  "Japan": ["WOWOW", "J Sports", "DAZN Japan"],
  "Global": ["DAZN", "ESPN International", "beIN Sports", "Eurosport", "NBA League Pass"]
}

export const COUNTRIES = Object.keys(CHANNELS_BY_COUNTRY)

export const DATE_TABS = ["Today", "Tomorrow"]

export const FLAG_MAP = {
  USA: "🇺🇸", UK: "🇬🇧", Canada: "🇨🇦", Australia: "🇦🇺",
  India: "🇮🇳", Germany: "🇩🇪", France: "🇫🇷", Spain: "🇪🇸",
  Italy: "🇮🇹", Portugal: "🇵🇹", Sudan: "🇸🇩",
  China: "🇨🇳", Turkey: "🇹🇷", Greece: "🇬🇷", Lithuania: "🇱🇹",
  Serbia: "🇷🇸", Russia: "🇷🇺", Argentina: "🇦🇷", Brazil: "🇧🇷",
  Mexico: "🇲🇽", Japan: "🇯🇵", Global: "🌍"
}
