import React, { useMemo, useState } from 'react';
import { FPLTeam, FPLFixture } from '../types';
import {
  TrendingUp,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
  Flame,
  Target,
  Sparkles,
  Award,
  Zap,
  BarChart3,
  Calendar
} from 'lucide-react';
import TwoPanelTable from './TwoPanelTable';
import ResultChip from './ResultChip';
import { track } from '@/lib/ga';
import { TeamIcon } from './TeamIcon';
import { useLanguage, Language } from '../lib/language';

interface TeamAnalysisProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

interface TeamPeriodStats {
  id: number;
  name: string;
  short_name: string;
  played: number;
  scored: number;
  conceded: number;
  cleanSheets: number;
  failedToScore: number;
  results: { opponent: number; score: string; result: 'W' | 'D' | 'L'; isHome: boolean }[];
}

// Tooltip metric descriptions and tactical interpretation tips for Team Analysis
const teamMetricDescriptions: Record<string, {
  label: (lang: Language) => string;
  abbr: string;
  description: (lang: Language) => string;
  tip?: (lang: Language) => string;
}> = {
  rank: {
    label: (lang) => lang === 'sk' ? 'Ligové poradie formy' : 'Form Rank',
    abbr: 'RANK',
    description: (lang) => lang === 'sk'
      ? 'Poradie tímu v Premier League podľa zvolenej kategórie (útok alebo obrana) v sledovanom období.'
      : 'Team rank based on selected category (attack or defense) over the analyzed period.',
    tip: (lang) => lang === 'sk'
      ? 'Top 3 tímy sú zvýraznené medailami. Tímy na spodku rebríčka obrany sú ideálnym terčom pre kapitána vášho tímu.'
      : 'Top 3 teams represent the current form leaders. Bottom defensive teams are prime targets for your captain.'
  },
  team: {
    label: (lang) => lang === 'sk' ? 'Klub Premier League' : 'Club',
    abbr: 'TEAM',
    description: (lang) => lang === 'sk'
      ? 'Oficiálny názov a erb tímu Premier League.'
      : 'Premier League club crest and name.'
  },
  games: {
    label: (lang) => lang === 'sk' ? 'Odohrané zápasy' : 'Matches Played',
    abbr: 'MP',
    description: (lang) => lang === 'sk'
      ? 'Počet skutočne odohraných ligových zápasov v sledovanom časovom okne (zohľadňuje aj odložené či predohrávané kolá).'
      : 'Number of finished matches in the selected window.'
  },
  scored: {
    label: (lang) => lang === 'sk' ? 'Strelené góly' : 'Goals Scored',
    abbr: 'GF',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet strelených gólov tímom v analyzovanom období zápasov.'
      : 'Total goals scored by the team in this period.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Vysoký počet gólov signalizuje, že tím tvorí množstvo šancí a FPL bodov pre ofenzívnych hráčov.'
      : 'How to read: High goal tallies reflect consistent chance creation and attacking FPL returns.'
  },
  gs_per_game: {
    label: (lang) => lang === 'sk' ? 'Priemer strelených gólov na zápas' : 'Goals Scored Per Game',
    abbr: 'GS/G',
    description: (lang) => lang === 'sk'
      ? 'Priemerný počet strelených gólov na jeden zápas (Góly / Odohrané zápasy).'
      : 'Average goals scored per match.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Hodnota 2.00+ gólu na zápas predstavuje elitnú palebnú silu. Hráči týchto tímov by mali byť základom vašej ofenzívy.'
      : 'How to read: Scores of 2.00+ represent elite attacking power and must-have attacking picks.'
  },
  fts: {
    label: (lang) => lang === 'sk' ? 'Zápasy bez gólu (Failed to Score)' : 'Failed To Score',
    abbr: 'FTS',
    description: (lang) => lang === 'sk'
      ? 'Počet zápasov, v ktorých tím nestrelil ani jeden gól (vyšiel naprázdno).'
      : 'Matches in which the team failed to score any goals.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Tímy s 0 FTS skórujú v každom zápase! Naopak tímy s vysokým FTS sú rizikové pre útočníkov a lákavé pre čisté konto brankárov súpera.'
      : 'How to read: Teams with 0 FTS return attacking points in every fixture.'
  },
  conceded: {
    label: (lang) => lang === 'sk' ? 'Inkasované góly' : 'Goals Conceded',
    abbr: 'GA',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet inkasovaných gólov v analyzovanom období zápasov.'
      : 'Total goals conceded by the team in this period.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Čím menej gólov tím inkasuje, tým stabilnejšie čisté kontá prináša pre ich obrancov a brankára.'
      : 'How to read: Fewer goals conceded translates directly into clean sheet reliability.'
  },
  gc_per_game: {
    label: (lang) => lang === 'sk' ? 'Priemer inkasovaných gólov na zápas' : 'Goals Conceded Per Game',
    abbr: 'GC/G',
    description: (lang) => lang === 'sk'
      ? 'Priemerný počet inkasovaných gólov na jeden zápas (Inkasované / Odohrané zápasy).'
      : 'Average goals conceded per match.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Hodnota pod 0.80 znamená nepriepustnú defenzívu. Hodnota nad 1.80 označuje deravú obranu – ideálny terč na nasadenie kapitána!'
      : 'How to read: Values under 0.80 indicate rock-solid defense; over 1.80 marks prime captaincy targets.'
  },
  cs: {
    label: (lang) => lang === 'sk' ? 'Čisté kontá tímu' : 'Clean Sheets',
    abbr: 'CS',
    description: (lang) => lang === 'sk'
      ? 'Počet zápasov, v ktorých tím udržal čisté konto a neinkasoval ani jeden gól.'
      : 'Matches where the team kept a clean sheet without conceding.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Každé čisté konto prináša brankárovi a obrancom až 4 body. Tímy s 3+ CS v sérii sú základom defenzívnej rotácie.'
      : 'How to read: Clean sheets award 4 pts each to defenders and keepers.'
  },
  gd: {
    label: (lang) => lang === 'sk' ? 'Gólový rozdiel' : 'Goal Difference',
    abbr: 'GD',
    description: (lang) => lang === 'sk'
      ? 'Rozdiel medzi strelenými a inkasovanými gólmi tímu (+/-).'
      : 'Goal difference across analyzed matches (+/-).',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Kladné číslo značí hernú prevahu a celkovú dominanciu tímu v danom období.'
      : 'How to read: Positive values denote overall match dominance.'
  },
  history: {
    label: (lang) => lang === 'sk' ? 'Zápasová história' : 'Match History',
    abbr: 'FORM',
    description: (lang) => lang === 'sk'
      ? 'Výsledky posledných zápasov tímu (zelená = výhra, sivá = remíza, červená = prehra) so skóre a kódom súpera.'
      : 'Recent match results (Green = Win, Grey = Draw, Red = Loss) with scores and opponent codes.',
    tip: (lang) => lang === 'sk'
      ? 'Ako chápať: Sledujte nielen výhru/prehru, ale aj silu súperov a počet gólov v jednotlivých zápasoch.'
      : 'How to read: Evaluate both outcomes and the defensive strength of opposition faced.'
  }
};

