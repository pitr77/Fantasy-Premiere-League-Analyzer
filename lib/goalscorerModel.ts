import { FPLPlayer, FPLTeam, FPLFixture } from '../types';
import { FortunaMatch } from '../services/oddsSnapshotService';

export interface PlayerOddsMetric {
  odds: number; // Decimal odds (e.g. 2.85)
  prob: number; // Probability between 0 and 1 (e.g. 0.35)
  source: 'fortuna_live' | 'fortuna_model';
}

export interface GoalscorerOddsResult {
  // Primary / Backwards compatible properties (defaults to goal or selected active metric)
  odds: number;
  prob: number;
  source: 'fortuna_live' | 'fortuna_model';

  // Specific individual metrics
  goal: PlayerOddsMetric;
  assist: PlayerOddsMetric;
  goalOrAssist: PlayerOddsMetric;

  teamExpectedGoals: number;
  teamExpectedAssists: number;
  opponentId: number;
  opponentShort: string;
  isHome: boolean;
}

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesPlayer(candidateName: string, player: FPLPlayer): boolean {
  const c = normalizeName(candidateName);
  const web = normalizeName(player.web_name);
  const sec = normalizeName(player.second_name);
  const fir = normalizeName(player.first_name);

  if (sec.length >= 4 && c.includes(sec)) return true;
  if (web.length >= 4 && c.includes(web)) return true;
  if (fir.length >= 4 && c.includes(fir) && (c.includes(sec) || c.includes(web))) return true;
  if (sec.length >= 3 && web.length >= 3 && (c.includes(sec) || c.includes(web))) return true;
  return false;
}

/**
 * Calculates or retrieves anytime goal, assist, and goal-or-assist odds and probabilities
 * for an FPL player (DEF, MID, FWD) in an upcoming fixture.
 */
