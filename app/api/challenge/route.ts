import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

/**
 * GET /api/challenge?gw=27
 * Retrieves the authenticated user's picks for a specific gameweek
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const gw = searchParams.get('gw');

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    const supabase = createServerSupabase(token);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (gw) {
        const { data, error } = await supabase
            .from('challenge_picks')
            .select('*')
            .eq('user_id', userData.user.id)
            .eq('gameweek', Number(gw))
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error fetching challenge picks:', error);
            return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
        }

        return NextResponse.json({ picks: data || null });
    } else {
        const { data, error } = await supabase
            .from('challenge_picks')
            .select('*')
            .eq('user_id', userData.user.id)
            .order('gameweek', { ascending: false });

        if (error) {
            console.error('Error fetching all challenge picks:', error);
            return NextResponse.json({ error: 'Failed to fetch picks history' }, { status: 500 });
        }

        return NextResponse.json({ history: data || [] });
    }
}

/**
 * POST /api/challenge
 * Saves or updates the user's picks for a gameweek
 * Body: { gameweek, gk_id, def_id, mid_id, fwd_id, captain_id }
 */
export async function POST(req: Request) {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    const supabase = createServerSupabase(token);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { gameweek, gk_id, def_id, mid_id, fwd_id, captain_id } = body;

        if (!gameweek || !gk_id || !def_id || !mid_id || !fwd_id || !captain_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Upsert into challenge_picks
        const { data, error } = await supabase
            .from('challenge_picks')
            .upsert(
                {
                    user_id: userData.user.id,
                    gameweek: Number(gameweek),
                    gk_id: Number(gk_id),
                    def_id: Number(def_id),
                    mid_id: Number(mid_id),
                    fwd_id: Number(fwd_id),
                    captain_id: Number(captain_id),
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id,gameweek' }
            )
            .select()
            .single();

        if (error) {
            console.error('Supabase upsert error:', error);
            return NextResponse.json({ error: 'Failed to save picks', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, picks: data });

    } catch (err: any) {
        console.error('Save challenge error:', err);
        return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
    }
}
