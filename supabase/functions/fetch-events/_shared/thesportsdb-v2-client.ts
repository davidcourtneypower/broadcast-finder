/**
 * TheSportsDB API Client
 * Premium/Business tier client for fetching all sports events and TV broadcasts
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

export interface FetchEventsResponse {
  events: TheSportsDBEvent[] | null;
}

export interface FetchTVResponse {
  tvevents: TheSportsDBTVEvent[] | null;
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
   * Uses V1 eventsday.php endpoint (works for all tiers)
   * Premium keys get access to all sports/leagues
   */
  async fetchEventsForDay(date: string): Promise<TheSportsDBEvent[]> {
    // V1 eventsday.php works for all tiers
    // Premium keys can fetch all events without league filter
    if (this.isPremium) {
      return this.fetchAllEventsV1(date);
    }
    // Free tier needs to query specific leagues
    return this.fetchEventsByLeaguesV1(date);
  }

  /**
   * V1 Premium: Fetch ALL events for a day (no league filter)
   */
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

  /**
   * V1 Free/Fallback: Fetch events from popular leagues one by one
   */
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

          // Deduplicate events
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

  /**
   * Fetch all TV broadcasts for a specific day
   * Uses V2 endpoint with header auth for premium/business tier
   * Falls back to V1 for compatibility
   */
  async fetchTVForDay(date: string): Promise<TheSportsDBTVEvent[]> {
    if (!this.isPremium) {
      console.log('[Free] TV broadcasts endpoint requires premium API key');
      return [];
    }

    // Try V2 first (header auth, modern endpoint)
    try {
      const tvEvents = await this.fetchTVV2(date);
      if (tvEvents.length > 0) {
        return tvEvents;
      }
    } catch (error) {
      console.warn(`[V2] TV fetch failed: ${(error as Error).message}, trying V1...`);
    }

    // Fallback to V1 eventstv.php
    return this.fetchTVV1(date);
  }

  /**
   * V2: Fetch TV broadcasts with header-based auth
   * Endpoint: /api/v2/json/filter/tv/day/{date}
   */
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

  /**
   * V1: Fetch TV broadcasts (key in URL)
   * Endpoint: /api/v1/json/{key}/eventstv.php?d={date}
   */
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
   * Helper to fetch with timeout
   * @param url The URL to fetch
   * @param useV2Auth If true, use X-API-KEY header (V2), otherwise key is in URL (V1)
   */
  private async fetchWithTimeout(url: string, useV2Auth: boolean): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    // V2 uses header-based auth
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
