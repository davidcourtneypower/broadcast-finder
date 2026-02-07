/**
 * Fetch Livescores Edge Function
 * Fetches current livescores from TheSportsDB V2 API and updates match status/scores
 * Runs every 2 minutes via pg_cron
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBv2Client, TheSportsDBLivescoreEvent } from './_shared/thesportsdb-v2-client.ts';

// Set of strProgress values that indicate the match is currently in play
const LIVE_PROGRESS = new Set([
  // Soccer
  '1H', '2H', 'HT', 'ET', 'P', 'BT',
  // Basketball / American Football
  'Q1', 'Q2', 'Q3', 'Q4', 'OT',
  // Ice Hockey
  'P1', 'P2', 'P3', 'PT',
  // Baseball
  'IN1', 'IN2', 'IN3', 'IN4', 'IN5', 'IN6', 'IN7', 'IN8', 'IN9',
  // Rugby / Handball
  // (1H, 2H, HT, ET, BT, PT already included above)
  // Volleyball
  'S1', 'S2', 'S3', 'S4', 'S5',
]);

// Set of strProgress values that indicate the match has finished
const FINISHED_PROGRESS = new Set([
  'FT', 'AET', 'AOT', 'PEN', 'AP',
]);

// Set of strProgress values that indicate cancellation/postponement/suspension
const CANCELLED_PROGRESS = new Set([
  'CANC', 'PST', 'ABD', 'SUSP', 'INT', 'INTR', 'POST', 'AWD', 'WO', 'AW',
]);

/**
 * Map TheSportsDB strProgress value to our app status
 */
function mapProgressToStatus(strProgress: string): string {
  if (!strProgress) return 'upcoming';

  const p = strProgress.toUpperCase().trim();

  if (p === 'NS' || p === 'TBD' || p === '') return 'upcoming';
  if (LIVE_PROGRESS.has(p)) return 'live';
  if (FINISHED_PROGRESS.has(p)) return 'finished';
  if (CANCELLED_PROGRESS.has(p)) return 'cancelled';

  // Unknown progress value — default to live (safer to show than hide)
  console.warn(`Unknown strProgress value: "${strProgress}"`);
  return 'live';
}

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
  now: Date
): Promise<number> {
  const today = now.toISOString().split('T')[0];

  // Get all matches currently marked as "live" in the DB for today
  const { data: currentlyLive, error } = await supabase
    .from('matches')
    .select('id, sportsdb_event_id, last_livescore_update')
    .eq('status', 'live')
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
        status: 'finished',
        last_livescore_update: now.toISOString()
      })
      .in('id', toFinish);

    if (updateError) {
      console.error(`Failed to mark disappeared matches as finished: ${updateError.message}`);
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

    // 3. Process each livescore event — update status and scores in the DB
    let updatedCount = 0;
    let notFoundCount = 0;
    const errors: string[] = [];

    for (const event of livescoreEvents) {
      if (!event.idEvent) continue;

      const status = mapProgressToStatus(event.strProgress);
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

      if (error) {
        errors.push(`Event ${event.idEvent}: ${error.message}`);
      } else if (!data || data.length === 0) {
        notFoundCount++;
      } else {
        updatedCount++;
      }
    }

    // 4. Handle disappeared matches (live in DB but not in current feed)
    const now = new Date();
    const finishedCount = await handleDisappearedMatches(supabase, liveEventIds, now);

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
