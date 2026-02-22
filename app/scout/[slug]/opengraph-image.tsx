import { ImageResponse } from 'next/og';
import { createServerSupabase } from '@/lib/supabaseServer';

export const runtime = 'edge';

// Image metadata
export const alt = 'FPL Studio Scout Gameweek Preview';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
    // Edge functions can fetch Supabase data directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        return new Response('Missing Supabase env vars', { status: 500 });
    }

    // Raw fetch because createServerSupabase is nodejs, and we are in edge runtime
    const res = await fetch(`${supabaseUrl}/rest/v1/scout_articles?select=*&slug=eq.${params.slug}&published=is.true`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    const data = await res.json();
    const article = data?.[0];

    if (!article) {
        return new Response('Not Found', { status: 404 });
    }

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#0f172a', // text-slate-950
                    padding: '80px',
                    justifyContent: 'space-between',
                    backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(147, 51, 234, 0.4) 0%, rgba(15, 23, 42, 1) 50%, rgba(16, 185, 129, 0.1) 100%)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '2px solid rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            padding: '12px 24px',
                            borderRadius: '16px',
                            fontSize: '28px',
                            fontWeight: 900,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase'
                        }}>
                            Gameweek {article.gameweek}
                        </div>
                        <div style={{
                            color: '#a855f7',
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '2px solid rgba(168, 85, 247, 0.2)',
                            padding: '12px 24px',
                            borderRadius: '16px',
                            fontSize: '28px',
                            fontWeight: 900,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            marginLeft: '20px'
                        }}>
                            AI Scout
                        </div>
                    </div>
                    <h1
                        style={{
                            fontSize: '76px',
                            fontWeight: 900,
                            color: '#ffffff',
                            lineHeight: 1.1,
                            letterSpacing: '-2px',
                            marginBottom: '30px',
                        }}
                    >
                        {article.title}
                    </h1>
                    <p
                        style={{
                            fontSize: '32px',
                            color: '#94a3b8',
                            margin: 0,
                            maxWidth: '85%',
                            lineHeight: 1.4,
                        }}
                    >
                        {article.summary}
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '30px' }}>
                        {article.captain_pick && (
                            <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(245, 158, 11, 0.05)', padding: '24px', borderRadius: '24px', border: '2px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ color: '#f59e0b', fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>Captain</div>
                                <div style={{ color: '#fff', fontSize: '36px', fontWeight: 900 }}>{article.captain_pick}</div>
                            </div>
                        )}
                        {article.differential_pick && (
                            <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(6, 182, 212, 0.05)', padding: '24px', borderRadius: '24px', border: '2px solid rgba(6, 182, 212, 0.2)' }}>
                                <div style={{ color: '#06b6d4', fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>Differential</div>
                                <div style={{ color: '#fff', fontSize: '36px', fontWeight: 900 }}>{article.differential_pick}</div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', fontSize: '32px', fontWeight: 900, color: 'transparent', backgroundClip: 'text', backgroundImage: 'linear-gradient(to right, #c084fc, #34d399)' }}>
                        FPL STUDIO
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
