import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    console.log(`Starting cleanup for events before ${today}`);

    // Process old events in batches of 1000 (PostgREST default limit)
    let totalEventsDeleted = 0, totalBroadcastsDeleted = 0, totalVotesDeleted = 0;

    while (true) {
      const { data: oldMatches } = await supabase
        .from('events')
        .select('id')
        .lt('event_date', today)
        .limit(1000);

      if (!oldMatches || oldMatches.length === 0) break;

      const oldMatchIds = oldMatches.map(m => m.id);

      // Get broadcasts for these events (to find votes)
      const { data: oldBroadcasts } = await supabase
        .from('broadcasts')
        .select('id')
        .in('event_id', oldMatchIds);

      const oldBroadcastIds = (oldBroadcasts || []).map(b => b.id);

      // Delete cascade: votes → broadcasts → events
      if (oldBroadcastIds.length > 0) {
        const { count: vCount } = await supabase
          .from('votes')
          .delete({ count: 'exact' })
          .in('broadcast_id', oldBroadcastIds);
        totalVotesDeleted += vCount || 0;
      }

      const { count: bCount } = await supabase
        .from('broadcasts')
        .delete({ count: 'exact' })
        .in('event_id', oldMatchIds);
      totalBroadcastsDeleted += bCount || 0;

      const { count: mCount } = await supabase
        .from('events')
        .delete({ count: 'exact' })
        .in('id', oldMatchIds);
      totalEventsDeleted += mCount || 0;

      console.log(`Batch: deleted ${mCount} events, ${bCount} broadcasts, ${totalVotesDeleted} votes`);
    }

    console.log(`Total deleted: ${totalEventsDeleted} events, ${totalBroadcastsDeleted} broadcasts, ${totalVotesDeleted} votes`);

    // Log cleanup
    await supabase.from('api_fetch_logs').insert({
      fetch_type: 'cleanup',
      sport: 'all',
      fetch_date: today,
      status: 'success',
      matches_fetched: 0,
      matches_created: 0,
      matches_updated: -totalEventsDeleted,
      error_message: totalEventsDeleted === 0
        ? 'No old data to clean'
        : `Cleaned: ${totalEventsDeleted} events, ${totalBroadcastsDeleted} broadcasts, ${totalVotesDeleted} votes`
    });

    return new Response(JSON.stringify({
      success: true,
      deleted: {
        events: totalEventsDeleted,
        broadcasts: totalBroadcastsDeleted,
        votes: totalVotesDeleted
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Cleanup error:', error);

    // Try to log the error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.from('api_fetch_logs').insert({
        fetch_type: 'cleanup',
        sport: 'all',
        fetch_date: new Date().toISOString().split('T')[0],
        status: 'error',
        matches_fetched: 0,
        matches_created: 0,
        matches_updated: 0,
        error_message: error.message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
