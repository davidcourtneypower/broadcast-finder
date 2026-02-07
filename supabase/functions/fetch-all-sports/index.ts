/**
 * Fetch All Sports Edge Function
 * Fetches all sports events from TheSportsDB V2 API and stores them in the matches table
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBv2Client, TheSportsDBEvent } from './_shared/thesportsdb-v2-client.ts';

interface MatchInsert {
  id: string;
  sportsdb_event_id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  match_date: string;
  match_time: string;
  country: string;
  popularity: number;
}

interface SportStats {
  eventsFound: number;
  eventsInserted: number;
}

/** Map common country codes/names to standardized names */
const COUNTRY_NORMALIZATIONS: Record<string, string> = {
  'us': 'USA', 'usa': 'USA', 'united states': 'USA', 'united states of america': 'USA',
  'uk': 'UK', 'gb': 'UK', 'united kingdom': 'UK', 'great britain': 'UK', 'england': 'UK',
  'ca': 'Canada', 'can': 'Canada',
  'de': 'Germany', 'ger': 'Germany', 'deutschland': 'Germany',
  'fr': 'France', 'fra': 'France',
  'es': 'Spain', 'esp': 'Spain', 'españa': 'Spain',
  'it': 'Italy', 'ita': 'Italy', 'italia': 'Italy',
  'au': 'Australia', 'aus': 'Australia',
  'in': 'India', 'ind': 'India',
  'cn': 'China', 'chn': 'China',
  'jp': 'Japan', 'jpn': 'Japan',
  'br': 'Brazil', 'bra': 'Brazil', 'brasil': 'Brazil',
  'mx': 'Mexico', 'mex': 'Mexico', 'méxico': 'Mexico',
  'ar': 'Argentina', 'arg': 'Argentina',
  'tr': 'Turkey', 'tur': 'Turkey', 'türkiye': 'Turkey',
  'ru': 'Russia', 'rus': 'Russia',
  'worldwide': 'Global', 'international': 'Global', 'world': 'Global',
};

function normalizeCountry(country: string): string {
  if (!country) return 'Global';
  const normalized = country.toLowerCase().trim();
  return COUNTRY_NORMALIZATIONS[normalized] || country;
}

/**
 * Transform TheSportsDB event to our matches table format
 */
function transformEvent(event: TheSportsDBEvent): MatchInsert | null {
  // Skip events without required fields
  if (!event.idEvent || !event.strHomeTeam || !event.strAwayTeam || !event.dateEvent) {
    return null;
  }

  // Skip events that are clearly non-match events (like awards ceremonies)
  if (!event.strAwayTeam || event.strAwayTeam === '') {
    return null;
  }

  return {
    id: `sportsdb-${event.idEvent}`,
    sportsdb_event_id: event.idEvent,
    sport: event.strSport || 'Unknown',
    league: event.strLeague || 'Unknown',
    home: event.strHomeTeam,
    away: event.strAwayTeam,
    match_date: event.dateEvent,
    match_time: event.strTime?.substring(0, 5) || '00:00',
    country: normalizeCountry(event.strCountry || 'Global'),
    popularity: 70 // Default popularity
  };
}

/**
 * Auto-populate sports and leagues reference tables from discovered event data.
 * Uses ON CONFLICT DO NOTHING so existing rows are never overwritten.
 */
