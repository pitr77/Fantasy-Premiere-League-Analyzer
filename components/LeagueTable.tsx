import React, { useMemo, useState } from 'react';
import { Trophy, TrendingUp, Sparkles, Home, Plane } from 'lucide-react';
import { FPLTeam, FPLFixture } from '../types';
import { track } from '@/lib/ga';
import { TeamIcon } from './TeamIcon';
import { useLanguage, Language } from '../lib/language';

interface LeagueTableProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

type LocationFilter = 'all' | 'home' | 'away';
type ViewMode = 'full' | 'compact';
type FormResult = 'W' | 'D' | 'L';

interface FormMatch {
  result: FormResult;
  opponent: number;
  score: string;
  isHome: boolean;
  date?: string | null;
  event?: number;
}

interface TeamStatsRecord {
  id: number;
  name: string;
  short_name: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  pts: number;
  form: FormMatch[];
}

// Tooltip metric descriptions and tactical interpretation tips
const leagueMetricDescriptions: Record<string, {
  label: (lang: Language) => string;
  abbr: string;
  description: (lang: Language) => string;
  tip?: (lang: Language) => string;
}> = {
  pos: {
    label: (lang) => lang === 'sk' ? 'Ligová pozícia' : 'League Position',
    abbr: '#',
    description: (lang) => lang === 'sk'
      ? 'Aktuálne umiestnenie tímu v tabuľke Premier League (podľa bodov, gólového rozdielu a strelených gólov).'
      : 'Current standings rank in Premier League based on points, GD and goals scored.',
    tip: (lang) => lang === 'sk'
      ? 'Top 4 zaisťuje Ligu majstrov (modrý pásik), 5. Európsku ligu (oranžový), 6.-7. Konferenčnú ligu (zelený) a posledné 3 miesta znamenajú zostup (červený).'
      : 'Top 4 qualifies for Champions League (blue), 5th for Europa League, 6-7th Conference League, bottom 3 relegation.'
  },
  team: {
    label: (lang) => lang === 'sk' ? 'Klub Premier League' : 'Club',
    abbr: 'TEAM',
    description: (lang) => lang === 'sk'
      ? 'Oficiálny erb a názov klubu Premier League.'
      : 'Official Premier League club crest and name.'
  },
  played: {
    label: (lang) => lang === 'sk' ? 'Odohrané zápasy' : 'Matches Played',
    abbr: 'MP',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet skutočne odohraných ligových stretnutí vo vybranom filtri (celkovo, doma alebo vonku).'
      : 'Total matches played in the selected scope (all, home, or away).'
  },
  win: {
    label: (lang) => lang === 'sk' ? 'Víťazstvá' : 'Wins',
    abbr: 'W',
    description: (lang) => lang === 'sk'
      ? 'Počet vyhratých zápasov tímu (za každú výhru tím získava 3 body do tabuľky).'
      : 'Number of wins (3 points each).'
  },
  draw: {
    label: (lang) => lang === 'sk' ? 'Remízy' : 'Draws',
    abbr: 'D',
    description: (lang) => lang === 'sk'
      ? 'Počet nerozhodných výsledkov (za každú remízu tím získava 1 bod do tabuľky).'
      : 'Number of draws (1 point each).'
  },
  loss: {
    label: (lang) => lang === 'sk' ? 'Prehry' : 'Losses',
    abbr: 'L',
    description: (lang) => lang === 'sk'
      ? 'Počet prehratých zápasov tímu (0 bodov).'
      : 'Number of defeats (0 points).'
  },
  gf: {
    label: (lang) => lang === 'sk' ? 'Strelené góly' : 'Goals For',
    abbr: 'GF',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet gólov strelených tímom v sledovanom filtri zápasov.'
      : 'Total goals scored by the team.'
  },
  ga: {
    label: (lang) => lang === 'sk' ? 'Inkasované góly' : 'Goals Against',
    abbr: 'GA',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet gólov inkasovaných tímom v sledovanom filtri zápasov.'
      : 'Total goals conceded by the team.'
  },
  score: {
    label: (lang) => lang === 'sk' ? 'Skóre (Strelené : Inkasované)' : 'Score (GF:GA)',
    abbr: 'GF:GA',
    description: (lang) => lang === 'sk'
      ? 'Pomer strelených a inkasovaných gólov tímu v súťaži.'
      : 'Goals scored vs goals conceded ratio.'
  },
  gd: {
    label: (lang) => lang === 'sk' ? 'Gólový rozdiel' : 'Goal Difference',
    abbr: 'GD',
    description: (lang) => lang === 'sk'
      ? 'Rozdiel medzi strelenými a inkasovanými gólmi (GF - GA).'
      : 'Goal difference across finished matches (GF - GA).',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Pri rovnosti bodov je GD prvým rozhodujúcim kritériom pre poradie v tabuľke.'
      : 'How to read: Primary tie-breaker when teams are level on points.'
  },
  pts: {
    label: (lang) => lang === 'sk' ? 'Body' : 'Points',
    abbr: 'PTS',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet získaných bodov tímu v tabuľke Premier League.'
      : 'Total accumulated league points.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Hlavné hodnotiace kritérium úspešnosti a postavenia tímu v ligovej sezóne.'
      : 'Primary ranking metric in the Premier League.'
  },
  form: {
    label: (lang) => lang === 'sk' ? 'Forma (Posledných 5 zápasov)' : 'Recent Form (Last 5)',
    abbr: 'FORM',
    description: (lang) => lang === 'sk'
      ? 'Výsledky posledných 5 odohraných ligových zápasov (Zelená = Výhra, Sivá = Remíza, Červená = Prehra). Zobrazuje sa zľava doprava (najnovší zápas je vľavo).'
      : 'Results of the last 5 league matches (Green = Win, Grey = Draw, Red = Loss) from left to right (newest on the left).',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Prejdite myšou nad pilulku a okamžite uvidíte skóre a meno súpera.'
      : 'How to read: Hover any pill to reveal match score and opponent details.'
  },
  next: {
    label: (lang) => lang === 'sk' ? 'Najbližší zápas' : 'Next Fixture',
    abbr: 'NEXT',
    description: (lang) => lang === 'sk'
      ? 'Najbližší nadchádzajúci súper tímu v Premier League vrátane informácie (D) doma / (V) vonku a obťažnosti FDR.'
      : 'Next scheduled Premier League fixture with Home/Away indicator and FDR difficulty rating.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Zelená značí priaznivý zápas (FDR 2), sivá vyrovnaný (FDR 3) a červená náročný duel (FDR 4-5).'
      : 'Green denotes favorable fixture (FDR 2), grey balanced (FDR 3), and red tough test (FDR 4-5).'
  }
};

