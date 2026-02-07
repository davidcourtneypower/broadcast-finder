/**
 * Fetch Events Edge Function
 * Fetches all sports events from TheSportsDB V2 API and stores them in the events table
 * Supports team sports (home vs away), 1v1 sports, and multi-participant events
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBv2Client, TheSportsDBEvent, TheSportsDBSport } from './_shared/thesportsdb-v2-client.ts';

interface EventInsert {
  id: string;
  sportsdb_event_id: string;
  sport_id: number;
  league: string;
  home: string | null;
  away: string | null;
  event_name: string | null;
  event_date: string;
  event_time: string;
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
 * Transform TheSportsDB event to our events table format.
 * Accepts team sports (home vs away), 1v1 sports, and multi-participant events.
 */
function transformEvent(
  event: TheSportsDBEvent,
  sportIdMap: Map<string, number>
): { insert: EventInsert; sportName: string } | null {
  if (!event.idEvent || !event.dateEvent) return null;

  const sportName = event.strSport || 'Unknown';
  const sportId = sportIdMap.get(sportName);
  if (!sportId) return null; // Skip events with unknown sport

  const hasTeams = event.strHomeTeam && event.strAwayTeam;
  if (!hasTeams && !event.strEvent) return null;

  return {
    insert: {
      id: `sportsdb-${event.idEvent}`,
      sportsdb_event_id: event.idEvent,
      sport_id: sportId,
      league: event.strLeague || 'Unknown',
      home: event.strHomeTeam || null,
      away: event.strAwayTeam || null,
      event_name: hasTeams ? null : (event.strEvent || event.strFilename || null),
      event_date: event.dateEvent,
      event_time: event.strTime?.substring(0, 5) || '00:00',
      country: normalizeCountry(event.strCountry || 'Global'),
      popularity: 70
    },
    sportName
  };
}

/**
 * Auto-populate sports and leagues reference tables from discovered event data.
 * Uses sport format data from TheSportsDB to set sport_type_id.
 */
async function upsertReferenceData(
  supabase: any,
  events: TheSportsDBEvent[],
  sportFormats: Map<string, string>
) {
  // 1. Collect unique sports and resolve their sport_type_id
  const uniqueSports = [...new Set(
    events.map(e => e.strSport).filter(Boolean)
  )];

  if (uniqueSports.length > 0) {
    // Fetch sport_types to map format name → id
    const { data: sportTypes } = await supabase
      .from('sport_types')
      .select('id, name');
    const typeIdMap = new Map<string, number>();
    (sportTypes || []).forEach((t: any) => typeIdMap.set(t.name, t.id));
    const defaultTypeId = typeIdMap.get('TeamvsTeam') || 1;

    const sportRows = uniqueSports.map(name => {
      const format = sportFormats.get(name) || 'TeamvsTeam';
      return { name, sport_type_id: typeIdMap.get(format) || defaultTypeId };
    });

    const { error: sportError } = await supabase
      .from('sports')
      .upsert(sportRows, { onConflict: 'name', ignoreDuplicates: false });

    if (sportError) {
      console.warn(`Failed to upsert sports: ${sportError.message}`);
    } else {
      console.log(`Upserted ${uniqueSports.length} sports with format data`);
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

    // Phase 1: Fetch all raw events from API
    const rawEventsByDate: { date: string; events: TheSportsDBEvent[] }[] = [];
    const allRawEvents: TheSportsDBEvent[] = [];

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
        rawEventsByDate.push({ date, events });
        allRawEvents.push(...events);
      } catch (dateError) {
        const errorMsg = `Error fetching ${date}: ${(dateError as Error).message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Phase 2: Fetch sport formats from TheSportsDB, then ensure reference data exists
    const sportFormats = new Map<string, string>();
    try {
      const apiSports = await client.fetchAllSports();
      for (const s of apiSports) {
        if (s.strSport && s.strFormat) {
          sportFormats.set(s.strSport, s.strFormat);
        }
      }
      console.log(`Fetched ${sportFormats.size} sport formats from API`);
    } catch (formatError) {
      console.warn('Failed to fetch sport formats (non-fatal):', formatError);
    }

    try {
      await upsertReferenceData(supabase, allRawEvents, sportFormats);
    } catch (refError) {
      console.warn('Reference data upsert failed (non-fatal):', refError);
    }

    // Phase 3: Build sport name→id map
    const { data: sportsData } = await supabase
      .from('sports')
      .select('id, name');
    const sportIdMap = new Map<string, number>();
    (sportsData || []).forEach((s: any) => sportIdMap.set(s.name, s.id));

    // Phase 4: Transform and upsert events with sport_id
    for (const { date, events } of rawEventsByDate) {
      const validEvents: EventInsert[] = [];

      for (const event of events) {
        const result = transformEvent(event, sportIdMap);
        if (result) {
          validEvents.push(result.insert);

          if (!sportStats[result.sportName]) {
            sportStats[result.sportName] = { eventsFound: 0, eventsInserted: 0 };
          }
          sportStats[result.sportName].eventsFound++;
        }
      }

      console.log(`Transformed ${validEvents.length} valid events for ${date}`);

      // Batch insert events
      if (validEvents.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < validEvents.length; i += batchSize) {
          const batch = validEvents.slice(i, i + batchSize);

          const { error: upsertError } = await supabase
            .from('events')
            .upsert(batch, {
              onConflict: 'sportsdb_event_id',
              ignoreDuplicates: false
            });

          if (upsertError) {
            console.warn(`Upsert on sportsdb_event_id failed, trying id: ${upsertError.message}`);

            const { error: upsertError2 } = await supabase
              .from('events')
              .upsert(batch, {
                onConflict: 'id',
                ignoreDuplicates: false
              });

            if (upsertError2) {
              console.error(`Batch insert failed: ${upsertError2.message}`);
              errors.push(`Batch ${i}-${i + batch.length}: ${upsertError2.message}`);
            } else {
              totalEventsInserted += batch.length;
              for (const ev of batch) {
                const name = [...sportIdMap.entries()].find(([_, id]) => id === ev.sport_id)?.[0];
                if (name && sportStats[name]) sportStats[name].eventsInserted++;
              }
            }
          } else {
            totalEventsInserted += batch.length;
            for (const ev of batch) {
              const name = [...sportIdMap.entries()].find(([_, id]) => id === ev.sport_id)?.[0];
              if (name && sportStats[name]) sportStats[name].eventsInserted++;
            }
          }
        }
      }
    }

    // Log to api_fetch_logs
    const status = errors.length > 0
      ? (totalEventsInserted > 0 ? 'partial' : 'error')
      : 'success';

    const { error: logError } = await supabase.from('api_fetch_logs').insert({
      fetch_type: `fetch-events-${trigger}`,
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
        fetch_type: 'fetch-events-manual',
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
