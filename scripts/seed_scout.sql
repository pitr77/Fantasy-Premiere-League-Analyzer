
-- Seed data for Scout Articles
INSERT INTO scout_articles (slug, gameweek, title, summary, content, captain_pick, differential_pick, published, generated_at)
VALUES (
    'gw28-preview-ultimate-guide',
    28,
    'FPL Gameweek 28 Preview: High-Stakes Differentials & Captaincy Strategy',
    'Master GW28 with our expert analysis on the best captain picks, differential gems, and the crucial transfer targets you need to climb the ranks.',
    '## Gameweek 28: The Calm Before the Storm?

As we approach the business end of the season, Gameweek 28 presents a fascinating tactical challenge for FPL managers. With many teams looking solidified and a few key injuries shaking up the template, now is the time to act if you want to make significant gains in your mini-leagues.

The data suggests that defensive solidity is becoming harder to find, while mid-priced midfielders continue to offer the best value-for-money in the game. In this report, we break down where you should be spending your transfers this week.

## Key Fixtures to Target

**Arsenal vs Leicester City**
The Gunners remain the most potent attacking force in the league. With Bukayo Saka and Martin Ødegaard pulling the strings, expect a high-scoring affair at the Emirates. Leicester''s defensive lapses (note the double single quote for SQL) in transition will be exploited by Arsenal''s high press.

**Manchester City vs Everton**
Always a fixture for goals. Erling Haaland will be the focus, but don''t overlook Phil Foden, who has been in devastating form recently. City''s home record against bottom-half sides is nearly flawless, making them prime targets for a triple-up.

## The Captaincy Conundrum

**Erling Haaland (MCI)**
The default choice, and for good reason. His underlying xG remains off the charts, and with 90 minutes almost guaranteed at home against Everton, he is the safest ''effective ownership'' shield.

**Bukayo Saka (ARS)**
If you''re chasing, Saka offers a massive ceiling against a Leicester side that struggles with wide overloads. He is on penalties and set pieces, giving him multiple routes to points.

## Differential Gems (<10% Ownership)

**Alex Iwobi (FUL)**
With a series of favorable fixtures coming up, Iwobi is playing in a very advanced role and taking frequent shots from the edge of the box. At his price point, he is a perfect budget enabler.

**Pervis Estupiñán (BHA)**
Brighton''s defense has stabilized, and his attacking license remains the highest among all defenders in his price bracket. He is a primary target for those looking to pivot away from underperforming template defenders.

## Summary Checklist for GW28
- **Check Injuries:** Monitor the late fitness tests for key assets.
- **Don''t Chase Last Week''s Points:** Stick to long-term form and fixture swings.
- **Save your FT:** If your team looks solid, banking a transfer for the upcoming double gameweeks could be invaluable.

Good luck, managers!',
    'Erling Haaland',
    'Alex Iwobi',
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
