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
  status: string;
  popularity: number;
}

interface SportStats {
  eventsFound: number;
  eventsInserted: number;
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
    country: event.strCountry || 'Global',
    status: 'upcoming', // Status calculated dynamically by frontend
    popularity: 70 // Default popularity
  };
}

serve(async (req) => {
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
      { headers: { 'Content-Type': 'application/json' } }
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
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
