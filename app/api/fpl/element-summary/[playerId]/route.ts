import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${FPL_BASE}/element-summary/${id}/`, {
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
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch FPL element-summary', details: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

