/**
 * Fetch Livescores Edge Function
 * Fetches current livescores from TheSportsDB V2 API and updates match status/scores
 * Runs every 2 minutes via pg_cron
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBv2Client, TheSportsDBLivescoreEvent } from './_shared/thesportsdb-v2-client.ts';

/**
 * Parse score string to integer, returns null for invalid/empty values
 */
function parseScore(score: string | null): number | null {
  if (score === null || score === undefined || score === '') return null;
  const parsed = parseInt(score, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Handle matches that were "live" in the DB but are no longer in the livescore feed.
 * If they've been missing for >5 minutes, mark them as finished.
 */
async function handleDisappearedMatches(
  supabase: ReturnType<typeof createClient>,
  liveEventIds: Set<string>,
  now: Date,
  terminalStatuses: string[]
): Promise<number> {
  const today = now.toISOString().split('T')[0];

  // Get matches that were recently updated by livescores and are not yet done
  // Terminal statuses are loaded from the status_mappings DB table
  const statusFilter = terminalStatuses.map(s => `"${s}"`).join(',');
  const { data: currentlyLive, error } = await supabase
    .from('matches')
    .select('id, sportsdb_event_id, status, last_livescore_update')
    .not('last_livescore_update', 'is', null)
    .not('status', 'in', `(${statusFilter})`)
    .gte('match_date', today);

  if (error || !currentlyLive || currentlyLive.length === 0) return 0;

  const toFinish: string[] = [];

  for (const match of currentlyLive) {
    // Skip if this match IS in the current livescore response
    if (match.sportsdb_event_id && liveEventIds.has(match.sportsdb_event_id)) {
      continue;
    }

    // Only mark as finished if we've seen it via livescore before
    // and it has been missing for > 5 minutes (guards against API blips)
    if (match.last_livescore_update) {
      const lastUpdate = new Date(match.last_livescore_update);
      const minutesSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

      if (minutesSinceLastUpdate > 5) {
        toFinish.push(match.id);
      }
    }
    // If never updated by livescore (last_livescore_update is null),
    // don't touch it — the match was marked live by some other mechanism
    // or is a data inconsistency
  }

  if (toFinish.length > 0) {
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'FT',
        last_livescore_update: now.toISOString()
      })
      .in('id', toFinish);

    if (updateError) {
      console.error(`Failed to mark disappeared matches as FT: ${updateError.message}`);
      return 0;
    }

    console.log(`Marked ${toFinish.length} disappeared matches as finished`);
    return toFinish.length;
  }

  return 0;
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
    const body = await req.json().catch(() => ({}));
    const { trigger = 'manual' } = body;

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Initialize TheSportsDB V2 client
    const client = new TheSportsDBv2Client();

    // 0. Load terminal statuses from DB for disappearance detection
    const FALLBACK_TERMINAL = ['FT', 'AET', 'AOT', 'PEN', 'AP', 'CANC', 'PST', 'ABD', 'SUSP', 'NS', 'TBD', 'upcoming'];
    let terminalStatuses: string[] = [];
    try {
      const { data: mappings } = await supabase
        .from('status_mappings')
        .select('raw_status, display_category')
        .in('display_category', ['finished', 'cancelled', 'upcoming']);
      if (mappings && mappings.length > 0) {
        terminalStatuses = mappings.map(m => m.raw_status);
      }
    } catch (e) {
      console.error('Failed to load status mappings, using hardcoded fallback:', e);
    }
    if (terminalStatuses.length === 0) {
      terminalStatuses = FALLBACK_TERMINAL;
    }

    // 1. Fetch livescores from TheSportsDB
    const livescoreEvents = await client.fetchLivescores();

    console.log(`Processing ${livescoreEvents.length} livescore events, trigger: ${trigger}`);

    // 2. Build set of event IDs in current response (for disappearance detection)
    const liveEventIds = new Set<string>();
    for (const event of livescoreEvents) {
      if (event.idEvent) {
        liveEventIds.add(event.idEvent);
      }
    }

    // 3. Process livescore events in parallel batches
    let updatedCount = 0;
    let notFoundCount = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < livescoreEvents.length; i += BATCH_SIZE) {
      const batch = livescoreEvents.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (event) => {
          if (!event.idEvent) return 'skip';

          const status = event.strStatus || 'NS';
          const homeScore = parseScore(event.intHomeScore);
          const awayScore = parseScore(event.intAwayScore);

          const { data, error } = await supabase
            .from('matches')
            .update({
              status,
              home_score: homeScore,
              away_score: awayScore,
              last_livescore_update: new Date().toISOString(),
            })
            .eq('sportsdb_event_id', event.idEvent)
            .select('id');

          if (error) throw new Error(`Event ${event.idEvent}: ${error.message}`);
          if (!data || data.length === 0) return 'not_found';
          return 'updated';
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'updated') updatedCount++;
          else if (result.value === 'not_found') notFoundCount++;
        } else {
          errors.push(result.reason?.message || 'Unknown error');
        }
      }
    }

    // 4. Handle disappeared matches (live in DB but not in current feed)
    // Skip when API returns 0 events to prevent false positives during outages
    const now = new Date();
    let finishedCount = 0;
    if (livescoreEvents.length > 0) {
      finishedCount = await handleDisappearedMatches(supabase, liveEventIds, now, terminalStatuses);
    } else {
      console.warn('Livescore API returned 0 events — skipping disappearance detection (possible API outage)');
    }

    // 5. Log to api_fetch_logs
    const status = errors.length > 0
      ? (updatedCount > 0 ? 'partial' : 'error')
      : 'success';

    const logParts: string[] = [];
    if (notFoundCount > 0) logParts.push(`${notFoundCount} events not found in matches table`);
    if (finishedCount > 0) logParts.push(`${finishedCount} disappeared matches marked finished`);
    if (errors.length > 0) logParts.push(`${errors.length} errors: ${errors.slice(0, 3).join('; ')}`);

    const { error: logError } = await supabase.from('api_fetch_logs').insert({
      fetch_type: `livescores-${trigger}`,
      sport: 'all',
      fetch_date: now.toISOString().split('T')[0],
      status,
      matches_fetched: livescoreEvents.length,
      matches_created: 0,
      matches_updated: updatedCount + finishedCount,
      error_message: logParts.length > 0 ? logParts.join('; ') : null,
    });

    if (logError) {
      console.error('Failed to log fetch:', logError);
    }

    const response = {
      success: status !== 'error',
      status,
      livescoreEvents: livescoreEvents.length,
      updated: updatedCount,
      notFound: notFoundCount,
      disappearedFinished: finishedCount,
      executionTimeMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    };

    console.log(`Livescore fetch completed: ${JSON.stringify(response)}`);

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
        fetch_type: 'livescores-manual',
        sport: 'all',
        fetch_date: new Date().toISOString().split('T')[0],
        status: 'error',
        matches_fetched: 0,
        matches_created: 0,
        matches_updated: 0,
        error_message: (error as Error).message,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        executionTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
