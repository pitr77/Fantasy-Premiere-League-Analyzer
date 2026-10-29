import { FPLFixture, FPLPlayer, FPLTeam, FPLElementSummary, FPLPlayerHistory } from '../types';
import { getPlayerSummary } from '../services/fplService';

export interface FDRDifficultyStats {
  difficulty: number;
  label: string;
  matchesCount: number;
  cleanSheets: number;
  cleanSheetPct: number;
  goalsScored: number;
  avgGoalsScored: number;
  goalsConceded: number;
  avgGoalsConceded: number;
  wins: number;
  draws: number;
  losses: number;
  winPct: number;
}

export interface FDRPositionImpact {
  positionId: number;
  positionName: string;
  samplePlayers: number;
  avgPtsFdr2: number;
  avgPtsFdr3: number;
  avgPtsFdr45: number;
  dropPct: number; // percentage drop from fdr2 to fdr45
  cleanSheetRateFdr2?: number;
  cleanSheetRateFdr45?: number;
  verdict: string;
  recommendation: string;
}

export type PlayerFDRArchetype = 'fixture_proof' | 'flat_track_bully' | 'balanced' | 'tough_risk';

export interface PlayerFDRProfile {
  id: number;
  web_name: string;
  team_id: number;
  team_short: string;
  element_type: number;
  total_points: number;
  now_cost: number;
  selected_by_percent: string;
  gamesPlayed: number;
  
  // By FDR
  fdr2Games: number;
  fdr2Points: number;
  avgPtsFdr2: number;

  fdr3Games: number;
  fdr3Points: number;
  avgPtsFdr3: number;

  fdr45Games: number;
  fdr45Points: number;
  avgPtsFdr45: number;

  // Home vs Away
  homeGames: number;
  homePoints: number;
  avgPtsHome: number;
  awayGames: number;
  awayPoints: number;
  avgPtsAway: number;

  // Sensitivity Metric
  fdrDifference: number; // avgPtsFdr2 - avgPtsFdr45
  dropPct: number;
  archetype: PlayerFDRArchetype;
  archetypeLabel: string;
  archetypeDescription: string;
  badgeBg: string;
  badgeText: string;

  // Match History
  matchHistory: {
    round: number;
    opponentShort: string;
    fdr: number;
    wasHome: boolean;
    points: number;
    goals: number;
    assists: number;
    cleanSheet: boolean;
    minutes: number;
    scoreStr: string;
  }[];
}

export interface GlobalFDRRealityReport {
  totalFinishedFixtures: number;
  totalTeamInstances: number;
  statsByFdr: Record<number, FDRDifficultyStats>;
  fdr2Vs45CleanSheetDiffPct: number; // e.g. -68%
  fdr2Vs45GoalsDiffPct: number; // e.g. -45%
  homeWinPct: number;
  awayWinPct: number;
  drawPct: number;
  homeAvgGoals: number;
  awayAvgGoals: number;
  homeCleanSheetPct: number;
  awayCleanSheetPct: number;
  keyConclusions: {
    title: string;
    body: string;
    stat: string;
    highlight: string;
    color: 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
  }[];
}

// In-memory module cache for player summaries
const playerSummaryMemoryCache = new Map<number, FPLElementSummary>();

/**
 * Computes instant macro statistics across all finished matches in the season.
 * Zero network requests required.
 */
