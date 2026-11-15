import React, { useState, useEffect, useMemo } from 'react';
import { FPLPlayer, FPLTeam, FPLElementSummary, FPLFixture } from '../types';
import { getPlayerSummary, getPlayerImageUrl, getTeamShirtUrl } from '../services/fplService';
import { Top100Snapshot, Top100PlayerSignal } from '../services/top100Service';
import { findTop100Signal } from '../lib/top100Matcher';
import { calculateLeaguePositions, getDynamicDifficulty } from '../lib/fdrModel';
import {
  X,
  Trophy,
  TrendingUp,
  Calendar,
  Activity,
  Award,
  Shield,
  Target,
  Flame,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  ChevronRight,
  ExternalLink,
  Zap,
  Sparkles,
  BarChart3,
  Coins,
  History,
  Info,
  ArrowLeftRight
} from 'lucide-react';
import { useLanguage, Language } from '../lib/language';
import { FortunaMatch } from '../services/oddsSnapshotService';
import { getGoalscorerOdds } from '../lib/goalscorerModel';

interface PlayerDetailModalProps {
  player: FPLPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  teams: FPLTeam[];
  allPlayers?: FPLPlayer[];
  top100Snapshot?: Top100Snapshot | null;
  fixtures?: FPLFixture[];
  oddsData?: FortunaMatch[] | null;
}

