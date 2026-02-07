/**
 * Fetch Reference Data Edge Function
 * Fetches all sports, countries, and leagues from TheSportsDB API
 * and populates the reference tables for comprehensive coverage
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TheSportsDBv2Client } from './_shared/thesportsdb-v2-client.ts';

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

/** Known country flag emojis */
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
    const { trigger = 'manual' } = body;

    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const client = new TheSportsDBv2Client();

    const errors: string[] = [];
    const stats = {
      sports: { fetched: 0, upserted: 0 },
      countries: { fetched: 0, upserted: 0 },
      leagues: { fetched: 0, upserted: 0 },
    };

    // ── Phase 1: Sports ──────────────────────────────────────────
    try {
      console.log('Phase 1: Fetching sports...');
      const apiSports = await client.fetchAllSports();
      stats.sports.fetched = apiSports.length;

      if (apiSports.length > 0) {
        // Fetch sport_types to map strFormat → sport_type_id
        const { data: sportTypes } = await supabase
          .from('sport_types')
          .select('id, name');
        const typeIdMap = new Map<string, number>();
        (sportTypes || []).forEach((t: any) => typeIdMap.set(t.name, t.id));
        const defaultTypeId = typeIdMap.get('TeamvsTeam') || 1;

        // Only include name + sport_type_id to preserve admin-customized colors
        const sportRows = apiSports
          .filter(s => s.strSport)
          .map(s => ({
            name: s.strSport,
            sport_type_id: typeIdMap.get(s.strFormat) || defaultTypeId,
          }));

        const { error: sportError } = await supabase
          .from('sports')
          .upsert(sportRows, { onConflict: 'name', ignoreDuplicates: false });

        if (sportError) {
          console.warn(`Failed to upsert sports: ${sportError.message}`);
          errors.push(`Sports upsert: ${sportError.message}`);
        } else {
          stats.sports.upserted = sportRows.length;
          console.log(`Upserted ${sportRows.length} sports`);
        }
      }
    } catch (error) {
      const msg = `Sports phase failed: ${(error as Error).message}`;
      console.error(msg);
      errors.push(msg);
    }

    // ── Phase 2: Countries ───────────────────────────────────────
    try {
      console.log('Phase 2: Fetching countries...');
      const apiCountries = await client.fetchAllCountries();
      stats.countries.fetched = apiCountries.length;

      if (apiCountries.length > 0) {
        const countryRows = apiCountries
          .filter(c => c.name_area)
          .map(c => {
            const name = normalizeCountry(c.name_area);
            return {
              name,
              flag_emoji: FLAG_LOOKUP[name] || '🌍',
            };
          });

        // Deduplicate (normalization can map multiple names to the same value)
        const seen = new Map<string, typeof countryRows[0]>();
        for (const row of countryRows) {
          seen.set(row.name, row);
        }
        const uniqueRows = [...seen.values()];

        const { error: countryError } = await supabase
          .from('countries')
          .upsert(uniqueRows, { onConflict: 'name', ignoreDuplicates: true });

        if (countryError) {
          console.warn(`Failed to upsert countries: ${countryError.message}`);
          errors.push(`Countries upsert: ${countryError.message}`);
        } else {
          stats.countries.upserted = uniqueRows.length;
          console.log(`Upserted ${uniqueRows.length} countries`);
        }
      }
    } catch (error) {
      const msg = `Countries phase failed: ${(error as Error).message}`;
      console.error(msg);
      errors.push(msg);
    }

    // ── Phase 3: Leagues (depends on sports being present) ───────
    try {
      console.log('Phase 3: Fetching leagues...');
      const apiLeagues = await client.fetchAllLeagues();
      stats.leagues.fetched = apiLeagues.length;

      if (apiLeagues.length > 0) {
        // Build sport name → id map from whatever is in DB now
        const { data: sportsData } = await supabase
          .from('sports')
          .select('id, name');
        const sportIdMap = new Map<string, number>();
        (sportsData || []).forEach((s: any) => sportIdMap.set(s.name, s.id));

        const leagueRows = apiLeagues
          .filter(l => l.strLeague && l.strSport)
          .map(l => ({
            name: l.strLeague,
            sport_id: sportIdMap.get(l.strSport),
            sportsdb_league_id: l.idLeague,
          }))
          .filter(l => l.sport_id != null);

        // Batch upsert in groups of 100
        const batchSize = 100;
        let upsertedCount = 0;
        for (let i = 0; i < leagueRows.length; i += batchSize) {
          const batch = leagueRows.slice(i, i + batchSize);

          const { error: leagueError } = await supabase
            .from('leagues')
            .upsert(batch, { onConflict: 'name,sport_id', ignoreDuplicates: true });

          if (leagueError) {
            console.warn(`Failed to upsert leagues batch ${i}: ${leagueError.message}`);
            errors.push(`Leagues batch ${i}: ${leagueError.message}`);
          } else {
            upsertedCount += batch.length;
          }
        }

        stats.leagues.upserted = upsertedCount;
        console.log(`Upserted ${upsertedCount} leagues (${leagueRows.length - upsertedCount} skipped — unknown sport)`);
      }
    } catch (error) {
      const msg = `Leagues phase failed: ${(error as Error).message}`;
      console.error(msg);
      errors.push(msg);
    }

    // ── Logging ──────────────────────────────────────────────────
    const status = errors.length > 0
      ? ((stats.sports.upserted + stats.countries.upserted + stats.leagues.upserted) > 0 ? 'partial' : 'error')
      : 'success';

    const { error: logError } = await supabase.from('api_fetch_logs').insert({
      fetch_type: `reference-data-${trigger}`,
      sport: 'all',
      fetch_date: new Date().toISOString().split('T')[0],
      status,
      matches_fetched: stats.sports.fetched + stats.countries.fetched + stats.leagues.fetched,
      matches_created: stats.sports.upserted + stats.countries.upserted + stats.leagues.upserted,
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
      sports: stats.sports,
      countries: stats.countries,
      leagues: stats.leagues,
      executionTimeMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`Reference data fetch completed: ${JSON.stringify(response)}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.from('api_fetch_logs').insert({
        fetch_type: 'reference-data-manual',
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
