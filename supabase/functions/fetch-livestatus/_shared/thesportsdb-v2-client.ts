/**
 * TheSportsDB API Client
 * Premium/Business tier client for fetching all sports events, TV broadcasts, and livescores
 *
 * API Structure:
 * - V1: Key in URL path (/api/v1/json/{key}/...)
 * - V2: Key in X-API-KEY header (/api/v2/json/...)
 */

export interface TheSportsDBEvent {
  idEvent: string;
  idLeague: string;
  strEvent: string;
  strEventAlternate: string;
  strFilename: string;
  strSport: string;
  strLeague: string;
  strLeagueAlternate: string;
  strSeason: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intSpectators: string | null;
  strStatus: string;
  strVenue: string;
  strCountry: string;
  strCity: string;
  strPoster: string;
  strSquare: string;
  strFanart: string;
  strThumb: string;
  strBanner: string;
  strMap: string;
  strVideo: string;
  strPostponed: string;
  dateEvent: string;
  strTime: string;
  strTimestamp: string;
  idHomeTeam: string;
  idAwayTeam: string;
}

export interface TheSportsDBTVEvent {
  idEvent: string;
  strEvent: string;
  strSport: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strTime: string;
  strChannel: string;
  strCountry: string;
  strLogo: string;
  strPoster: string;
  strTVStation: string;
}

export interface TheSportsDBLivescoreEvent {
  idLiveScore: string;
  idEvent: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string;
  strProgress: string;
  strEventTime: string;
  dateEvent: string;
  updated: string;
}

export interface FetchEventsResponse {
  events: TheSportsDBEvent[] | null;
}

export interface FetchTVResponse {
  tvevents: TheSportsDBTVEvent[] | null;
}

export interface FetchLivescoresResponse {
  livescore: TheSportsDBLivescoreEvent[] | null;
}

// Popular league IDs for V1 fallback
const POPULAR_LEAGUES = [
  // Soccer
  { id: '4328', name: 'English Premier League' },
  { id: '4331', name: 'German Bundesliga' },
  { id: '4332', name: 'Italian Serie A' },
  { id: '4334', name: 'French Ligue 1' },
  { id: '4335', name: 'Spanish La Liga' },
  { id: '4346', name: 'MLS' },
  { id: '4480', name: 'UEFA Champions League' },
  // Basketball
  { id: '4387', name: 'NBA' },
  { id: '4424', name: 'EuroLeague' },
  // American Football
  { id: '4391', name: 'NFL' },
  // Ice Hockey
  { id: '4380', name: 'NHL' },
  // Baseball
  { id: '4424', name: 'MLB' },
  // Tennis
  { id: '4464', name: 'ATP Tour' },
  // Cricket
  { id: '4472', name: 'Indian Premier League' },
];