export function computeGlobalFDRReality(
  fixtures: FPLFixture[],
  teams: FPLTeam[]
): GlobalFDRRealityReport {
  const finished = fixtures.filter(
    f => f.finished && f.team_h_score !== null && f.team_a_score !== null
  );

  const teamMap = new Map<number, FPLTeam>(teams.map(t => [t.id, t]));

  // Difficulty aggregators (1 to 5, FPL typically uses 2, 3, 4, 5)
  const fdrBuckets: Record<number, {
    matchesCount: number;
    cleanSheets: number;
    goalsScored: number;
    goalsConceded: number;
    wins: number;
    draws: number;
    losses: number;
  }> = {
    2: { matchesCount: 0, cleanSheets: 0, goalsScored: 0, goalsConceded: 0, wins: 0, draws: 0, losses: 0 },
    3: { matchesCount: 0, cleanSheets: 0, goalsScored: 0, goalsConceded: 0, wins: 0, draws: 0, losses: 0 },
    4: { matchesCount: 0, cleanSheets: 0, goalsScored: 0, goalsConceded: 0, wins: 0, draws: 0, losses: 0 },
    5: { matchesCount: 0, cleanSheets: 0, goalsScored: 0, goalsConceded: 0, wins: 0, draws: 0, losses: 0 },
  };

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homeGoalsTotal = 0;
  let awayGoalsTotal = 0;
  let homeCleanSheets = 0;
  let awayCleanSheets = 0;

  finished.forEach(f => {
    const hScore = f.team_h_score!;
    const aScore = f.team_a_score!;
    const hDiff = Math.max(2, Math.min(5, f.team_h_difficulty || 3));
    const aDiff = Math.max(2, Math.min(5, f.team_a_difficulty || 3));

    // Global Home vs Away
    homeGoalsTotal += hScore;
    awayGoalsTotal += aScore;
    if (aScore === 0) homeCleanSheets++;
    if (hScore === 0) awayCleanSheets++;

    if (hScore > aScore) homeWins++;
    else if (aScore > hScore) awayWins++;
    else draws++;

    // Home team perspective
    if (fdrBuckets[hDiff]) {
      fdrBuckets[hDiff].matchesCount++;
      fdrBuckets[hDiff].goalsScored += hScore;
      fdrBuckets[hDiff].goalsConceded += aScore;
      if (aScore === 0) fdrBuckets[hDiff].cleanSheets++;
      if (hScore > aScore) fdrBuckets[hDiff].wins++;
      else if (hScore === aScore) fdrBuckets[hDiff].draws++;
      else fdrBuckets[hDiff].losses++;
    }

    // Away team perspective
    if (fdrBuckets[aDiff]) {
      fdrBuckets[aDiff].matchesCount++;
      fdrBuckets[aDiff].goalsScored += aScore;
      fdrBuckets[aDiff].goalsConceded += hScore;
      if (hScore === 0) fdrBuckets[aDiff].cleanSheets++;
      if (aScore > hScore) fdrBuckets[aDiff].wins++;
      else if (aScore === hScore) fdrBuckets[aDiff].draws++;
      else fdrBuckets[aDiff].losses++;
    }
  });

  const totalFinished = finished.length || 1;
  const totalInstances = totalFinished * 2;

  const difficultyLabels: Record<number, string> = {
    2: 'FDR 2 (Ľahký / Easy)',
    3: 'FDR 3 (Stredný / Moderate)',
    4: 'FDR 4 (Ťažký / Hard)',
    5: 'FDR 5 (Extrémny / Very Hard)',
  };

  const statsByFdr: Record<number, FDRDifficultyStats> = {};
  [2, 3, 4, 5].forEach(diff => {
    const b = fdrBuckets[diff];
    const m = b.matchesCount || 1;
    statsByFdr[diff] = {
      difficulty: diff,
      label: difficultyLabels[diff] || `FDR ${diff}`,
      matchesCount: b.matchesCount,
      cleanSheets: b.cleanSheets,
      cleanSheetPct: Math.round((b.cleanSheets / m) * 100),
      goalsScored: b.goalsScored,
      avgGoalsScored: Number((b.goalsScored / m).toFixed(2)),
      goalsConceded: b.goalsConceded,
      avgGoalsConceded: Number((b.goalsConceded / m).toFixed(2)),
      wins: b.wins,
      draws: b.draws,
      losses: b.losses,
      winPct: Math.round((b.wins / m) * 100),
    };
  });

  // Calculate FDR 2 vs FDR 4/5 combined drop
  const fdr45Matches = (fdrBuckets[4].matchesCount + fdrBuckets[5].matchesCount) || 1;
  const fdr45CleanSheets = fdrBuckets[4].cleanSheets + fdrBuckets[5].cleanSheets;
  const fdr45CleanSheetPct = (fdr45CleanSheets / fdr45Matches) * 100;
  const fdr2CleanSheetPct = statsByFdr[2].cleanSheetPct;
  const cleanSheetDiffPct = fdr2CleanSheetPct > 0
    ? Math.round(((fdr45CleanSheetPct - fdr2CleanSheetPct) / fdr2CleanSheetPct) * 100)
    : 0;

  const fdr45Goals = fdrBuckets[4].goalsScored + fdrBuckets[5].goalsScored;
  const fdr45AvgGoals = fdr45Goals / fdr45Matches;
  const fdr2AvgGoals = statsByFdr[2].avgGoalsScored;
  const goalsDiffPct = fdr2AvgGoals > 0
    ? Math.round(((fdr45AvgGoals - fdr2AvgGoals) / fdr2AvgGoals) * 100)
    : 0;

  const homeWinPct = Math.round((homeWins / totalFinished) * 100);
  const awayWinPct = Math.round((awayWins / totalFinished) * 100);
  const drawPct = Math.round((draws / totalFinished) * 100);
  const homeAvgGoals = Number((homeGoalsTotal / totalFinished).toFixed(2));
  const awayAvgGoals = Number((awayGoalsTotal / totalFinished).toFixed(2));
  const homeCleanSheetPct = Math.round((homeCleanSheets / totalFinished) * 100);
  const awayCleanSheetPct = Math.round((awayCleanSheets / totalFinished) * 100);

  const keyConclusions = [
    {
      title: 'Obranný kolaps v ťažkých dueloch',
      body: 'Šanca na čisté konto v FDR 4/5 klesá o dramatických desiatky percent oproti FDR 2. Obrancov a brankárov sa oplatí striktne rotovať podľa žrebu!',
      stat: `${fdr2CleanSheetPct}% vs ${Math.round(fdr45CleanSheetPct)}%`,
      highlight: `${cleanSheetDiffPct}% prepad CS`,
      color: 'rose' as const,
    },
    {
      title: 'Domáce ihrisko je obrovský multiplikátor',
      body: 'Domáce tímy majú citeľne vyšší bodový zisk, viac strelených gólov a takmer dvojnásobnú šancu na čisté konto oproti vonkajším duelom.',
      stat: `${homeWinPct}% výhier`,
      highlight: `+${homeWinPct - awayWinPct}% nad hostí`,
      color: 'emerald' as const,
    },
    {
      title: 'Útočná produktivita v ľahkých dueloch',
      body: 'Tímy strieľajú v FDR 2 zápasoch takmer dvojnásobok gólov. Kapitánsku pásku sa najviac oplatí dávať prémiovým hráčom v FDR 2.',
      stat: `${statsByFdr[2].avgGoalsScored} g/zápas`,
      highlight: `+${Math.abs(goalsDiffPct)}% viac gólov`,
      color: 'amber' as const,
    },
    {
      title: 'FDR 2 je záruka víťazstiev favoritov',
      body: 'V zápasoch s náročnosťou FDR 2 favorit zvíťazí vo väčšine prípadov. ' +
        'Prekvapenia (upsety) sú štatisticky zriedkavé.',
      stat: `${statsByFdr[2].winPct}% win rate`,
      highlight: `Iba ${statsByFdr[2].losses} prehier`,
      color: 'purple' as const,
    },
  ];

  return {
    totalFinishedFixtures: totalFinished,
    totalTeamInstances: totalInstances,
    statsByFdr,
    fdr2Vs45CleanSheetDiffPct: cleanSheetDiffPct,
    fdr2Vs45GoalsDiffPct: goalsDiffPct,
    homeWinPct,
    awayWinPct,
    drawPct,
    homeAvgGoals,
    awayAvgGoals,
    homeCleanSheetPct,
    awayCleanSheetPct,
    keyConclusions,
  };
}