const getFdrColorClasses = (difficulty: number) => {
  switch (difficulty) {
    case 1:
    case 2:
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30';
    case 3:
      return 'bg-slate-600/30 text-slate-200 border-slate-500/40 hover:bg-slate-600/40';
    case 4:
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
    case 5:
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30';
    default:
      return 'bg-slate-700/30 text-slate-300 border-slate-600';
  }
};

const LeagueTable: React.FC<LeagueTableProps> = ({ teams, fixtures }) => {
  const [lang] = useLanguage();
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('full');

  // Interactive header tooltip state
  const [hoveredMetric, setHoveredMetric] = useState<{
    label: string;
    abbr: string;
    description: string;
    tip?: string;
    rect: DOMRect;
  } | null>(null);

  // Floating hover state for individual form pill
  const [hoveredForm, setHoveredForm] = useState<{
    teamId: number;
    opponentId: number;
    teamName: string;
    opponentName: string;
    score: string;
    result: FormResult;
    isHome: boolean;
    date?: string | null;
    event?: number;
    rect: DOMRect;
  } | null>(null);

  // 1. Calculate Next Fixture for each team
  const nextFixtureMap = useMemo(() => {
    const map: Record<number, {
      opponentId: number;
      opponentName: string;
      opponentShort: string;
      isHome: boolean;
      difficulty: number;
      event?: number;
      kickoff?: string;
    } | null> = {};

    const upcoming = fixtures
      .filter((f) => !f.finished && f.team_h_score === null && Boolean(f.kickoff_time))
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

    teams.forEach((t) => {
      const nextF = upcoming.find((f) => f.team_h === t.id || f.team_a === t.id);
      if (!nextF) {
        map[t.id] = null;
        return;
      }
      const isHome = nextF.team_h === t.id;
      const oppId = isHome ? nextF.team_a : nextF.team_h;
      const oppTeam = teams.find((team) => team.id === oppId);
      const difficulty = isHome ? nextF.team_h_difficulty : nextF.team_a_difficulty;

      map[t.id] = {
        opponentId: oppId,
        opponentName: oppTeam?.name || 'TBD',
        opponentShort: oppTeam?.short_name || 'TBD',
        isHome,
        difficulty,
        event: nextF.event,
        kickoff: nextF.kickoff_time
      };
    });

    return map;
  }, [teams, fixtures]);

  // 2. Calculate Table Standings with Home / Away / All Scope
  const tableData = useMemo<TeamStatsRecord[]>(() => {
    const stats: Record<number, {
      id: number;
      name: string;
      short_name: string;
      home: { played: number; win: number; draw: number; loss: number; gf: number; ga: number; pts: number };
      away: { played: number; win: number; draw: number; loss: number; gf: number; ga: number; pts: number };
      allForm: FormMatch[];
      homeForm: FormMatch[];
      awayForm: FormMatch[];
    }> = {};

    teams.forEach((t) => {
      stats[t.id] = {
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        home: { played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 },
        away: { played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 },
        allForm: [],
        homeForm: [],
        awayForm: []
      };
    });

    const finishedFixtures = fixtures
      .filter((f) => {
        const hasKickoff = Boolean(f.kickoff_time);
        const hasScore =
          f.team_h_score !== null && f.team_h_score !== undefined &&
          f.team_a_score !== null && f.team_a_score !== undefined;
        return hasKickoff && (f.finished === true || hasScore);
      })
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

    finishedFixtures.forEach((f) => {
      const hTeam = stats[f.team_h];
      const aTeam = stats[f.team_a];
      if (!hTeam || !aTeam) return;

      const hScore = f.team_h_score ?? 0;
      const aScore = f.team_a_score ?? 0;

      hTeam.home.played++;
      aTeam.away.played++;

      hTeam.home.gf += hScore;
      hTeam.home.ga += aScore;

      aTeam.away.gf += aScore;
      aTeam.away.ga += hScore;

      let hRes: FormResult = 'D';
      let aRes: FormResult = 'D';

      if (hScore > aScore) {
        hRes = 'W';
        aRes = 'L';
        hTeam.home.win++;
        aTeam.away.loss++;
        hTeam.home.pts += 3;
      } else if (hScore < aScore) {
        hRes = 'L';
        aRes = 'W';
        aTeam.away.win++;
        hTeam.home.loss++;
        aTeam.away.pts += 3;
      } else {
        hTeam.home.draw++;
        aTeam.away.draw++;
        hTeam.home.pts += 1;
        aTeam.away.pts += 1;
      }

      const hMatch: FormMatch = {
        result: hRes,
        opponent: f.team_a,
        score: `${hScore}-${aScore}`,
        isHome: true,
        date: f.kickoff_time,
        event: f.event
      };

      const aMatch: FormMatch = {
        result: aRes,
        opponent: f.team_h,
        score: `${aScore}-${hScore}`,
        isHome: false,
        date: f.kickoff_time,
        event: f.event
      };

      hTeam.allForm.push(hMatch);
      hTeam.homeForm.push(hMatch);

      aTeam.allForm.push(aMatch);
      aTeam.awayForm.push(aMatch);
    });

    const records: TeamStatsRecord[] = Object.values(stats).map((t) => {
      if (locationFilter === 'home') {
        return {
          id: t.id,
          name: t.name,
          short_name: t.short_name,
          played: t.home.played,
          win: t.home.win,
          draw: t.home.draw,
          loss: t.home.loss,
          gf: t.home.gf,
          ga: t.home.ga,
          pts: t.home.pts,
          form: t.homeForm
        };
      } else if (locationFilter === 'away') {
        return {
          id: t.id,
          name: t.name,
          short_name: t.short_name,
          played: t.away.played,
          win: t.away.win,
          draw: t.away.draw,
          loss: t.away.loss,
          gf: t.away.gf,
          ga: t.away.ga,
          pts: t.away.pts,
          form: t.awayForm
        };
      } else {
        return {
          id: t.id,
          name: t.name,
          short_name: t.short_name,
          played: t.home.played + t.away.played,
          win: t.home.win + t.away.win,
          draw: t.home.draw + t.away.draw,
          loss: t.home.loss + t.away.loss,
          gf: t.home.gf + t.away.gf,
          ga: t.home.ga + t.away.ga,
          pts: t.home.pts + t.away.pts,
          form: t.allForm
        };
      }
    });

    // Sort by: PTS desc, GD desc, GF desc, Name asc
    return records.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
  }, [teams, fixtures, locationFilter]);

  const getTeamObj = (id: number) => teams.find((t) => t.id === id);

  const renderTh = (
    key: string,
    displayLabel: string,
    alignClass: string = 'text-center',
    extraClass: string = ''
  ) => {
    const metric = leagueMetricDescriptions[key];

    return (
      <th
        key={key}
        onMouseEnter={(e) => {
          if (!metric) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setHoveredMetric({
            label: metric.label(lang),
            abbr: metric.abbr,
            description: metric.description(lang),
            tip: metric.tip?.(lang),
            rect
          });
        }}
        onMouseLeave={() => setHoveredMetric(null)}
        className={`py-3 px-2 md:px-3 font-bold cursor-default transition-colors select-none border-b border-slate-700 ${alignClass} ${extraClass}`}
      >
        <span className="border-b border-dotted border-slate-600/70 hover:border-blue-400 transition-colors">
          {displayLabel}
        </span>
      </th>
    );
  };

  const finishedCount = useMemo(() => {
    return fixtures.filter(
      (f) => f.finished || (f.team_h_score !== null && f.team_a_score !== null)
    ).length;
  }, [fixtures]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header & Controls Toolbar */}
      <div className="bg-slate-800 p-5 md:p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
                {lang === 'sk' ? 'Tabuľka Premier League' : 'Premier League Table'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'sk'
                  ? `Odohraných ${finishedCount} ligových zápasov • Sezóna 2024/25`
                  : `${finishedCount} matches finished • Season 2024/25`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Scope Filter: Celkovo / Doma / Vonku */}
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex items-center shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setLocationFilter('all');
                  track('league_table_scope', { scope: 'all' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  locationFilter === 'all'
                    ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{lang === 'sk' ? 'Celkovo' : 'Overall'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocationFilter('home');
                  track('league_table_scope', { scope: 'home' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  locationFilter === 'home'
                    ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Home size={13} className={locationFilter === 'home' ? 'text-amber-400' : 'text-slate-500'} />
                <span>{lang === 'sk' ? 'Doma' : 'Home'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocationFilter('away');
                  track('league_table_scope', { scope: 'away' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  locationFilter === 'away'
                    ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plane size={13} className={locationFilter === 'away' ? 'text-cyan-400' : 'text-slate-500'} />
                <span>{lang === 'sk' ? 'Vonku' : 'Away'}</span>
              </button>
            </div>

            {/* View Mode Toggle: Kompletná / Kompaktná */}
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex items-center shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setViewMode('full');
                  track('league_table_view', { view: 'full' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'full'
                    ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{lang === 'sk' ? 'Kompletná' : 'Detailed'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('compact');
                  track('league_table_view', { view: 'compact' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'compact'
                    ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{lang === 'sk' ? 'Kompaktná' : 'Compact'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Standings Table Container */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0 md:table-auto">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider font-bold">
                {/* 1. Pos - Sticky */}
                {renderTh('pos', '#', 'text-center', 'w-10 sm:w-12 sticky left-0 z-30 bg-slate-900 border-r border-slate-700')}

                {/* 2. Team - Sticky */}
                {renderTh('team', lang === 'sk' ? 'Klub' : 'Club', 'text-left', 'w-32 sm:w-44 md:w-56 sticky left-10 sm:left-12 z-30 bg-slate-900 border-r border-slate-700 shadow-[2px_0_6px_rgba(0,0,0,0.35)]')}

                {/* 3. Matches Played */}
                {renderTh('played', lang === 'sk' ? 'Z' : 'MP', 'text-center', 'w-10 sm:w-12')}

                {/* Full View Detailed Stats */}
                {viewMode === 'full' && (
                  <>
                    {renderTh('win', lang === 'sk' ? 'V' : 'W', 'text-center text-emerald-400', 'w-10 sm:w-12')}
                    {renderTh('draw', lang === 'sk' ? 'R' : 'D', 'text-center text-slate-400', 'w-10 sm:w-12')}
                    {renderTh('loss', lang === 'sk' ? 'P' : 'L', 'text-center text-rose-400', 'w-10 sm:w-12')}
                    {renderTh('score', lang === 'sk' ? 'Skóre' : 'GF:GA', 'text-center font-mono', 'w-16 sm:w-20 hidden sm:table-cell')}
                  </>
                )}

                {/* Goal Difference */}
                {renderTh('gd', lang === 'sk' ? 'GD' : 'GD', 'text-center font-mono', 'w-12 sm:w-16')}

                {/* Points */}
                {renderTh('pts', lang === 'sk' ? 'Body' : 'PTS', 'text-center text-white font-bold', 'w-14 sm:w-16 bg-slate-900/90')}

                {/* Form (Last 5) */}
                {renderTh('form', lang === 'sk' ? 'Forma (5)' : 'Form (5)', 'text-center', 'w-36 sm:w-44')}

                {/* Next Match */}
                {renderTh('next', lang === 'sk' ? 'Najbližší zápas' : 'Next Match', 'text-center', 'w-28 sm:w-36')}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-700/50 text-[11px] md:text-sm">
              {tableData.map((row, idx) => {
                const pos = idx + 1;
                const nextMatch = nextFixtureMap[row.id];
                const last5 = row.form.slice(-5).reverse();

                const isSourceTeam = hoveredForm?.teamId === row.id;
                const isOpponentTeam = hoveredForm?.opponentId === row.id;

                // Flashscore Qualification Zone left borders (applied in overall mode)
                let zoneBorder = 'border-l-[3px] border-l-transparent';
                if (locationFilter === 'all') {
                  if (pos <= 4) {
                    zoneBorder = 'border-l-[3px] border-l-blue-500'; // Champions League
                  } else if (pos === 5) {
                    zoneBorder = 'border-l-[3px] border-l-amber-500'; // Europa League
                  } else if (pos === 6 || pos === 7) {
                    zoneBorder = 'border-l-[3px] border-l-emerald-500'; // Conference League
                  } else if (pos >= 18) {
                    zoneBorder = 'border-l-[3px] border-l-rose-500'; // Relegation
                  }
                }

                // Sticky cell backgrounds matching highlight state
                const stickyBg = (isOpponentTeam || isSourceTeam)
                  ? 'bg-slate-700/95 text-white'
                  : 'bg-slate-800 group-hover:bg-slate-700 text-slate-200';

                const rowHighlightClass = (isOpponentTeam || isSourceTeam)
                  ? 'bg-slate-700/40 transition-colors'
                  : 'hover:bg-slate-700/30 transition-colors group';

                const cellBgClass = isOpponentTeam ? 'bg-slate-700/30' : '';

                return (
                  <tr
                    key={row.id}
                    className={rowHighlightClass}
                  >
                    {/* Rank (#) - Sticky Left with Flashscore Zone Accent */}
                    <td
                      className={`py-2.5 px-1 sm:px-2 text-center sticky left-0 z-20 transition-colors border-b border-slate-700/50 border-r border-slate-700 ${stickyBg} ${zoneBorder}`}
                    >
                      <span className="font-mono font-bold text-xs md:text-sm">
                        {pos}
                      </span>
                    </td>

                    {/* Team Name & Crest - Sticky Left */}
                    <td
                      className={`py-2.5 px-2.5 sm:px-3 font-bold text-white sticky left-10 sm:left-12 z-20 transition-colors border-b border-slate-700/50 border-r border-slate-700 shadow-[2px_0_6px_rgba(0,0,0,0.25)] truncate ${stickyBg}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamIcon code={row.short_name} alt={row.name} size={20} />
                        <span className="hidden sm:inline truncate">{row.name}</span>
                        <span className="sm:hidden truncate">{row.short_name}</span>

                        {/* Opponent highlight indicator pill */}
                        {isOpponentTeam && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-600/80 shrink-0">
                            {lang === 'sk' ? 'SÚPER' : 'OPPONENT'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Matches Played */}
                    <td className={`py-2.5 px-2 text-center text-slate-300 border-b border-slate-700/50 font-mono ${cellBgClass}`}>
                      {row.played}
                    </td>

                    {/* Full View Columns */}
                    {viewMode === 'full' && (
                      <>
                        <td className={`py-2.5 px-2 text-center text-emerald-400 border-b border-slate-700/50 font-mono font-semibold ${cellBgClass}`}>
                          {row.win}
                        </td>
                        <td className={`py-2.5 px-2 text-center text-slate-400 border-b border-slate-700/50 font-mono ${cellBgClass}`}>
                          {row.draw}
                        </td>
                        <td className={`py-2.5 px-2 text-center text-rose-400 border-b border-slate-700/50 font-mono ${cellBgClass}`}>
                          {row.loss}
                        </td>
                        <td className={`py-2.5 px-2 text-center text-slate-300 border-b border-slate-700/50 font-mono hidden sm:table-cell ${cellBgClass}`}>
                          {row.gf}:{row.ga}
                        </td>
                      </>
                    )}

                    {/* Goal Difference */}
                    <td className={`py-2.5 px-2 text-center border-b border-slate-700/50 font-mono ${cellBgClass}`}>
                      <span
                        className={`font-semibold ${
                          row.gf - row.ga > 0
                            ? 'text-emerald-400'
                            : row.gf - row.ga < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.gf - row.ga > 0 ? '+' : ''}
                        {row.gf - row.ga}
                      </span>
                    </td>

                    {/* Points */}
                    <td className={`py-2.5 px-2 text-center border-b border-slate-700/50 font-mono font-black text-white text-xs md:text-base ${
                      isOpponentTeam ? 'bg-slate-700/50' : 'bg-slate-900/30'
                    }`}>
                      {row.pts}
                    </td>

                    {/* Form Pills (Flashscore Style) */}
                    <td className={`py-2.5 px-2 md:px-3 text-center border-b border-slate-700/50 ${cellBgClass}`}>
                      <div className="flex items-center justify-center gap-1">
                        {last5.length === 0 ? (
                          <span className="text-slate-500 text-xs font-mono">—</span>
                        ) : (
                          last5.map((match, mIdx) => {
                            const oppTeam = getTeamObj(match.opponent);
                            const oppName = oppTeam?.name || 'Opponent';

                            let pillColor = 'bg-slate-600 text-slate-100 border-slate-500';
                            let pillLabel = lang === 'sk' ? 'R' : 'D';

                            if (match.result === 'W') {
                              pillColor = 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500';
                              pillLabel = lang === 'sk' ? 'V' : 'W';
                            } else if (match.result === 'L') {
                              pillColor = 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500';
                              pillLabel = lang === 'sk' ? 'P' : 'L';
                            }

                            return (
                              <button
                                key={mIdx}
                                type="button"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredForm({
                                    teamId: row.id,
                                    opponentId: match.opponent,
                                    teamName: row.name,
                                    opponentName: oppName,
                                    score: match.score,
                                    result: match.result,
                                    isHome: match.isHome,
                                    date: match.date,
                                    event: match.event,
                                    rect
                                  });
                                }}
                                onMouseLeave={() => setHoveredForm(null)}
                                className={`w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold border shadow-xs transition-transform hover:scale-110 active:scale-95 cursor-default ${pillColor}`}
                              >
                                {pillLabel}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </td>

                    {/* Next Match Fixture Badge */}
                    <td className={`py-2.5 px-2 text-center border-b border-slate-700/50 ${cellBgClass}`}>
                      {nextMatch ? (
                        <div
                          title={`GW${nextMatch.event || ''} vs ${nextMatch.opponentName} (${nextMatch.isHome ? 'H' : 'A'})`}
                          className="inline-flex items-center justify-center"
                        >
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] sm:text-xs font-bold border transition-colors ${getFdrColorClasses(
                              nextMatch.difficulty
                            )}`}
                          >
                            {nextMatch.opponentShort} ({nextMatch.isHome ? (lang === 'sk' ? 'D' : 'H') : (lang === 'sk' ? 'V' : 'A')})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs font-mono">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Flashscore Zone Legend at bottom */}
        {locationFilter === 'all' && (
          <div className="bg-slate-900/70 p-3.5 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block shadow-sm" />
                <span>{lang === 'sk' ? 'Liga majstrov (1. – 4.)' : 'Champions League (1-4)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block shadow-sm" />
                <span>{lang === 'sk' ? 'Európska liga (5.)' : 'Europa League (5)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block shadow-sm" />
                <span>{lang === 'sk' ? 'Konferenčná liga (6. – 7.)' : 'Conference League (6-7)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block shadow-sm" />
                <span>{lang === 'sk' ? 'Zostup (18. – 20.)' : 'Relegation (18-20)'}</span>
              </div>
            </div>

            <div className="text-slate-500 text-[10px] font-mono">
              {lang === 'sk'
                ? 'Forma (zľava najnovší zápas): V = Výhra • R = Remíza • P = Prehra'
                : 'Form (newest on left): W = Win • D = Draw • L = Loss'}
            </div>
          </div>
        )}
      </div>

      {/* Floating Header Metric Explainer Tooltip */}
      {hoveredMetric && (() => {
        const isNearTop = hoveredMetric.rect.top < 240;
        const leftPos = Math.max(
          160,
          Math.min(
            (typeof window !== 'undefined' ? window.innerWidth : 1000) - 160,
            hoveredMetric.rect.left + hoveredMetric.rect.width / 2
          )
        );

        return (
          <div
            style={{
              position: 'fixed',
              left: leftPos,
              top: isNearTop ? hoveredMetric.rect.bottom + 10 : hoveredMetric.rect.top - 10,
              transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
            }}
            className="z-[9999] pointer-events-none w-72 sm:w-80 p-3.5 bg-slate-900/98 backdrop-blur-md text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 text-left normal-case font-normal select-none transition-all duration-150 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="font-bold text-white text-xs">{hoveredMetric.label}</span>
              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {hoveredMetric.abbr}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300 whitespace-normal">
              {hoveredMetric.description}
            </p>
            {hoveredMetric.tip && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 bg-slate-950/50 -mx-1 p-2 rounded-lg border border-slate-800/60">
                <div className="flex items-start gap-1.5 text-[10.5px] leading-snug text-amber-200/90 font-medium">
                  <Sparkles size={12} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{hoveredMetric.tip}</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Floating Form Match Details Tooltip */}
      {hoveredForm && (() => {
        const isNearTop = hoveredForm.rect.top < 160;
        const leftPos = Math.max(
          140,
          Math.min(
            (typeof window !== 'undefined' ? window.innerWidth : 1000) - 140,
            hoveredForm.rect.left + hoveredForm.rect.width / 2
          )
        );

        const outcomeText =
          hoveredForm.result === 'W'
            ? lang === 'sk' ? 'Výhra' : 'Win'
            : hoveredForm.result === 'L'
            ? lang === 'sk' ? 'Prehra' : 'Loss'
            : lang === 'sk' ? 'Remíza' : 'Draw';

        const venueText = hoveredForm.isHome
          ? lang === 'sk' ? 'Doma' : 'Home'
          : lang === 'sk' ? 'Vonku' : 'Away';

        return (
          <div
            style={{
              position: 'fixed',
              left: leftPos,
              top: isNearTop ? hoveredForm.rect.bottom + 8 : hoveredForm.rect.top - 8,
              transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
            }}
            className="z-[9999] pointer-events-none w-56 p-2.5 bg-slate-900/98 backdrop-blur-md text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 text-left select-none animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-white mb-1">
              <span className="truncate max-w-[120px]">{hoveredForm.teamName}</span>
              <span className="text-slate-400 font-mono text-[10px]">
                {hoveredForm.event ? `GW${hoveredForm.event}` : ''}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 flex items-center justify-between py-1 border-y border-slate-800 my-1">
              <span>vs {hoveredForm.opponentName}</span>
              <span className="font-mono font-black text-white px-1.5 py-0.2 bg-slate-800 rounded">
                {hoveredForm.score}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span
                className={`font-bold ${
                  hoveredForm.result === 'W'
                    ? 'text-emerald-400'
                    : hoveredForm.result === 'L'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {outcomeText} ({venueText})
              </span>
              {hoveredForm.date && (
                <span>{new Date(hoveredForm.date).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</span>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LeagueTable;