export class TheSportsDBv2Client {
  private apiKey: string;
  private timeout: number;
  private isPremium: boolean;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || Deno.env.get('THESPORTSDB_API_KEY') || '3';
    // Free tier key is '3', any other key is premium/business
    this.isPremium = this.apiKey !== '3';
    this.timeout = 30000; // 30 seconds
    console.log(`TheSportsDB client initialized with key: ${this.apiKey.substring(0, 3)}***, isPremium: ${this.isPremium}`);
  }

  // V1: Key in URL path
  private get baseUrlV1(): string {
    return `https://www.thesportsdb.com/api/v1/json/${this.apiKey}`;
  }

  // V2: Key goes in header, not in URL
  private get baseUrlV2(): string {
    return 'https://www.thesportsdb.com/api/v2/json';
  }

  /**
   * Fetch all events for a specific day (all sports)
   */
  async fetchEventsForDay(date: string): Promise<TheSportsDBEvent[]> {
    if (this.isPremium) {
      return this.fetchAllEventsV1(date);
    }
    return this.fetchEventsByLeaguesV1(date);
  }

  private async fetchAllEventsV1(date: string): Promise<TheSportsDBEvent[]> {
    const url = `${this.baseUrlV1}/eventsday.php?d=${date}`;
    console.log(`[V1-Premium] Fetching all events for ${date}...`);

    try {
      const response = await this.fetchWithTimeout(url, false);

      if (!response.ok) {
        console.warn(`[V1-Premium] API returned ${response.status}, trying league-by-league...`);
        return this.fetchEventsByLeaguesV1(date);
      }

      const data: FetchEventsResponse = await response.json();
      const events = data.events || [];
      console.log(`[V1-Premium] Received ${events.length} events for ${date}`);
      return events;
    } catch (error) {
      console.warn(`[V1-Premium] Fetch failed: ${(error as Error).message}, trying league-by-league...`);
      return this.fetchEventsByLeaguesV1(date);
    }
  }

  private async fetchEventsByLeaguesV1(date: string): Promise<TheSportsDBEvent[]> {
    console.log(`[V1] Fetching events from ${POPULAR_LEAGUES.length} popular leagues for ${date}...`);

    const allEvents: TheSportsDBEvent[] = [];
    const seenIds = new Set<string>();

    for (const league of POPULAR_LEAGUES) {
      try {
        const url = `${this.baseUrlV1}/eventsday.php?d=${date}&l=${league.id}`;
        const response = await this.fetchWithTimeout(url, false);

        if (response.ok) {
          const data: FetchEventsResponse = await response.json();
          const events = data.events || [];

          for (const event of events) {
            if (!seenIds.has(event.idEvent)) {
              seenIds.add(event.idEvent);
              allEvents.push(event);
            }
          }

          if (events.length > 0) {
            console.log(`[V1] ${league.name}: ${events.length} events`);
          }
        }
      } catch (error) {
        console.warn(`[V1] Failed to fetch ${league.name}: ${(error as Error).message}`);
      }
    }

    console.log(`[V1] Total: ${allEvents.length} events from popular leagues`);
    return allEvents;
  }

  async fetchTVForDay(date: string): Promise<TheSportsDBTVEvent[]> {
    if (!this.isPremium) {
      console.log('[Free] TV broadcasts endpoint requires premium API key');
      return [];
    }

    try {
      const tvEvents = await this.fetchTVV2(date);
      if (tvEvents.length > 0) {
        return tvEvents;
      }
    } catch (error) {
      console.warn(`[V2] TV fetch failed: ${(error as Error).message}, trying V1...`);
    }

    return this.fetchTVV1(date);
  }

  private async fetchTVV2(date: string): Promise<TheSportsDBTVEvent[]> {
    const url = `${this.baseUrlV2}/filter/tv/day/${date}`;
    console.log(`[V2] Fetching TV broadcasts for ${date}...`);

    const response = await this.fetchWithTimeout(url, true);

    if (!response.ok) {
      console.warn(`[V2] TV API returned ${response.status}`);
      throw new Error(`V2 TV API returned ${response.status}`);
    }

    const data: FetchTVResponse = await response.json();
    const tvevents = data.tvevents || [];
    console.log(`[V2] Received ${tvevents.length} TV events for ${date}`);
    return tvevents;
  }

  private async fetchTVV1(date: string): Promise<TheSportsDBTVEvent[]> {
    const url = `${this.baseUrlV1}/eventstv.php?d=${date}`;
    console.log(`[V1] Fetching TV broadcasts for ${date}...`);

    try {
      const response = await this.fetchWithTimeout(url, false);

      if (!response.ok) {
        console.warn(`[V1] TV API returned ${response.status}`);
        return [];
      }

      const data: FetchTVResponse = await response.json();
      const tvevents = data.tvevents || [];
      console.log(`[V1] Received ${tvevents.length} TV events for ${date}`);
      return tvevents;
    } catch (error) {
      console.warn(`[V1] TV fetch failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Fetch all current livescores across all sports (V2 endpoint, header auth)
   * Endpoint: /api/v2/json/livescore/all
   */
  async fetchLivescores(): Promise<TheSportsDBLivescoreEvent[]> {
    if (!this.isPremium) {
      console.log('[Free] Livescore endpoint requires premium/business API key');
      return [];
    }

    const url = `${this.baseUrlV2}/livescore/all`;
    console.log('[V2] Fetching all livescores...');

    try {
      const response = await this.fetchWithTimeout(url, true);

      if (!response.ok) {
        console.warn(`[V2] Livescore API returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      const keys = Object.keys(data || {});
      console.log(`[V2] Livescore response keys: [${keys.join(', ')}]`);
      const events: TheSportsDBLivescoreEvent[] = data?.livescore || data?.events || [];
      console.log(`[V2] Received ${events.length} livescore events`);
      return events;
    } catch (error) {
      console.error(`[V2] Livescore fetch failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async fetchWithTimeout(url: string, useV2Auth: boolean): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (useV2Auth) {
      headers['X-API-KEY'] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }
}