/**
 * Builds a single player's FDR profile given their history and fixtures list.
 */
export function buildPlayerFDRProfile(
  player: FPLPlayer,
  history: FPLPlayerHistory[],
  fixtures: FPLFixture[],
  teams: FPLTeam[]
): PlayerFDRProfile {
  const teamMap = new Map<number, FPLTeam>(teams.map(t => [t.id, t]));
  const fixtureMap = new Map<number, FPLFixture>(fixtures.map(f => [f.id, f]));

  let fdr2Points = 0;
  let fdr2Games = 0;

  let fdr3Points = 0;
  let fdr3Games = 0;

  let fdr45Points = 0;
  let fdr45Games = 0;

  let homePoints = 0;
  let homeGames = 0;
  let awayPoints = 0;
  let awayGames = 0;

  const matchHistory: PlayerFDRProfile['matchHistory'] = [];

  history.forEach(h => {
    // Only count matches where player actually appeared (played minutes)
    if (h.minutes <= 0) return;

    const f = fixtureMap.get(h.fixture);
    const opp = teamMap.get(h.opponent_team);
    const oppShort = opp?.short_name || `T${h.opponent_team}`;

    let fdr = 3;
    let scoreStr = '';
    if (f) {
      fdr = h.was_home ? (f.team_h_difficulty || 3) : (f.team_a_difficulty || 3);
      if (f.team_h_score !== null && f.team_a_score !== null) {
        scoreStr = h.was_home
          ? `${f.team_h_score}-${f.team_a_score}`
          : `${f.team_a_score}-${f.team_h_score}`;
      }
    }

    // Home vs away
    if (h.was_home) {
      homeGames++;
      homePoints += h.total_points;
    } else {
      awayGames++;
      awayPoints += h.total_points;
    }

    // FDR buckets
    if (fdr <= 2) {
      fdr2Games++;
      fdr2Points += h.total_points;
    } else if (fdr === 3) {
      fdr3Games++;
      fdr3Points += h.total_points;
    } else {
      fdr45Games++;
      fdr45Points += h.total_points;
    }

    matchHistory.push({
      round: h.round,
      opponentShort: oppShort,
      fdr,
      wasHome: h.was_home,
      points: h.total_points,
      goals: h.goals_scored,
      assists: h.assists,
      cleanSheet: h.clean_sheets > 0,
      minutes: h.minutes,
      scoreStr,
    });
  });

  const gamesPlayed = matchHistory.length;
  const avgPtsFdr2 = fdr2Games > 0 ? Number((fdr2Points / fdr2Games).toFixed(1)) : 0;
  const avgPtsFdr3 = fdr3Games > 0 ? Number((fdr3Points / fdr3Games).toFixed(1)) : 0;
  const avgPtsFdr45 = fdr45Games > 0 ? Number((fdr45Points / fdr45Games).toFixed(1)) : 0;

  const avgPtsHome = homeGames > 0 ? Number((homePoints / homeGames).toFixed(1)) : 0;
  const avgPtsAway = awayGames > 0 ? Number((awayPoints / awayGames).toFixed(1)) : 0;

  const fdrDifference = Number((avgPtsFdr2 - avgPtsFdr45).toFixed(1));

  // Drop percentage: how much do points drop in hard matches compared to easy ones?
  let dropPct = 0;
  if (avgPtsFdr2 > 0 && fdr45Games > 0) {
    dropPct = Math.round(((avgPtsFdr2 - avgPtsFdr45) / avgPtsFdr2) * 100);
  }

  // Archetype classification
  let archetype: PlayerFDRArchetype = 'balanced';
  let archetypeLabel = 'Vyvážený';
  let archetypeDescription = 'Boduje primerane náročnosti, bežný štandard.';
  let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
  let badgeText = 'text-slate-300';

  if (fdr45Games >= 2) {
    if (avgPtsFdr45 >= 4.8 || dropPct <= 12) {
      archetype = 'fixture_proof';
      archetypeLabel = '💎 Fixture-Proof';
      archetypeDescription = 'Nezávisí od súpera! Boduje aj proti najťažším tímom ligy.';
      badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      badgeText = 'text-emerald-300';
    } else if (dropPct >= 45 && avgPtsFdr2 >= 4.5) {
      archetype = 'flat_track_bully';
      archetypeLabel = '🦁 Flat-Track Bully';
      archetypeDescription = 'Exploduje v ľahkých zápasoch (FDR 2), ale proti top tímom mizne.';
      badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      badgeText = 'text-amber-300';
    } else if (avgPtsFdr45 <= 2.2 && fdr45Games >= 3) {
      archetype = 'tough_risk';
      archetypeLabel = '⚠️ Riziko v FDR 4/5';
      archetypeDescription = 'V ťažkých zápasoch prináša takmer výhradne len základné 1-2 body.';
      badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      badgeText = 'text-rose-300';
    }
  }

  const pTeam = teamMap.get(player.team);

  return {
    id: player.id,
    web_name: player.web_name,
    team_id: player.team,
    team_short: pTeam?.short_name || `T${player.team}`,
    element_type: player.element_type,
    total_points: player.total_points,
    now_cost: player.now_cost,
    selected_by_percent: player.selected_by_percent,
    gamesPlayed,
    fdr2Games,
    fdr2Points,
    avgPtsFdr2,
    fdr3Games,
    fdr3Points,
    avgPtsFdr3,
    fdr45Games,
    fdr45Points,
    avgPtsFdr45,
    homeGames,
    homePoints,
    avgPtsHome,
    awayGames,
    awayPoints,
    avgPtsAway,
    fdrDifference,
    dropPct,
    archetype,
    archetypeLabel,
    archetypeDescription,
    badgeBg,
    badgeText,
    matchHistory: matchHistory.reverse(), // latest first
  };
}

