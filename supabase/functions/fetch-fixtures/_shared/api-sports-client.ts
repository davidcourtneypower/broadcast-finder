import { getApiConfig } from './sports-config.ts';

export class ApiSportsClient {
  private apiKey: string;
  private sport: string;
  private timeout = 15000; // 15 seconds

  constructor(apiKey: string, sport: string) {
    if (!sport) {
      throw new Error('Sport parameter is required for ApiSportsClient');
    }
    this.apiKey = apiKey;
    this.sport = sport;
  }

  private getApiConfig() {
    return getApiConfig(this.sport);
  }

  async fetchFixtures(params: { date: string }) {
    const config = this.getApiConfig();
    const url = new URL(`${config.baseUrl}/${config.endpoint}`);
    url.searchParams.append('date', params.date);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': config.host
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error('API request timed out after 15 seconds');
      }
      throw error;
    }
  }
}
