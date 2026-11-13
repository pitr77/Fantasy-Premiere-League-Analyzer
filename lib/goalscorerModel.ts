import { FPLPlayer, FPLTeam, FPLFixture } from '../types';
import { FortunaMatch, FortunaPlayerOdd } from '../services/oddsSnapshotService';

export interface PlayerOddsMetric {
  odds: number; // Decimal odds (e.g. 2.85)
  prob: number; // Probability between 0 and 1 (e.g. 0.35)
  source: 'fortuna_live' | 'fortuna_model';
  opponentShort?: string;
  isHome?: boolean;
}

export interface GoalscorerOddsResult {
  // Primary / Backwards compatible properties (defaults to goal or selected active metric)
  odds: number;
  prob: number;
  source: 'fortuna_live' | 'fortuna_model';

  // Specific individual metrics
  cleanSheet?: PlayerOddsMetric | null;
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

function findBestPlayerOdd(
  list: FortunaPlayerOdd[] | undefined,
  player: FPLPlayer
): FortunaPlayerOdd | null {
  if (!list || list.length === 0) return null;

  const web = normalizeName(player.web_name);
  const sec = normalizeName(player.second_name);
  const fir = normalizeName(player.first_name);
  const firTokens = fir.split(' ').filter(t => t.length >= 3);
  const secTokens = sec.split(' ').filter(t => t.length >= 3);

  // 1. Strict pass: both surname/web_name AND first name match
  for (const item of list) {
    if (!item.odds || item.odds <= 1) continue;
    const c = normalizeName(item.name);
    const cWords = c.split(' ');

    const hasLast =
      (sec.length >= 3 && c.includes(sec)) ||
      (web.length >= 3 && c.includes(web)) ||
      secTokens.some(t => cWords.includes(t));

    const hasFirst =
      (fir.length >= 3 && c.includes(fir)) ||
      firTokens.some(t => cWords.includes(t));

    if (hasLast && hasFirst) {
      return item;
    }
  }

  // 2. Second pass: single-name player (e.g. "Savinho", "Casemiro", "Jorginho") or exact web_name match
  for (const item of list) {
    if (!item.odds || item.odds <= 1) continue;
    const c = normalizeName(item.name);
    const cWords = c.split(' ');

    // If Fortuna name has no comma, or web_name is a distinct single name
    if (web.length >= 4 && (c === web || (!item.name.includes(',') && cWords.includes(web)))) {
      return item;
    }

    // If Fortuna has "Lastname, Firstname", only match by surname if the Firstname doesn't conflict
    if (item.name.includes(',')) {
      const [rawLast, rawFirst] = item.name.split(',');
      const cLast = normalizeName(rawLast || '');
      const cFirst = normalizeName(rawFirst || '');
      const lastMatches =
        (sec.length >= 4 && (cLast === sec || cLast.includes(sec))) ||
        (web.length >= 4 && (cLast === web || cLast.includes(web)));

      if (lastMatches) {
        // Check if first name shares at least a 3-letter prefix or if web_name is in cFirst
        const cFirstWords = cFirst.split(' ').filter(Boolean);
        const firstCompatible =
          !cFirst ||
          firTokens.some(ft => cFirstWords.some(cf => cf.startsWith(ft.slice(0, 3)) || ft.startsWith(cf.slice(0, 3)))) ||
          (web.length >= 4 && cFirst.includes(web));

        if (firstCompatible) {
          return item;
        }
      }
    }
  }

  return null;
}

/**
 * Calculates or retrieves clean sheet, anytime goal, assist, and goal-or-assist odds and probabilities
 * for an FPL player (GKP, DEF, MID, FWD) in an upcoming fixture.
 */
export function getGoalscorerOdds(
  player: FPLPlayer,
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  nextEventId: number,
  oddsData: FortunaMatch[] | null
): GoalscorerOddsResult | null {
  // Applicable for GKP (1), DEF (2), MID (3) and FWD (4)
  if (
    player.element_type !== 1 &&
    player.element_type !== 2 &&
    player.element_type !== 3 &&
    player.element_type !== 4
  ) {
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

  // 1. Find Fortuna match in the snapshot for nextEventId
  const match = oddsData?.find(m =>
    isHome
      ? m.homeTeamId === player.team && m.awayTeamId === opponentId
      : m.homeTeamId === opponentId && m.awayTeamId === player.team
  );

  // If the nextEventId match doesn't have player props published on Fortuna yet,
  // check if Fortuna has an active match for this team with live player props.
  const playerPropsMatch =
    match && ((match.scorers && match.scorers.length > 0) || (match.assists && match.assists.length > 0) || (match.goalOrAssists && match.goalOrAssists.length > 0))
      ? match
      : oddsData?.find(
          m =>
            (m.homeTeamId === player.team || m.awayTeamId === player.team) &&
            ((m.scorers && m.scorers.length > 0) ||
              (m.assists && m.assists.length > 0) ||
              (m.goalOrAssists && m.goalOrAssists.length > 0))
        ) || match;

  const propsIsHome = playerPropsMatch ? playerPropsMatch.homeTeamId === player.team : isHome;
  const propsOppId = playerPropsMatch
    ? (propsIsHome ? playerPropsMatch.awayTeamId : playerPropsMatch.homeTeamId)
    : opponentId;
  const propsOpponentShort = teams.find(t => t.id === propsOppId)?.short_name || opponentShort;

  // 2. Check for Fortuna live quotes
  let liveCleanSheet: PlayerOddsMetric | null = null;
  let liveGoal: PlayerOddsMetric | null = null;
  let liveAssist: PlayerOddsMetric | null = null;
  let liveGoalOrAssist: PlayerOddsMetric | null = null;

  const csMatch =
    match?.cleanSheet?.home || match?.cleanSheet?.away
      ? match
      : oddsData?.find(
          m =>
            (m.homeTeamId === player.team || m.awayTeamId === player.team) &&
            (m.cleanSheet?.home || m.cleanSheet?.away)
        );

  if (csMatch) {
    const csIsHome = csMatch.homeTeamId === player.team;
    const csOppId = csIsHome ? csMatch.awayTeamId : csMatch.homeTeamId;
    const csOpponentShort = teams.find(t => t.id === csOppId)?.short_name || opponentShort;
    const csSide = csIsHome ? csMatch.cleanSheet?.home : csMatch.cleanSheet?.away;
    if (csSide && csSide.yes > 1) {
      liveCleanSheet = {
        odds: csSide.yes,
        prob: csSide.prob || Number((1 / csSide.yes).toFixed(2)),
        source: 'fortuna_live',
        opponentShort: csOpponentShort,
        isHome: csIsHome,
      };
    }
  }

  if (playerPropsMatch) {
    // Check direct goalscorer
    const foundGoal = findBestPlayerOdd(playerPropsMatch.scorers, player);
    if (foundGoal) {
      liveGoal = {
        odds: foundGoal.odds,
        prob: foundGoal.prob || Number((1 / foundGoal.odds).toFixed(2)),
        source: 'fortuna_live',
        opponentShort: propsOpponentShort,
        isHome: propsIsHome,
      };
    }

    // Check direct assist
    const foundAssist = findBestPlayerOdd(playerPropsMatch.assists, player);
    if (foundAssist) {
      liveAssist = {
        odds: foundAssist.odds,
        prob: foundAssist.prob || Number((1 / foundAssist.odds).toFixed(2)),
        source: 'fortuna_live',
        opponentShort: propsOpponentShort,
        isHome: propsIsHome,
      };
    }

    // Check direct goal or assist
    const foundGA = findBestPlayerOdd(playerPropsMatch.goalOrAssists, player);
    if (foundGA) {
      liveGoalOrAssist = {
        odds: foundGA.odds,
        prob: foundGA.prob || Number((1 / foundGA.odds).toFixed(2)),
        source: 'fortuna_live',
        opponentShort: propsOpponentShort,
        isHome: propsIsHome,
      };
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
    const costFactor = Math.min(0.40, 0.15 + (Math.max(0, cost - 5.0) / 10.0) * 0.25);
    const formFactor = Math.min(0.08, (form / 10) * 0.08);
    const threatFactor = Math.min(0.08, (threatPerGame / 70) * 0.08);
    playerGoalShare = costFactor + formFactor + threatFactor;
  } else if (player.element_type === 3) {
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
    opponentShort,
    isHome,
  };

  // B. Model Assist Probability
  let playerAssistShare = 0;
  if (player.element_type === 3) {
    const isCreativeMid = creativityPerGame > 25 || cost >= 6.5;
    if (isCreativeMid) {
      playerAssistShare = Math.min(0.35, 0.12 + (creativityPerGame / 60) * 0.18 + (Math.max(0, cost - 6.0) / 8) * 0.08);
    } else {
      playerAssistShare = Math.min(0.15, 0.05 + (creativityPerGame / 40) * 0.08);
    }
  } else if (player.element_type === 2) {
    const isWingback = creativityPerGame > 15 || cost >= 5.5;
    if (isWingback) {
      playerAssistShare = Math.min(0.24, 0.08 + (creativityPerGame / 40) * 0.12 + (Math.max(0, cost - 4.5) / 6) * 0.06);
    } else {
      playerAssistShare = Math.min(0.08, 0.02 + (creativityPerGame / 30) * 0.05);
    }
  } else {
    playerAssistShare = Math.min(0.20, 0.06 + (creativityPerGame / 40) * 0.10 + (form / 10) * 0.04);
  }

  const lambdaAssist = Math.max(0.02, teamExpAssists * playerAssistShare * playProb);
  const modelAssistProb = 1 - Math.exp(-lambdaAssist);
  const modelAssistOdds = Math.max(1.45, Math.min(26.0, Number(((1 / modelAssistProb) * 0.93).toFixed(2))));

  const finalAssist: PlayerOddsMetric = liveAssist || {
    odds: modelAssistOdds,
    prob: Number(modelAssistProb.toFixed(2)),
    source: 'fortuna_model',
    opponentShort,
    isHome,
  };

  // C. Model Goal or Assist
  let finalGoalOrAssist: PlayerOddsMetric;
  if (liveGoalOrAssist) {
    finalGoalOrAssist = liveGoalOrAssist;
  } else {
    const lambdaGA = lambdaGoal + lambdaAssist;
    const modelGAProb = 1 - Math.exp(-lambdaGA);
    const modelGAOdds = Math.max(1.20, Math.min(21.0, Number(((1 / modelGAProb) * 0.93).toFixed(2))));
    finalGoalOrAssist = {
      odds: modelGAOdds,
      prob: Number(modelGAProb.toFixed(2)),
      source: 'fortuna_model',
      opponentShort,
      isHome,
    };
  }

  return {
    odds: finalGoal.odds,
    prob: finalGoal.prob,
    source: finalGoal.source,
    cleanSheet: liveCleanSheet,
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
