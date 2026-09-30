import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FORTUNA_BASE = 'https://api.ifortuna.sk/offer';
const PREMIER_LEAGUE_TOURNAMENT_ID = 'ufo:tour:00-03m'; // 1. Anglicko

// Normalize team names to FPL IDs (1 - 20)
const TEAM_NAME_TO_FPL_ID = {
  'arsenal': 1,
  'aston villa': 2,
  'bournemouth': 3,
  'brentford': 4,
  'brighton': 5,
  'chelsea': 6,
  'coventry': 7,
  'coventry city': 7,
  'crystal palace': 8,
  'everton': 9,
  'fulham': 10,
  'hull': 11,
  'hull city': 11,
  'ipswich': 12,
  'ipswich town': 12,
  'leeds': 13,
  'leeds united': 13,
  'liverpool': 14,
  'man.city': 15,
  'man city': 15,
  'manchester city': 15,
  'man.united': 16,
  'man utd': 16,
  'man united': 16,
  'manchester united': 16,
  'newcastle': 17,
  'newcastle united': 17,
  'nottingham': 18,
  'nott\'m forest': 18,
  'nottingham forest': 18,
  'tottenham': 19,
  'spurs': 19,
  'sunderland': 20,
};

function normalizeTeamName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ');
}

function resolveFplTeamId(rawName) {
  if (!rawName) return null;
  const rawKey = rawName.trim().toLowerCase();
  if (TEAM_NAME_TO_FPL_ID[rawKey]) return TEAM_NAME_TO_FPL_ID[rawKey];
  const cleaned = normalizeTeamName(rawName);
  if (TEAM_NAME_TO_FPL_ID[cleaned]) return TEAM_NAME_TO_FPL_ID[cleaned];

  for (const [key, id] of Object.entries(TEAM_NAME_TO_FPL_ID)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return id;
  }
  return null;
}

function implied(odds) {
  return Number.isFinite(odds) && odds > 1 ? 1 / odds : 0;
}

function normalize1X2(home, draw, away) {
  if (!home || !draw || !away) return null;
  const rh = implied(home);
  const rd = implied(draw);
  const ra = implied(away);
  const sum = rh + rd + ra;
  if (sum <= 0) return null;
  return {
    home: Number((rh / sum).toFixed(4)),
    draw: Number((rd / sum).toFixed(4)),
    away: Number((ra / sum).toFixed(4)),
    overround: Number(sum.toFixed(4)),
  };
}

