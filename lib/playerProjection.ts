import { FPLPlayer, FPLTeam } from '../types';

export type PlayerProjection = {
    expectedPoints: number;
    startProbability: number;
    confidence: number;
};

function finite(value: string | number | null | undefined, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value || '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Lightweight, odds-free expected-points prior. It is deliberately conservative
 * early in the season: historical FPL output and team strength carry more weight
 * until enough current-season minutes exist.
 */
export function projectPlayer(p: FPLPlayer, team?: FPLTeam): PlayerProjection {
    const minutes = Math.max(0, p.minutes);
    const seasonSample = Math.min(1, minutes / 900);
    const form = Math.max(0, finite(p.form));
    const pointsPerGame = Math.max(0, finite(p.points_per_game));
    const teamStrength = Math.max(1, Math.min(5, team?.strength ?? 3));
    const strengthPrior = 2.5 + (teamStrength - 3) * 0.45;
    const availability = Math.max(0, Math.min(1, (p.chance_of_playing_next_round ?? 100) / 100));
    const expectedPoints = (pointsPerGame * seasonSample + (form * 0.75 + strengthPrior) * (1 - seasonSample)) * availability;
    const confidence = Math.min(1, 0.25 + seasonSample * 0.65 + (p.chance_of_playing_next_round === null ? 0.1 : 0));

    return {
        expectedPoints: Number(Math.max(0, expectedPoints).toFixed(2)),
        startProbability: Number(availability.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
    };
}
