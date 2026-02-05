/**
 * TheSportsDB Sport Configuration
 * Maps between TheSportsDB identifiers and internal sport names
 */

export interface TheSportsDBSportConfig {
  /** Sport name used in TheSportsDB API (e.g., 'Soccer', 'Basketball') */
  sportsdbSport: string;
  /** Internal sport name used in our database (e.g., 'Football', 'Basketball') */
  internalSport: string;
  /** Common team name variations/abbreviations to normalize */
  teamNameNormalizations: Record<string, string>;
  /** Map TheSportsDB league names to our league names */
  leagueNameMappings: Record<string, string>;
}

export const THESPORTSDB_SPORTS: Record<string, TheSportsDBSportConfig> = {
  football: {
    sportsdbSport: 'Soccer',
    internalSport: 'Football',
    teamNameNormalizations: {
      // English clubs
      'man utd': 'manchester united',
      'man united': 'manchester united',
      'man city': 'manchester city',
      'spurs': 'tottenham',
      'tottenham hotspur': 'tottenham',
      'wolves': 'wolverhampton',
      'wolverhampton wanderers': 'wolverhampton',
      'west ham united': 'west ham',
      'newcastle united': 'newcastle',
      'nottm forest': 'nottingham forest',
      'nott\'m forest': 'nottingham forest',
      'brighton and hove albion': 'brighton',
      'brighton & hove albion': 'brighton',
      'leicester city': 'leicester',
      'aston villa fc': 'aston villa',

      // Spanish clubs
      'atletico madrid': 'atletico de madrid',
      'atlético madrid': 'atletico de madrid',
      'atlético de madrid': 'atletico de madrid',
      'real sociedad': 'real sociedad',
      'athletic bilbao': 'athletic club',

      // German clubs
      'bayern munich': 'bayern munchen',
      'bayern münchen': 'bayern munchen',
      'borussia dortmund': 'dortmund',
      'rb leipzig': 'rasenballsport leipzig',
      'bayer leverkusen': 'leverkusen',

      // Italian clubs
      'inter milan': 'internazionale',
      'inter': 'internazionale',
      'ac milan': 'milan',
      'juventus fc': 'juventus',
      'napoli': 'ssc napoli',

      // French clubs
      'paris saint-germain': 'paris saint germain',
      'psg': 'paris saint germain',
      'olympique marseille': 'marseille',
      'olympique lyon': 'lyon',

      // Common suffixes removal handled in normalizer
    },
    leagueNameMappings: {
      'English Premier League': 'Premier League',
      'English League Championship': 'Championship',
      'Spanish La Liga': 'La Liga',
      'German Bundesliga': 'Bundesliga',
      'Italian Serie A': 'Serie A',
      'French Ligue 1': 'Ligue 1',
      'UEFA Champions League': 'Champions League',
      'UEFA Europa League': 'Europa League',
      'UEFA Europa Conference League': 'Europa Conference League',
      'FIFA World Cup': 'World Cup',
      'UEFA European Championship': 'Euro Championship',
    }
  },

  basketball: {
    sportsdbSport: 'Basketball',
    internalSport: 'Basketball',
    teamNameNormalizations: {
      // NBA teams - full names to short forms
      'la lakers': 'los angeles lakers',
      'la clippers': 'los angeles clippers',
      'okc thunder': 'oklahoma city thunder',
      'okc': 'oklahoma city thunder',
      'ny knicks': 'new york knicks',
      'nyc knicks': 'new york knicks',
      'gs warriors': 'golden state warriors',
      'gsw': 'golden state warriors',
      'nola pelicans': 'new orleans pelicans',

      // European teams
      'real madrid baloncesto': 'real madrid',
      'fc barcelona basket': 'barcelona',
      'fc barcelona baloncesto': 'barcelona',
    },
    leagueNameMappings: {
      'NBA': 'NBA',
      'National Basketball Association': 'NBA',
      'EuroLeague': 'EuroLeague',
      'Turkish Airlines EuroLeague': 'EuroLeague',
      'NCAA Men\'s Basketball': 'NCAA',
      'NCAA': 'NCAA',
      'FIBA World Cup': 'World Cup',
    }
  }
};

/**
 * Get configuration for a sport
 * @param sport - Internal sport name (e.g., 'football', 'basketball')
 */
export function getSportsDBConfig(sport: string): TheSportsDBSportConfig | null {
  const normalizedSport = sport.toLowerCase();
  return THESPORTSDB_SPORTS[normalizedSport] || null;
}

/**
 * Get all supported sports
 */
export function getSupportedSports(): string[] {
  return Object.keys(THESPORTSDB_SPORTS);
}