async function upsertReferenceData(
  supabase: any,
  events: TheSportsDBEvent[]
) {
  // 1. Collect unique sports
  const uniqueSports = [...new Set(
    events.map(e => e.strSport).filter(Boolean)
  )];

  if (uniqueSports.length > 0) {
    const sportRows = uniqueSports.map(name => ({ name }));
    const { error: sportError } = await supabase
      .from('sports')
      .upsert(sportRows, { onConflict: 'name', ignoreDuplicates: true });

    if (sportError) {
      console.warn(`Failed to upsert sports: ${sportError.message}`);
    } else {
      console.log(`Upserted ${uniqueSports.length} sports to reference table`);
    }
  }

  // 2. Collect unique leagues and link to sports
  const leagueMap = new Map<string, { name: string; sport: string; sportsdbId: string }>();
  for (const event of events) {
    if (event.strLeague && event.strSport) {
      const key = `${event.strLeague}|${event.strSport}`;
      if (!leagueMap.has(key)) {
        leagueMap.set(key, {
          name: event.strLeague,
          sport: event.strSport,
          sportsdbId: event.idLeague
        });
      }
    }
  }

  if (leagueMap.size > 0) {
    // Fetch sport IDs
    const { data: sportsData } = await supabase
      .from('sports')
      .select('id, name');

    const sportIdMap = new Map<string, number>();
    (sportsData || []).forEach((s: any) => sportIdMap.set(s.name, s.id));

    const leagueRows = [];
    for (const league of leagueMap.values()) {
      const sportId = sportIdMap.get(league.sport);
      if (sportId) {
        leagueRows.push({
          name: league.name,
          sport_id: sportId,
          sportsdb_league_id: league.sportsdbId
        });
      }
    }

    if (leagueRows.length > 0) {
      const { error: leagueError } = await supabase
        .from('leagues')
        .upsert(leagueRows, { onConflict: 'name,sport_id', ignoreDuplicates: true });

      if (leagueError) {
        console.warn(`Failed to upsert leagues: ${leagueError.message}`);
      } else {
        console.log(`Upserted ${leagueRows.length} leagues to reference table`);
      }
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

    console.log(`Starting fetch for dates: ${datesToFetch.join(', ')}, trigger: ${trigger}`);

    // Track statistics
    let totalEventsFound = 0;
    let totalEventsInserted = 0;
    const sportStats: Record<string, SportStats> = {};
    const errors: string[] = [];
    const allRawEvents: TheSportsDBEvent[] = [];

    // Fetch events for each date
    for (const date of datesToFetch) {
      try {
        console.log(`Fetching events for ${date}...`);
        const events = await client.fetchEventsForDay(date);

        if (!events || events.length === 0) {
          console.log(`No events found for ${date}`);
          continue;
        }

        console.log(`Found ${events.length} events for ${date}`);
        totalEventsFound += events.length;
        allRawEvents.push(...events);

        // Transform events
        const matches: MatchInsert[] = [];
        for (const event of events) {
          const match = transformEvent(event);
          if (match) {
            matches.push(match);

            // Track by sport
            if (!sportStats[match.sport]) {
              sportStats[match.sport] = { eventsFound: 0, eventsInserted: 0 };
            }
            sportStats[match.sport].eventsFound++;
          }
        }

        console.log(`Transformed ${matches.length} valid matches for ${date}`);

        // Batch insert matches
        if (matches.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < matches.length; i += batchSize) {
            const batch = matches.slice(i, i + batchSize);

            const { error: upsertError } = await supabase
              .from('matches')
              .upsert(batch, {
                onConflict: 'sportsdb_event_id',
                ignoreDuplicates: false
              });

            if (upsertError) {
              // Try with id as conflict target if sportsdb_event_id constraint doesn't exist yet
              console.warn(`Upsert on sportsdb_event_id failed, trying id: ${upsertError.message}`);

              const { error: upsertError2 } = await supabase
                .from('matches')
                .upsert(batch, {
                  onConflict: 'id',
                  ignoreDuplicates: false
                });

              if (upsertError2) {
                console.error(`Batch insert failed: ${upsertError2.message}`);
                errors.push(`Batch ${i}-${i + batch.length}: ${upsertError2.message}`);
              } else {
                totalEventsInserted += batch.length;
                // Update sport stats
                for (const match of batch) {
                  if (sportStats[match.sport]) {
                    sportStats[match.sport].eventsInserted++;
                  }
                }
              }
            } else {
              totalEventsInserted += batch.length;
              // Update sport stats
              for (const match of batch) {
                if (sportStats[match.sport]) {
                  sportStats[match.sport].eventsInserted++;
                }
              }
            }
          }
        }

      } catch (dateError) {
        const errorMsg = `Error fetching ${date}: ${(dateError as Error).message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Auto-populate sports and leagues reference tables
    try {
      await upsertReferenceData(supabase, allRawEvents);
    } catch (refError) {
      console.warn('Reference data upsert failed (non-fatal):', refError);
    }

    // Log to api_fetch_logs
    const status = errors.length > 0
      ? (totalEventsInserted > 0 ? 'partial' : 'error')
      : 'success';

    const { error: logError } = await supabase.from('api_fetch_logs').insert({
      fetch_type: `all-sports-${trigger}`,
      sport: 'all',
      fetch_date: today.toISOString().split('T')[0],
      status,
      matches_fetched: totalEventsFound,
      matches_created: totalEventsInserted,
      matches_updated: 0,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      api_response_time_ms: Date.now() - startTime
    });

    if (logError) {
      console.error('Failed to log fetch:', logError);
    }

    const response = {
      success: status !== 'error',
      status,
      eventsFound: totalEventsFound,
      eventsInserted: totalEventsInserted,
      sportsFound: Object.keys(sportStats).length,
      sportStats,
      executionTimeMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`Fetch completed: ${JSON.stringify(response)}`);

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
        fetch_type: 'all-sports-manual',
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
