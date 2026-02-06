/**
 * Fetch Broadcasts Edge Function (V2 - Simplified)
 * Fetches TV broadcast data from TheSportsDB and links directly by event ID
 * No fuzzy matching needed - both fixtures and broadcasts come from TheSportsDB
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBv2Client, TheSportsDBTVEvent } from './_shared/thesportsdb-v2-client.ts';

interface BroadcastInsert {
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

function normalizeCountry(country: string): string {
  if (!country) return 'Global';
  const normalized = country.toLowerCase().trim();
  return COUNTRY_NORMALIZATIONS[normalized] || country;
}

/** Known country flag emojis for initial population */
const FLAG_LOOKUP: Record<string, string> = {
  'USA': '🇺🇸', 'UK': '🇬🇧', 'Canada': '🇨🇦', 'Australia': '🇦🇺',
  'India': '🇮🇳', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Spain': '🇪🇸',
  'Italy': '🇮🇹', 'Portugal': '🇵🇹', 'China': '🇨🇳', 'Turkey': '🇹🇷',
  'Greece': '🇬🇷', 'Lithuania': '🇱🇹', 'Serbia': '🇷🇸', 'Russia': '🇷🇺',
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Mexico': '🇲🇽', 'Japan': '🇯🇵',
  'Latvia': '🇱🇻', 'New Zealand': '🇳🇿', 'Poland': '🇵🇱', 'Slovenia': '🇸🇮',
  'Croatia': '🇭🇷', 'Czechia': '🇨🇿', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹',
  'Belgium': '🇧🇪', 'Norway': '🇳🇴', 'Finland': '🇫🇮', 'Slovakia': '🇸🇰',
  'Ireland': '🇮🇪', 'Sweden': '🇸🇪', 'South Africa': '🇿🇦', 'Paraguay': '🇵🇾',
  'Bulgaria': '🇧🇬', 'Denmark': '🇩🇰', 'Iceland': '🇮🇸', 'The Netherlands': '🇳🇱',
  'Azerbaijan': '🇦🇿', 'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳', 'Romania': '🇷🇴',
  'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦', 'Israel': '🇮🇱', 'Thailand': '🇹🇭',
  'Singapore': '🇸🇬', 'Malaysia': '🇲🇾', 'Bosnia and Herzegovina': '🇧🇦',
  'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Ukraine': '🇺🇦', 'Belarus': '🇧🇾',
  'Nicaragua': '🇳🇮', 'Guatemala': '🇬🇹', 'Peru': '🇵🇪', 'El Salvador': '🇸🇻',
  'Honduras': '🇭🇳', 'Estonia': '🇪🇪', 'Costa Rica': '🇨🇷', 'Albania': '🇦🇱',
  'Sudan': '🇸🇩', 'South Korea': '🇰🇷', 'Philippines': '🇵🇭', 'Hungary': '🇭🇺',
  'Global': '🌍',
};

/**
 * Auto-populate countries and country_channels reference tables from broadcast data.
 * Uses ON CONFLICT DO NOTHING so existing rows are never overwritten.
 */