export function getGoalscorerOdds(
  player: FPLPlayer,
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  nextEventId: number,
  oddsData: FortunaMatch[] | null
): GoalscorerOddsResult | null {
  // Applicable for DEF (2), MID (3) and FWD (4)
  if (player.element_type !== 2 && player.element_type !== 3 && player.element_type !== 4) {
    return null;
  }

  // Find next fixture for the player's team
  const fix = fixtures.find(
    f => f.event === nextEventId && (f.team_h === player.team || f.team_a === player.team)
  );
  if (!fix) return null;

  const isHome = fix.team_h === player.team;
  const opponentId = isHome ? fix.team_a : fix.team_h;
  const oppTeam = teams.find(t => t.id === opponentId);
  const opponentShort = oppTeam?.short_name || 'UNK';

  // 1. Find Fortuna match in the snapshot
  const match = oddsData?.find(m =>
    isHome
      ? m.homeTeamId === player.team && m.awayTeamId === opponentId
      : m.homeTeamId === opponentId && m.awayTeamId === player.team
  );

  // 2. Check for Fortuna live quotes
  let liveGoal: PlayerOddsMetric | null = null;
  let liveAssist: PlayerOddsMetric | null = null;
  let liveGoalOrAssist: PlayerOddsMetric | null = null;

  if (match) {
    // Check direct goalscorer
    if (match.scorers && match.scorers.length > 0) {
      const found = match.scorers.find(s => matchesPlayer(s.name, player));
      if (found && found.odds > 1) {
        liveGoal = {
          odds: found.odds,
          prob: found.prob || Number((1 / found.odds).toFixed(2)),
          source: 'fortuna_live',
        };
      }
    }

    // Check direct assist
    if (match.assists && match.assists.length > 0) {
      const found = match.assists.find(a => matchesPlayer(a.name, player));
      if (found && found.odds > 1) {
        liveAssist = {
          odds: found.odds,
          prob: found.prob || Number((1 / found.odds).toFixed(2)),
          source: 'fortuna_live',
        };
      }
    }

    // Check direct goal or assist
    if (match.goalOrAssists && match.goalOrAssists.length > 0) {
      const found = match.goalOrAssists.find(ga => matchesPlayer(ga.name, player));
      if (found && found.odds > 1) {
        liveGoalOrAssist = {
          odds: found.odds,
          prob: found.prob || Number((1 / found.odds).toFixed(2)),
          source: 'fortuna_live',
        };
      }
    }
  }

  // 3. Statistical Model Baseline using match odds (Over/Under 2.5 and 1X2)
  let totalMatchGoals = 2.75;
  if (match?.overUnder25?.overProb) {
    totalMatchGoals = 2.2 + (match.overUnder25.overProb * 1.5);
  }

  let teamGoalShare = isHome ? 0.54 : 0.46;
  if (match?.probabilities) {
    const pWin = isHome ? match.probabilities.home : match.probabilities.away;
    const pLoss = isHome ? match.probabilities.away : match.probabilities.home;
    const netSuperiority = pWin - pLoss;
    teamGoalShare = Math.min(0.85, Math.max(0.18, 0.50 + netSuperiority * 0.42));
  }

  const teamExpGoals = totalMatchGoals * teamGoalShare;
  const teamExpAssists = teamExpGoals * 0.75;

  const cost = player.now_cost / 10;
  const minutesPlayed = player.minutes || 0;
  const gamesPlayed = Math.max(1, minutesPlayed / 90);
  const threatPerGame = parseFloat(player.threat) / gamesPlayed;
  const creativityPerGame = parseFloat(player.creativity) / gamesPlayed;
  const form = parseFloat(player.form) || 0;
  const ppg = parseFloat(player.points_per_game) || 0;

  const playProb = player.chance_of_playing_next_round !== null
    ? player.chance_of_playing_next_round / 100
    : 1.0;

  // A. Model Goal Probability
  let playerGoalShare = 0;
  if (player.element_type === 4) {
    // FWD
    const costFactor = Math.min(0.40, 0.15 + (Math.max(0, cost - 5.0) / 10.0) * 0.25);
    const formFactor = Math.min(0.08, (form / 10) * 0.08);
    const threatFactor = Math.min(0.08, (threatPerGame / 70) * 0.08);
    playerGoalShare = costFactor + formFactor + threatFactor;
  } else if (player.element_type === 3) {
    // MID
    const isWingerOrAttacker = cost >= 7.0 || threatPerGame > 25 || ppg >= 4.5;
    if (isWingerOrAttacker) {
      const costFactor = Math.min(0.30, 0.10 + (Math.max(0, cost - 6.5) / 8.0) * 0.20);
      const formFactor = Math.min(0.06, (form / 10) * 0.06);
      const threatFactor = Math.min(0.06, (threatPerGame / 60) * 0.06);
      playerGoalShare = costFactor + formFactor + threatFactor;
    } else {
      playerGoalShare = Math.min(0.10, 0.04 + (form / 20) * 0.04 + (threatPerGame / 100) * 0.04);
    }
  } else {
    // DEF
    const isAttackingDef = threatPerGame > 8 || cost >= 5.5;
    if (isAttackingDef) {
      const costFactor = Math.min(0.07, 0.02 + (Math.max(0, cost - 4.5) / 5.0) * 0.05);
      const threatFactor = Math.min(0.06, (threatPerGame / 40) * 0.06);
      const formFactor = Math.min(0.03, (form / 10) * 0.03);
      playerGoalShare = costFactor + threatFactor + formFactor;
    } else {
      playerGoalShare = Math.min(0.035, 0.01 + (threatPerGame / 50) * 0.025);
    }
  }

  const lambdaGoal = Math.max(0.02, teamExpGoals * playerGoalShare * playProb);
  const modelGoalProb = 1 - Math.exp(-lambdaGoal);
  const modelGoalOdds = Math.max(1.35, Math.min(26.0, Number(((1 / modelGoalProb) * 0.93).toFixed(2))));

  const finalGoal: PlayerOddsMetric = liveGoal || {
    odds: modelGoalOdds,
    prob: Number(modelGoalProb.toFixed(2)),
    source: 'fortuna_model',
  };

  // B. Model Assist Probability
  let playerAssistShare = 0;
  if (player.element_type === 3) {
    // MID
    const isCreativeMid = creativityPerGame > 25 || cost >= 6.5;
    if (isCreativeMid) {
      playerAssistShare = Math.min(0.35, 0.12 + (creativityPerGame / 60) * 0.18 + (Math.max(0, cost - 6.0) / 8) * 0.08);
    } else {
      playerAssistShare = Math.min(0.15, 0.05 + (creativityPerGame / 40) * 0.08);
    }
  } else if (player.element_type === 2) {
    // DEF (attacking wingbacks like Trent, Porro, Robinson vs CBs)
    const isWingback = creativityPerGame > 15 || cost >= 5.5;
    if (isWingback) {
      playerAssistShare = Math.min(0.24, 0.08 + (creativityPerGame / 40) * 0.12 + (Math.max(0, cost - 4.5) / 6) * 0.06);
    } else {
      playerAssistShare = Math.min(0.08, 0.02 + (creativityPerGame / 30) * 0.05);
    }
  } else {
    // FWD (link-up forwards like Watkins, Isak, Haaland)
    playerAssistShare = Math.min(0.20, 0.06 + (creativityPerGame / 40) * 0.10 + (form / 10) * 0.04);
  }

  const lambdaAssist = Math.max(0.02, teamExpAssists * playerAssistShare * playProb);
  const modelAssistProb = 1 - Math.exp(-lambdaAssist);
  const modelAssistOdds = Math.max(1.45, Math.min(26.0, Number(((1 / modelAssistProb) * 0.93).toFixed(2))));

  const finalAssist: PlayerOddsMetric = liveAssist || {
    odds: modelAssistOdds,
    prob: Number(modelAssistProb.toFixed(2)),
    source: 'fortuna_model',
  };

  // C. Model Goal or Assist (Kanadský bod / Goal Involvement)
  let finalGoalOrAssist: PlayerOddsMetric;
  if (liveGoalOrAssist) {
    finalGoalOrAssist = liveGoalOrAssist;
  } else {
    // Combined Poisson rate of goal or assist arrival: P(G U A) = 1 - exp(-(lambda_G + lambda_A))
    const lambdaGA = lambdaGoal + lambdaAssist;
    const modelGAProb = 1 - Math.exp(-lambdaGA);
    const modelGAOdds = Math.max(1.20, Math.min(21.0, Number(((1 / modelGAProb) * 0.93).toFixed(2))));
    finalGoalOrAssist = {
      odds: modelGAOdds,
      prob: Number(modelGAProb.toFixed(2)),
      source: 'fortuna_model',
    };
  }

  return {
    odds: finalGoal.odds,
    prob: finalGoal.prob,
    source: finalGoal.source,
    goal: finalGoal,
    assist: finalAssist,
    goalOrAssist: finalGoalOrAssist,
    teamExpectedGoals: Number(teamExpGoals.toFixed(1)),
    teamExpectedAssists: Number(teamExpAssists.toFixed(1)),
    opponentId,
    opponentShort,
    isHome,
  };
}
