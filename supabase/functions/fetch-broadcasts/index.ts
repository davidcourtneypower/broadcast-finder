/**
 * Fetch Broadcasts Edge Function
 * Fetches TV broadcast data from TheSportsDB and matches it to existing fixtures
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBClient } from './_shared/thesportsdb-client.ts';
import { EventMatcher, DatabaseMatch } from './_shared/event-matcher.ts';
import { getSportsDBConfig, getSupportedSports } from './_shared/thesportsdb-config.ts';
import { transformTheSportsDBTVToBroadcasts, deduplicateBroadcasts, BroadcastInsert } from './_shared/transformers.ts';

interface SportResult {
  eventsProcessed: number;
  matched: number;
  unmatched: number;
  broadcastsInserted: number;
  errors?: string[];
}

serve(async (req) => {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      sports = getSupportedSports(),
      dates = ['today', 'tomorrow'],
      trigger = 'manual'
    } = body;

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Initialize TheSportsDB client
    // Use '1' as free tier key, or custom key from env
    const apiKey = Deno.env.get('THESPORTSDB_API_KEY') || '1';
    const isPremium = apiKey !== '1';
    const client = new TheSportsDBClient(apiKey, isPremium);

    // Build date strings
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateMap: Record<string, string> = {
      'today': today.toISOString().split('T')[0],
      'tomorrow': tomorrow.toISOString().split('T')[0]
    };

    const datesToFetch = dates
      .map((d: string) => dateMap[d] || d)
      .filter(Boolean);

    // Track overall statistics
    let totalEventsProcessed = 0;
    let totalBroadcastsInserted = 0;
    let totalMatched = 0;
    let totalUnmatched = 0;
    const errors: string[] = [];
    const sportResults: Record<string, SportResult | { error: string }> = {};

    console.log(`Starting broadcast fetch for sports: ${sports.join(', ')}, dates: ${datesToFetch.join(', ')}`);

    // Process each sport
    for (const sport of sports) {
      const sportConfig = getSportsDBConfig(sport);

      if (!sportConfig) {
        const errorMsg = `Unknown sport: ${sport}`;
        errors.push(errorMsg);
        sportResults[sport] = { error: errorMsg };
        continue;
      }

      const sportStartTime = Date.now();
      let sportEventsProcessed = 0;
      let sportBroadcastsInserted = 0;
      let sportMatched = 0;
      let sportUnmatched = 0;
      const sportErrors: string[] = [];

      try {
        // Collect all broadcasts for this sport across dates
        const allBroadcasts: BroadcastInsert[] = [];

        for (const date of datesToFetch) {
          console.log(`Fetching ${sport} TV data for ${date}...`);

          try {
            // Fetch TV schedule from TheSportsDB
            const tvResponse = await client.fetchTVSchedule({
              date,
              sport: sportConfig.sportsdbSport
            });

            const tvEvents = tvResponse.tvevents || [];
            sportEventsProcessed += tvEvents.length;

            console.log(`Found ${tvEvents.length} TV events for ${sport} on ${date}`);

            if (tvEvents.length === 0) {
              continue;
            }

            // Fetch existing matches for this date and sport from database
            const { data: dbMatches, error: dbError } = await supabase
              .from('matches')
              .select('id, sport, league, home, away, match_date, match_time')
              .eq('match_date', date)
              .ilike('sport', sportConfig.internalSport);

            if (dbError) {
              sportErrors.push(`DB error fetching matches for ${date}: ${dbError.message}`);
              continue;
            }

            if (!dbMatches || dbMatches.length === 0) {
              console.log(`No database matches found for ${sport} on ${date}`);
              sportUnmatched += tvEvents.length;
              continue;
            }

            console.log(`Found ${dbMatches.length} database matches for ${sport} on ${date}`);

            // Match each TV event to a database fixture
            for (const tvEvent of tvEvents) {
              const bestMatch = EventMatcher.findBestMatch(
                tvEvent,
                dbMatches as DatabaseMatch[],
                sportConfig
              );

              if (bestMatch) {
                sportMatched++;
                const broadcasts = transformTheSportsDBTVToBroadcasts(
                  tvEvent,
                  bestMatch.match.id,
                  bestMatch.score
                );
                allBroadcasts.push(...broadcasts);

                console.log(`Matched: ${tvEvent.strHomeTeam} vs ${tvEvent.strAwayTeam} -> ${bestMatch.match.id} (score: ${bestMatch.score})`);
              } else {
                sportUnmatched++;
                console.log(`No match found for: ${tvEvent.strHomeTeam} vs ${tvEvent.strAwayTeam} (${tvEvent.strLeague})`);
              }
            }

          } catch (dateError) {
            const errorMsg = `Error processing ${sport} for ${date}: ${(dateError as Error).message}`;
            console.error(errorMsg);
            sportErrors.push(errorMsg);
          }
        }

        // Deduplicate broadcasts before insertion
        const uniqueBroadcasts = deduplicateBroadcasts(allBroadcasts);
        console.log(`Inserting ${uniqueBroadcasts.length} unique broadcasts for ${sport} (${allBroadcasts.length} total before dedup)`);

        // Batch insert broadcasts
        if (uniqueBroadcasts.length > 0) {
          const batchSize = 100;

          for (let i = 0; i < uniqueBroadcasts.length; i += batchSize) {
            const batch = uniqueBroadcasts.slice(i, i + batchSize);

            // Use upsert with conflict handling
            // If a broadcast with same match_id, channel, country, source exists, update it
            const { error: insertError } = await supabase
              .from('broadcasts')
              .upsert(batch, {
                onConflict: 'match_id,channel,country,source',
                ignoreDuplicates: false
              });

            if (insertError) {
              // If upsert fails (e.g., constraint doesn't exist yet), try insert with ignore
              console.warn(`Upsert failed, trying insert: ${insertError.message}`);

              const { error: insertError2 } = await supabase
                .from('broadcasts')
                .insert(batch);

              if (insertError2) {
                // Log but continue - some may be duplicates
                console.warn(`Insert batch ${i}-${i + batch.length} partial: ${insertError2.message}`);
              }
            }

            sportBroadcastsInserted += batch.length;
          }
        }

        // Record sport results
        sportResults[sport] = {
          eventsProcessed: sportEventsProcessed,
          matched: sportMatched,
          unmatched: sportUnmatched,
          broadcastsInserted: sportBroadcastsInserted,
          errors: sportErrors.length > 0 ? sportErrors : undefined
        };

        // Update totals
        totalEventsProcessed += sportEventsProcessed;
        totalMatched += sportMatched;
        totalUnmatched += sportUnmatched;
        totalBroadcastsInserted += sportBroadcastsInserted;
        errors.push(...sportErrors);

        // Log to api_fetch_logs
        const { error: logError } = await supabase.from('api_fetch_logs').insert({
          fetch_type: `broadcast-${trigger}`,
          sport: sport,
          fetch_date: today.toISOString().split('T')[0],
          status: sportErrors.length > 0 ? (sportBroadcastsInserted > 0 ? 'partial' : 'error') : 'success',
          matches_fetched: sportEventsProcessed,
          matches_created: sportBroadcastsInserted,
          matches_updated: sportMatched,
          error_message: sportErrors.length > 0 ? sportErrors.join('; ') : null,
          api_response_time_ms: Date.now() - sportStartTime
        });

        if (logError) {
          console.error(`Failed to log ${sport} fetch:`, logError);
        }

      } catch (sportError) {
        const errorMsg = `Fatal error processing ${sport}: ${(sportError as Error).message}`;
        console.error(errorMsg);
        sportErrors.push(errorMsg);
        errors.push(errorMsg);
        sportResults[sport] = { error: errorMsg };

        // Log error
        await supabase.from('api_fetch_logs').insert({
          fetch_type: `broadcast-${trigger}`,
          sport: sport,
          fetch_date: today.toISOString().split('T')[0],
          status: 'error',
          matches_fetched: 0,
          matches_created: 0,
          matches_updated: 0,
          error_message: errorMsg,
          api_response_time_ms: Date.now() - sportStartTime
        });
      }
    }

    // Determine overall status
    const status = errors.length > 0
      ? (totalBroadcastsInserted > 0 ? 'partial' : 'error')
      : 'success';

    const response = {
      success: status !== 'error',
      status,
      eventsProcessed: totalEventsProcessed,
      matched: totalMatched,
      unmatched: totalUnmatched,
      broadcastsInserted: totalBroadcastsInserted,
      executionTimeMs: Date.now() - startTime,
      sports: sportResults,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`Broadcast fetch completed: ${JSON.stringify(response)}`);

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
        fetch_type: 'broadcast-manual',
        sport: 'unknown',
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