async function upsertBroadcastReferenceData(
  supabase: any,
  tvEvents: TheSportsDBTVEvent[]
) {
  // 1. Collect unique countries and channels per country
  const countrySet = new Set<string>();
  const channelsByCountry = new Map<string, Set<string>>();

  for (const tv of tvEvents) {
    const country = normalizeCountry(tv.strCountry || 'Global');
    countrySet.add(country);

    if (tv.strChannel) {
      if (!channelsByCountry.has(country)) {
        channelsByCountry.set(country, new Set());
      }
      channelsByCountry.get(country)!.add(tv.strChannel);
    }
  }

  // 2. Upsert countries
  if (countrySet.size > 0) {
    const countryRows = [...countrySet].map(name => ({
      name,
      flag_emoji: FLAG_LOOKUP[name] || '🌍'
    }));
    const { error: countryError } = await supabase
      .from('countries')
      .upsert(countryRows, { onConflict: 'name', ignoreDuplicates: true });

    if (countryError) {
      console.warn(`Failed to upsert countries: ${countryError.message}`);
    } else {
      console.log(`Upserted ${countrySet.size} countries to reference table`);
    }
  }

  // 3. Upsert country_channels
  if (channelsByCountry.size > 0) {
    // Fetch country IDs
    const { data: countriesData } = await supabase
      .from('countries')
      .select('id, name');

    const countryIdMap = new Map<string, number>();
    (countriesData || []).forEach((c: any) => countryIdMap.set(c.name, c.id));

    const channelRows: { country_id: number; channel_name: string }[] = [];
    for (const [country, channels] of channelsByCountry) {
      const countryId = countryIdMap.get(country);
      if (countryId) {
        for (const channel of channels) {
          channelRows.push({ country_id: countryId, channel_name: channel });
        }
      }
    }

    if (channelRows.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < channelRows.length; i += batchSize) {
        const batch = channelRows.slice(i, i + batchSize);
        const { error: channelError } = await supabase
          .from('country_channels')
          .upsert(batch, { onConflict: 'country_id,channel_name', ignoreDuplicates: true });

        if (channelError) {
          console.warn(`Failed to upsert country_channels batch: ${channelError.message}`);
        }
      }
      console.log(`Upserted ${channelRows.length} country_channels to reference table`);
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      dates = ['today', 'tomorrow'],
      trigger = 'manual'
    } = body;

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Initialize TheSportsDB V2 client
    const client = new TheSportsDBv2Client();

    // Build date strings
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const dateMap: Record<string, string> = {
      'today': today.toISOString().split('T')[0],
      'tomorrow': tomorrow.toISOString().split('T')[0],
      'day_after_tomorrow': dayAfterTomorrow.toISOString().split('T')[0]
    };

    const datesToFetch = dates
      .map((d: string) => dateMap[d] || d)
      .filter(Boolean);

    console.log(`Starting broadcast fetch for dates: ${datesToFetch.join(', ')}, trigger: ${trigger}`);

    // Log sample sportsdb_event_ids from matches table for debugging
    const { data: sampleMatches } = await supabase
      .from('matches')
      .select('sportsdb_event_id, home, away')
      .not('sportsdb_event_id', 'is', null)
      .limit(5);

    if (sampleMatches && sampleMatches.length > 0) {
      const sampleDbIds = sampleMatches.map(m => m.sportsdb_event_id).join(', ');
      console.log(`Sample DB sportsdb_event_ids: ${sampleDbIds}`);
      console.log(`Sample matches: ${sampleMatches.map(m => `${m.home} vs ${m.away}`).join(', ')}`);
    } else {
      console.warn('NO matches found with sportsdb_event_id populated!');

      // Check if there are any matches at all
      const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true });
      console.log(`Total matches in DB: ${count}`);
    }

    // Track statistics
    let totalTVEventsFound = 0;
    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalBroadcastsInserted = 0;
    const errors: string[] = [];
    const allRawTVEvents: TheSportsDBTVEvent[] = [];

    // Fetch TV broadcasts for each date
    for (const date of datesToFetch) {
      try {
        console.log(`Fetching TV broadcasts for ${date}...`);
        const tvEvents = await client.fetchTVForDay(date);

        if (!tvEvents || tvEvents.length === 0) {
          console.log(`No TV events found for ${date}`);
          continue;
        }

        console.log(`Found ${tvEvents.length} TV events for ${date}`);
        totalTVEventsFound += tvEvents.length;
        allRawTVEvents.push(...tvEvents);

        // Collect all broadcasts for batch insert
        const allBroadcasts: BroadcastInsert[] = [];

        // Log sample TV event IDs for debugging
        if (tvEvents.length > 0) {
          const sampleIds = tvEvents.slice(0, 5).map(e => e.idEvent).join(', ');
          console.log(`Sample TV event IDs: ${sampleIds}`);
        }

        // Process each TV event
        for (const tvEvent of tvEvents) {
          if (!tvEvent.idEvent) {
            totalUnmatched++;
            continue;
          }

          // Direct lookup by TheSportsDB event ID (use limit(1) to avoid single() errors)
          const { data: matches, error: matchError } = await supabase
            .from('matches')
            .select('id, sportsdb_event_id')
            .eq('sportsdb_event_id', tvEvent.idEvent)
            .limit(1);

          if (matchError) {
            console.error(`Query error for event ${tvEvent.idEvent}: ${matchError.message}`);
            totalUnmatched++;
            continue;
          }

          if (!matches || matches.length === 0) {
            totalUnmatched++;
            // Only log first few unmatched to avoid log spam
            if (totalUnmatched <= 5) {
              console.log(`No match found for event ${tvEvent.idEvent}: ${tvEvent.strEvent}`);
            }
            continue;
          }

          const match = matches[0];
          totalMatched++;

          // API returns strChannel (one channel per entry), not strTVStation
          const channel = tvEvent.strChannel;
          const country = normalizeCountry(tvEvent.strCountry || 'Global');

          if (channel) {
            allBroadcasts.push({
              match_id: match.id,
              country,
              channel,
              created_by: 'system',
              source: 'thesportsdb',
              source_id: tvEvent.idEvent,
              confidence_score: 100 // Direct ID match = highest confidence
            });
          }
        }

        // Deduplicate broadcasts
        const seen = new Map<string, BroadcastInsert>();
        for (const broadcast of allBroadcasts) {
          const key = `${broadcast.match_id}|${broadcast.channel.toLowerCase()}|${broadcast.country.toLowerCase()}`;
          seen.set(key, broadcast);
        }
        const uniqueBroadcasts = Array.from(seen.values());

        console.log(`Inserting ${uniqueBroadcasts.length} unique broadcasts for ${date}`);

        // Batch insert broadcasts
        if (uniqueBroadcasts.length > 0) {
          const batchSize = 100;

          for (let i = 0; i < uniqueBroadcasts.length; i += batchSize) {
            const batch = uniqueBroadcasts.slice(i, i + batchSize);

            const { error: insertError } = await supabase
              .from('broadcasts')
              .upsert(batch, {
                onConflict: 'match_id,channel,country,source',
                ignoreDuplicates: false
              });

            if (insertError) {
              // If upsert fails, try simple insert
              console.warn(`Upsert failed, trying insert: ${insertError.message}`);

              const { error: insertError2 } = await supabase
                .from('broadcasts')
                .insert(batch);

              if (insertError2) {
                console.warn(`Insert batch failed: ${insertError2.message}`);
              } else {
                totalBroadcastsInserted += batch.length;
              }
            } else {
              totalBroadcastsInserted += batch.length;
            }
          }
        }

      } catch (dateError) {
        const errorMsg = `Error processing ${date}: ${(dateError as Error).message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Auto-populate countries and channels reference tables
    try {
      await upsertBroadcastReferenceData(supabase, allRawTVEvents);
    } catch (refError) {
      console.warn('Reference data upsert failed (non-fatal):', refError);
    }

    // Log to api_fetch_logs
    const status = errors.length > 0
      ? (totalBroadcastsInserted > 0 ? 'partial' : 'error')
      : 'success';

    const { error: logError } = await supabase.from('api_fetch_logs').insert({
      fetch_type: `broadcast-${trigger}`,
      sport: 'all',
      fetch_date: today.toISOString().split('T')[0],
      status,
      matches_fetched: totalTVEventsFound,
      matches_created: totalBroadcastsInserted,
      matches_updated: totalMatched,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      api_response_time_ms: Date.now() - startTime
    });

    if (logError) {
      console.error('Failed to log fetch:', logError);
    }

    const response = {
      success: status !== 'error',
      status,
      tvEventsFound: totalTVEventsFound,
      matched: totalMatched,
      unmatched: totalUnmatched,
      broadcastsInserted: totalBroadcastsInserted,
      executionTimeMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`Broadcast fetch completed: ${JSON.stringify(response)}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);

    // Try to log the error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.from('api_fetch_logs').insert({
        fetch_type: 'broadcast-manual',
        sport: 'all',
        fetch_date: new Date().toISOString().split('T')[0],
        status: 'error',
        matches_fetched: 0,
        matches_created: 0,
        matches_updated: 0,
        error_message: (error as Error).message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        executionTimeMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