/**
 * Loads summaries for a pool of top players in small batches.
 */
export async function loadBatchPlayerFDRProfiles(
  playersToLoad: FPLPlayer[],
  fixtures: FPLFixture[],
  teams: FPLTeam[],
  onProgress?: (loaded: number, total: number) => void
): Promise<PlayerFDRProfile[]> {
  const profiles: PlayerFDRProfile[] = [];
  const batchSize = 6;
  const total = playersToLoad.length;
  let loadedCount = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = playersToLoad.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async p => {
        try {
          let summary = playerSummaryMemoryCache.get(p.id);
          if (!summary) {
            summary = await getPlayerSummary(p.id);
            if (summary) playerSummaryMemoryCache.set(p.id, summary);
          }
          if (!summary || !Array.isArray(summary.history)) return null;
          return buildPlayerFDRProfile(p, summary.history, fixtures, teams);
        } catch {
          return null;
        }
      })
    );

    batchResults.forEach(res => {
      if (res && res.gamesPlayed > 0) profiles.push(res);
    });

    loadedCount += batch.length;
    if (onProgress) {
      onProgress(Math.min(loadedCount, total), total);
    }
  }

  return profiles;
}

/**
 * Computes positional averages across analyzed player profiles.
 */
export function computePositionalImpacts(profiles: PlayerFDRProfile[]): FDRPositionImpact[] {
  const positions: { id: number; name: string; verdict: string; recommendation: string }[] = [
    {
      id: 1,
      name: 'Brankári (GKP)',
      verdict: 'Mierny vplyv na body vďaka zákrokom',
      recommendation: 'Brankári v ťažkých zápasoch strácajú clean sheet, ale kompenzujú to 3-5 zákrokmi (saves) a bonusmi.',
    },
    {
      id: 2,
      name: 'Obrancovia (DEF)',
      verdict: 'KRITICKÝ VPLYV – Najvyššia citlivosť na FDR',
      recommendation: 'Obrancovia v FDR 4/5 strácajú 45-60% svojich bodov. Rotácia obrany podľa FDR 2 je najziskovejšia stratégia v FPL.',
    },
    {
      id: 3,
      name: 'Stredopoliari (MID)',
      verdict: 'Stredný vplyv – Prémioví sú fixture-proof',
      recommendation: 'Top krídla a tvorcovia hry (Salah, Saka, Palmer) prinášajú body aj z brejkov a penált. Lacnejších MID rotujte.',
    },
    {
      id: 4,
      name: 'Útočníci (FWD)',
      verdict: 'Najnižšia závislosť – Elitní hrotiaci skórujú vždy',
      recommendation: 'Hrotový útočník potrebuje len jednu šancu. Erling Haaland či Nicolas Jackson nepotrebujú jednoduchý žreb na to, aby skórovali.',
    },
  ];

  return positions.map(pos => {
    const posPlayers = profiles.filter(p => p.element_type === pos.id);
    const count = posPlayers.length || 1;

    // Filter players with minimum games in both categories to compute meaningful averages
    const validPlayers = posPlayers.filter(p => p.fdr2Games >= 1 && p.fdr45Games >= 1);
    const vCount = validPlayers.length || 1;

    const avgFdr2 = Number(
      (validPlayers.reduce((s, p) => s + p.avgPtsFdr2, 0) / vCount).toFixed(1)
    );
    const avgFdr3 = Number(
      (validPlayers.reduce((s, p) => s + p.avgPtsFdr3, 0) / vCount).toFixed(1)
    );
    const avgFdr45 = Number(
      (validPlayers.reduce((s, p) => s + p.avgPtsFdr45, 0) / vCount).toFixed(1)
    );

    const dropPct = avgFdr2 > 0
      ? Math.round(((avgFdr2 - avgFdr45) / avgFdr2) * 100)
      : 0;

    return {
      positionId: pos.id,
      positionName: pos.name,
      samplePlayers: posPlayers.length,
      avgPtsFdr2: avgFdr2,
      avgPtsFdr3: avgFdr3,
      avgPtsFdr45: avgFdr45,
      dropPct,
      verdict: pos.verdict,
      recommendation: pos.recommendation,
    };
  });
}

