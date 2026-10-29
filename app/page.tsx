import App from '../App';

export default function HomePage() {
  return (
    <>
      {/* Semantic Crawlable Content for Google, Bing, and AI Search Engines */}
      <section className="sr-only" aria-label="FPL Studio SEO Overview">
        <h1>FPL Studio — AI-Powered Fantasy Premier League Analytics & Tools</h1>
        <p>
          FPL Studio is a free, comprehensive Fantasy Premier League analytics platform
          providing real-time insights, Top 100 manager consensus, dynamic fixture difficulty ratings (FDR),
          live bookmaker odds, transfer planning, and automated Gemini AI gameweek previews.
        </p>

        <h2>Key Fantasy Premier League Features & Tools</h2>
        <ul>
          <li>
            <strong>Top 100 Elite Managers Tracker:</strong> Real-time transfer activity (in/out/net),
            captaincy picks, and team templates from the top 100 ranked FPL managers in the world.
          </li>
          <li>
            <strong>Dynamic FDR Matrix:</strong> Advanced Fixture Difficulty Rating recalculating real-time
            matchup difficulty based on home/away form, rolling offensive/defensive ratings, and odds.
          </li>
          <li>
            <strong>Transfer Picks & Bookmaker Odds:</strong> Expected goals (xG), expected assists (xA),
            and live clean sheet & goalscorer odds to identify high-value transfer targets and differentials.
          </li>
          <li>
            <strong>Player Detail & Match Logs:</strong> Deep gameweek history, position rank percentiles,
            BPS scores, and metric breakdowns for every Premier League player.
          </li>
          <li>
            <strong>Squad Simulator & Chip Planner:</strong> Interactive pitch simulation to test Wildcard,
            Free Hit, Bench Boost, and transfer sequences ahead of future gameweek deadlines.
          </li>
          <li>
            <strong>AI Scout Gameweek Previews:</strong> Tactical previews, captaincy recommendations,
            and differential picks generated before every gameweek deadline.
          </li>
        </ul>

        <h2>Frequently Asked Questions (FAQ)</h2>
        <dl>
          <dt>What is FPL Studio?</dt>
          <dd>FPL Studio is a free analytics suite built to help Fantasy Premier League managers make smarter decisions using mathematical models, bookmaker odds, and elite manager trends.</dd>
          <dt>Is FPL Studio free to use?</dt>
          <dd>Yes, all core analytical tools including the Top 100 manager tracker, dynamic FDR, and transfer picks are free.</dd>
          <dt>How does Dynamic FDR differ from official FPL difficulty?</dt>
          <dd>Official FPL FDR is static (1-5). FPL Studio recalculates FDR dynamically after every gameweek based on team form, home/away splits, goal threat, and bookmaker odds.</dd>
        </dl>
      </section>

      {/* Main Interactive App Client Island */}
      <App />
    </>
  );
}

