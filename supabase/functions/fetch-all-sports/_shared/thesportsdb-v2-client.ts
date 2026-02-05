/**
 * TheSportsDB V2 API Client
 * Premium tier client for fetching all sports events and TV broadcasts
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

export class TheSportsDBv2Client {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || Deno.env.get('THESPORTSDB_API_KEY') || '987156';
    this.baseUrl = `https://www.thesportsdb.com/api/v2/json/${this.apiKey}`;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Fetch all events for a specific day (all sports)
   */
  async fetchEventsForDay(date: string): Promise<TheSportsDBEvent[]> {
    const url = `${this.baseUrl}/eventsday.php?d=${date}`;
    console.log(`Fetching events for ${date}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data: FetchEventsResponse = await response.json();
      const events = data.events || [];
      console.log(`Received ${events.length} events for ${date}`);
      return events;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms for ${url}`);
      }
      throw error;
    }
  }

  /**
   * Fetch all TV broadcasts for a specific day (all sports)
   */
  async fetchTVForDay(date: string): Promise<TheSportsDBTVEvent[]> {
    const url = `${this.baseUrl}/eventstv.php?d=${date}`;
    console.log(`Fetching TV broadcasts for ${date}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data: FetchTVResponse = await response.json();
      const tvevents = data.tvevents || [];
      console.log(`Received ${tvevents.length} TV events for ${date}`);
      return tvevents;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms for ${url}`);
      }
      throw error;
    }
  }
}
