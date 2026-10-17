import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fallbackTop100Json from '../data/top100/latest.json';

export const SPREADSHEET_ID = '1HcQsj3aVbvlak135JK_akFxQ68hG6ioV2HRtOpr-6JM';
export const DEFAULT_TRANSFERS_GID = '1863195069';
export const DEFAULT_TEMPLATE_GID = '673155910';

export const TRANSFERS_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${DEFAULT_TRANSFERS_GID}`;
export const TEMPLATE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${DEFAULT_TEMPLATE_GID}`;

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

export interface Top100PositionLeader {
  rank: number;
  player: string;
  own: string;
  team: string;
}

export interface Top100TemplateTierPlayer {
  rank: number;
  player: string;
  pos: string; // 'GK' | 'DEF' | 'MID' | 'FWD'
  team: string;
  price: string;
  top100Own: number; // e.g. 88.0
  appearances: number; // e.g. 88
  overallOwn: number; // e.g. 73.8
  delta: number; // e.g. +14.2 (top100Own - overallOwn)
  tier: string; // 'Template Core' | 'Strong Template' | 'Differential' | 'Elite Differential'
  status: string; // 'Core' | 'Strong' | 'Differential' | 'Elite Diff'
}

export interface Top100TemplateAnalysis {
  templateByPos: {
    GK: Top100PositionLeader[];
    DEF: Top100PositionLeader[];
    MID: Top100PositionLeader[];
    FWD: Top100PositionLeader[];
  };
  templateTiers: Top100TemplateTierPlayer[];
}

export interface Top100Snapshot {
  gw: number; // e.g. 6
  closedDeadlineGw: number;
  planningForGw: number;
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
  templateAnalysis?: Top100TemplateAnalysis;
  cachedAt?: number;
}

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function cleanCsvCell(str: string): string {
  if (!str) return '';
  return str.replace(/^"|"$/g, '').trim();
}

function parseCsvRow(line: string): string[] {
  const res: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      res.push(cleanCsvCell(current));
      current = '';
    } else {
      current += c;
    }
  }
  res.push(cleanCsvCell(current));
  return res;
}

export function isSnapshotValid(snapshot: Top100Snapshot | null): boolean {
  if (!snapshot) return false;
  if (!snapshot.mostBought?.player || snapshot.mostBought.player.includes('"') || snapshot.mostBought.player.includes(',')) {
    return false;
  }
  if (!snapshot.mostSold?.player || snapshot.mostSold.player.includes('"') || snapshot.mostSold.player.includes(',')) {
    return false;
  }
  if (!snapshot.netBuys || snapshot.netBuys.length === 0) {
    return false;
  }
  if (!snapshot.netSells || snapshot.netSells.length === 0) {
    return false;
  }
  return true;
}

