
-- Seed data for Scout Articles - GW28 Captaincy Masterclass
INSERT INTO scout_articles (slug, gameweek, title, summary, content, captain_pick, differential_pick, published, generated_at)
VALUES (
    'gw28-captain-masterclass',
    28,
    'GW28 Captaincy Masterclass: Is it time to stray from the Robot?',
    'Erling Haaland faces Everton, but is there a higher ceiling elsewhere? We analyze the stats behind Saka, Foden, and Salah for Gameweek 28.',
    '## The Great Captaincy Debate

Gameweek 28 presents a classic FPL dilemma: do you play it safe with the most owned player in the game, or do you take a calculated risk to climb the rankings? With the title race heating up, the traditional "set and forget" captaincy on Erling Haaland is being questioned by the top 10k managers.

## The Safe Bet: Erling Haaland (v Everton, Home)

It is hard to ignore a man who averages nearly an attacking return per start at the Etihad. Everton have showed defensive resilience recently, but the sheer volume of chances Manchester City creates usually overwhelms low blocks.

**The Stats:**
- xG per 90: 0.94
- Big Chances: 4 in the last 3 matches
- Ownership: >85%

If you don''t captain him, you are effectively betting against the most explosive asset in the league. Is the risk worth the reward?

## The Explosive Alternative: Bukayo Saka (v Leicester, Home)

Arsenal are in "must-win" mode. Bukayo Saka has been the focal point of everything good about the Gunners'' attack. Leicester City struggle significantly with transitions and high-intensity pressing, both of which are Arsenal specialties.

**Why Saka?**
1. **Penalties:** He remains the undisputed taker.
2. **Creativity:** His expected assists (xA) have spiked in February.
3. **Fixture:** Leicester have conceded the 3rd most big chances in the league over the last month.

## The "Gut Feeling" Pick: Phil Foden (v Everton, Home)

If you believe City will dominate but Haaland might be the decoy, Phil Foden is your man. He is playing more centrally than ever and has developed a knack for arriving late in the box—a nightmare for Everton''s aging center-backs.

## Comparison Table

| Asset | Fixture | Form | Ceiling |
|-------|---------|------|---------|
| Haaland | EVE (H) | High | Massive |
| Saka | LEI (H) | Elite | High |
| Foden | EVE (H) | High | Medium |
| Salah | BHA (A) | Good | High |

## Pro Tip for GW28
If you are leading your mini-league, **Haaland** is the logical shield. If you are trailing by 30+ points, **Saka** is the sword you need to bridge that gap.

Good luck with your decisions!',
    'Bukayo Saka',
    'Phil Foden',
    true,
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    captain_pick = EXCLUDED.captain_pick,
    differential_pick = EXCLUDED.differential_pick,
    generated_at = EXCLUDED.generated_at;
