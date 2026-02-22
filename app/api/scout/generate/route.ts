import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabaseServer';
import { generateScoutArticle } from '@/services/scoutGeneratorService';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for AI generation

// Global lock to prevent concurrent AI generations
let isGenerating = false;

/**
 * POST /api/scout/generate
 * 
 * Generates a new Scout article for the current gameweek using Gemini AI.
 * Protected by SCOUT_GENERATE_SECRET — only callable by cron or admin.
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

    const { searchParams } = new URL(req.url);
    const isMock = searchParams.get('mock') === 'true';

    if (isGenerating && !isMock) {
        return NextResponse.json(
            { error: 'Generation already in progress. Please wait.' },
            { status: 429 }
        );
    }

    try {
        if (!isMock) isGenerating = true;

        const article = await generateScoutArticle(isMock);
        const supabase = createServerSupabase();

        // Upsert: if slug exists, update; otherwise insert
        const { error } = await supabase
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
                        is_mock: isMock,
                        captain_pick: article.captain_pick,
                        differential_pick: article.differential_pick,
                    },
                },
                { onConflict: 'slug' }
            );

        if (error) {
            console.error('Supabase upsert error:', error);
            return NextResponse.json(
                { error: 'Failed to save article', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            isMock,
            article: {
                slug: article.slug,
                title: article.title,
                gameweek: article.gameweek,
            },
        });
    } catch (err: any) {
        console.error('Scout generation error:', err);
        return NextResponse.json(
            {
                error: 'Failed to generate article',
                message: err?.message || String(err),
                stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
            },
            { status: 500 }
        );
    } finally {
        isGenerating = false;
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
