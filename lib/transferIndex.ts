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
    horizon?: 'next' | 'next5';
}): TransferIndexResult[] {
    const { players, fixtures, teams, events, lookahead, horizon = 'next5' } = args;

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

            let index = 0;
            const formValRaw = parseFloat(p.form ?? '0');
            const formVal = Number.isFinite(formValRaw) ? formValRaw : 0;

            if (horizon === 'next') {
                // --- NEXT GW SCORING LOGIC ---
                const firstFix = nextFixtures[0];
                let fixtureScore = 0.65; // Moderate default

                if (firstFix) {
                    const diff = firstFix.difficulty;
                    if (diff >= 5) fixtureScore = 0.25;      // Very Hard
                    else if (diff === 4) fixtureScore = 0.40; // Hard
                    else if (diff === 3) fixtureScore = 0.65; // Moderate
                    else fixtureScore = 0.85;                // Easy/Good (1, 2)

                    // Home bonus +0.05
                    if (firstFix.isHome) {
                        fixtureScore = Math.min(1.0, fixtureScore + 0.05);
                    }
                }

                const formNorm = Math.max(0, Math.min(1, formVal / 8));

                // Minutes Score (Start likelihood)
                // Use chance_of_playing_next_round as proxy (0-100 normalized to 0-1)
                // If null, assume 100% fit
                const chance = (p.chance_of_playing_next_round ?? 100);
                const minutesNorm = Math.max(0, Math.min(1, chance / 100));

                // New Next GW score: 50% Fixture + 30% Minutes + 20% Form
                index = (0.50 * fixtureScore + 0.30 * minutesNorm + 0.20 * formNorm);
            } else {
                // --- THE ALGORITHM (Next 5 GWs) ---
                // 1. Normalize Form (0-10 scale usually) -> 0.0 to 1.0
                const normForm = Math.min(formVal / 10, 1.0);

                // 2. Normalize Fixtures (5 games * 1 diff = 5 best, 5 * 5 = 25 worst)
                // Invert so higher is better.
                const normFixtures = Math.max(0, Math.min(1, ((lookahead * 5) - difficultySum) / (lookahead * 4)));

                // 3. Combine (Weighted)
                // 50/50 Form and Fixtures
                index = (normForm * 0.5) + (normFixtures * 0.5);
            }

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

