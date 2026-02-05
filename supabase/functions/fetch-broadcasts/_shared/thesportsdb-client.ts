/**
 * TheSportsDB API Client
 * Handles all interactions with TheSportsDB API including rate limiting
 */

export interface TheSportsDBTVEvent {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strLeague: string;
  strSport: string;
  dateEvent: string;      // YYYY-MM-DD
  strTime: string;        // HH:MM:SS or HH:MM
  strCountry: string;     // Country or comma-separated countries
  strTVStation: string;   // Channel or comma-separated channels
}

export interface TheSportsDBTVResponse {
  tvevents: TheSportsDBTVEvent[] | null;
}

export class TheSportsDBClient {
  private apiKey: string;
  private baseUrl = 'https://www.thesportsdb.com/api/v1/json';
  private timeout = 15000; // 15 seconds
  private lastRequestTime = 0;
  private minRequestInterval: number;

  /**
   * @param apiKey - API key ('1' for free tier, or premium key)
   * @param isPremium - If true, uses faster rate limit (100 req/min vs 1 req/min)
   */
  constructor(apiKey: string = '1', isPremium: boolean = false) {
    this.apiKey = apiKey;
    // Free tier: 1 request per minute (60000ms)
    // Premium: 100 requests per minute (600ms)
    this.minRequestInterval = isPremium ? 600 : 60000;
  }

  /**
   * Enforce rate limiting by waiting if necessary
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (this.lastRequestTime > 0 && timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch TV schedule by date and sport
   * @param params.date - Date in YYYY-MM-DD format
   * @param params.sport - Sport name (e.g., 'Soccer', 'Basketball')
   */
  async fetchTVSchedule(params: { date: string; sport: string }): Promise<TheSportsDBTVResponse> {
    await this.enforceRateLimit();

    const url = new URL(`${this.baseUrl}/${this.apiKey}/eventstv.php`);
    url.searchParams.append('d', params.date);
    url.searchParams.append('s', params.sport);

    console.log(`Fetching TV schedule: ${url.toString()}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TheSportsDB API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as TheSportsDBTVResponse;

    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error(`TheSportsDB request timed out after ${this.timeout / 1000}s`);
      }
      throw error;
    }
  }

  /**
   * Lookup TV broadcasts for a specific event
   * @param eventId - TheSportsDB event ID
   */
  async lookupEventTV(eventId: string): Promise<TheSportsDBTVResponse> {
    await this.enforceRateLimit();

    const url = new URL(`${this.baseUrl}/${this.apiKey}/lookuptv.php`);
    url.searchParams.append('id', eventId);

    console.log(`Looking up event TV: ${url.toString()}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TheSportsDB API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as TheSportsDBTVResponse;

    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error(`TheSportsDB request timed out after ${this.timeout / 1000}s`);
      }
      throw error;
    }
  }
}
