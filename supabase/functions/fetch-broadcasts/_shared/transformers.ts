/**
 * Broadcast Transformers
 * Transform TheSportsDB TV data into broadcast records for database insertion
 */

import { TheSportsDBTVEvent } from './thesportsdb-client.ts';

export interface BroadcastInsert {
  match_id: string;
  country: string;
  channel: string;
  created_by: string;
  source: string;
  source_id: string;
  confidence_score: number;
}

/** Map common country codes/names to standardized names */
const COUNTRY_NORMALIZATIONS: Record<string, string> = {
  // Common codes
  'us': 'USA',
  'usa': 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  'uk': 'UK',
  'gb': 'UK',
  'united kingdom': 'UK',
  'great britain': 'UK',
  'england': 'UK',
  'ca': 'Canada',
  'can': 'Canada',
  'de': 'Germany',
  'ger': 'Germany',
  'deutschland': 'Germany',
  'fr': 'France',
  'fra': 'France',
  'es': 'Spain',
  'esp': 'Spain',
  'españa': 'Spain',
  'it': 'Italy',
  'ita': 'Italy',
  'italia': 'Italy',
  'au': 'Australia',
  'aus': 'Australia',
  'in': 'India',
  'ind': 'India',
  'cn': 'China',
  'chn': 'China',
  'jp': 'Japan',
  'jpn': 'Japan',
  'br': 'Brazil',
  'bra': 'Brazil',
  'brasil': 'Brazil',
  'mx': 'Mexico',
  'mex': 'Mexico',
  'méxico': 'Mexico',
  'ar': 'Argentina',
  'arg': 'Argentina',
  'tr': 'Turkey',
  'tur': 'Turkey',
  'türkiye': 'Turkey',
  'ru': 'Russia',
  'rus': 'Russia',
  'worldwide': 'Global',
  'international': 'Global',
  'world': 'Global',
};

/**
 * Normalize country name to match our CHANNELS_BY_COUNTRY keys
 */
function normalizeCountry(country: string): string {
  if (!country) return 'Global';

  const normalized = country.toLowerCase().trim();
  return COUNTRY_NORMALIZATIONS[normalized] || country;
}

/**
 * Parse TV stations string which may contain multiple channels
 * Format can be: "ESPN, Fox Sports" or "ESPN (USA), Sky Sports (UK)"
 */
function parseTVStations(
  tvStation: string | null,
  defaultCountry: string
): Array<{ channel: string; country: string }> {
  if (!tvStation) return [];

  const results: Array<{ channel: string; country: string }> = [];

  // Split by comma
  const stations = tvStation.split(',').map(s => s.trim()).filter(Boolean);

  for (const station of stations) {
    // Check if station has country in parentheses: "ESPN (USA)"
    const match = station.match(/^(.+?)\s*\(([^)]+)\)$/);

    if (match) {
      const channel = match[1].trim();
      const country = normalizeCountry(match[2].trim());
      if (channel) {
        results.push({ channel, country });
      }
    } else {
      // No country specified, use default
      const channel = station.trim();
      if (channel) {
        results.push({ channel, country: normalizeCountry(defaultCountry) });
      }
    }
  }

  return results;
}

/**
 * Transform TheSportsDB TV event data into broadcast records
 * @param tvEvent - TheSportsDB TV event data
 * @param matchId - Our database match ID to associate with
 * @param matchScore - Match quality score (70-100) for confidence calculation
 */
export function transformTheSportsDBTVToBroadcasts(
  tvEvent: TheSportsDBTVEvent,
  matchId: string,
  matchScore: number
): BroadcastInsert[] {
  const broadcasts: BroadcastInsert[] = [];

  // Parse TV stations with country information
  const stations = parseTVStations(tvEvent.strTVStation, tvEvent.strCountry || 'Global');

  // Calculate confidence score based on match quality
  // Match score 70-100 maps to confidence 40-70
  const baseConfidence = Math.round(40 + ((matchScore - 70) / 30) * 30);
  const confidence = Math.min(70, Math.max(40, baseConfidence));

  for (const { channel, country } of stations) {
    broadcasts.push({
      match_id: matchId,
      country: country,
      channel: channel,
      created_by: 'system',
      source: 'thesportsdb',
      source_id: tvEvent.idEvent,
      confidence_score: confidence
    });
  }

  return broadcasts;
}

/**
 * Deduplicate broadcasts by match_id + channel + country combination
 * Keeps the one with highest confidence score
 */
export function deduplicateBroadcasts(broadcasts: BroadcastInsert[]): BroadcastInsert[] {
  const seen = new Map<string, BroadcastInsert>();

  for (const broadcast of broadcasts) {
    const key = `${broadcast.match_id}|${broadcast.channel.toLowerCase()}|${broadcast.country.toLowerCase()}`;

    const existing = seen.get(key);
    if (!existing || broadcast.confidence_score > existing.confidence_score) {
      seen.set(key, broadcast);
    }
  }

  return Array.from(seen.values());
}
