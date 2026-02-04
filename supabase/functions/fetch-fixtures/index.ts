import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ApiSportsClient } from './_shared/api-sports-client.ts';
import { transformApiSportsFixture } from './_shared/transformers.ts';

serve(async (req) => {
  try {
    const body = await req.json();
    const { sport, sports, dates = ['today', 'tomorrow'], trigger = 'manual' } = body;

    // Support both single sport and multiple sports
    const sportsToFetch = sports || (sport ? [sport] : []);

    // Validate that at least one sport is provided
    if (sportsToFetch.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'At least one sport must be specified. Use "sport" or "sports" parameter.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Convert date strings to actual dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateMap: Record<string, string> = {
      'today': today.toISOString().split('T')[0],
      'tomorrow': tomorrow.toISOString().split('T')[0]
    };

    const datesToFetch = dates.map(d => dateMap[d]).filter(Boolean);

    let totalFetched = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const startTime = Date.now();
    const errors: string[] = [];
    const sportResults: Record<string, any> = {};

    // Fetch fixtures for each sport
    for (const currentSport of sportsToFetch) {
      const sportStartTime = Date.now();
      let sportFetched = 0;
      let sportUpdated = 0;
      const sportErrors: string[] = [];

      try {
        console.log(`Fetching ${currentSport} fixtures...`);

        const apiClient = new ApiSportsClient(Deno.env.get('API_SPORTS_KEY')!, currentSport);

        // Fetch fixtures for each date
        for (const date of datesToFetch) {
          try {
            console.log(`Fetching ${currentSport} fixtures for ${date}...`);

            const response = await apiClient.fetchFixtures({ date });

            const fixtures = response.response || [];
            sportFetched += fixtures.length;
            totalFetched += fixtures.length;

            console.log(`Fetched ${fixtures.length} ${currentSport} fixtures for ${date}`);

            // Transform and upsert in batches to avoid timeouts
            const batchSize = 100;
            for (let i = 0; i < fixtures.length; i += batchSize) {
              const batch = fixtures.slice(i, i + batchSize);
              const transformedMatches = batch.map((f: any) => transformApiSportsFixture(f, currentSport));

              if (transformedMatches.length > 0) {
                const { error } = await supabase
                  .from('matches')
                  .upsert(transformedMatches, { onConflict: 'id' });

                if (error) {
                  console.error('Database error:', error);
                  const errorMsg = `${currentSport} batch ${i}-${i + batch.length}: ${error.message}`;
                  sportErrors.push(errorMsg);
                  errors.push(errorMsg);
                } else {
                  sportUpdated += transformedMatches.length;
                  totalUpdated += transformedMatches.length;
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching ${currentSport} fixtures for ${date}:`, error);
            const errorMsg = `${currentSport} date ${date}: ${(error as Error).message}`;
            sportErrors.push(errorMsg);
            errors.push(errorMsg);
          }
        }

        // Log individual sport result
        sportResults[currentSport] = {
          fetched: sportFetched,
          updated: sportUpdated,
          errors: sportErrors.length > 0 ? sportErrors : undefined
        };

        // Log each sport fetch to api_fetch_logs
        const { error: logError } = await supabase.from('api_fetch_logs').insert({
          fetch_type: trigger,
          sport: currentSport,
          fetch_date: today.toISOString().split('T')[0],
          status: sportErrors.length > 0 ? (sportUpdated > 0 ? 'partial' : 'error') : 'success',
          matches_fetched: sportFetched,
          matches_created: 0,
          matches_updated: sportUpdated,
          error_message: sportErrors.length > 0 ? sportErrors.join('; ') : null,
          api_response_time_ms: Date.now() - sportStartTime
        });

        if (logError) {
          console.error(`Failed to log ${currentSport} fetch:`, logError);
        } else {
          console.log(`Logged ${currentSport} fetch to api_fetch_logs`);
        }

      } catch (error) {
        console.error(`Fatal error fetching ${currentSport}:`, error);
        const errorMsg = `${currentSport}: ${(error as Error).message}`;
        sportErrors.push(errorMsg);
        errors.push(errorMsg);
        sportResults[currentSport] = {
          fetched: 0,
          updated: 0,
          errors: [errorMsg]
        };
      }
    }

    const status = errors.length > 0 ? (totalUpdated > 0 ? 'partial' : 'error') : 'success';

    return new Response(
      JSON.stringify({
        success: status !== 'error',
        status,
        fetched: totalFetched,
        created: 0,
        updated: totalUpdated,
        sports: sportResults,
        errors: errors.length > 0 ? errors : undefined
      }),
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
        fetch_type: 'manual',
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
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
