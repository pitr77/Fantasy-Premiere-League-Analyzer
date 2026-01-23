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
            const h = f.team_h_score!;
            const a = f.team_a_score!;

            stats[f.team_h].gf += h;
            stats[f.team_h].gd += (h - a);
            stats[f.team_a].gf += a;
            stats[f.team_a].gd += (a - h);

            if (h > a) stats[f.team_h].pts += 3;
            else if (h < a) stats[f.team_a].pts += 3;
            else {
                stats[f.team_h].pts += 1;
                stats[f.team_a].pts += 1;
            }
        });

    const sorted = Object.values(stats).sort((x, y) => {
        if (y.pts !== x.pts) return y.pts - x.pts;
        if (y.gd !== x.gd) return y.gd - x.gd;
        if (y.gf !== x.gf) return y.gf - x.gf;
        return x.id - y.id;
    });

    const positionMap: Record<number, number> = {};
    sorted.forEach((t, idx) => (positionMap[t.id] = idx + 1));
    return positionMap;
}

/**
 * Top-N key player form stats (average is the stable scale).
 */
function getTeamFormStats(teamId: number, players: FPLPlayer[], topN = 12) {
    const forms = players
        .filter(p => p.team === teamId)
        .map(p => Number.parseFloat(p.form || '0'))
        .filter(v => Number.isFinite(v))
        .sort((a, b) => b - a)
        .slice(0, topN);

    const sum = forms.reduce((s, v) => s + v, 0);
    const avg = forms.length ? sum / forms.length : 0;

    return { forms, sum, avg, count: forms.length };
}

/**
 * Converts table position to a small adjustment.
 * With weight 0.15 => approx [-1.35..+1.50]
 */
function tableAdjustment(position: number, weight = 0.15) {
    const pos = position >= 1 && position <= 20 ? position : 10;
    const tableStrength = (20 - pos) + 1; // 1..20
    const raw = (tableStrength - 10);     // -9..+10
    return raw * weight;
}

type DifficultyResult = {
    score: 1 | 2 | 3 | 4 | 5;
    label: string;
    bg: string;
    border: string;
    text: string;
    threat: number; // keep field; now equals avg form
    details: {
        formAvgTop12: number;
        formCount: number;
        position: number;
        tableAdj: number;
        haAdj: number;
        final: number;
    };
};

/**
 * Unified Dynamic FDR
 * - Main: opponent avg form of top 12
 * - Supporting: table position (small)
 * - Small home/away adjustment
 * Backward compatible: isAway optional.
 */
export function getDynamicDifficulty(
    opponentId: number,
    players: FPLPlayer[],
    positionMap: Record<number, number>,
    isAway: boolean = false
): DifficultyResult {
    const { avg, count } = getTeamFormStats(opponentId, players, 12);

    const position = positionMap[opponentId] || 10;
    const tableAdj = tableAdjustment(position, 0.15);

    // Away slightly harder
    const haAdj = isAway ? 0.15 : -0.10;

    const final = avg + tableAdj + haAdj;

    let score: 1 | 2 | 3 | 4 | 5 = 1;
    let label = 'Easy';
    let bg = 'bg-green-600';
    let border = 'border-green-700';

    // thresholds tuned to avg-form scale
    if (final > 4.2) {
        score = 5; label = 'Very Hard'; bg = 'bg-red-600'; border = 'border-red-700';
    } else if (final > 3.7) {
        score = 4; label = 'Hard'; bg = 'bg-orange-500'; border = 'border-orange-600';
    } else if (final > 3.2) {
        score = 3; label = 'Moderate'; bg = 'bg-slate-500'; border = 'border-slate-600';
    } else if (final > 2.7) {
        score = 2; label = 'Good'; bg = 'bg-green-500'; border = 'border-green-600';
    }

    return {
        score,
        label,
        bg,
        border,
        text: 'text-white',
        threat: Number(avg.toFixed(2)),
        details: {
            formAvgTop12: Number(avg.toFixed(2)),
            formCount: count,
            position,
            tableAdj: Number(tableAdj.toFixed(2)),
            haAdj: Number(haAdj.toFixed(2)),
            final: Number(final.toFixed(2)),
        }
    };
}
