import { FPLPlayer, FPLTeam, FPLFixture } from '../types';
import { FortunaMatch } from '../services/oddsSnapshotService';

export interface GoalscorerOddsResult {
  odds: number; // Decimal odds (e.g. 1.85)
  prob: number; // Probability between 0 and 1 (e.g. 0.50)
  source: 'fortuna_live' | 'fortuna_model';
  teamExpectedGoals: number; // Expected goals for player's team (e.g. 2.1)
  opponentId: number;
  opponentShort: string;
  isHome: boolean;
}

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Calculates or retrieves anytime goalscorer odds and probability for an FPL player in an upcoming fixture.
 */
export function getGoalscorerOdds(
  player: FPLPlayer,
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  nextEventId: number,
  oddsData: FortunaMatch[] | null
): GoalscorerOddsResult | null {
  // Only applicable for MID (3) and FWD (4)
  if (player.element_type !== 3 && player.element_type !== 4) {
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

  // 1. Try finding Fortuna match in the snapshot
  const match = oddsData?.find(m =>
    isHome
      ? m.homeTeamId === player.team && m.awayTeamId === opponentId
      : m.homeTeamId === opponentId && m.awayTeamId === player.team
  );

  // 2. Check if Fortuna has direct anytime goalscorer odds for this player
  if (match?.scorers && match.scorers.length > 0) {
    const webNameNorm = normalizeName(player.web_name);
    const secondNameNorm = normalizeName(player.second_name);
    const firstNameNorm = normalizeName(player.first_name);

    const foundScorer = match.scorers.find(s => {
      const sNorm = normalizeName(s.name);
      return (
        sNorm.includes(secondNameNorm) ||
        sNorm.includes(webNameNorm) ||
        (firstNameNorm.length > 3 && sNorm.includes(firstNameNorm))
      );
    });

    if (foundScorer && foundScorer.odds > 1) {
      return {
        odds: foundScorer.odds,
        prob: foundScorer.prob || Number((1 / foundScorer.odds).toFixed(2)),
        source: 'fortuna_live',
        teamExpectedGoals: 0,
        opponentId,
        opponentShort,
        isHome,
      };
    }
  }

  // 3. Implied Goal Expectancy Model using Fortuna team match odds
  // A. Total match expected goals
  let totalMatchGoals = 2.75; // Premier League standard base
  if (match?.overUnder25?.overProb) {
    const overProb = match.overUnder25.overProb;
    // Over 2.5 probability maps smoothly: 40% -> 2.4 goals, 50% -> 2.7 goals, 65% -> 3.2 goals
    totalMatchGoals = 2.2 + (overProb * 1.5);
  }

  // B. Team's share of expected goals
  let teamGoalShare = isHome ? 0.54 : 0.46; // Base home advantage
  if (match?.probabilities) {
    const pWin = isHome ? match.probabilities.home : match.probabilities.away;
    const pLoss = isHome ? match.probabilities.away : match.probabilities.home;
    const pDraw = match.probabilities.draw;

    // Team win dominance translates directly to goal share
    const netSuperiority = pWin - pLoss; // e.g. Arsenal (0.68 - 0.13) = +0.55
    teamGoalShare = Math.min(0.85, Math.max(0.18, 0.50 + netSuperiority * 0.42));
  }

  const teamExpGoals = totalMatchGoals * teamGoalShare;

  // C. Player's individual goal expectation (lambda)
  const cost = player.now_cost / 10;
  const threatPerGame = parseFloat(player.threat) / Math.max(1, (player.minutes / 90) || 1);
  const form = parseFloat(player.form) || 0;
  const ppg = parseFloat(player.points_per_game) || 0;

  // Position baseline share of team goals
  let playerShareOfTeamGoals = 0;

  if (player.element_type === 4) {
    // FORWARD (FWD): Main target man / talisman
    // Elite forwards (Haaland, Isak, Watkins) take 30-45% of team goals
    // Mid forwards (Wood, Evanilson) take 22-30%
    // Budget/backup forwards take 12-20%
    const costFactor = Math.min(0.40, 0.15 + (Math.max(0, cost - 5.0) / 10.0) * 0.25);
    const formFactor = Math.min(0.08, (form / 10) * 0.08);
    const threatFactor = Math.min(0.08, (threatPerGame / 70) * 0.08);
    playerShareOfTeamGoals = costFactor + formFactor + threatFactor;
  } else {
    // MIDFIELDER (MID):
    // Elite scoring wingers (Salah, Palmer, Saka, Mbeumo) take 22-35% of team goals
    // Attacking mids take 12-20%
    // Holding/central mids take 4-10%
    const isWingerOrAttacker = cost >= 7.0 || threatPerGame > 25 || ppg >= 4.5;
    if (isWingerOrAttacker) {
      const costFactor = Math.min(0.30, 0.10 + (Math.max(0, cost - 6.5) / 8.0) * 0.20);
      const formFactor = Math.min(0.06, (form / 10) * 0.06);
      const threatFactor = Math.min(0.06, (threatPerGame / 60) * 0.06);
      playerShareOfTeamGoals = costFactor + formFactor + threatFactor;
    } else {
      playerShareOfTeamGoals = Math.min(0.10, 0.04 + (form / 20) * 0.04 + (threatPerGame / 100) * 0.04);
    }
  }

  // Adjust for playing time probability
  const playProb = player.chance_of_playing_next_round !== null
    ? player.chance_of_playing_next_round / 100
    : 1.0;

  const playerExpectedGoals = Math.max(0.04, teamExpGoals * playerShareOfTeamGoals * playProb);

  // Poisson probability of scoring at least 1 goal: P(X >= 1) = 1 - exp(-lambda)
  const goalProb = 1 - Math.exp(-playerExpectedGoals);

  // Convert to bookmaker decimal odds with ~8% standard margin
  const fairOdds = 1 / goalProb;
  const rawOdds = fairOdds * 0.93; // bookmaker margin reduction
  const decimalOdds = Math.max(1.35, Math.min(21.0, Number(rawOdds.toFixed(2))));

  return {
    odds: decimalOdds,
    prob: Number(goalProb.toFixed(2)),
    source: 'fortuna_model',
    teamExpectedGoals: Number(teamExpGoals.toFixed(1)),
    opponentId,
    opponentShort,
    isHome,
  };
}
