import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  const { teamId, eventId } = await params;
  const team = Number(teamId);
  const event = Number(eventId);

  if (!Number.isFinite(team) || team <= 0 || !Number.isFinite(event) || event <= 0) {
    return NextResponse.json({ error: 'Invalid teamId or eventId' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${FPL_BASE}/entry/${team}/event/${event}/picks/`, {
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
      { error: 'Failed to fetch FPL picks', details: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