function normalize2Way(yesOdds, noOdds) {
  if (!yesOdds) return null;
  const ry = implied(yesOdds);
  const rn = implied(noOdds);
  const sum = ry + rn;
  if (sum <= 0) return { prob: Number(ry.toFixed(4)), overround: 1 };
  return {
    prob: Number((ry / sum).toFixed(4)),
    overround: Number(sum.toFixed(4)),
  };
}

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://www.ifortuna.sk',
  'Referer': 'https://www.ifortuna.sk/',
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (status: ${res.status})`);
  }
  return res.json();
}

async function run() {
  console.log('Fetching Premier League fixtures from Fortuna.sk...');
  const matchesUrl = `${FORTUNA_BASE}/structure/api/v1_0/tournament/${PREMIER_LEAGUE_TOURNAMENT_ID}/matches?timeFilter=all`;
  const matchesData = await fetchJson(matchesUrl);
  const fixtures = matchesData.fixtures || [];

  if (fixtures.length === 0) {
    console.warn('No active fixtures found for tournament ' + PREMIER_LEAGUE_TOURNAMENT_ID);
    return;
  }

  console.log(`Found ${fixtures.length} Premier League fixtures.`);

  // 1. Fetch overview markets (1X2, double chance, total goals over/under 2.5)
  const params = new URLSearchParams();
  for (const f of fixtures) {
    params.append('fixtureIds', f.id);
  }
  const overviewUrl = `${FORTUNA_BASE}/markets/api/v1_0/fixtures/markets/overview?${params.toString()}`;
  const overviewData = await fetchJson(overviewUrl);

  // 2. Fetch detailed markets in small batches to get Clean Sheet odds
  const detailedMap = {};
  const batchSize = 5;
  for (let i = 0; i < fixtures.length; i += batchSize) {
    const batch = fixtures.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async f => {
        try {
          const detailUrl = `${FORTUNA_BASE}/markets/api/v1_0/fixture/${encodeURIComponent(f.id)}/markets`;
          detailedMap[f.id] = await fetchJson(detailUrl);
        } catch (err) {
          console.warn(`Could not fetch details for ${f.id}:`, err.message);
          detailedMap[f.id] = [];
        }
      })
    );
  }

  const processedMatches = [];

  for (const f of fixtures) {
    const homePart = f.participants?.find(p => p.type === 'HOME');
    const awayPart = f.participants?.find(p => p.type === 'AWAY');
    const homeTeam = homePart?.name || 'Home';
    const awayTeam = awayPart?.name || 'Away';
    const homeTeamId = resolveFplTeamId(homeTeam);
    const awayTeamId = resolveFplTeamId(awayTeam);

    const overviewMarkets = overviewData[f.id] || [];
    const details = detailedMap[f.id] || [];

    // Extract 1X2 Match Result
    const matchMarket = overviewMarkets.find(m => m.syntheticGroupKey === 'match') 
      || details.find(m => m.syntheticGroupKey === 'match' || m.name?.toLowerCase().includes('výsledok zápasu'));

    let odds1X2 = null;
    let probs1X2 = null;
    if (matchMarket?.outcomes) {
      const homeOutcome = matchMarket.outcomes.find(o => o.name === '1');
      const drawOutcome = matchMarket.outcomes.find(o => o.name === '0');
      const awayOutcome = matchMarket.outcomes.find(o => o.name === '2');

      const homeOdds = Number(homeOutcome?.odds) || null;
      const drawOdds = Number(drawOutcome?.odds) || null;
      const awayOdds = Number(awayOutcome?.odds) || null;

      if (homeOdds && drawOdds && awayOdds) {
        odds1X2 = { home: homeOdds, draw: drawOdds, away: awayOdds };
        probs1X2 = normalize1X2(homeOdds, drawOdds, awayOdds);
      }
    }

    // Extract Over/Under 2.5 goals
    const totalGoalsMarket = overviewMarkets.find(m => m.syntheticGroupKey === 'total_goals_/_asian_total_goals' || m.name?.includes('2.5'))
      || details.find(m => m.name?.toLowerCase().includes('počet gólov 2.5'));

    let overUnder25 = null;
    if (totalGoalsMarket?.outcomes) {
      const overOutcome = totalGoalsMarket.outcomes.find(o => o.name?.includes('+') || o.name?.toLowerCase().includes('viac'));
      const underOutcome = totalGoalsMarket.outcomes.find(o => o.name?.includes('-') || o.name?.toLowerCase().includes('menej'));

      const overOdds = Number(overOutcome?.odds) || null;
      const underOdds = Number(underOutcome?.odds) || null;

      if (overOdds && underOdds) {
        const norm = normalize2Way(overOdds, underOdds);
        overUnder25 = {
          over: overOdds,
          under: underOdds,
          overProb: norm ? norm.prob : null,
          underProb: norm ? Number((1 - norm.prob).toFixed(4)) : null,
        };
      }
    }

    // Extract Clean Sheet markets from details
    let homeCleanSheet = null;
    let awayCleanSheet = null;

    for (const m of details) {
      const mName = m.name?.toLowerCase() || '';
      if (!mName.includes('čisté konto') || mName.includes('1.polčas') || mName.includes('2.polčas')) continue;

      // Check if it corresponds to home or away
      const isHome = mName.includes(homeTeam.toLowerCase()) || mName.includes('domáci');
      const isAway = mName.includes(awayTeam.toLowerCase()) || mName.includes('hostia');

      const yesOutcome = m.outcomes?.find(o => o.name?.toLowerCase().includes('áno') || o.name?.toLowerCase().includes('ano'));
      const noOutcome = m.outcomes?.find(o => o.name?.toLowerCase().includes('nie'));
      const yesOdds = Number(yesOutcome?.odds) || null;
      const noOdds = Number(noOutcome?.odds) || null;

      if (yesOdds) {
        const norm = normalize2Way(yesOdds, noOdds);
        const csData = {
          yes: yesOdds,
          no: noOdds,
          prob: norm ? norm.prob : null,
        };
        if (isHome && !homeCleanSheet) homeCleanSheet = csData;
        else if (isAway && !awayCleanSheet) awayCleanSheet = csData;
      }
    }

    processedMatches.push({
      id: f.id,
      name: f.name,
      startDatetime: f.startDatetime ? new Date(f.startDatetime).toISOString() : null,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      odds: odds1X2,
      probabilities: probs1X2,
      overUnder25,
      cleanSheet: {
        home: homeCleanSheet,
        away: awayCleanSheet,
      },
    });
  }

  const outputDir = join(process.cwd(), 'data', 'odds');
  const outputPath = join(outputDir, 'latest.json');
  await mkdir(outputDir, { recursive: true });

  const resultSnapshot = {
    provider: 'fortuna.sk',
    tournament: '1. Anglicko (Premier League)',
    tournamentId: PREMIER_LEAGUE_TOURNAMENT_ID,
    fetchedAt: new Date().toISOString(),
    matchesCount: processedMatches.length,
    matches: processedMatches,
  };

  await writeFile(outputPath, JSON.stringify(resultSnapshot, null, 2), 'utf8');

  console.log(`Successfully saved ${processedMatches.length} matches with Fortuna odds to ${outputPath}`);
  console.log(`Matches with 1X2 odds: ${processedMatches.filter(m => m.odds).length}`);
  console.log(`Matches with clean sheet odds: ${processedMatches.filter(m => m.cleanSheet.home || m.cleanSheet.away).length}`);
}

run().catch(err => {
  console.error('Download odds failed:', err);
  process.exit(1);
});
