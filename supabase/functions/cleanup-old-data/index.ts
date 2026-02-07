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

    // Get events before today (to find related broadcasts/votes)
    const { data: oldMatches } = await supabase
      .from('events')
      .select('id')
      .lt('event_date', today);

    if (!oldMatches || oldMatches.length === 0) {
      console.log('No old data to clean');

      await supabase.from('api_fetch_logs').insert({
        fetch_type: 'cleanup',
        sport: 'all',
        fetch_date: today,
        status: 'success',
        matches_fetched: 0,
        matches_created: 0,
        matches_updated: 0,
        error_message: 'No old data to clean'
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'No old data to clean',
        deleted: { events: 0, broadcasts: 0, votes: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const oldMatchIds = oldMatches.map(m => m.id);
    console.log(`Found ${oldMatchIds.length} old events to delete`);

    // Get broadcasts for old events (to find votes)
    const { data: oldBroadcasts } = await supabase
      .from('broadcasts')
      .select('id')
      .in('event_id', oldMatchIds);

    const oldBroadcastIds = (oldBroadcasts || []).map(b => b.id);
    console.log(`Found ${oldBroadcastIds.length} old broadcasts to delete`);

    // Delete cascade: votes → broadcasts → events
    let votesDeleted = 0, broadcastsDeleted = 0, eventsDeleted = 0;

    if (oldBroadcastIds.length > 0) {
      const { count: vCount } = await supabase
        .from('votes')
        .delete({ count: 'exact' })
        .in('broadcast_id', oldBroadcastIds);
      votesDeleted = vCount || 0;
      console.log(`Deleted ${votesDeleted} votes`);
    }

    const { count: bCount } = await supabase
      .from('broadcasts')
      .delete({ count: 'exact' })
      .in('event_id', oldMatchIds);
    broadcastsDeleted = bCount || 0;
    console.log(`Deleted ${broadcastsDeleted} broadcasts`);

    const { count: mCount } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .in('id', oldMatchIds);
    eventsDeleted = mCount || 0;
    console.log(`Deleted ${eventsDeleted} events`);

    // Log cleanup
    await supabase.from('api_fetch_logs').insert({
      fetch_type: 'cleanup',
      sport: 'all',
      fetch_date: today,
      status: 'success',
      matches_fetched: 0,
      matches_created: 0,
      matches_updated: -eventsDeleted,
      error_message: `Cleaned: ${eventsDeleted} events, ${broadcastsDeleted} broadcasts, ${votesDeleted} votes`
    });

    return new Response(JSON.stringify({
      success: true,
      deleted: {
        events: eventsDeleted,
        broadcasts: broadcastsDeleted,
        votes: votesDeleted
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
