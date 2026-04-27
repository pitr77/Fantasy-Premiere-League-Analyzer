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
    
    // Extract token from header for Supabase auth
    const authHeader = req.headers.get('authorization');
    const tokenVal = authHeader?.split('Bearer ')?.[1];

    const supabase = createServerSupabase(tokenVal);
    const { data: { user } } = await supabase.auth.getUser();
    const isAdminUser = user?.email === 'p.kalavsky@gmail.com';

    // If it's not the admin user, then enforce secrets
    if (!isAdminUser && (secret || cronSecret)) {
        const { searchParams } = new URL(req.url);
        const urlKey = searchParams.get('key');

        // Accept: 1. Bearer token (secret/cronSecret), or 2. 'key' param in URL
        const isAuthorized = 
            (tokenVal && (tokenVal === secret || tokenVal === cronSecret)) ||
            (urlKey && urlKey === secret);

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const { searchParams } = new URL(req.url);
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
 * Manual trigger from UI
 */
export async function POST(req: Request) {
    return handleGeneration(req);
}

/**
 * GET /api/scout/generate
 * Triggered by Vercel Cron
 */
export async function GET(req: Request) {
    // If it's a cron request (has CRON_SECRET or is being called by Vercel)
    // or if no security is set at all, we allow GET to trigger generation.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    
    if (cronSecret && authHeader?.includes(`Bearer ${cronSecret}`)) {
        return handleGeneration(req);
    }

    // Otherwise, just return info (health check)
    return NextResponse.json({
        info: 'Use POST for manual generation. GET is reserved for automated Crons.',
        requiresAuth: Boolean(process.env.SCOUT_GENERATE_SECRET),
    });
}
