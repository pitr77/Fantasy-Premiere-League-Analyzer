import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function GET() {
  try {
    const upstream = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream FPL error: ${upstream.status}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: {
        // Helps CDN/server caches; Next fetch cache also applies via `revalidate`.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch FPL bootstrap-static', details: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