const POSITION_NAMES: Record<number, { short: string; full: string; color: string; bg: string; border: string }> = {
  1: { short: 'GKP', full: 'Goalkeeper', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  2: { short: 'DEF', full: 'Defender', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  3: { short: 'MID', full: 'Midfielder', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  4: { short: 'FWD', full: 'Forward', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' },
};

// Tooltip metric descriptions for match log and history table headers
const matchLogMetricDescriptions: Record<string, { label: (lang: Language) => string; abbr: string; description: (lang: Language) => string }> = {
  gw: {
    label: (lang) => lang === 'sk' ? 'Kolo' : 'Gameweek',
    abbr: 'GW',
    description: (lang) => lang === 'sk'
      ? 'Číslo herného kola Premier League (Gameweek).'
      : 'Premier League Gameweek round number.'
  },
  opponent: {
    label: (lang) => lang === 'sk' ? 'Súper & FDR' : 'Opponent & FDR',
    abbr: 'OPP',
    description: (lang) => lang === 'sk'
      ? 'Súper v danom zápase, informácia o domácom (Doma) alebo vonkajšom (Vonku) prostredí a FDR náročnosť zápasu.'
      : 'Opponent team, venue (Home/Away), and FDR (Fixture Difficulty Rating).'
  },
  result: {
    label: (lang) => lang === 'sk' ? 'Výsledok' : 'Result',
    abbr: 'RES',
    description: (lang) => lang === 'sk'
      ? 'Konečný výsledok zápasu: Výhra (W), Remíza (D) alebo Prehra (L).'
      : 'Final match score and outcome: Win (W), Draw (D), or Loss (L).'
  },
  mins: {
    label: (lang) => lang === 'sk' ? 'Minúty' : 'Minutes',
    abbr: 'MINS',
    description: (lang) => lang === 'sk'
      ? 'Počet odohraných minút v zápase (60+ minút garantuje 2 body pre obrancov a brankárov za čisté konto).'
      : 'Minutes played in the match (60+ mins required for clean sheet eligibility).'
  },
  pts: {
    label: (lang) => lang === 'sk' ? 'FPL Body' : 'Points',
    abbr: 'PTS',
    description: (lang) => lang === 'sk'
      ? 'Celkový počet Fantasy bodov získaných hráčom v danom zápase.'
      : 'Total Fantasy Premier League points scored by the player in this match.'
  },
  g: {
    label: (lang) => lang === 'sk' ? 'Góly' : 'Goals',
    abbr: 'G',
    description: (lang) => lang === 'sk'
      ? 'Počet strelených gólov v zápase (Útočník: 4b, Záložník: 5b, Obranca/GKP: 6b).'
      : 'Goals scored in the match (FWD: 4 pts, MID: 5 pts, DEF/GKP: 6 pts).'
  },
  a: {
    label: (lang) => lang === 'sk' ? 'Asistencie' : 'Assists',
    abbr: 'A',
    description: (lang) => lang === 'sk'
      ? 'Počet gólových asistencií v zápase (3 body za asistenciu).'
      : 'Goal assists awarded in this match (3 pts each).'
  },
  cs: {
    label: (lang) => lang === 'sk' ? 'Čisté konto' : 'Clean Sheet',
    abbr: 'CS',
    description: (lang) => lang === 'sk'
      ? 'Čisté konto tímu počas pobytu hráča na ihrisku (min. 60 minút: Obranca/GKP: 4b, Záložník: 1b).'
      : 'Clean sheet awarded if player was on pitch 60+ mins without conceding (DEF/GKP: 4 pts, MID: 1 pt).'
  },
  bonus: {
    label: (lang) => lang === 'sk' ? 'Bonusové body' : 'Bonus Points',
    abbr: 'BONUS',
    description: (lang) => lang === 'sk'
      ? 'Oficiálne bonusové body udelené 3 najlepším hráčom zápasu podľa BPS (1, 2 alebo 3 body).'
      : 'Official FPL bonus points awarded to top performers based on BPS (1, 2, or 3 points).'
  },
  bps: {
    label: (lang) => 'Bonus Points System',
    abbr: 'BPS',
    description: (lang) => lang === 'sk'
      ? 'Systém bodovania výkonu hráčov v zápase (prihrávky, zákroky, vyhraté súboje), ktorý rozhoduje o udelení bonusových bodov.'
      : 'Bonus Points System score based on comprehensive underlying match metrics determining bonus points.'
  },
  xg: {
    label: (lang) => 'Expected Goals',
    abbr: 'xG',
    description: (lang) => lang === 'sk'
      ? 'Očakávané góly: Štatistická pravdepodobnosť, že strelecké pokusy hráča skončia gólom na základe kvality šancí.'
      : 'Expected Goals: Measure of the probability of a shot resulting in a goal based on historical data.'
  },
  xa: {
    label: (lang) => 'Expected Assists',
    abbr: 'xA',
    description: (lang) => lang === 'sk'
      ? 'Očakávané asistencie: Meria kvalitu finálnych prihrávok, ktoré viedli k strelám spoluhráčov.'
      : 'Expected Assists: Quality of passes leading to a teammate shot attempt.'
  },
  xgi: {
    label: (lang) => 'Expected Goal Involvement',
    abbr: 'xGI',
    description: (lang) => lang === 'sk'
      ? 'Kombinované očakávané góly a asistencie (xG + xA). Kľúčový ukazovateľ celkového ofenzívneho potenciálu hráča.'
      : 'Expected Goal Involvement: Combined xG + xA, reflecting overall attacking threat and production.'
  },
  ict: {
    label: (lang) => 'ICT Index',
    abbr: 'ICT',
    description: (lang) => lang === 'sk'
      ? 'Kompozitný index FPL skladajúci sa z Vplyvu (Influence), Kreativity (Creativity) a Hrozby (Threat).'
      : 'Composite FPL index combining Influence, Creativity, and Threat into an overall score.'
  },
  threat: {
    label: (lang) => lang === 'sk' ? 'Threat (Hrozba)' : 'Threat',
    abbr: 'THREAT',
    description: (lang) => lang === 'sk'
      ? 'Schopnosť hráča dostať sa do gólovej príležitosti (strely, dotyky v pokutovom území súpera).'
      : 'Threat: Measure of player goal-threat capacity based on shots and dangerous touches inside the box.'
  },
  creat: {
    label: (lang) => lang === 'sk' ? 'Creativity (Kreativita)' : 'Creativity',
    abbr: 'CREAT',
    description: (lang) => lang === 'sk'
      ? 'Schopnosť pripravovať šance spoluhráčom (kľúčové prihrávky, centry, predfinálne pasy).'
      : 'Creativity: Measure of ability to produce goal-scoring chances for teammates via key passes and crosses.'
  },
  gc: {
    label: (lang) => lang === 'sk' ? 'Inkasované góly' : 'Goals Conceded',
    abbr: 'GC',
    description: (lang) => lang === 'sk'
      ? 'Počet gólov inkasovaných tímom v čase, keď bol hráč na ihrisku (Obrancovia/GKP: -1 bod za každé 2 inkasované góly).'
      : 'Goals conceded by the team while player was on the pitch (DEF/GKP lose 1 pt per 2 goals conceded).'
  },
  saves: {
    label: (lang) => lang === 'sk' ? 'Zákroky brankára' : 'Saves',
    abbr: 'SAVES',
    description: (lang) => lang === 'sk'
      ? 'Počet úspešných zákrokov brankára v zápase (1 bod za každé 3 zákroky).'
      : 'Goalkeeper saves made in the match (1 pt awarded per every 3 saves).'
  },
  price: {
    label: (lang) => lang === 'sk' ? 'Cena hráča' : 'Price',
    abbr: 'PRICE',
    description: (lang) => lang === 'sk'
      ? 'Trhová hodnota hráča v oficiálnej hre Fantasy Premier League v danom kole.'
      : 'Official Fantasy Premier League market price of the player in that gameweek.'
  },
  season: {
    label: (lang) => lang === 'sk' ? 'Sezóna' : 'Season',
    abbr: 'SEASON',
    description: (lang) => lang === 'sk'
      ? 'Ročník Premier League.'
      : 'Premier League season.'
  },
  startCost: {
    label: (lang) => lang === 'sk' ? 'Počiatočná cena' : 'Start Cost',
    abbr: 'START',
    description: (lang) => lang === 'sk'
      ? 'Cena hráča na začiatku daného ročníka Premier League.'
      : 'Player cost at the beginning of that Premier League season.'
  },
  endCost: {
    label: (lang) => lang === 'sk' ? 'Konečná cena' : 'End Cost',
    abbr: 'END',
    description: (lang) => lang === 'sk'
      ? 'Cena hráča na konci daného ročníka Premier League po všetkých cenových pohyboch.'
      : 'Player cost at the conclusion of that Premier League season after all price changes.'
  }
};

// In-memory summary cache for instant re-opening
const summaryCache = new Map<number, FPLElementSummary>();

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  isOpen,
  onClose,
  teams = [],
  allPlayers = [],
  top100Snapshot,
  fixtures = [],
  oddsData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'advanced' | 'past'>('overview');
  const [lang] = useLanguage();
  const [summary, setSummary] = useState<FPLElementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [hoveredMetric, setHoveredMetric] = useState<{
    key: string;
    label: string;
    abbr: string;
    description: string;
    rect: DOMRect;
  } | null>(null);

  useEffect(() => {
    setHoveredMetric(null);
  }, [activeSubTab, isOpen]);

  const renderTh = (
    metricKey: string,
    displayLabel?: React.ReactNode,
    extraClass: string = 'text-center'
  ) => {
    const metric = matchLogMetricDescriptions[metricKey];
    if (!metric) return null;
    const label = metric.label(lang);
    const description = metric.description(lang);
    const shown = displayLabel ?? metric.abbr;

    return (
      <th
        key={metricKey}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoveredMetric({
            key: metricKey,
            label,
            abbr: metric.abbr,
            description,
            rect
          });
        }}
        onMouseLeave={() => setHoveredMetric(null)}
        className={`py-2.5 px-2 font-bold cursor-help transition-colors select-none ${extraClass}`}
      >
        <span className="border-b border-dotted border-slate-600/70 hover:border-blue-400 transition-colors">
          {shown}
        </span>
      </th>
    );
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset & load player summary when opened or player changes
  useEffect(() => {
    if (!isOpen || !player) {
      setSummary(null);
      setError(null);
      setImgError(false);
      return;
    }

    setImgError(false);
    setError(null);
    setActiveSubTab('overview');

    if (summaryCache.has(player.id)) {
      setSummary(summaryCache.get(player.id)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    getPlayerSummary(player.id)
      .then((data) => {
        summaryCache.set(player.id, data);
        setSummary(data);
      })
      .catch((err) => {
        console.error('Failed to load player summary:', err);
        setError('Nepodarilo sa načítať podrobnú históriu hráča z FPL API.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, player]);

  const team = useMemo(() => {
    if (!player) return null;
    return teams?.find?.((t) => t.id === player.team) || null;
  }, [player, teams]);

  const posInfo = useMemo(() => {
    if (!player) return POSITION_NAMES[1];
    return POSITION_NAMES[player.element_type] || POSITION_NAMES[1];
  }, [player]);

  // Top 100 Signal
  const top100Signal: Top100PlayerSignal | null = useMemo(() => {
    if (!player || !top100Snapshot) return null;
    return findTop100Signal(player, top100Snapshot);
  }, [player, top100Snapshot]);

  // Top 100 Template Tier if available
  const templateTier = useMemo(() => {
    if (!player?.web_name || !top100Snapshot?.templateAnalysis?.templateTiers) return null;
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const playerNorm = norm(player.web_name);
    if (!playerNorm || playerNorm.length < 2) return null;
    return top100Snapshot.templateAnalysis.templateTiers.find((t) => {
      if (!t?.player) return false;
      const tNorm = norm(t.player);
      if (!tNorm || tNorm.length < 2) return false;
      return tNorm.includes(playerNorm) || playerNorm.includes(tNorm);
    }) || null;
  }, [player, top100Snapshot]);

  // Upcoming 5-6 fixtures using Dynamic FDR consistent with Transfer Picks & Dashboard
  const upcomingFixtures = useMemo(() => {
    if (!player) return [];

    const leaguePositions = (teams && fixtures) ? calculateLeaguePositions(teams, fixtures) : {};

    // 1. If fixtures array is available, sort and get next 6
    if (fixtures && Array.isArray(fixtures) && fixtures.length > 0) {
      return fixtures
        .filter((f) => f && !f.finished && (f.team_h === player.team || f.team_a === player.team))
        .sort((a, b) => (a.event || 99) - (b.event || 99))
        .slice(0, 6)
        .map((f) => {
          const isHome = f.team_h === player.team;
          const oppId = isHome ? f.team_a : f.team_h;
          const oppTeam = teams?.find?.((t) => t.id === oppId);

          let difficulty = 3;
          if (allPlayers && allPlayers.length > 0) {
            const dynamicData = getDynamicDifficulty(
              oppId,
              allPlayers,
              leaguePositions,
              !isHome,
              oppTeam?.strength
            );
            difficulty = dynamicData.score;
          } else {
            difficulty = isHome ? (f.team_h_difficulty || 3) : (f.team_a_difficulty || 3);
          }

          return {
            id: f.id,
            event: f.event,
            isHome,
            opponentShort: oppTeam?.short_name || (isHome ? `T${f.team_a}` : `T${f.team_h}`),
            opponentName: oppTeam?.name || 'Unknown',
            difficulty,
            kickoffTime: f.kickoff_time,
          };
        });
    }

    // 2. Fallback to summary.fixtures
    if (summary?.fixtures && Array.isArray(summary.fixtures) && summary.fixtures.length > 0) {
      return summary.fixtures
        .filter((f: any) => f && !f.finished)
        .slice(0, 6)
        .map((f: any) => {
          const isHome = Boolean(f.is_home);
          const oppId = isHome ? f.team_a : f.team_h;
          const oppTeam = teams?.find?.((t) => t.id === oppId);
          let difficulty = f.difficulty || 3;
          if (allPlayers && allPlayers.length > 0) {
            const dynamicData = getDynamicDifficulty(
              oppId,
              allPlayers,
              leaguePositions,
              !isHome,
              oppTeam?.strength
            );
            difficulty = dynamicData.score;
          }
          return {
            id: f.id,
            event: f.event,
            isHome,
            opponentShort: oppTeam?.short_name || (isHome ? `T${f.team_a}` : `T${f.team_h}`),
            opponentName: oppTeam?.name || 'Unknown',
            difficulty,
            kickoffTime: f.kickoff_time,
          };
        });
    }

    return [];
  }, [player, summary?.fixtures, fixtures, teams, allPlayers]);

  if (!isOpen || !player) return null;

  const pointsHistory = Array.isArray(summary?.history) ? summary.history : [];
  const pastSeasons = Array.isArray(summary?.history_past) ? summary.history_past : [];

  const getDifficultyColor = (score: number) => {
    switch (score) {
      case 1:
        return 'bg-green-600 text-white border-green-700'; // Easy
      case 2:
        return 'bg-green-500 text-white border-green-600'; // Good
      case 3:
        return 'bg-slate-500 text-white border-slate-600'; // Moderate
      case 4:
        return 'bg-orange-500 text-white border-orange-600'; // Hard
      case 5:
        return 'bg-red-600 text-white border-red-700'; // Very Hard
      case 6:
        return 'bg-slate-900 text-slate-500 border-slate-800'; // Blank
      default:
        return 'bg-slate-800 text-white border-slate-700';
    }
  };

  // Calculate highest & average gameweek points
  const maxGwPoints = pointsHistory.reduce((max, h) => Math.max(max, h.total_points), 0);
  const avgGwPoints = pointsHistory.length > 0
    ? (pointsHistory.reduce((sum, h) => sum + h.total_points, 0) / pointsHistory.length).toFixed(1)
    : '0';

  const getPointsBadgeClass = (pts: number) => {
    if (pts >= 10) return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.25)] font-black';
    if (pts >= 6) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
    if (pts >= 3) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  const getResultBadge = (h: { was_home: boolean; team_h_score: number | null; team_a_score: number | null }) => {
    if (h.team_h_score === null || h.team_a_score === null || h.team_h_score === undefined || h.team_a_score === undefined) {
      return { text: '-', cls: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
    const scored = h.was_home ? h.team_h_score : h.team_a_score;
    const conceded = h.was_home ? h.team_a_score : h.team_h_score;
    if (scored > conceded) return { text: 'W', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (scored < conceded) return { text: 'L', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    return { text: 'D', cls: 'text-slate-400 bg-slate-700/30 border-slate-600/30' };
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] text-slate-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 sm:p-6 border-b border-slate-700/80">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all shadow"
            title="Zatvoriť (Esc)"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Player Image / Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700/70 p-1 shadow-inner flex items-center justify-center overflow-hidden">
                {!imgError ? (
                  <img
                    src={getPlayerImageUrl(player.photo)}
                    alt={player.web_name}
                    className="w-full h-full object-cover object-top rounded-lg"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <img
                    src={getTeamShirtUrl(team?.code, player.element_type === 1)}
                    alt={player.web_name}
                    className="w-full h-full object-contain filter drop-shadow p-1"
                    onError={e => {
                      (e.target as HTMLImageElement).src = 'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.png';
                    }}
                  />
                )}
              </div>
              <span className={`absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black border font-mono shadow ${posInfo.bg} ${posInfo.color} ${posInfo.border}`}>
                {posInfo.short}
              </span>
            </div>

            {/* Player Info & Key Metrics */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  {player.first_name}
                </span>
                <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                  {team?.name || 'Unknown'} ({team?.short_name})
                </span>

                {/* Top 100 Signal Badge */}
                {top100Signal && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded font-mono border shadow-sm ${
                      top100Signal.net > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : top100Signal.net < 0
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {top100Signal.net > 0 ? <Flame size={12} /> : <AlertTriangle size={12} />}
                    Top 100: {top100Signal.net > 0 ? `+${top100Signal.net}` : top100Signal.net}
                  </span>
                )}

                {/* Template Tier Badge */}
                {templateTier && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                    <Sparkles size={11} className="text-amber-400" /> {templateTier.tier}
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate mb-3">
                {player.second_name || player.web_name}
              </h2>

              {/* 5 Key Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Cena</div>
                  <div className="text-sm font-black font-mono text-white">£{(player.now_cost / 10).toFixed(1)}m</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Celk. Body</div>
                  <div className="text-sm font-black font-mono text-white">{player.total_points} pts</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Forma</div>
                  <div className="text-sm font-black font-mono text-white">{player.form}</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Vlastníctvo</div>
                  <div className="text-sm font-black font-mono text-white">{player.selected_by_percent}%</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Dostupnosť</div>
                  <div className={`text-sm font-black font-mono ${
                    player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round < 100
                      ? player.chance_of_playing_next_round >= 75
                        ? 'text-amber-400'
                        : 'text-rose-400'
                      : 'text-white'
                  }`}>
                    {player.chance_of_playing_next_round ?? 100}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nadchádzajúce zápasy (Next 5-6 fixtures) */}
          {upcomingFixtures.length > 0 && (
            <div className="mt-4 bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar size={12} className="text-blue-400" />
                  Najbližších {upcomingFixtures.length} zápasov (FDR obtiažnosť)
                </span>
                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                  2 = výhodný · 3 = vyrovnaný · 4–5 = náročný
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {upcomingFixtures.map((fix) => {
                  const diffCls = getDifficultyColor(fix.difficulty);
                  return (
                    <div
                      key={fix.id || fix.event}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border-b-2 font-mono transition-all hover:scale-105 shadow-sm ${diffCls}`}
                      title={`${fix.opponentName} (${fix.isHome ? 'H' : 'A'}) · GW${fix.event} · FDR ${fix.difficulty}/5`}
                    >
                      <div className="flex items-center justify-between w-full text-[9px] font-bold opacity-90 px-0.5">
                        <span>GW{fix.event}</span>
                        <span className="text-[8px] font-extrabold px-1 rounded bg-black/25">
                          {fix.isHome ? '(H)' : '(A)'}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm font-black tracking-tight my-1 truncate max-w-full text-white">
                        {fix.opponentShort}
                      </div>
                      <div className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/25 border border-white/10 text-white">
                        FDR {fix.difficulty}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fortuna Odds Breakdown for GKP, DEF, MID, FWD (Live Fortuna only) */}
          {oddsData && player && (() => {
            const nextEventId = upcomingFixtures[0]?.event || 1;
            const oddsRes = getGoalscorerOdds(player, teams, fixtures, nextEventId, oddsData);
            if (!oddsRes) return null;

            const hasLiveCS = (player.element_type === 1 || player.element_type === 2) && oddsRes.cleanSheet?.source === 'fortuna_live';
            const hasLiveGoal = player.element_type !== 1 && oddsRes.goal.source === 'fortuna_live';
            const hasLiveAssist = player.element_type !== 1 && oddsRes.assist.source === 'fortuna_live';
            const hasLiveGA = player.element_type !== 1 && oddsRes.goalOrAssist.source === 'fortuna_live';

            if (!hasLiveCS && !hasLiveGoal && !hasLiveAssist && !hasLiveGA) return null;

            return (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl shadow-inner">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Coins size={12} />
                    {lang === 'sk'
                      ? `Reálne kurzy Fortuna`
                      : `Fortuna Live Odds`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Clean Sheet for GKP & DEF */}
                  {(player.element_type === 1 || player.element_type === 2) && (
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-cyan-500/20 flex flex-col items-center text-center">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{lang === 'sk' ? 'Čisté konto' : 'Clean Sheet'}</span>
                      {hasLiveCS && oddsRes.cleanSheet ? (
                        <>
                          <span className="text-white font-mono font-bold text-sm mt-0.5">{oddsRes.cleanSheet.odds.toFixed(2)}</span>
                          <span className="text-xs text-cyan-300 font-bold">{Math.round(oddsRes.cleanSheet.prob * 100)}%</span>
                          <span className="text-[8px] text-slate-500 mt-0.5">vs {oddsRes.cleanSheet.opponentShort || oddsRes.opponentShort}</span>
                        </>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs mt-2">-</span>
                      )}
                    </div>
                  )}
                  {player.element_type !== 1 && (
                    <>
                      {/* Goal */}
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-amber-500/20 flex flex-col items-center text-center">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{lang === 'sk' ? 'Gól' : 'Goal'}</span>
                        {hasLiveGoal ? (
                          <>
                            <span className="text-white font-mono font-bold text-sm mt-0.5">{oddsRes.goal.odds.toFixed(2)}</span>
                            <span className="text-xs text-amber-300 font-bold">{Math.round(oddsRes.goal.prob * 100)}%</span>
                            <span className="text-[8px] text-slate-500 mt-0.5">vs {oddsRes.goal.opponentShort || oddsRes.opponentShort}</span>
                          </>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs mt-2">-</span>
                        )}
                      </div>
                      {/* Assist */}
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-blue-500/20 flex flex-col items-center text-center">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{lang === 'sk' ? 'Asistencia' : 'Assist'}</span>
                        {hasLiveAssist ? (
                          <>
                            <span className="text-white font-mono font-bold text-sm mt-0.5">{oddsRes.assist.odds.toFixed(2)}</span>
                            <span className="text-xs text-blue-300 font-bold">{Math.round(oddsRes.assist.prob * 100)}%</span>
                            <span className="text-[8px] text-slate-500 mt-0.5">vs {oddsRes.assist.opponentShort || oddsRes.opponentShort}</span>
                          </>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs mt-2">-</span>
                        )}
                      </div>
                      {/* G+A */}
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-emerald-500/20 flex flex-col items-center text-center">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{lang === 'sk' ? 'Gól + Asist.' : 'G+A'}</span>
                        {hasLiveGA ? (
                          <>
                            <span className="text-white font-mono font-bold text-sm mt-0.5">{oddsRes.goalOrAssist.odds.toFixed(2)}</span>
                            <span className="text-xs text-emerald-300 font-bold">{Math.round(oddsRes.goalOrAssist.prob * 100)}%</span>
                            <span className="text-[8px] text-slate-500 mt-0.5">vs {oddsRes.goalOrAssist.opponentShort || oddsRes.opponentShort}</span>
                          </>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs mt-2">-</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Sťahujem oficiálne štatistiky a históriu z FPL API...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && (
            <div className="space-y-6">
              {/* Gameweek Sparkline / Bar Chart */}
              {pointsHistory.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <BarChart3 size={14} className="text-blue-400" />
                      Vývoj bodov po jednotlivých kolách
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Priemer: <strong className="text-emerald-400">{avgGwPoints} pts/GW</strong> · Max: <strong className="text-amber-300">{maxGwPoints} pts</strong>
                    </span>
                  </div>

                  {/* Horizontal Points Bars */}
                  <div className="flex items-end gap-1.5 h-24 pt-4 px-2 border-b border-slate-700/50">
                    {pointsHistory.map((h) => {
                      const opp = teams?.find?.((t) => t.id === h.opponent_team)?.short_name || 'UNK';
                      const matchFixture = fixtures?.find((f) => f.id === h.fixture);
                      const fdrVal = matchFixture ? (h.was_home ? matchFixture.team_h_difficulty : matchFixture.team_a_difficulty) : null;
                      const heightPercent = maxGwPoints > 0 ? Math.max(12, (h.total_points / Math.max(maxGwPoints, 12)) * 100) : 10;
                      return (
                        <div key={h.round} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 bg-slate-950 text-white text-[10px] font-mono py-1 px-1.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                            GW{h.round}: {h.total_points} pts vs {opp} ({h.was_home ? 'H' : 'A'}){fdrVal ? ` · FDR ${fdrVal}` : ''} · {h.minutes}'
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-300 group-hover:text-white">
                            {h.total_points}
                          </span>
                          <div
                            className={`w-full rounded-t transition-all group-hover:brightness-125 ${
                              h.total_points >= 10
                                ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                : h.total_points >= 6
                                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                                : h.total_points >= 3
                                ? 'bg-gradient-to-t from-blue-600 to-blue-400'
                                : 'bg-slate-700'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="text-[9px] font-mono text-slate-400 mt-1">
                            GW{h.round}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Match History Table with Sub-Tabs */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-visible shadow">
                {/* Match Log Header with Sub-Tabs */}
                <div className="p-3 sm:p-4 bg-slate-800/80 border-b border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold uppercase text-slate-200 flex items-center gap-1.5">
                      {activeSubTab === 'past' ? (
                        <>
                          <Calendar size={14} className="text-blue-400" />
                          <span>{lang === 'sk' ? 'Kariérna história v Premier League' : 'Premier League Career History'}</span>
                        </>
                      ) : (
                        <>
                          <Activity size={14} className="text-emerald-400" />
                          <span>{lang === 'sk' ? 'Zápasový denník (Aktuálna sezóna)' : 'Match Log (This Season)'}</span>
                        </>
                      )}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {activeSubTab === 'past'
                        ? (lang === 'sk' ? `História minulých ročníkov (${pastSeasons.length} sezón)` : `Past seasons history (${pastSeasons.length} seasons)`)
                        : (lang === 'sk' ? <>Spolu odohraných: <strong className="text-white font-mono">{player.minutes} minút</strong></> : <>Total played: <strong className="text-white font-mono">{player.minutes} mins</strong></>)}
                    </span>
                  </div>

                  {/* Sub-Tab Switcher - all switchers in one place, slightly smaller */}
                  <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 self-start sm:self-auto flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('overview')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        activeSubTab === 'overview'
                          ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Activity size={12} />
                      <span>{lang === 'sk' ? 'Prehľad' : 'Overview'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('advanced')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        activeSubTab === 'advanced'
                          ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Zap size={12} />
                      <span>{lang === 'sk' ? 'Rozšírené (xG / Stats)' : 'Advanced (xG / Stats)'}</span>
                    </button>
                    {pastSeasons.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('past')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          activeSubTab === 'past'
                            ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Calendar size={12} />
                        <span>{lang === 'sk' ? `Minulé sezóny (${pastSeasons.length})` : `Past Seasons (${pastSeasons.length})`}</span>
                      </button>
                    )}
                  </div>
                </div>

                {activeSubTab === 'past' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-700/60 select-none">
                          {renderTh('season', lang === 'sk' ? 'Sezóna' : 'Season', 'py-2.5 px-3 text-left')}
                          {renderTh('mins', lang === 'sk' ? 'Minúty' : 'Minutes', 'py-2.5 px-2.5 text-center')}
                          {renderTh('pts', lang === 'sk' ? 'Celk. Body' : 'Total Pts', 'py-2.5 px-2.5 text-center font-bold text-white')}
                          {renderTh('g', lang === 'sk' ? 'Góly' : 'Goals', 'py-2.5 px-2.5 text-center')}
                          {renderTh('a', lang === 'sk' ? 'Asistencie' : 'Assists', 'py-2.5 px-2.5 text-center')}
                          {renderTh('cs', lang === 'sk' ? 'Čisté kontá' : 'Clean Sheets', 'py-2.5 px-2.5 text-center')}
                          {renderTh('bonus', lang === 'sk' ? 'Bonusy' : 'Bonus', 'py-2.5 px-2.5 text-center')}
                          {renderTh('startCost', lang === 'sk' ? 'Poč. Cena' : 'Start Price', 'py-2.5 px-2.5 text-center')}
                          {renderTh('endCost', lang === 'sk' ? 'Konc. Cena' : 'End Price', 'py-2.5 px-2.5 text-center')}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/40 font-mono">
                        {pastSeasons.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-400 font-sans text-xs">
                              {lang === 'sk' ? 'Žiadne predchádzajúce sezóny v databáze (nováčik v Premier League).' : 'No past seasons in database (Premier League newcomer).'}
                            </td>
                          </tr>
                        ) : (
                          [...pastSeasons].reverse().map((s) => (
                            <tr key={s.season_name} className="hover:bg-slate-800/60 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-white font-sans">{s.season_name}</td>
                              <td className="py-2.5 px-2.5 text-center text-slate-300">{s.minutes}'</td>
                              <td className="py-2.5 px-2.5 text-center font-black text-emerald-400 text-sm">
                                {s.total_points}
                              </td>
                              <td className="py-2.5 px-2.5 text-center text-slate-200">{s.goals_scored}</td>
                              <td className="py-2.5 px-2.5 text-center text-slate-200">{s.assists}</td>
                              <td className="py-2.5 px-2.5 text-center text-slate-200">{s.clean_sheets}</td>
                              <td className="py-2.5 px-2.5 text-center text-amber-400">{s.bonus}</td>
                              <td className="py-2.5 px-2.5 text-center text-slate-400">£{(s.start_cost / 10).toFixed(1)}</td>
                              <td className="py-2.5 px-2.5 text-center text-blue-300">£{(s.end_cost / 10).toFixed(1)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-700/60 select-none">
                        {renderTh('gw', lang === 'sk' ? 'Kolo' : 'GW', 'py-2.5 px-2.5 w-12 text-center')}
                        {renderTh('opponent', lang === 'sk' ? 'Súper' : 'Opponent', 'py-2.5 px-3 min-w-[120px] text-left')}
                        {renderTh('result', lang === 'sk' ? 'Výsledok' : 'Result', 'py-2.5 px-2.5 text-center w-20')}

                        {activeSubTab === 'overview' && (
                          <>
                            {renderTh('mins', lang === 'sk' ? 'Min' : 'Mins', 'py-2.5 px-2 text-center')}
                            {renderTh('pts', lang === 'sk' ? 'Body' : 'Pts', 'py-2.5 px-2 text-center text-white')}
                            {renderTh('g', 'G', 'py-2.5 px-2 text-center')}
                            {renderTh('a', 'A', 'py-2.5 px-2 text-center')}
                            {renderTh('cs', 'CS', 'py-2.5 px-2 text-center')}
                            {renderTh('bonus', 'Bonus', 'py-2.5 px-2 text-center')}
                            {renderTh('bps', 'BPS', 'py-2.5 px-2 text-center')}
                            {renderTh('xg', 'xG', 'py-2.5 px-2 text-center')}
                            {renderTh('xa', 'xA', 'py-2.5 px-2 text-center')}
                            {renderTh('price', lang === 'sk' ? 'Cena' : 'Price', 'py-2.5 px-2 text-center')}
                          </>
                        )}

                        {activeSubTab === 'advanced' && (
                          <>
                            {renderTh('mins', lang === 'sk' ? 'Min' : 'Mins', 'py-2.5 px-2 text-center')}
                            {renderTh('pts', lang === 'sk' ? 'Body' : 'Pts', 'py-2.5 px-2 text-center text-white')}
                            {renderTh('xg', 'xG', 'py-2.5 px-2 text-center')}
                            {renderTh('xa', 'xA', 'py-2.5 px-2 text-center')}
                            {renderTh('xgi', 'xGI', 'py-2.5 px-2 text-center text-emerald-300')}
                            {renderTh('ict', 'ICT', 'py-2.5 px-2 text-center text-amber-300')}
                            {renderTh('threat', 'Threat', 'py-2.5 px-2 text-center')}
                            {renderTh('creat', 'Creat', 'py-2.5 px-2 text-center')}
                            {renderTh('gc', 'GC', 'py-2.5 px-2 text-center')}
                            {renderTh('saves', 'Saves', 'py-2.5 px-2 text-center')}
                            {renderTh('bps', 'BPS', 'py-2.5 px-2 text-center')}
                          </>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-700/40 font-mono">
                      {pointsHistory.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-8 text-center text-slate-400 font-sans text-xs">
                            {lang === 'sk' ? 'Zatiaľ žiadne odohrané zápasy v tejto sezóne.' : 'No matches played yet this season.'}
                          </td>
                        </tr>
                      ) : (
                        [...pointsHistory].reverse().map((h) => {
                          const opp = teams?.find?.((t) => t.id === h.opponent_team)?.short_name || `ID ${h.opponent_team}`;
                          const matchFixture = fixtures?.find((f) => f.id === h.fixture);
                          const fdrVal = matchFixture ? (h.was_home ? matchFixture.team_h_difficulty : matchFixture.team_a_difficulty) : null;
                          const res = getResultBadge(h);
                          const hasScore = h.team_h_score !== null && h.team_a_score !== null && h.team_h_score !== undefined && h.team_a_score !== undefined;
                          const scoreText = hasScore ? (h.was_home ? `${h.team_h_score}-${h.team_a_score}` : `${h.team_a_score}-${h.team_h_score}`) : '-';
                          const xgiVal = h.expected_goal_involvements || (parseFloat(h.expected_goals || '0') + parseFloat(h.expected_assists || '0')).toFixed(2);
                          const netTransfers = h.transfers_balance ?? (h.transfers_in - h.transfers_out);

                          return (
                            <tr key={h.round} className="hover:bg-slate-800/60 transition-colors">
                              {/* Fixed: Round */}
                              <td className="py-2 px-2.5 text-center font-bold text-white">GW{h.round}</td>

                              {/* Fixed: Opponent */}
                              <td className="py-2 px-3 text-left">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-200">{opp}</span>
                                  <span className="text-[10px] text-slate-500 font-sans">
                                    ({h.was_home ? (lang === 'sk' ? 'Doma' : 'H') : (lang === 'sk' ? 'Vonku' : 'A')})
                                  </span>
                                  {fdrVal && (
                                    <span className={`px-1 py-0.2 rounded text-[9px] font-bold border ${getDifficultyColor(fdrVal)}`}>
                                      FDR {fdrVal}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Fixed: Result */}
                              <td className="py-2 px-2.5 text-center">
                                {hasScore ? (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${res.cls}`}>
                                    {scoreText} ({res.text})
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[11px]">-</span>
                                )}
                              </td>

                              {/* DYNAMIC TAB 1: OVERVIEW */}
                              {activeSubTab === 'overview' && (
                                <>
                                  <td className="py-2 px-2 text-center text-slate-300">{h.minutes}'</td>
                                  <td className="py-2 px-2 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs ${getPointsBadgeClass(h.total_points)}`}>
                                      {h.total_points}
                                    </span>
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.goals_scored > 0 ? 'text-emerald-400 font-black' : 'text-slate-500'}`}>
                                    {h.goals_scored}
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.assists > 0 ? 'text-blue-400 font-black' : 'text-slate-500'}`}>
                                    {h.assists}
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.clean_sheets > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                                    {h.clean_sheets}
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.bonus > 0 ? 'text-amber-400 font-black' : 'text-slate-500'}`}>
                                    {h.bonus > 0 ? `+${h.bonus}` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-400">{h.bps}</td>
                                  <td className="py-2 px-2 text-center text-slate-400 font-sans text-[11px]">{h.expected_goals || '0.00'}</td>
                                  <td className="py-2 px-2 text-center text-slate-400 font-sans text-[11px]">{h.expected_assists || '0.00'}</td>
                                  <td className="py-2 px-2 text-center text-blue-300">£{(h.value / 10).toFixed(1)}m</td>
                                </>
                              )}

                              {/* DYNAMIC TAB 2: ADVANCED */}
                              {activeSubTab === 'advanced' && (
                                <>
                                  <td className="py-2 px-2 text-center text-slate-300">{h.minutes}'</td>
                                  <td className="py-2 px-2 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs ${getPointsBadgeClass(h.total_points)}`}>
                                      {h.total_points}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-center text-emerald-300 font-sans text-[11px] font-semibold">
                                    {h.expected_goals || '0.00'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-blue-300 font-sans text-[11px] font-semibold">
                                    {h.expected_assists || '0.00'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-emerald-400 font-sans text-[11px] font-bold">
                                    {xgiVal}
                                  </td>
                                  <td className="py-2 px-2 text-center text-amber-300 font-bold">
                                    {Number(h.ict_index || 0).toFixed(1)}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-300">
                                    {Number(h.threat || 0).toFixed(0)}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-300">
                                    {Number(h.creativity || 0).toFixed(0)}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-400">
                                    {h.goals_conceded}
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.saves > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>
                                    {h.saves || '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-300 font-bold">
                                    {h.bps}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>Zdroj dát:</span>
            <strong className="text-slate-400">Official Premier League & Top 100 Intel</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-bold text-xs transition-colors"
          >
            Zatvoriť
          </button>
        </div>
      </div>

      {/* Column Explanation Tooltip (Identical to PlayerStats.tsx) */}
      {hoveredMetric && (() => {
        const isNearTop = hoveredMetric.rect.top < 220;
        const leftPos = Math.max(
          150,
          Math.min(
            (typeof window !== 'undefined' ? window.innerWidth : 1000) - 150,
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
            className="z-[9999] pointer-events-none w-64 sm:w-72 p-3 bg-slate-900/98 backdrop-blur-md text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 text-left normal-case font-normal select-none transition-all duration-150 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-white text-xs">{hoveredMetric.label}</span>
              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {hoveredMetric.abbr}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300 whitespace-normal">
              {hoveredMetric.description}
            </p>
            {/* Arrow pointing to the column header */}
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
