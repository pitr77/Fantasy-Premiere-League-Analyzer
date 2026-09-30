/**
 * Converts decimal bookmaker odds into normalized implied probabilities.
 * Normalization removes the bookmaker margin (overround) when a complete
 * 1X2 market is supplied.
 */
export type MatchOdds = {
    home: number;
    draw: number;
    away: number;
};

export type MatchProbabilities = {
    home: number;
    draw: number;
    away: number;
    overround: number;
};

function implied(odds: number): number {
    return Number.isFinite(odds) && odds > 1 ? 1 / odds : 0;
}

export function probabilitiesFromOdds(odds: MatchOdds): MatchProbabilities | null {
    const raw = {
        home: implied(odds.home),
        draw: implied(odds.draw),
        away: implied(odds.away),
    };
    const overround = raw.home + raw.draw + raw.away;
    if (overround <= 0) return null;

    return {
        home: raw.home / overround,
        draw: raw.draw / overround,
        away: raw.away / overround,
        overround,
    };
}

/** Probability that the selected team wins, based on a normalized 1X2 market. */
export function teamWinProbability(
    odds: MatchOdds,
    isHome: boolean,
): number | null {
    const probabilities = probabilitiesFromOdds(odds);
    if (!probabilities) return null;
    return isHome ? probabilities.home : probabilities.away;
}