export function parseTop100Csv(csvText: string): Top100Snapshot {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let gw = 6;
  let refreshedAt = new Date().toISOString();

  const gwMatch = csvText.match(/GW(\d+)/i);
  if (gwMatch) gw = parseInt(gwMatch[1], 10);

  const refMatch = csvText.match(/Refreshed:\s*(\d{1,2}-[A-Za-z]+-\d{4}\s+\d{1,2}:\d{2})/i) || csvText.match(/Refreshed:\s*([^,\r\n"]+?)(?:\s+MOST|\s*$)/i);
  if (refMatch) refreshedAt = refMatch[1].trim();

  // Extract KPI card highlights using regex pattern from header cell
  const mbMatch = csvText.match(/MOST BOUGHT\r?\n([^\r\n]+)\r?\n([^\r\n]+)\r?\n(\d+)\s*managers/i);
  const msMatch = csvText.match(/MOST SOLD\r?\n([^\r\n]+)\r?\n([^\r\n]+)\r?\n(\d+)\s*managers/i);
  const nbMatch = csvText.match(/STRONGEST NET BUY\r?\n([^\r\n]+)\r?\n([^\r\n]+)\r?\nNet\s*\+?(-?\d+)/i);
  const nsMatch = csvText.match(/STRONGEST NET SELL\r?\n([^\r\n]+)\r?\n([^\r\n]+)\r?\nNet\s*(-?\d+)/i);

  const mostBought = {
    player: mbMatch ? cleanCsvCell(mbMatch[1]) : '',
    team: mbMatch ? cleanCsvCell(mbMatch[2]) : '',
    count: mbMatch ? parseInt(mbMatch[3], 10) : 0,
  };
  const mostSold = {
    player: msMatch ? cleanCsvCell(msMatch[1]) : '',
    team: msMatch ? cleanCsvCell(msMatch[2]) : '',
    count: msMatch ? parseInt(msMatch[3], 10) : 0,
  };
  const strongestNetBuy = {
    player: nbMatch ? cleanCsvCell(nbMatch[1]) : '',
    team: nbMatch ? cleanCsvCell(nbMatch[2]) : '',
    net: nbMatch ? parseInt(nbMatch[3], 10) : 0,
  };
  const strongestNetSell = {
    player: nsMatch ? cleanCsvCell(nsMatch[1]) : '',
    team: nsMatch ? cleanCsvCell(nsMatch[2]) : '',
    net: nsMatch ? parseInt(nsMatch[3], 10) : 0,
  };

  const netBuys: Top100PlayerSignal[] = [];
  const netSells: Top100PlayerSignal[] = [];
  const dividedOpinion: Top100PlayerSignal[] = [];
  const positionActivity: PositionShare[] = [];
  const playerLookup: Record<string, Top100PlayerSignal> = {};

  const posNames = ['GK', 'DEF', 'MID', 'FWD'];
  let posIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const parts = parseCsvRow(rawLine);

    // 1. Position Activity Breakdown (% shares in parts[4] and parts[5])
    if (posIdx < 4 && parts.length >= 6 && parts[4] && parts[4].endsWith('%') && parts[5] && parts[5].endsWith('%')) {
      const pos = posNames[posIdx++];
      positionActivity.push({
        pos,
        in: parseInt(parts[1], 10) || 0,
        out: parseInt(parts[2], 10) || 0,
        net: parseInt(parts[3], 10) || 0,
        shareIn: parts[4],
        shareOut: parts[5],
      });
      continue;
    }

    // 2. High Churn / Divided Opinion (row format has price with £ in parts[4])
    if (parts.length >= 10 && parts[0] && !isNaN(parseInt(parts[0], 10)) && parts[4] && parts[4].includes('£')) {
      const rank = parseInt(parts[0], 10);
      const player = parts[1];
      const pos = parts[2];
      const team = parts[3];
      const price = parts[4];
      const inCount = parseInt(parts[5], 10) || 0;
      const outCount = parseInt(parts[6], 10) || 0;
      const totalActivity = parseInt(parts[7], 10) || (inCount + outCount);
      const net = parseInt(parts[8], 10) || (inCount - outCount);
      const form = parseFloat(parts[9]) || 0;
      const ownership = parts[10] || '';

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
      continue;
    }

    // 3. Net Buys & Net Sells Leaderboards:
    // parts[0] is rank (1..10), parts[6] is buy net (number), parts[15] is sell net (number)
    if (
      parts.length >= 16 &&
      parts[0] &&
      !isNaN(parseInt(parts[0], 10)) &&
      !parts[4].includes('£') &&
      parts[6] !== '' &&
      !isNaN(parseInt(parts[6], 10)) &&
      parts[15] !== '' &&
      !isNaN(parseInt(parts[15], 10))
    ) {
      const buyRank = parseInt(parts[0], 10);
      const buyPlayer = parts[1];
      const buyPos = parts[2];
      const buyTeam = parts[3];
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

      // Sell side is on right offset
      const rightRank = parseInt(parts[9], 10);
      const sellPlayer = parts[10];
      const sellPos = parts[11];
      const sellTeam = parts[12];
      const sellIn = parseInt(parts[13], 10) || 0;
      const sellOut = parseInt(parts[14], 10) || 0;
      const sellNet = parseInt(parts[15], 10) || (sellIn - sellOut);
      const sellForm = parseFloat(parts[16]) || 0;

      if (sellPlayer) {
        const sellSignal: Top100PlayerSignal = {
          rank: rightRank || buyRank,
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
        const sellKey = normalizeName(sellPlayer);
        if (!playerLookup[sellKey]) {
          playerLookup[sellKey] = sellSignal;
        }
      }
      continue;
    }
  }

  // Fallbacks if KPI cards were not matched via regex:
  if (!mostBought.player && netBuys[0]) {
    mostBought.player = netBuys[0].player;
    mostBought.team = netBuys[0].team;
    mostBought.count = netBuys[0].in;
  }
  if (!mostSold.player && netSells[0]) {
    mostSold.player = netSells[0].player;
    mostSold.team = netSells[0].team;
    mostSold.count = netSells[0].out;
  }
  if (!strongestNetBuy.player && netBuys[0]) {
    strongestNetBuy.player = netBuys[0].player;
    strongestNetBuy.team = netBuys[0].team;
    strongestNetBuy.net = netBuys[0].net;
  }
  if (!strongestNetSell.player && netSells[0]) {
    strongestNetSell.player = netSells[0].player;
    strongestNetSell.team = netSells[0].team;
    strongestNetSell.net = netSells[0].net;
  }

  return {
    gw,
    closedDeadlineGw: gw,
    planningForGw: gw + 1,
    refreshedAt,
    sourceUrl: TRANSFERS_SHEET_CSV_URL,
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

export function parseTop100TemplateCsv(csvText: string): Top100TemplateAnalysis {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const templateTiers: Top100TemplateTierPlayer[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const parts = parseCsvRow(rawLine);

    // Template tier rows:
    // parts[1]: Player, parts[2]: Pos, parts[3]: Team, parts[4]: Price, parts[5]: Top100 Own %, parts[6]: Appearances, parts[7]: Overall Own %, parts[8]: Tier, parts[9]: Rank, parts[10]: Status
    if (parts.length >= 10 && parts[1] && parts[4] && parts[4].includes('£') && parts[5] && parts[5].includes('%')) {
      const player = parts[1];
      const pos = parts[2] || '';
      const team = parts[3] || '';
      const price = parts[4] || '';
      const top100Own = parseFloat(parts[5].replace('%', '')) || 0;
      const appearances = parseInt(parts[6] || '0', 10);
      const overallOwn = parseFloat(parts[7].replace('%', '')) || 0;
      const tier = parts[8] || '';
      const rank = parseInt(parts[9] || '0', 10);
      const status = parts[10] || '';
      const delta = parseFloat((top100Own - overallOwn).toFixed(1));

      templateTiers.push({
        rank,
        player,
        pos,
        team,
        price,
        top100Own,
        appearances,
        overallOwn,
        tier,
        status,
        delta,
      });
    }
  }

  // Build clean templateByPos directly from verified templateTiers
  const templateByPos = {
    GK: [] as Top100PositionLeader[],
    DEF: [] as Top100PositionLeader[],
    MID: [] as Top100PositionLeader[],
    FWD: [] as Top100PositionLeader[],
  };

  (['GK', 'DEF', 'MID', 'FWD'] as const).forEach(pos => {
    const matching = templateTiers
      .filter(t => t.pos.toUpperCase() === pos)
      .sort((a, b) => b.top100Own - a.top100Own)
      .slice(0, 5)
      .map((t, idx) => ({
        rank: idx + 1,
        player: t.player,
        own: `${t.top100Own.toFixed(1)}%`,
        team: t.team,
      }));
    templateByPos[pos] = matching;
  });

  return {
    templateByPos,
    templateTiers,
  };
}

let inMemoryTop100: Top100Snapshot | null = null;

export async function resolveSheetGids(): Promise<{ transfersGid: string; templateGid: string }> {
  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/htmlview`;
    const res = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const html = await res.text();
      const gids: Record<string, string> = {};
      const re = /name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        gids[m[1].trim()] = m[2];
      }
      const reRev = /gid:\s*"(\d+)"[^}]*?name:\s*"([^"]+)"/g;
      while ((m = reRev.exec(html)) !== null) {
        gids[m[2].trim()] = m[1];
      }

      let transfersGid = '';
      let templateGid = '';

      for (const [name, gid] of Object.entries(gids)) {
        const lower = name.toLowerCase();
        if (lower.includes('top 100') && lower.includes('transfer')) {
          transfersGid = gid;
        } else if (!transfersGid && lower.includes('transfer') && !lower.includes('pick')) {
          transfersGid = gid;
        }

        if (lower.includes('top 100') && (lower.includes('analysis') || lower.includes('template'))) {
          templateGid = gid;
        } else if (!templateGid && (lower.includes('template') || lower.includes('analysis'))) {
          templateGid = gid;
        }
      }

      return {
        transfersGid: transfersGid || DEFAULT_TRANSFERS_GID,
        templateGid: templateGid || DEFAULT_TEMPLATE_GID,
      };
    }
  } catch (err) {
    console.warn('[top100Service] Dynamic sheet discovery failed, falling back to defaults:', err);
  }

  return { transfersGid: DEFAULT_TRANSFERS_GID, templateGid: DEFAULT_TEMPLATE_GID };
}

export async function fetchAndSaveTop100Snapshot(): Promise<Top100Snapshot> {
  const { transfersGid, templateGid } = await resolveSheetGids();

  const transfersUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${transfersGid}`;
  const templateUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${templateGid}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const [transfersRes, templateRes] = await Promise.allSettled([
    fetch(transfersUrl, { headers, signal: AbortSignal.timeout(8000) }),
    fetch(templateUrl, { headers, signal: AbortSignal.timeout(8000) }),
  ]);

  let snapshot: Top100Snapshot | null = null;
  if (transfersRes.status === 'fulfilled' && transfersRes.value.ok) {
    const csvText = await transfersRes.value.text();
    const parsed = parseTop100Csv(csvText);
    if (isSnapshotValid(parsed)) {
      snapshot = parsed;
      snapshot.sourceUrl = transfersUrl;
    }
  }

  // Backup fallback to default GID if dynamic GID differed and failed
  if (!snapshot && transfersGid !== DEFAULT_TRANSFERS_GID) {
    try {
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${DEFAULT_TRANSFERS_GID}`;
      const fallbackRes = await fetch(fallbackUrl, { headers, signal: AbortSignal.timeout(6000) });
      if (fallbackRes.ok) {
        const csvText = await fallbackRes.text();
        const parsed = parseTop100Csv(csvText);
        if (isSnapshotValid(parsed)) {
          snapshot = parsed;
          snapshot.sourceUrl = fallbackUrl;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!snapshot) {
    // If transfers live fetch failed, return cached or bundled baseline snapshot
    const cached = await readTop100Snapshot();
    if (cached) {
      return cached;
    }
    throw new Error('Nepodarilo sa načítať platné dáta Top 100 manažérov z Google Sheets');
  }

  if (templateRes.status === 'fulfilled' && templateRes.value.ok) {
    try {
      const templateCsv = await templateRes.value.text();
      snapshot.templateAnalysis = parseTop100TemplateCsv(templateCsv);
    } catch (err) {
      console.warn('[top100Service] Failed to parse template CSV:', err);
    }
  }

  if (!snapshot.templateAnalysis?.templateTiers?.length && templateGid !== DEFAULT_TEMPLATE_GID) {
    try {
      const fallbackTemplateUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${DEFAULT_TEMPLATE_GID}`;
      const fallbackTemplateRes = await fetch(fallbackTemplateUrl, { headers, signal: AbortSignal.timeout(6000) });
      if (fallbackTemplateRes.ok) {
        const templateCsv = await fallbackTemplateRes.text();
        snapshot.templateAnalysis = parseTop100TemplateCsv(templateCsv);
      }
    } catch {
      // ignore
    }
  }

  snapshot.cachedAt = Date.now();
  inMemoryTop100 = snapshot;

  // Best-effort disk caching that never throws on read-only serverless filesystems (e.g. Vercel)
  try {
    const dir = join(process.cwd(), 'data', 'top100');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'latest.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (fsErr) {
    // If working directory is read-only (Vercel Lambda), write to /tmp
    try {
      await writeFile('/tmp/fpl_top100_latest.json', JSON.stringify(snapshot, null, 2), 'utf8');
    } catch {
      // Ignore: in-memory cache is fully operational
    }
  }

  return snapshot;
}

export async function readTop100Snapshot(): Promise<Top100Snapshot | null> {
  if (inMemoryTop100 && isSnapshotValid(inMemoryTop100)) {
    return inMemoryTop100;
  }
  inMemoryTop100 = null;

  try {
    const file = await readFile(join(process.cwd(), 'data', 'top100', 'latest.json'), 'utf8');
    const parsed = JSON.parse(file) as Top100Snapshot;
    if (isSnapshotValid(parsed)) {
      inMemoryTop100 = parsed;
      return inMemoryTop100;
    }
  } catch {
    // ignore
  }

  // Fallback to /tmp if present
  try {
    const tmpFile = await readFile('/tmp/fpl_top100_latest.json', 'utf8');
    const parsed = JSON.parse(tmpFile) as Top100Snapshot;
    if (isSnapshotValid(parsed)) {
      inMemoryTop100 = parsed;
      return inMemoryTop100;
    }
  } catch {
    // ignore
  }

  // Guaranteed fallback to bundled baseline JSON
  if (fallbackTop100Json && isSnapshotValid(fallbackTop100Json as unknown as Top100Snapshot)) {
    inMemoryTop100 = fallbackTop100Json as unknown as Top100Snapshot;
    return inMemoryTop100;
  }

  return null;
}

