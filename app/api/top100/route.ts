import { NextResponse } from 'next/server';
import { readTop100Snapshot, fetchAndSaveTop100Snapshot } from '../../../services/top100Service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  let snapshot = await readTop100Snapshot();
  const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const isStale = !snapshot || !snapshot.cachedAt || (Date.now() - snapshot.cachedAt > CACHE_TTL_MS);

  if (isStale) {
    try {
      const fresh = await fetchAndSaveTop100Snapshot();
      snapshot = fresh;
    } catch (err: any) {
      console.warn('[api/top100] Live fetch error, falling back to cached snapshot:', err?.message);
      if (!snapshot) {
        snapshot = await readTop100Snapshot();
      }
    }
  }

  if (!snapshot) {
    return NextResponse.json(
      { available: false, error: 'Nepodarilo sa načítať Top 100 snapshot' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { available: true, ...snapshot },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST() {
  try {
    const snapshot = await fetchAndSaveTop100Snapshot();
    return NextResponse.json(
      { available: true, success: true, ...snapshot },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.warn('[api/top100] Manual refresh failed:', err?.message);
    const fallback = await readTop100Snapshot();
    if (fallback) {
      return NextResponse.json(
        { available: true, success: false, warning: err?.message, ...fallback },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }
    return NextResponse.json(
      { available: false, success: false, error: err?.message || 'Failed to refresh Top 100 snapshot' },
      { status: 500 }
    );
  }
}