const TeamAnalysis: React.FC<TeamAnalysisProps> = ({ teams, fixtures }) => {
  const [lang] = useLanguage();
  const [activeTab, setActiveTab] = useState<'ATTACK' | 'DEFENSE'>('ATTACK');
  const [matchCount, setMatchCount] = useState<3 | 5 | 8>(5);
  const [mobileView, setMobileView] = useState<'STATS' | 'FORM'>('STATS');
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [hoveredMetric, setHoveredMetric] = useState<{
    label: string;
    abbr: string;
    description: string;
    tip?: string;
    rect: DOMRect;
  } | null>(null);

  // 1. Calculate Stats for Last N Matches
  const stats = useMemo(() => {
    const finishedFixtures = fixtures
      .filter((f) => {
        const hasKickoff = Boolean(f.kickoff_time);
        const hasScore =
          f.team_h_score !== null && f.team_h_score !== undefined &&
          f.team_a_score !== null && f.team_a_score !== undefined;
        return hasKickoff && (f.finished === true || hasScore);
      })
      .sort(
        (a, b) =>
          new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime()
      );

    if (finishedFixtures.length === 0) return [];

    const teamStatsMap: Record<number, TeamPeriodStats> = {};

    teams.forEach(t => {
      teamStatsMap[t.id] = {
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        played: 0,
        scored: 0,
        conceded: 0,
        cleanSheets: 0,
        failedToScore: 0,
        results: []
      };
    });

    teams.forEach(t => {
      const teamFixtures = finishedFixtures
        .filter(f => f.team_h === t.id || f.team_a === t.id)
        .slice(0, matchCount);

      teamFixtures.forEach(f => {
        const s = teamStatsMap[t.id];
        const isHome = f.team_h === t.id;
        const gf = isHome ? (f.team_h_score ?? 0) : (f.team_a_score ?? 0);
        const ga = isHome ? (f.team_a_score ?? 0) : (f.team_h_score ?? 0);
        const opponent = isHome ? f.team_a : f.team_h;

        s.played++;
        s.scored += gf;
        s.conceded += ga;

        if (ga === 0) s.cleanSheets++;
        if (gf === 0) s.failedToScore++;

        let res: 'W' | 'D' | 'L' = 'D';
        if (gf > ga) res = 'W';
        if (gf < ga) res = 'L';

        s.results.push({
          opponent,
          score: `${gf}-${ga}`,
          result: res,
          isHome
        });
      });
    });

    return Object.values(teamStatsMap);
  }, [teams, fixtures, matchCount]);

  // 2. Sort Data based on Active Tab
  const sortedData = useMemo(() => {
    return [...stats].sort((a, b) => {
      if (activeTab === 'ATTACK') {
        const aGPG = a.scored / (a.played || 1);
        const bGPG = b.scored / (b.played || 1);
        if (bGPG !== aGPG) return bGPG - aGPG;
        return b.scored - a.scored;
      } else {
        const aGCPG = a.conceded / (a.played || 1);
        const bGCPG = b.conceded / (b.played || 1);
        if (aGCPG !== bGCPG) return aGCPG - bGCPG; // Lower is better
        return b.cleanSheets - a.cleanSheets;
      }
    });
  }, [stats, activeTab]);

  // Max value in league for progress bar scaling
  const maxMetricPerGame = useMemo(() => {
    if (sortedData.length === 0) return 2.5;
    if (activeTab === 'ATTACK') {
      const vals = sortedData.map(t => t.played > 0 ? t.scored / t.played : 0);
      return Math.max(...vals, 2.5);
    } else {
      const vals = sortedData.map(t => t.played > 0 ? t.conceded / t.played : 0);
      return Math.max(...vals, 2.5);
    }
  }, [sortedData, activeTab]);

  // Top 3 Highlights for KPI cards
  const highlights = useMemo(() => {
    if (stats.length === 0) return null;

    // Best attack: highest scored / played
    const bestAttack = [...stats].sort((a, b) => {
      const aG = a.scored / (a.played || 1);
      const bG = b.scored / (b.played || 1);
      return bG - aG || b.scored - a.scored;
    })[0];

    // Best defense: lowest conceded / played
    const bestDefense = [...stats].sort((a, b) => {
      const aGC = a.conceded / (a.played || 1);
      const bGC = b.conceded / (b.played || 1);
      return aGC - bGC || b.cleanSheets - a.cleanSheets;
    })[0];

    // Worst defense (Captain Target): highest conceded / played
    const worstDefense = [...stats].sort((a, b) => {
      const aGC = a.conceded / (a.played || 1);
      const bGC = b.conceded / (b.played || 1);
      return bGC - aGC || a.cleanSheets - b.cleanSheets;
    })[0];

    return { bestAttack, bestDefense, worstDefense };
  }, [stats]);

  const getTeamShort = (id: number) => teams.find(t => t.id === id)?.short_name || 'UNK';

  const renderTh = (
    key: string,
    displayLabel: string,
    alignClass: string = 'text-center',
    extraClass: string = ''
  ) => {
    const metric = teamMetricDescriptions[key];
    return (
      <th
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
        className={`py-3 px-3 md:px-5 font-bold cursor-help transition-colors select-none border-b border-slate-700 ${alignClass} ${extraClass}`}
      >
        <span className="border-b border-dotted border-slate-600/70 hover:border-blue-400 transition-colors">
          {displayLabel}
        </span>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Main Header Card with Controls */}
      <div className="bg-slate-800 p-5 md:p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              {activeTab === 'ATTACK' ? (
                <TrendingUp className="text-emerald-400 shrink-0" />
              ) : (
                <Shield className="text-cyan-400 shrink-0" />
              )}
              <span>{lang === 'sk' ? 'Analýza tímovej formy' : 'Team Form Analysis'}</span>
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              {lang === 'sk' ? (
                <>
                  Hodnotenie výkonnosti tímov za posledných <strong className="text-white">{matchCount} zápasov</strong>.
                </>
              ) : (
                <>
                  Analyzing performance over the <strong className="text-white">Last {matchCount} Matches</strong>.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* Horizon Filter: 3 / 5 / 8 Matches */}
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-2 hidden sm:inline">
                {lang === 'sk' ? 'Zápasy:' : 'Matches:'}
              </span>
              {([3, 5, 8] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMatchCount(count)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    matchCount === count
                      ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count} {lang === 'sk' ? 'Z' : 'M'}
                </button>
              ))}
            </div>

            {/* Attack / Defense Category Toggle */}
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ATTACK');
                  track('team_analysis_interaction', { action: 'select_tab', tab: 'ATTACK' });
                }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                  activeTab === 'ATTACK'
                    ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp size={14} className={activeTab === 'ATTACK' ? 'text-emerald-400' : 'text-slate-400'} />
                <span>{lang === 'sk' ? 'Útok' : 'Attacking'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('DEFENSE');
                  track('team_analysis_interaction', { action: 'select_tab', tab: 'DEFENSE' });
                }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                  activeTab === 'DEFENSE'
                    ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield size={14} className={activeTab === 'DEFENSE' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>{lang === 'sk' ? 'Obrana' : 'Defensive'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Info Guide */}
        <div className="mt-4 pt-3 border-t border-slate-700/60">
          <button
            onClick={() => setInfoExpanded(!infoExpanded)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold group"
          >
            <Info size={14} className="text-blue-400" />
            <span>{lang === 'sk' ? 'Ako čítať tímové metriky a FPL tipy' : 'About these metrics & FPL insights'}</span>
            {infoExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {infoExpanded && (
            <div className="mt-3 bg-slate-900/90 border border-slate-700/80 p-3.5 rounded-xl text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5">
                <Flame className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <strong className="text-white block mb-0.5">
                    {lang === 'sk' ? 'Útočný potenciál (GS/G & FTS)' : 'Attacking Firepower (GS/G & FTS)'}
                  </strong>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    {lang === 'sk'
                      ? 'Zelené čísla (2.0+ gólu na zápas) značia elitnú ofenzívu. Sledujte aj FTS (Failed to score) – tímy s 0 FTS takmer garantujú body útočníkov v každom kole.'
                      : 'Green numbers (2.0+ goals per game) indicate elite attacking form. Teams with 0 FTS consistently return points in every gameweek.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Target className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <strong className="text-white block mb-0.5">
                    {lang === 'sk' ? 'Kapitánske terče a obrana (GC/G & CS)' : 'Defensive Solidity & Captain Targets'}
                  </strong>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    {lang === 'sk'
                      ? 'Tímy s GC/G pod 0.8 sú ideálne pre čisté kontá obrancov. Naopak tímy s GC/G nad 1.8 inkasujú najviac a slúžia ako ideálny terč pre vášho kapitána!'
                      : 'Teams conceding under 0.8 are prime clean sheet sources. Teams conceding 1.8+ represent prime targets to captain against.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top 3 KPI Summary Cards */}
      {highlights && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Best Attack Card */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-850 to-slate-800 p-4 rounded-xl border border-emerald-500/30 shadow-md flex items-center gap-3.5 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <TeamIcon code={highlights.bestAttack.short_name} alt={highlights.bestAttack.name} size={30} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Flame size={12} /> {lang === 'sk' ? 'Najlepší útok' : 'Top Attack'}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  #1
                </span>
              </div>
              <h4 className="text-base font-bold text-white truncate leading-tight">
                {highlights.bestAttack.name}
              </h4>
              <div className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-2">
                <strong className="text-emerald-400 font-bold">
                  {(highlights.bestAttack.scored / (highlights.bestAttack.played || 1)).toFixed(2)} {lang === 'sk' ? 'gólu/zápas' : 'GS/G'}
                </strong>
                <span className="text-[10px] text-slate-500">
                  ({highlights.bestAttack.scored} {lang === 'sk' ? 'gólov' : 'goals'})
                </span>
              </div>
            </div>
          </div>

          {/* 2. Best Defense Card */}
          <div className="bg-gradient-to-br from-cyan-950/40 via-slate-850 to-slate-800 p-4 rounded-xl border border-cyan-500/30 shadow-md flex items-center gap-3.5 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <TeamIcon code={highlights.bestDefense.short_name} alt={highlights.bestDefense.name} size={30} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Shield size={12} /> {lang === 'sk' ? 'Najlepšia obrana' : 'Top Defense'}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  #1
                </span>
              </div>
              <h4 className="text-base font-bold text-white truncate leading-tight">
                {highlights.bestDefense.name}
              </h4>
              <div className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-2">
                <strong className="text-cyan-400 font-bold">
                  {(highlights.bestDefense.conceded / (highlights.bestDefense.played || 1)).toFixed(2)} {lang === 'sk' ? 'ink./zápas' : 'GC/G'}
                </strong>
                <span className="text-[10px] text-slate-500">
                  ({highlights.bestDefense.cleanSheets} {lang === 'sk' ? 'čistých kont' : 'CS'})
                </span>
              </div>
            </div>
          </div>

          {/* 3. Captain Target Card (Leakiest defense) */}
          <div className="bg-gradient-to-br from-rose-950/40 via-slate-850 to-slate-800 p-4 rounded-xl border border-rose-500/30 shadow-md flex items-center gap-3.5 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center shrink-0">
              <TeamIcon code={highlights.worstDefense.short_name} alt={highlights.worstDefense.name} size={30} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1">
                  <Target size={12} /> {lang === 'sk' ? 'Kapitánsky terč' : 'Captain Target'}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                  {lang === 'sk' ? 'Deravá obrana' : 'Leaky Def'}
                </span>
              </div>
              <h4 className="text-base font-bold text-white truncate leading-tight">
                {highlights.worstDefense.name}
              </h4>
              <div className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-2">
                <strong className="text-rose-400 font-bold">
                  {(highlights.worstDefense.conceded / (highlights.worstDefense.played || 1)).toFixed(2)} {lang === 'sk' ? 'ink./zápas' : 'GC/G'}
                </strong>
                <span className="text-[10px] text-slate-500">
                  ({highlights.worstDefense.conceded} {lang === 'sk' ? 'inkasovaných' : 'conceded'})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile View Toggle */}
      <div className="md:hidden flex justify-center mb-2">
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex w-full max-w-[300px]">
          <button
            onClick={() => setMobileView('STATS')}
            className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mobileView === 'STATS'
                ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'sk' ? 'Štatistiky' : 'Stats'}
          </button>
          <button
            onClick={() => setMobileView('FORM')}
            className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mobileView === 'FORM'
                ? 'bg-slate-600/50 text-slate-100 border border-slate-500/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'sk' ? 'Forma' : 'Form'}
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
        {mobileView === 'STATS' ? (
          <div className="w-full overflow-x-hidden md:overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0 md:table-auto">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider font-bold">
                  {renderTh('rank', lang === 'sk' ? 'Por.' : 'Rank', 'text-center', 'w-12 sm:w-16 md:w-20 sticky left-0 z-20 bg-slate-900 border-r border-slate-700')}
                  {renderTh('team', lang === 'sk' ? 'Tím' : 'Team', 'text-left', 'w-24 sm:w-36 md:w-64 sticky left-12 sm:left-16 md:left-20 z-20 bg-slate-900 border-r border-slate-700')}
                  {renderTh('games', lang === 'sk' ? 'Zápasy' : 'Games', 'text-center', 'hidden md:table-cell')}

                  {activeTab === 'ATTACK' ? (
                    <>
                      {renderTh('scored', lang === 'sk' ? 'Góly' : 'Scored', 'text-right', 'w-[20%] sm:w-auto')}
                      {renderTh('gs_per_game', lang === 'sk' ? 'GS / Z' : 'GS/G', 'text-right text-white font-bold', 'w-[30%] sm:w-auto')}
                      {renderTh('fts', lang === 'sk' ? 'Bez gólu (FTS)' : 'FTS', 'text-center', 'hidden md:table-cell')}
                    </>
                  ) : (
                    <>
                      {renderTh('conceded', lang === 'sk' ? 'Inkas.' : 'Conceded', 'text-right', 'w-[20%] sm:w-auto')}
                      {renderTh('gc_per_game', lang === 'sk' ? 'GC / Z' : 'GC/G', 'text-right text-white font-bold', 'w-[30%] sm:w-auto')}
                      {renderTh('cs', lang === 'sk' ? 'Čisté kontá (CS)' : 'CS', 'text-center', 'hidden md:table-cell')}
                    </>
                  )}

                  {renderTh('gd', lang === 'sk' ? 'Rozdiel (GD)' : 'GD', 'text-center font-mono', 'hidden md:table-cell')}
                  {renderTh('history', lang === 'sk' ? 'Zápasová história' : 'Match History', 'text-left pl-6', 'hidden md:table-cell')}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/50">
                {sortedData.map((team, idx) => {
                  const perGame = team.played > 0
                    ? (activeTab === 'ATTACK' ? team.scored / team.played : team.conceded / team.played)
                    : 0;

                  // Relative strength percentage for the visual progress bar
                  const powerPct = activeTab === 'ATTACK'
                    ? Math.min(100, Math.max(10, Math.round((perGame / maxMetricPerGame) * 100)))
                    : Math.min(100, Math.max(10, Math.round((perGame / Math.max(maxMetricPerGame, 2.5)) * 100)));

                  let statColor = 'text-white';
                  let barGradient = 'bg-slate-500';

                  if (activeTab === 'ATTACK') {
                    if (perGame >= 2.0) {
                      statColor = 'text-emerald-400 font-bold';
                      barGradient = 'bg-gradient-to-r from-emerald-500 to-teal-400';
                    } else if (perGame >= 1.4) {
                      statColor = 'text-blue-300 font-semibold';
                      barGradient = 'bg-blue-400';
                    } else if (perGame <= 0.8 && team.played > 0) {
                      statColor = 'text-rose-400';
                      barGradient = 'bg-rose-500/70';
                    }
                  } else {
                    if (perGame <= 0.8 && team.played > 0) {
                      statColor = 'text-emerald-400 font-bold';
                      barGradient = 'bg-gradient-to-r from-emerald-500 to-teal-400';
                    } else if (perGame <= 1.3 && team.played > 0) {
                      statColor = 'text-cyan-300 font-semibold';
                      barGradient = 'bg-cyan-400';
                    } else if (perGame >= 1.8) {
                      statColor = 'text-rose-400 font-bold';
                      barGradient = 'bg-gradient-to-r from-amber-500 to-rose-500';
                    }
                  }

                  const isGold = idx === 0;
                  const isSilver = idx === 1;
                  const isBronze = idx === 2;
                  const isBottom3 = idx >= 17;

                  return (
                    <tr key={team.id} className="hover:bg-slate-700/30 transition-colors group text-[11px] md:text-sm">
                      {/* Rank Cell with Medals / Badges */}
                      <td className="py-2.5 px-3 md:py-3 md:px-5 text-center sticky left-0 z-10 bg-slate-800 transition-colors group-hover:bg-slate-700 border-b border-slate-700/50 border-r border-slate-700">
                        {isGold ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-black text-xs shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                            #1
                          </span>
                        ) : isSilver ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-400/20 text-slate-200 border border-slate-400/40 font-mono font-bold text-xs">
                            #2
                          </span>
                        ) : isBronze ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-700/20 text-amber-400 border border-amber-700/40 font-mono font-bold text-xs">
                            #3
                          </span>
                        ) : isBottom3 && activeTab === 'DEFENSE' ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono font-bold text-xs">
                            #{idx + 1}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Team Name & Crest */}
                      <td className="py-2.5 px-3 md:py-3 md:px-5 font-bold text-white sticky left-12 sm:left-16 md:left-20 z-10 bg-slate-800 transition-colors group-hover:bg-slate-700 border-b border-slate-700/50 truncate border-r border-slate-700">
                        <div className="flex items-center gap-2">
                          <TeamIcon code={team.short_name} alt={team.name} size={22} />
                          <span className="md:hidden truncate">{team.short_name}</span>
                          <span className="hidden md:inline truncate">{team.name}</span>
                        </div>
                      </td>

                      {/* Matches Played */}
                      <td className="py-2.5 px-3 md:py-3 md:px-5 text-center text-slate-300 hidden md:table-cell border-b border-slate-700/50 font-mono">
                        {team.played}
                      </td>

                      {/* ATTACK METRICS */}
                      {activeTab === 'ATTACK' ? (
                        <>
                          <td className="py-2.5 px-3 md:py-3 md:px-5 text-right text-slate-300 border-b border-slate-700/50 font-mono font-semibold">
                            {team.scored}
                          </td>
                          <td className="py-2.5 px-3 md:py-3 md:px-5 text-right border-b border-slate-700/50">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs md:text-sm font-mono ${statColor}`}>
                                {perGame.toFixed(2)}
                              </span>
                              <div className="w-14 sm:w-20 bg-slate-950/70 rounded-full h-1.5 overflow-hidden border border-slate-700/50">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barGradient}`}
                                  style={{ width: `${powerPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 md:py-3 md:px-5 text-center text-slate-400 hidden md:table-cell border-b border-slate-700/50 font-mono">
                            {team.failedToScore === 0 ? (
                              <span className="text-emerald-400 font-bold">0</span>
                            ) : (
                              team.failedToScore
                            )}
                          </td>
                        </>
                      ) : (
                        /* DEFENSE METRICS */
                        <>
                          <td className="py-2.5 px-3 md:py-3 md:px-5 text-right text-slate-300 border-b border-slate-700/50 font-mono font-semibold">
                            {team.conceded}
                          </td>
                          <td className="py-2.5 px-3 md:py-3 md:px-5 text-right border-b border-slate-700/50">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs md:text-sm font-mono ${statColor}`}>
                                {perGame.toFixed(2)}
                              </span>
                              <div className="w-14 sm:w-20 bg-slate-950/70 rounded-full h-1.5 overflow-hidden border border-slate-700/50">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barGradient}`}
                                  style={{ width: `${powerPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 md:py-3 md:px-5 text-center text-slate-400 hidden md:table-cell border-b border-slate-700/50 font-mono">
                            {team.cleanSheets > 0 ? (
                              <span className="text-cyan-400 font-bold">{team.cleanSheets}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Goal Difference */}
                      <td className="py-2.5 px-3 md:py-3 md:px-5 text-center font-mono hidden md:table-cell border-b border-slate-700/50">
                        <span className={`font-bold ${
                          team.scored - team.conceded > 0
                            ? 'text-emerald-400'
                            : team.scored - team.conceded < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}>
                          {team.scored - team.conceded > 0 ? '+' : ''}
                          {team.scored - team.conceded}
                        </span>
                      </td>

                      {/* Match History Chips */}
                      <td className="py-2.5 px-3 md:py-3 md:px-5 pl-6 hidden md:table-cell border-b border-slate-700/50">
                        <div className="flex items-center gap-1.5 flex-row">
                          {team.results.map((res, i) => (
                            <ResultChip
                              key={i}
                              label={getTeamShort(res.opponent)}
                              value={res.score}
                              variant={res.result}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Mobile TwoPanel Alternative View */
          <TwoPanelTable
            rowHeightClass="h-[48px] md:h-[52px]"
            leftHeader={
              <>
                <span className="w-8 sm:w-10 text-center">{lang === 'sk' ? 'Por.' : 'Rank'}</span>
                <span className="ml-2 sm:ml-4 flex-1">{lang === 'sk' ? 'Tím' : 'Team'}</span>
              </>
            }
            rightHeader={lang === 'sk' ? 'Zápasová história (Najnovšie → Najstaršie)' : 'Match History (Newest → Oldest)'}
            rows={sortedData.map((team, idx) => ({
              key: team.id,
              left: (
                <>
                  <span className="w-8 sm:w-10 text-center text-slate-500 font-mono text-[11px] sm:text-sm">
                    #{idx + 1}
                  </span>
                  <div className="ml-2 sm:ml-4 flex-1 min-w-0 flex items-center gap-1.5">
                    <TeamIcon code={team.short_name} alt={team.name} size={18} />
                    <span className="block font-bold text-white text-[11px] sm:text-sm truncate">
                      {team.short_name}
                    </span>
                  </div>
                </>
              ),
              right: (
                <div className="flex items-center gap-1.5 h-full">
                  {team.results.map((res, i) => (
                    <ResultChip
                      key={i}
                      label={getTeamShort(res.opponent)}
                      value={res.score}
                      variant={res.result}
                    />
                  ))}
                </div>
              )
            }))}
          />
        )}
      </div>

      {/* Floating Explanation Tooltip (Identical to TransferPicks & Stats) */}
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
            {/* Arrow pointing to column header */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 border-slate-700 rotate-45 ${
                isNearTop ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r'
              }`}
            />
          </div>
        );
      })()}

    </div>
  );
};

export default TeamAnalysis;