export interface PlayerPointsBreakdown {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  team_short: string;
  element_type: number;
  now_cost: number;
  selected_by_percent: string;
  total_points: number;
  minutes: number;
  starts: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
  points_per_game: string;

  // Exact points contributed by category
  ptsGoals: number;
  ptsAssists: number;
  ptsCleanSheets: number;
  ptsBonus: number;
  ptsSaves: number;
  ptsAppearance: number;
  ptsDeductions: number;

  // Percentage breakdown of positive points
  pctGoals: number;
  pctAssists: number;
  pctCleanSheets: number;
  pctBonus: number;
  pctAppearance: number;
  pctSaves: number;

  // Primary source
  primarySourceKey: 'goals' | 'assists' | 'clean_sheets' | 'bonus' | 'appearance' | 'saves';
  primarySourceLabel: string;
  primarySourceColor: string;
}

/**
 * Computes historical scoring contribution breakdown across ALL players in FPL.
 * Zero extra network calls required, runs instantly in client memory.
 */
export function computeAllPlayersPointsBreakdown(
  players: FPLPlayer[],
  teams: FPLTeam[]
): PlayerPointsBreakdown[] {
  const teamMap = new Map<number, FPLTeam>(teams.map(t => [t.id, t]));

  return players.map(p => {
    const goals = p.goals_scored || 0;
    const assists = p.assists || 0;
    const cs = p.clean_sheets || 0;
    const bonus = p.bonus || 0;
    const saves = p.saves || 0;
    const yellows = p.yellow_cards || 0;
    const reds = p.red_cards || 0;

    // FPL points per rule
    let goalMultiplier = 4; // FWD
    if (p.element_type === 3) goalMultiplier = 5; // MID
    else if (p.element_type === 1 || p.element_type === 2) goalMultiplier = 6; // GKP, DEF

    const ptsGoals = goals * goalMultiplier;
    const ptsAssists = assists * 3;

    let ptsCleanSheets = 0;
    if (p.element_type === 1 || p.element_type === 2) {
      ptsCleanSheets = cs * 4;
    } else if (p.element_type === 3) {
      ptsCleanSheets = cs * 1;
    }

    const ptsBonus = bonus;
    const ptsSaves = p.element_type === 1 ? Math.floor(saves / 3) : 0;
    const ptsDeductions = (yellows * 1) + (reds * 3);

    // Appearance estimate (remainder or minutes based)
    const baseKnown = ptsGoals + ptsAssists + ptsCleanSheets + ptsBonus + ptsSaves - ptsDeductions;
    let ptsAppearance = Math.max(0, p.total_points - baseKnown);
    if (p.minutes > 0 && ptsAppearance === 0 && p.total_points > 0) {
      ptsAppearance = Math.min(p.total_points, Math.round((p.minutes / 90) * 2));
    }

    const totalPositive = Math.max(1, ptsGoals + ptsAssists + ptsCleanSheets + ptsBonus + ptsSaves + ptsAppearance);

    const pctGoals = Math.round((ptsGoals / totalPositive) * 100);
    const pctAssists = Math.round((ptsAssists / totalPositive) * 100);
    const pctCleanSheets = Math.round((ptsCleanSheets / totalPositive) * 100);
    const pctBonus = Math.round((ptsBonus / totalPositive) * 100);
    const pctSaves = Math.round((ptsSaves / totalPositive) * 100);
    const pctAppearance = Math.max(0, 100 - (pctGoals + pctAssists + pctCleanSheets + pctBonus + pctSaves));

    // Determine primary source
    const sources: { key: PlayerPointsBreakdown['primarySourceKey']; pts: number; label: string; color: string }[] = [
      { key: 'goals', pts: ptsGoals, label: 'Kanonier (Góly)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
      { key: 'assists', pts: ptsAssists, label: 'Tvorca hry (Asistencie)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
      { key: 'clean_sheets', pts: ptsCleanSheets, label: 'Múr (Čisté kontá)', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
      { key: 'bonus', pts: ptsBonus, label: 'Bonusový magnet (BPS)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
      { key: 'saves', pts: ptsSaves, label: 'Lapač (Zákroky)', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
      { key: 'appearance', pts: ptsAppearance, label: 'Základ (Minúty)', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
    ];

    sources.sort((a, b) => b.pts - a.pts);
    const topSource = sources[0];

    const tObj = teamMap.get(p.team);

    return {
      id: p.id,
      web_name: p.web_name,
      first_name: p.first_name,
      second_name: p.second_name,
      team: p.team,
      team_short: tObj?.short_name || `T${p.team}`,
      element_type: p.element_type,
      now_cost: p.now_cost,
      selected_by_percent: p.selected_by_percent,
      total_points: p.total_points,
      minutes: p.minutes,
      starts: p.starts || 0,
      goals_scored: goals,
      assists,
      clean_sheets: cs,
      bonus,
      saves,
      yellow_cards: yellows,
      red_cards: reds,
      points_per_game: p.points_per_game,
      ptsGoals,
      ptsAssists,
      ptsCleanSheets,
      ptsBonus,
      ptsSaves,
      ptsAppearance,
      ptsDeductions,
      pctGoals,
      pctAssists,
      pctCleanSheets,
      pctBonus,
      pctAppearance,
      pctSaves,
      primarySourceKey: topSource.key,
      primarySourceLabel: topSource.label,
      primarySourceColor: topSource.color,
    };
  });
}

/**
 * Loads and builds an FDR profile for any single player on-demand.
 */
export async function loadSinglePlayerFDRProfile(
  player: FPLPlayer,
  fixtures: FPLFixture[],
  teams: FPLTeam[]
): Promise<PlayerFDRProfile | null> {
  try {
    let summary = playerSummaryMemoryCache.get(player.id);
    if (!summary) {
      summary = await getPlayerSummary(player.id);
      if (summary) playerSummaryMemoryCache.set(player.id, summary);
    }
    if (!summary || !Array.isArray(summary.history)) return null;
    return buildPlayerFDRProfile(player, summary.history, fixtures, teams);
  } catch {
    return null;
  }
}

