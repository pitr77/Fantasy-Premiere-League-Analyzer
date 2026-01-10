import { FPLPlayer, FPLTeam, FPLFixture } from '../types';

/**
 * Calculates current league positions based on finished fixtures.
 */
export function calculateLeaguePositions(teams: FPLTeam[], fixtures: FPLFixture[]) {
    const stats: Record<number, { pts: number; gd: number; gf: number; id: number }> = {};

    teams.forEach(t => {
        stats[t.id] = { pts: 0, gd: 0, gf: 0, id: t.id };
    });

    fixtures
        .filter(f => f.finished && f.team_h_score != null && f.team_a_score != null)
        .forEach(f => {
            const hScore = f.team_h_score!;
            const aScore = f.team_a_score!;

            stats[f.team_h].gf += hScore;
            stats[f.team_h].gd += (hScore - aScore);
            stats[f.team_a].gf += aScore;
            stats[f.team_a].gd += (aScore - hScore);

            if (hScore > aScore) {
                stats[f.team_h].pts += 3;
            } else if (hScore < aScore) {
                stats[f.team_a].pts += 3;
            } else {
                stats[f.team_h].pts += 1;
                stats[f.team_a].pts += 1;
            }
        });

    const sorted = Object.values(stats).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.id - b.id;
    });

    const positionMap: Record<number, number> = {};
    sorted.forEach((team, index) => {
        positionMap[team.id] = index + 1;
    });

    return positionMap;
}

/**
 * Calculates a team's threat level based on the form of its top 12 players.
 */
export function calculateTeamThreatLevel(teamId: number, players: FPLPlayer[]) {
    const teamPlayers = players
        .filter(p => p.team === teamId)
        .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
        .slice(0, 12);

    return teamPlayers.reduce((acc, p) => acc + parseFloat(p.form), 0);
}

/**
 * Unified Dynamic FDR calculations.
 * Combines player form and league position.
 */
export function getDynamicDifficulty(
    opponentId: number,
    players: FPLPlayer[],
    positionMap: Record<number, number>
) {
    const formScore = calculateTeamThreatLevel(opponentId, players);
    const position = positionMap[opponentId] || 10;
    const tableStrength = (20 - position) + 1;
    const tableAdjustment = (tableStrength - 10) * 1.0;
    const finalScore = formScore + tableAdjustment;

    let score = 1;
    let label = 'Easy';
    let bg = 'bg-green-600';
    let border = 'border-green-700';

    if (finalScore > 55) {
        score = 5; label = 'Very Hard'; bg = 'bg-red-600'; border = 'border-red-700';
    } else if (finalScore > 45) {
        score = 4; label = 'Hard'; bg = 'bg-orange-500'; border = 'border-orange-600';
    } else if (finalScore > 35) {
        score = 3; label = 'Moderate'; bg = 'bg-slate-500'; border = 'border-slate-600';
    } else if (finalScore > 25) {
        score = 2; label = 'Good'; bg = 'bg-green-500'; border = 'border-green-600';
    }

    return {
        score,
        label,
        bg,
        border,
        text: 'text-white',
        threat: formScore
    };
}
