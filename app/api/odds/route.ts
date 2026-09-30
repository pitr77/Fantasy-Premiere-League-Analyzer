import { NextResponse } from 'next/server';
import { readOddsSnapshot } from '../../../services/oddsSnapshotService';
import { fetchAndSaveFortunaOdds } from '../../../services/fortunaOddsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let snapshot = await readOddsSnapshot();
  if (!snapshot) {
    try {
      snapshot = await fetchAndSaveFortunaOdds();
    } catch {
      return NextResponse.json(
        { available: false, error: 'No local odds snapshot found and live fetch failed.' },
        { status: 404 },
      );
    }
  }

  return NextResponse.json(
    { available: true, ...snapshot },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function POST() {
  try {
    const snapshot = await fetchAndSaveFortunaOdds();
    return NextResponse.json(
      { available: true, success: true, ...snapshot },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error: any) {
    console.error('Failed to refresh Fortuna odds:', error);
    return NextResponse.json(
      { available: false, success: false, error: error?.message || 'Failed to refresh odds' },
      { status: 500 },
    );
  }
}
