import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function GET() {
  try {
    const upstream = await fetch(`${FPL_BASE}/fixtures/`, {
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
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch FPL fixtures', details: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

