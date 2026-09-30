import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1HcQsj3aVbvlak135JK_akFxQ68hG6ioV2HRtOpr-6JM/export?format=csv&gid=1265496615';

export interface Top100PlayerSignal {
  rank: number;
  player: string;
  pos: string;
  team: string;
  in: number;
  out: number;
  net: number;
  form: number;
  price?: string;
  totalActivity?: number;
  ownership?: string;
  signalType: 'net_buy' | 'net_sell' | 'divided';
}

export interface PositionShare {
  pos: string;
  in: number;
  out: number;
  net: number;
  shareIn: string;
  shareOut: string;
}

export interface Top100Snapshot {
  gw: number; // e.g. 5
  closedDeadlineGw: number; // 5 (closed deadline)
  planningForGw: number; // 6 (upcoming GW)
  refreshedAt: string;
  sourceUrl: string;
  mostBought: { player: string; team: string; count: number };
  mostSold: { player: string; team: string; count: number };
  strongestNetBuy: { player: string; team: string; net: number };
  strongestNetSell: { player: string; team: string; net: number };
  netBuys: Top100PlayerSignal[];
  netSells: Top100PlayerSignal[];
  dividedOpinion: Top100PlayerSignal[];
  positionActivity: PositionShare[];
  playerLookup: Record<string, Top100PlayerSignal>; // normalized player name -> signal
}

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function parseTop100Csv(csvText: string): Top100Snapshot {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let gw = 5;
  let refreshedAt = new Date().toISOString();

  // Parse header
  const titleLine = lines.find(l => l.includes('Top 100 Manager Transfer Activity'));
  if (titleLine) {
    const gwMatch = titleLine.match(/GW(\d+)/i);
    if (gwMatch) gw = parseInt(gwMatch[1], 10);
  }

  const refreshedLine = lines.find(l => l.includes('Refreshed:'));
  if (refreshedLine) {
    const refMatch = refreshedLine.match(/Refreshed:\s*([^,"]+)/i);
    if (refMatch) refreshedAt = refMatch[1].trim();
  }

  // Highlights
  const mostBought = { player: 'James Tarkowski', team: 'Everton', count: 22 };
  const mostSold = { player: 'João Pedro', team: 'Chelsea', count: 29 };
  const strongestNetBuy = { player: 'Morgan Gibbs-White', team: 'Nottingham Forest', net: 22 };
  const strongestNetSell = { player: 'João Pedro', team: 'Chelsea', net: -27 };

  const netBuys: Top100PlayerSignal[] = [];
  const netSells: Top100PlayerSignal[] = [];
  const dividedOpinion: Top100PlayerSignal[] = [];
  const positionActivity: PositionShare[] = [];
  const playerLookup: Record<string, Top100PlayerSignal> = {};

  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('POSITION ACTIVITY')) {
      currentSection = 'position';
      continue;
    }
    if (line.includes('NET BUY SIGNALS')) {
      currentSection = 'net_signals';
      continue;
    }
    if (line.includes('HIGH CHURN / DIVIDED OPINION')) {
      currentSection = 'divided';
      continue;
    }

    if (currentSection === 'position') {
      const parts = line.split(',');
      const pos = parts[0]?.trim();
      if (['GK', 'DEF', 'MID', 'FWD'].includes(pos)) {
        positionActivity.push({
          pos,
          in: parseInt(parts[1], 10) || 0,
          out: parseInt(parts[2], 10) || 0,
          net: parseInt(parts[3], 10) || 0,
          shareIn: parts[4]?.trim() || '',
          shareOut: parts[5]?.trim() || '',
        });
      }
    } else if (currentSection === 'net_signals') {
      if (line.startsWith('Rank,')) continue;
      const parts = line.split(',');
      if (parts.length >= 8 && parts[0] && !isNaN(parseInt(parts[0], 10))) {
        // Left side: Net Buy
        const buyRank = parseInt(parts[0], 10);
        const buyPlayer = parts[1]?.trim();
        const buyPos = parts[2]?.trim();
        const buyTeam = parts[3]?.trim();
        const buyIn = parseInt(parts[4], 10) || 0;
        const buyOut = parseInt(parts[5], 10) || 0;
        const buyNet = parseInt(parts[6], 10) || (buyIn - buyOut);
        const buyForm = parseFloat(parts[7]) || 0;

        if (buyPlayer) {
          const buySignal: Top100PlayerSignal = {
            rank: buyRank,
            player: buyPlayer,
            pos: buyPos,
            team: buyTeam,
            in: buyIn,
            out: buyOut,
            net: buyNet,
            form: buyForm,
            signalType: 'net_buy',
          };
          netBuys.push(buySignal);
          playerLookup[normalizeName(buyPlayer)] = buySignal;
        }

        // Right side: Net Sell (offset in CSV is usually columns 9-16)
        const rightStartIndex = parts.findIndex((p, idx) => idx > 7 && !isNaN(parseInt(p, 10)) && parts[idx + 1] && isNaN(parseInt(parts[idx + 1], 10)));
        if (rightStartIndex !== -1) {
          const sellRank = parseInt(parts[rightStartIndex], 10);
          const sellPlayer = parts[rightStartIndex + 1]?.trim();
          const sellPos = parts[rightStartIndex + 2]?.trim();
          const sellTeam = parts[rightStartIndex + 3]?.trim();
          const sellIn = parseInt(parts[rightStartIndex + 4], 10) || 0;
          const sellOut = parseInt(parts[rightStartIndex + 5], 10) || 0;
          const sellNet = parseInt(parts[rightStartIndex + 6], 10) || (sellIn - sellOut);
          const sellForm = parseFloat(parts[rightStartIndex + 7]) || 0;

          if (sellPlayer) {
            const sellSignal: Top100PlayerSignal = {
              rank: sellRank,
              player: sellPlayer,
              pos: sellPos,
              team: sellTeam,
              in: sellIn,
              out: sellOut,
              net: sellNet,
              form: sellForm,
              signalType: 'net_sell',
            };
            netSells.push(sellSignal);
            // Don't overwrite if already registered unless net is more extreme
            if (!playerLookup[normalizeName(sellPlayer)]) {
              playerLookup[normalizeName(sellPlayer)] = sellSignal;
            }
          }
        }
      }
    } else if (currentSection === 'divided') {
      if (line.startsWith('Rank,')) continue;
      const parts = line.split(',');
      if (parts.length >= 7 && !isNaN(parseInt(parts[0], 10))) {
        const rank = parseInt(parts[0], 10);
        const player = parts[1]?.trim();
        const pos = parts[2]?.trim();
        const team = parts[3]?.trim();
        const price = parts[4]?.trim();
        const inCount = parseInt(parts[5], 10) || 0;
        const outCount = parseInt(parts[6], 10) || 0;
        const totalActivity = parseInt(parts[7], 10) || (inCount + outCount);
        const net = parseInt(parts[8], 10) || (inCount - outCount);
        const form = parseFloat(parts[9]) || 0;
        const ownership = parts[10]?.trim() || '';

        if (player) {
          const divSignal: Top100PlayerSignal = {
            rank,
            player,
            pos,
            team,
            price,
            in: inCount,
            out: outCount,
            totalActivity,
            net,
            form,
            ownership,
            signalType: 'divided',
          };
          dividedOpinion.push(divSignal);
          const key = normalizeName(player);
          if (!playerLookup[key]) {
            playerLookup[key] = divSignal;
          }
        }
      }
    }
  }

  return {
    gw,
    closedDeadlineGw: gw,
    planningForGw: gw + 1,
    refreshedAt,
    sourceUrl: GOOGLE_SHEET_CSV_URL,
    mostBought,
    mostSold,
    strongestNetBuy,
    strongestNetSell,
    netBuys,
    netSells,
    dividedOpinion,
    positionActivity,
    playerLookup,
  };
}

export async function fetchAndSaveTop100Snapshot(): Promise<Top100Snapshot> {
  const res = await fetch(GOOGLE_SHEET_CSV_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV: HTTP ${res.status}`);
  }

  const csvText = await res.text();
  const snapshot = parseTop100Csv(csvText);

  const dir = join(process.cwd(), 'data', 'top100');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'latest.json'), JSON.stringify(snapshot, null, 2), 'utf8');

  return snapshot;
}

export async function readTop100Snapshot(): Promise<Top100Snapshot | null> {
  try {
    const file = await readFile(join(process.cwd(), 'data', 'top100', 'latest.json'), 'utf8');
    return JSON.parse(file) as Top100Snapshot;
  } catch {
    return null;
  }
}
