import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = Number(teamId);

  if (!Number.isFinite(team) || team <= 0) {
    return NextResponse.json({ error: 'Invalid teamId' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${FPL_BASE}/entry/${team}/`, {
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream FPL error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch FPL team info', details: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}
