import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabaseServer';
import { generateScoutArticle } from '@/services/scoutGeneratorService';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for AI generation

/**
 * POST /api/scout/generate
 * 
 * Generates a new Scout article for the current gameweek using Gemini AI.
 * Protected by SCOUT_GENERATE_SECRET — only callable by cron or admin.
 * 
 * If an article for the same gameweek already exists, it updates it (upsert).
 */
export async function POST(req: Request) {
    // Auth check
    const secret = process.env.SCOUT_GENERATE_SECRET;
    if (secret) {
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${secret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const article = await generateScoutArticle();
        const supabase = createServerSupabase();

        // Upsert: if slug exists, update; otherwise insert
        const { data, error } = await supabase
            .from('scout_articles')
            .upsert(
                {
                    slug: article.slug,
                    gameweek: article.gameweek,
                    title: article.title,
                    summary: article.summary,
                    content: article.content,
                    captain_pick: article.captain_pick,
                    differential_pick: article.differential_pick,
                    generated_at: new Date().toISOString(),
                    published: true,
                    metadata: {
                        captain_pick: article.captain_pick,
                        differential_pick: article.differential_pick,
                    },
                },
                { onConflict: 'slug' }
            )
            .select()
            .single();

        if (error) {
            console.error('Supabase upsert error:', error);
            return NextResponse.json(
                { error: 'Failed to save article', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            article: {
                slug: article.slug,
                title: article.title,
                gameweek: article.gameweek,
            },
        });
    } catch (err: any) {
        console.error('Scout generation error:', err);
        return NextResponse.json(
            { error: 'Failed to generate article', details: String(err?.message ?? err) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/scout/generate
 * Health check / manual trigger info
 */
export async function GET() {
    return NextResponse.json({
        info: 'POST to this endpoint with Bearer token to generate a scout article.',
        requiresAuth: Boolean(process.env.SCOUT_GENERATE_SECRET),
    });
}
