import { FPLPlayer, FPLFixture, FPLTeam, FPLEvent } from '../types';
import { getDynamicDifficulty, calculateLeaguePositions } from './fdrModel';

export type TransferIndexResult = FPLPlayer & {
    transferIndex: number;
    fixtureDifficultySum: number;
    nextFixtures: { event: number; opponent: number; difficulty: number; isHome: boolean }[];
    eoFormRatio: number;
    eoPtsRatio: number;
};

export function computeTransferIndexForPlayers(args: {
    players: FPLPlayer[];
    fixtures: FPLFixture[];
    teams: FPLTeam[];
    events: FPLEvent[];
    lookahead: number;
}): TransferIndexResult[] {
    const { players, fixtures, teams, events, lookahead } = args;

    // 1. Calculate League Positions
    const leaguePositions = calculateLeaguePositions(teams, fixtures);

    const nextEvent = events.find(e => e.is_next) || events[0];
    const startGw = nextEvent.id;
    const endGw = Math.min(38, startGw + lookahead - 1);

    // Create a map of fixtures by team and event for O(1) lookup
    const fixtureMap: Record<string, { opponent: number; isHome: boolean }> = {};
    fixtures.filter(f => !f.finished && f.event >= startGw && f.event <= endGw).forEach(f => {
        fixtureMap[`${f.team_h}-${f.event}`] = { opponent: f.team_a, isHome: true };
        fixtureMap[`${f.team_a}-${f.event}`] = { opponent: f.team_h, isHome: false };
    });

    return players
        .filter(p => p.total_points > 10) // Basic filter to remove inactive players
        .map(p => {
            const nextFixtures = [];
            let difficultySum = 0;

            for (let gw = startGw; gw <= startGw + lookahead - 1; gw++) {
                if (gw > 38) break;

                const match = fixtureMap[`${p.team}-${gw}`];
                if (match) {
                    const difficultyData = getDynamicDifficulty(match.opponent, players, leaguePositions, !match.isHome);
                    const diffScore = difficultyData.score;
                    difficultySum += diffScore;
                    nextFixtures.push({ event: gw, opponent: match.opponent, difficulty: diffScore, isHome: match.isHome });
                } else {
                    // Blank Gameweek penalty
                    difficultySum += 6;
                    nextFixtures.push({ event: gw, opponent: 0, difficulty: 6, isHome: false });
                }
            }

            // --- THE ALGORITHM ---
            // 1. Normalize Form (0-10 scale usually) -> 0.0 to 1.0
            const formVal = parseFloat(p.form);
            const normForm = Math.min(formVal / 10, 1.0);

            // 2. Normalize Fixtures (5 games * 1 diff = 5 best, 5 * 5 = 25 worst)
            // Invert so higher is better.
            const normFixtures = Math.max(0, Math.min(1, ((lookahead * 5) - difficultySum) / (lookahead * 4)));

            // 3. Combine (Weighted)
            // 50/50 Form and Fixtures
            const index = (normForm * 0.5) + (normFixtures * 0.5);

            // Ratios
            const ownership = parseFloat(p.selected_by_percent);
            const eoFormRatio = formVal > 0 ? ownership / formVal : 0;
            const eoPtsRatio = p.total_points > 0 ? ownership / p.total_points : 0;

            return {
                ...p,
                transferIndex: index,
                fixtureDifficultySum: difficultySum,
                nextFixtures,
                eoFormRatio,
                eoPtsRatio
            } as TransferIndexResult;
        });
}
