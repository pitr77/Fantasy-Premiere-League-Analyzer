import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MatchOdds } from '../lib/oddsModel';

export type FortunaCleanSheet = {
  yes: number;
  no: number;
  prob: number;
};

export type FortunaScorer = {
  name: string;
  odds: number;
  prob: number;
};

export type FortunaMatch = {
  id: string;
  name: string;
  startDatetime: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  odds: {
    home: number;
    draw: number;
    away: number;
  } | null;
  probabilities: {
    home: number;
    draw: number;
    away: number;
    overround: number;
  } | null;
  overUnder25: {
    over: number;
    under: number;
    overProb: number | null;
    underProb: number | null;
  } | null;
  cleanSheet: {
    home: FortunaCleanSheet | null;
    away: FortunaCleanSheet | null;
  };
  scorers?: FortunaScorer[];
};

export type OddsSnapshot = {
  provider: string;
  tournament?: string;
  tournamentId?: string | number;
  fetchedAt: string;
  matchesCount?: number;
  matches?: FortunaMatch[];
  payload?: any;
};

export async function readOddsSnapshot(): Promise<OddsSnapshot | null> {
  try {
    const file = await readFile(join(process.cwd(), 'data', 'odds', 'latest.json'), 'utf8');
    return JSON.parse(file) as OddsSnapshot;
  } catch {
    try {
      const tmpFile = await readFile('/tmp/fpl_odds_latest.json', 'utf8');
      return JSON.parse(tmpFile) as OddsSnapshot;
    } catch {
      return null;
    }
  }
}

/** Finds Fortuna match odds by FPL home and away team IDs */
export function findMatchOdds(
  snapshot: OddsSnapshot | null,
  homeTeamId: number,
  awayTeamId: number
): FortunaMatch | null {
  if (!snapshot?.matches) return null;
  return snapshot.matches.find(
    m => m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId
  ) || null;
}

function decimal(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

/** Extracts a 1X2 market from bookmaker data (fallback for legacy formats) */
export function extractMatchOdds(fixture: any): MatchOdds | null {
  if (fixture?.odds?.home && fixture?.odds?.draw && fixture?.odds?.away) {
    return fixture.odds;
  }
  const bookmakers = fixture?.bookmakers || [];
  for (const bookmaker of bookmakers) {
    for (const bet of bookmaker.bets || []) {
      const values = new Map<string, number>();
      for (const value of bet.values || []) {
        const odd = decimal(value.odd);
        if (odd !== null) values.set(String(value.value).toLowerCase(), odd);
      }
      const home = [...values.entries()].find(([key]) => key === 'home')?.[1];
      const draw = [...values.entries()].find(([key]) => key === 'draw')?.[1];
      const away = [...values.entries()].find(([key]) => key === 'away')?.[1];
      if (home && draw && away) return { home, draw, away };
    }
  }
  return null;
}
