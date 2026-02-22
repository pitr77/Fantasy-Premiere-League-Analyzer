
-- Seed data for Scout Articles - GW28 Differential Picks
INSERT INTO scout_articles (slug, gameweek, title, summary, content, captain_pick, differential_pick, published, generated_at)
VALUES (
    'gw28-differential-gems',
    28,
    'GW28 Differentials: 3 Low-Ownership Players to Boost Your Rank',
    'Stuck in a rank plateau? These three players have ownership under 5% and the potential to deliver massive hauls in Gameweek 28.',
    '## The Power of Differentials

In a season dominated by template teams (Erling Haaland, Bukayo Saka, Cole Palmer), the only way to make a real jump in rank is through effective differentials. A differential is a player with low ownership who scores high, giving you points that the majority of your rivals won''t have.

For Gameweek 28, we have identified three players who are flying under the radar but possess elite underlying metrics.

## 1. Simon Adingra (Brighton, £5.0m)
**Ownership: 1.2%**

With Brighton''s attack clicking again, Adingra has reclaimed his spot on the right wing. He is incredibly direct and takes on defenders with ease. Against a Brighton side that often keeps a high line, his pace on the break will be lethal.

**Why now?**
After a quiet period, his touches in the penalty area have doubled in the last two weeks. He is a primary target for managers looking to free up funds in midfield.

## 2. Dominic Solanke (Spurs, £7.5m)
**Ownership: 7.8%**

Wait, Solanke a differential? Yes! Due to Spurs'' recent blank gameweek and some minor fitness concerns, many managers sold him. Now that he is back to full fitness, he is one of the most clinical finishers in the league facing a defense that hasn''t kept a clean sheet in six matches.

**Key Stat:**
Solanke has the 2nd highest xG (Expected Goals) among all strikers over the last three matches he started.

## 3. Murillo (Nottingham Forest, £4.5m)
**Ownership: 1.5%**

If you need a budget defender who offers more than just clean sheet potential, look no further than Murillo. Not only is Forest''s defense improving under their new setup, but Murillo is also a threat at set pieces and has the ability to ping long-range assists.

## Summary

Don''t be afraid to deviate from the template. While the big names provide stability, these differentials provide the **velocity** you need to win your mini-leagues.

**Scout Verdict:** If you only have one transfer, prioritize **Dominic Solanke** if you don''t already own him. His ceiling is too high to ignore at 7% ownership.',
    'Erling Haaland',
    'Dominic Solanke',
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
