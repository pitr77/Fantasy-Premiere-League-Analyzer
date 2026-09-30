import { NextResponse } from 'next/server';
import { readTop100Snapshot, fetchAndSaveTop100Snapshot } from '../../../services/top100Service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let snapshot = await readTop100Snapshot();
  if (!snapshot) {
    try {
      snapshot = await fetchAndSaveTop100Snapshot();
    } catch (err: any) {
      return NextResponse.json(
        { available: false, error: err?.message || 'Failed to load Top 100 snapshot' },
        { status: 500 }
      );
    }
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
    return NextResponse.json(
      { available: false, success: false, error: err?.message || 'Failed to refresh Top 100 snapshot' },
      { status: 500 }
    );
  }
}
