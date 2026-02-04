import { getSportConfig } from './sports-config.ts';

export function transformApiSportsFixture(fixture: any, sport: string) {
  // Capitalize sport name
  const sportName = sport.charAt(0).toUpperCase() + sport.slice(1);

  // Get sport config to determine response structure
  const config = getSportConfig(sport);

  // Handle different API response structures based on config
  // 'flat' = data at root level (basketball-style)
  // 'nested' = data in fixture.fixture (football-style)
  const useFlatStructure = config?.responseStructure === 'flat';

  const fixtureData = useFlatStructure ? fixture : fixture.fixture;
  const statusShort = useFlatStructure ? fixture.status.short : fixture.fixture.status.short;

  return {
    id: `${sport}-${fixtureData.id || fixture.id}`,
    sport: sportName,
    league: fixture.league.name,
    home: fixture.teams.home.name,
    away: fixture.teams.away.name,
    match_date: (fixtureData.date || fixture.date).split('T')[0],
    match_time: ((fixtureData.date || fixture.date).split('T')[1] || fixture.time || '00:00').substring(0, 5),
    country: fixture.country?.name || fixture.league?.country || 'Global',
    status: mapStatus(statusShort, sport),
    popularity: calculatePopularity(fixture.league.id, fixture.league.name, sport),
  };
}

function mapStatus(apiStatus: string, sport: string): string {
  const config = getSportConfig(sport);

  // Handle unconfigured sports with sensible defaults
  if (!config) {
    console.warn(`Using default status mapping for unconfigured sport: ${sport}`);
    const commonLiveStatuses = ['LIVE', '1H', '2H', 'Q1', 'Q2', 'Q3', 'Q4'];
    const commonFinishedStatuses = ['FT', 'AOT', 'AET'];

    if (commonLiveStatuses.includes(apiStatus)) return 'live';
    if (commonFinishedStatuses.includes(apiStatus)) return 'finished';
    return 'upcoming';
  }

  if (config.statusCodes.live.includes(apiStatus)) return 'live';
  if (config.statusCodes.finished.includes(apiStatus)) return 'finished';
  return 'upcoming';
}

function calculatePopularity(leagueId: number, leagueName: string, sport: string): number {
  const config = getSportConfig(sport);

  // Handle unconfigured sports with default popularity
  if (!config) {
    console.warn(`Using default popularity for unconfigured sport: ${sport}`);
    return 70; // Generic default popularity
  }

  // Try league ID match first
  if (config.leagues[leagueId]) {
    return config.leagues[leagueId];
  }

  // Fallback to name-based matching if configured
  if (config.leagueNameMatches) {
    const nameLower = leagueName.toLowerCase();

    for (const [pattern, popularity] of Object.entries(config.leagueNameMatches)) {
      if (nameLower.includes(pattern)) {
        return popularity;
      }
    }
  }

  // Return default popularity for the sport
  return config.defaultPopularity;
}
