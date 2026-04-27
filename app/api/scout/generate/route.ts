import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabaseServer';
import { generateScoutArticle } from '@/services/scoutGeneratorService';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for AI generation

// Global lock to prevent concurrent AI generations
let isGenerating = false;

async function handleGeneration(req: Request) {
    const secret = process.env.SCOUT_GENERATE_SECRET;
    const cronSecret = process.env.CRON_SECRET;
    
    // Extract token from header for Supabase auth OR direct secret auth
    const authHeader = req.headers.get('authorization');
    const tokenVal = authHeader?.split('Bearer ')?.[1];

    const supabase = createServerSupabase(tokenVal);
    const { data: { user } } = await supabase.auth.getUser();
    const isAdminUser = user?.email === 'p.kalavsky@gmail.com';

    // Auth check logic
    const { searchParams } = new URL(req.url);
    const urlKey = searchParams.get('key');

    // Accept: 1. Admin email session, 2. Bearer token (secret/cronSecret), or 3. 'key' param in URL
    const isAuthorized = 
        isAdminUser ||
        (tokenVal && (tokenVal === secret || tokenVal === cronSecret)) ||
        (urlKey && urlKey === secret);

    if (!isAuthorized && (secret || cronSecret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isMock = searchParams.get('mock') === 'true';
    const topic = searchParams.get('topic') || 'general';

    if (isGenerating && !isMock) {
        return NextResponse.json(
            { error: 'Generation already in progress. Please wait.' },
            { status: 429 }
        );
    }

    try {
        if (!isMock) isGenerating = true;

        const article = await generateScoutArticle({ isMock, topic });
        const supabaseAdmin = createServerSupabase(); // Use base client for upsert

        const { error } = await supabaseAdmin
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
                        topic,
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
            topic,
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
 * POST /api/scout/generate
 */
export async function POST(req: Request) {
    return handleGeneration(req);
}

/**
 * GET /api/scout/generate
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const urlKey = searchParams.get('key');
    const secret = process.env.SCOUT_GENERATE_SECRET;
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');

    // If it's an authorized request (via key in URL or Bearer token), run it
    if (
        (urlKey && urlKey === secret) || 
        (authHeader?.includes(`Bearer ${cronSecret}`)) ||
        (authHeader?.includes(`Bearer ${secret}`))
    ) {
        return handleGeneration(req);
    }

    // Otherwise, just return info (health check)
    return NextResponse.json({
        info: 'Use POST for manual generation. GET is reserved for automated Crons.',
        requiresAuth: Boolean(secret),
    });
}
