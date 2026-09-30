import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

// In-memory cache to prevent rate-limiting and withstand FPL network hiccups
let cachedData: any = null;
let cachedTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cachedTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  try {
    const upstream = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      if (cachedData) {
        console.warn(`Upstream FPL error: ${upstream.status}, serving cached bootstrap-static.`);
        return NextResponse.json(cachedData);
      }
      return NextResponse.json(
        { error: `Upstream FPL error: ${upstream.status}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    cachedData = data;
    cachedTime = now;

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    if (cachedData) {
      console.warn('FPL fetch failed, serving cached bootstrap-static:', err?.message);
      return NextResponse.json(cachedData);
    }
    return NextResponse.json(
      { error: 'Failed to fetch FPL bootstrap-static', details: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

