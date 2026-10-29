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
  History,
  Info,
  ArrowLeftRight
} from 'lucide-react';
import { useLanguage } from '../lib/language';

interface PlayerDetailModalProps {
  player: FPLPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  teams: FPLTeam[];
  allPlayers?: FPLPlayer[];
  top100Snapshot?: Top100Snapshot | null;
  fixtures?: FPLFixture[];
}

const POSITION_NAMES: Record<number, { short: string; full: string; color: string; bg: string; border: string }> = {
  1: { short: 'GKP', full: 'Goalkeeper', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  2: { short: 'DEF', full: 'Defender', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  3: { short: 'MID', full: 'Midfielder', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  4: { short: 'FWD', full: 'Forward', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' },
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
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'rankings' | 'past'>('history');
  const [matchLogTab, setMatchLogTab] = useState<'overview' | 'attack' | 'defense' | 'transfers'>('overview');
  const [activeMatchTooltip, setActiveMatchTooltip] = useState<string | null>(null);
  const [lang] = useLanguage();
  const [summary, setSummary] = useState<FPLElementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

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

  // League Rankings within position and overall
  const rankings = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return null;

    const samePos = allPlayers.filter((p) => p && p.element_type === player.element_type);
    const totalInPos = samePos.length;
    const totalOverall = allPlayers.length;

    // Helper to calculate rank (1-based)
    const getRank = (list: FPLPlayer[], scoreFn: (p: FPLPlayer) => number) => {
      if (!list || list.length === 0) return null;
      const sorted = [...list].sort((a, b) => (scoreFn(b) || 0) - (scoreFn(a) || 0));
      const idx = sorted.findIndex((p) => p?.id === player.id);
      return idx >= 0 ? idx + 1 : null;
    };

    const pointsRankPos = getRank(samePos, (p) => p.total_points);
    const pointsRankAll = getRank(allPlayers, (p) => p.total_points);

    const formRankPos = getRank(samePos, (p) => parseFloat(p.form) || 0);
    const formRankAll = getRank(allPlayers, (p) => parseFloat(p.form) || 0);

    const valueRankPos = getRank(samePos, (p) => p.total_points / (p.now_cost / 10 || 1));
    const valueRankAll = getRank(allPlayers, (p) => p.total_points / (p.now_cost / 10 || 1));

    const ictRankPos = getRank(samePos, (p) => parseFloat(p.ict_index) || 0);
    const ictRankAll = getRank(allPlayers, (p) => parseFloat(p.ict_index) || 0);

    const bpsRankPos = getRank(samePos, (p) => p.bps || 0);
    const bpsRankAll = getRank(allPlayers, (p) => p.bps || 0);

    const ownRankPos = getRank(samePos, (p) => parseFloat(p.selected_by_percent) || 0);

    // Percentile in points within position (100 = best)
    const pointsPercentile = pointsRankPos ? Math.round(((totalInPos - pointsRankPos + 1) / totalInPos) * 100) : 0;

    return {
      pointsRankPos,
      pointsRankAll,
      formRankPos,
      formRankAll,
      valueRankPos,
      valueRankAll,
      ictRankPos,
      ictRankAll,
      bpsRankPos,
      bpsRankAll,
      ownRankPos,
      pointsPercentile,
      totalInPos,
      totalOverall,
    };
  }, [player, allPlayers]);

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
    if (pts >= 10) return 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.2)] font-black';
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
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <Sparkles size={11} /> {templateTier.tier}
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
                  <div className="text-sm font-black font-mono text-blue-400">£{(player.now_cost / 10).toFixed(1)}m</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Celk. Body</div>
                  <div className="text-sm font-black font-mono text-white">{player.total_points} pts</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Forma</div>
                  <div className="text-sm font-black font-mono text-emerald-400">{player.form}</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Vlastníctvo</div>
                  <div className="text-sm font-black font-mono text-purple-300">{player.selected_by_percent}%</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Dostupnosť</div>
                  <div className={`text-sm font-black font-mono ${
                    (player.chance_of_playing_next_round ?? 100) >= 75 ? 'text-emerald-400' : 'text-rose-400'
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

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-5 border-t border-slate-800 pt-3">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History size={14} />
              <span>GW História ({pointsHistory.length} kôl)</span>
            </button>

            <button
              onClick={() => setActiveTab('rankings')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'rankings'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Trophy size={14} />
              <span>Rebríčky & Percentily</span>
            </button>

            <button
              onClick={() => setActiveTab('past')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'past'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar size={14} />
              <span>Minulé sezóny ({pastSeasons.length})</span>
            </button>
          </div>
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

          {/* TAB 1: GW HISTÓRIA */}
          {activeTab === 'history' && !loading && (
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
                      Priemer: <strong className="text-emerald-400">{avgGwPoints} pts/GW</strong> · Max: <strong className="text-purple-300">{maxGwPoints} pts</strong>
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
                                ? 'bg-gradient-to-t from-purple-600 to-purple-400'
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
                      <Activity size={14} className="text-emerald-400" />
                      {lang === 'sk' ? 'Zápasový denník (Aktuálna sezóna)' : 'Match Log (This Season)'}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {lang === 'sk' ? 'Spolu odohraných:' : 'Total played:'} <strong className="text-white font-mono">{player.minutes} {lang === 'sk' ? 'minút' : 'mins'}</strong>
                    </span>
                  </div>

                  {/* Sub-Tab Switcher */}
                  <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-700/80 rounded-xl p-1 self-start sm:self-auto overflow-x-auto max-w-full">
                    <button
                      type="button"
                      onClick={() => setMatchLogTab('overview')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        matchLogTab === 'overview'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Activity size={12} />
                      <span>{lang === 'sk' ? 'Prehľad' : 'Overview'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchLogTab('attack')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        matchLogTab === 'attack'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Flame size={12} />
                      <span>{lang === 'sk' ? 'Útok & xG' : 'Attack & xG'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchLogTab('defense')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        matchLogTab === 'defense'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Shield size={12} />
                      <span>{lang === 'sk' ? 'Obrana' : 'Defense'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchLogTab('transfers')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        matchLogTab === 'transfers'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <ArrowLeftRight size={12} />
                      <span>{lang === 'sk' ? 'Prestupy' : 'Transfers'}</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-700/60 select-none">
                        <th className="py-2.5 px-2.5 w-12">{lang === 'sk' ? 'Kolo' : 'GW'}</th>
                        <th className="py-2.5 px-3 min-w-[120px]">{lang === 'sk' ? 'Súper' : 'Opponent'}</th>
                        <th className="py-2.5 px-2.5 text-center w-20">{lang === 'sk' ? 'Výsledok' : 'Result'}</th>

                        {/* TAB 1: OVERVIEW COLUMNS */}
                        {matchLogTab === 'overview' && (
                          <>
                            <th className="py-2.5 px-2 text-right">
                              <span className="inline-flex items-center gap-1">
                                <span>{lang === 'sk' ? 'Min' : 'Mins'}</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('min')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'min' ? null : 'min')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'min' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-48 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Odohrané minúty v zápase.' : 'Minutes played in the match.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-2 text-right text-white">
                              <span className="inline-flex items-center gap-1">
                                <span>{lang === 'sk' ? 'Body' : 'Pts'}</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('pts')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'pts' ? null : 'pts')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'pts' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-48 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Celkový počet získaných FPL bodov v tomto zápase.' : 'Total FPL points earned in this fixture.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-2 text-center" title="Góly">G</th>
                            <th className="py-2.5 px-2 text-center" title="Asistencie">A</th>
                            <th className="py-2.5 px-2 text-center" title="Čisté konto">CS</th>
                            <th className="py-2.5 px-2 text-center" title="Bonusové body">Bonus</th>
                            <th className="py-2.5 px-2.5 text-right" title="Bonus Points System">BPS</th>
                            <th className="py-2.5 px-2.5 text-right" title="Expected Goals">xG</th>
                            <th className="py-2.5 px-2.5 text-right" title="Expected Assists">xA</th>
                            <th className="py-2.5 px-2.5 text-right">{lang === 'sk' ? 'Cena' : 'Price'}</th>
                          </>
                        )}

                        {/* TAB 2: ATTACK & xG COLUMNS */}
                        {matchLogTab === 'attack' && (
                          <>
                            <th className="py-2.5 px-2 text-right">{lang === 'sk' ? 'Min' : 'Mins'}</th>
                            <th className="py-2.5 px-2 text-right text-white">{lang === 'sk' ? 'Body' : 'Pts'}</th>
                            <th className="py-2.5 px-2 text-center" title="Góly">G</th>
                            <th className="py-2.5 px-2 text-center" title="Asistencie">A</th>
                            <th className="py-2.5 px-2.5 text-right">
                              <span className="inline-flex items-center gap-1">
                                <span>xG</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('xg')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'xg' ? null : 'xg')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'xg' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-52 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Expected Goals: Kvalita a pravdepodobnosť strelených gólov.' : 'Expected Goals: Statistical shot quality.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-2.5 text-right">
                              <span className="inline-flex items-center gap-1">
                                <span>xA</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('xa')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'xa' ? null : 'xa')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'xa' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-52 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Expected Assists: Pravdepodobnosť asistencie z prihrávok.' : 'Expected Assists: Likelihood of passes resulting in assists.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-2.5 text-right text-purple-300">
                              <span className="inline-flex items-center gap-1">
                                <span>xGI</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('xgi')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'xgi' ? null : 'xgi')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'xgi' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-52 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Expected Goal Involvement: Súčet xG a xA hráča v zápase.' : 'Expected Goal Involvement: Combined xG + xA in fixture.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-2.5 text-right" title="Threat">{lang === 'sk' ? 'Hrozba' : 'Threat'}</th>
                            <th className="py-2.5 px-2.5 text-right" title="Creativity">{lang === 'sk' ? 'Kreativita' : 'Creativity'}</th>
                          </>
                        )}

                        {/* TAB 3: DEFENSE COLUMNS */}
                        {matchLogTab === 'defense' && (
                          <>
                            <th className="py-2.5 px-2 text-right">{lang === 'sk' ? 'Min' : 'Mins'}</th>
                            <th className="py-2.5 px-2 text-right text-white">{lang === 'sk' ? 'Body' : 'Pts'}</th>
                            <th className="py-2.5 px-2 text-center" title="Clean Sheet">CS</th>
                            <th className="py-2.5 px-2 text-center" title="Goals Conceded">GC</th>
                            <th className="py-2.5 px-2.5 text-right">
                              <span className="inline-flex items-center gap-1">
                                <span>xGC</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('xgc')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'xgc' ? null : 'xgc')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'xgc' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-52 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Expected Goals Conceded: Štatistická kvalita šancí, ktorým obrana čelila.' : 'Expected Goals Conceded: Quality of chances conceded by team.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-2 text-center" title="Zákroky / Saves">S</th>
                            <th className="py-2.5 px-2 text-center" title="Žlté karty">YC</th>
                            <th className="py-2.5 px-2 text-center" title="Červené karty">RC</th>
                            <th className="py-2.5 px-2 text-center" title="Chytené penalty">PS</th>
                            <th className="py-2.5 px-2.5 text-right" title="BPS Score">BPS</th>
                          </>
                        )}

                        {/* TAB 4: TRANSFERS COLUMNS */}
                        {matchLogTab === 'transfers' && (
                          <>
                            <th className="py-2.5 px-2 text-right text-white">{lang === 'sk' ? 'Body' : 'Pts'}</th>
                            <th className="py-2.5 px-2.5 text-right">{lang === 'sk' ? 'Cena' : 'Price'}</th>
                            <th className="py-2.5 px-2.5 text-right text-emerald-400">{lang === 'sk' ? 'Kúpené' : 'In'}</th>
                            <th className="py-2.5 px-2.5 text-right text-rose-400">{lang === 'sk' ? 'Predané' : 'Out'}</th>
                            <th className="py-2.5 px-2.5 text-right">
                              <span className="inline-flex items-center gap-1">
                                <span>{lang === 'sk' ? 'Net' : 'Net'}</span>
                                <div className="relative inline-flex group/info" onMouseEnter={() => setActiveMatchTooltip('net')} onMouseLeave={() => setActiveMatchTooltip(null)}>
                                  <button type="button" onClick={() => setActiveMatchTooltip(curr => curr === 'net' ? null : 'net')} className="text-slate-500 hover:text-blue-400">
                                    <Info size={11} />
                                  </button>
                                  <div className={`${activeMatchTooltip === 'net' ? 'visible opacity-100' : 'invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100'} transition-all absolute z-50 bottom-full mb-1 right-0 w-52 p-2 bg-slate-900 text-slate-200 text-[11px] rounded-lg shadow-xl border border-slate-700 font-normal normal-case`}>
                                    {lang === 'sk' ? 'Čistá bilancia nákupov a predajov pred daným kolom.' : 'Net transfer balance (In minus Out) before the deadline.'}
                                  </div>
                                </div>
                              </span>
                            </th>
                            <th className="py-2.5 px-3 text-right">{lang === 'sk' ? 'Vlastníkov' : 'Owners'}</th>
                            <th className="py-2.5 px-2.5 text-right text-purple-300" title="ICT Index">ICT</th>
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
                              <td className="py-2 px-2.5 font-bold text-white">GW{h.round}</td>

                              {/* Fixed: Opponent */}
                              <td className="py-2 px-3">
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
                              {matchLogTab === 'overview' && (
                                <>
                                  <td className="py-2 px-2 text-right text-slate-300">{h.minutes}'</td>
                                  <td className="py-2 px-2 text-right">
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
                                  <td className="py-2 px-2.5 text-right text-slate-400">{h.bps}</td>
                                  <td className="py-2 px-2.5 text-right text-slate-400 font-sans text-[11px]">{h.expected_goals || '0.00'}</td>
                                  <td className="py-2 px-2.5 text-right text-slate-400 font-sans text-[11px]">{h.expected_assists || '0.00'}</td>
                                  <td className="py-2 px-2.5 text-right text-blue-300">£{(h.value / 10).toFixed(1)}m</td>
                                </>
                              )}

                              {/* DYNAMIC TAB 2: ATTACK */}
                              {matchLogTab === 'attack' && (
                                <>
                                  <td className="py-2 px-2 text-right text-slate-300">{h.minutes}'</td>
                                  <td className="py-2 px-2 text-right">
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
                                  <td className="py-2 px-2.5 text-right text-emerald-300 font-sans text-[11px] font-semibold">
                                    {h.expected_goals || '0.00'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-blue-300 font-sans text-[11px] font-semibold">
                                    {h.expected_assists || '0.00'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-purple-300 font-sans text-[11px] font-bold">
                                    {xgiVal}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-slate-300">
                                    {Number(h.threat || 0).toFixed(0)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-slate-300">
                                    {Number(h.creativity || 0).toFixed(0)}
                                  </td>
                                </>
                              )}

                              {/* DYNAMIC TAB 3: DEFENSE */}
                              {matchLogTab === 'defense' && (
                                <>
                                  <td className="py-2 px-2 text-right text-slate-300">{h.minutes}'</td>
                                  <td className="py-2 px-2 text-right">
                                    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs ${getPointsBadgeClass(h.total_points)}`}>
                                      {h.total_points}
                                    </span>
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.clean_sheets > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                                    {h.clean_sheets}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-400">{h.goals_conceded}</td>
                                  <td className="py-2 px-2.5 text-right text-rose-300 font-sans text-[11px]">
                                    {h.expected_goals_conceded || '-'}
                                  </td>
                                  <td className={`py-2 px-2 text-center ${h.saves > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>
                                    {h.saves}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {h.yellow_cards > 0 ? (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                                        {h.yellow_cards}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {h.red_cards > 0 ? (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-500/25 text-rose-300 text-[10px] font-bold">
                                        {h.red_cards}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {h.penalties_saved > 0 ? (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                                        +{h.penalties_saved}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-amber-300 font-bold">{h.bps}</td>
                                </>
                              )}

                              {/* DYNAMIC TAB 4: TRANSFERS */}
                              {matchLogTab === 'transfers' && (
                                <>
                                  <td className="py-2 px-2 text-right">
                                    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs ${getPointsBadgeClass(h.total_points)}`}>
                                      {h.total_points}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-blue-300">£{(h.value / 10).toFixed(1)}m</td>
                                  <td className="py-2 px-2.5 text-right text-emerald-400">
                                    +{h.transfers_in.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-rose-400">
                                    -{h.transfers_out.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-bold">
                                    <span className={netTransfers > 0 ? 'text-emerald-400' : netTransfers < 0 ? 'text-rose-400' : 'text-slate-400'}>
                                      {netTransfers > 0 ? `+${netTransfers.toLocaleString()}` : netTransfers.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-300 text-[11px]">
                                    {h.selected.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-purple-300 font-bold">
                                    {Number(h.ict_index || 0).toFixed(1)}
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
              </div>
            </div>
          )}

          {/* TAB 2: REBRÍČKY & PERCENTILY */}
          {activeTab === 'rankings' && (
            <div className="space-y-6">
              {rankings && (
                <>
                  {/* Percentile Highlight Card */}
                  <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-slate-900 border border-blue-500/30 p-5 rounded-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase font-bold text-blue-400 flex items-center gap-1.5 mb-1">
                        <Trophy size={16} /> Ligový percentil hráča
                      </div>
                      <h4 className="text-lg font-black text-white">
                        Lepší ako <span className="text-emerald-400 font-mono text-xl">{rankings.pointsPercentile}%</span> hráčov na pozícii {posInfo.short}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Hodnotenie na základe celkového bodového zisku v aktuálnej sezóne.
                      </p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700/80 px-4 py-2.5 rounded-xl text-center shrink-0">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Poradie v pozícii</div>
                      <div className="text-xl font-black font-mono text-white">
                        #{rankings.pointsRankPos} <span className="text-xs text-slate-400 font-normal">z {rankings.totalInPos}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ranking Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {/* Points Rank */}
                    <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                          <Trophy size={14} className="text-amber-400" /> Celkové body
                        </span>
                        <span className="text-sm font-black font-mono text-white">{player.total_points} pts</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-slate-700/40 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">V pozícii ({posInfo.short}):</span>
                          <strong className="font-mono text-emerald-400">#{rankings.pointsRankPos} / {rankings.totalInPos}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Celá Premier League:</span>
                          <strong className="font-mono text-slate-300">#{rankings.pointsRankAll} / {rankings.totalOverall}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Form Rank */}
                    <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-emerald-400" /> Aktuálna forma
                        </span>
                        <span className="text-sm font-black font-mono text-emerald-400">{player.form}</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-slate-700/40 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">V pozícii ({posInfo.short}):</span>
                          <strong className="font-mono text-emerald-400">#{rankings.formRankPos} / {rankings.totalInPos}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Celá Premier League:</span>
                          <strong className="font-mono text-slate-300">#{rankings.formRankAll} / {rankings.totalOverall}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Value for Money (Points per £1m) */}
                    <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                          <DollarSign size={14} className="text-blue-400" /> Pomer cena / výkon
                        </span>
                        <span className="text-sm font-black font-mono text-blue-300">
                          {(player.total_points / (player.now_cost / 10 || 1)).toFixed(1)} pts/£m
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-slate-700/40 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">V pozícii ({posInfo.short}):</span>
                          <strong className="font-mono text-emerald-400">#{rankings.valueRankPos} / {rankings.totalInPos}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Celá Premier League:</span>
                          <strong className="font-mono text-slate-300">#{rankings.valueRankAll} / {rankings.totalOverall}</strong>
                        </div>
                      </div>
                    </div>

                    {/* ICT Index */}
                    <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                          <Zap size={14} className="text-purple-400" /> ICT Index
                        </span>
                        <span className="text-sm font-black font-mono text-purple-300">{player.ict_index}</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-slate-700/40 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">V pozícii ({posInfo.short}):</span>
                          <strong className="font-mono text-emerald-400">#{rankings.ictRankPos} / {rankings.totalInPos}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Celá Premier League:</span>
                          <strong className="font-mono text-slate-300">#{rankings.ictRankAll} / {rankings.totalOverall}</strong>
                        </div>
                      </div>
                    </div>

                    {/* BPS Rank */}
                    <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                          <Award size={14} className="text-amber-400" /> Bonus System (BPS)
                        </span>
                        <span className="text-sm font-black font-mono text-amber-300">{player.bps}</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-slate-700/40 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">V pozícii ({posInfo.short}):</span>
                          <strong className="font-mono text-emerald-400">#{rankings.bpsRankPos} / {rankings.totalInPos}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Celá Premier League:</span>
                          <strong className="font-mono text-slate-300">#{rankings.bpsRankAll} / {rankings.totalOverall}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Ownership Rank */}
                    <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400" /> Popularita (Vlastníctvo)
                        </span>
                        <span className="text-sm font-black font-mono text-white">{player.selected_by_percent}%</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-slate-700/40 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">V pozícii ({posInfo.short}):</span>
                          <strong className="font-mono text-purple-300">#{rankings.ownRankPos} / {rankings.totalInPos}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Status v tíme:</span>
                          <strong className="font-mono text-slate-300">
                            {parseFloat(player.selected_by_percent) > 20 ? 'Šablóna (Core)' : 'Diferenciál'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Top 100 Manager Intel Details */}
              {top100Signal && (
                <div className="bg-slate-800/50 border border-slate-700/70 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5">
                      <Flame size={14} /> Top 100 Manažérsky konsenzus
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      Uzávierka GW{top100Snapshot?.closedDeadlineGw || 6}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3">
                    Aktivita najlepších 100 manažérov na svete pri prestupoch tohto hráča:
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center font-mono">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
                      <div className="text-[10px] text-slate-400 uppercase">Kúpené (IN)</div>
                      <div className="text-sm font-black text-emerald-400">+{top100Signal.in}x</div>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
                      <div className="text-[10px] text-slate-400 uppercase">Predané (OUT)</div>
                      <div className="text-sm font-black text-rose-400">-{top100Signal.out}x</div>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
                      <div className="text-[10px] text-slate-400 uppercase">Čistá bilancia (Net)</div>
                      <div className={`text-sm font-black ${
                        top100Signal.net > 0 ? 'text-emerald-400' : top100Signal.net < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {top100Signal.net > 0 ? `+${top100Signal.net}` : top100Signal.net}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MINULÉ SEZÓNY */}
          {activeTab === 'past' && !loading && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden shadow">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-400" />
                    Kariérna história v Premier League (minulé ročníky)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-700/60 select-none">
                        <th className="py-2.5 px-3">Sezóna</th>
                        <th className="py-2.5 px-3 text-right">Minúty</th>
                        <th className="py-2.5 px-3 text-right font-bold text-white">Celk. Body</th>
                        <th className="py-2.5 px-3 text-center" title="Góly">Góly</th>
                        <th className="py-2.5 px-3 text-center" title="Asistencie">Asistencie</th>
                        <th className="py-2.5 px-3 text-center" title="Čisté kontá">Čisté kontá</th>
                        <th className="py-2.5 px-3 text-center" title="Bonusové body">Bonusy</th>
                        <th className="py-2.5 px-3 text-right">Poč. Cena</th>
                        <th className="py-2.5 px-3 text-right">Konc. Cena</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40 font-mono">
                      {pastSeasons.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-sans text-xs">
                            Žiadne predchádzajúce sezóny v databáze (nováčik v Premier League).
                          </td>
                        </tr>
                      ) : (
                        [...pastSeasons].reverse().map((s) => (
                          <tr key={s.season_name} className="hover:bg-slate-800/60 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-white font-sans">{s.season_name}</td>
                            <td className="py-2.5 px-3 text-right text-slate-300">{s.minutes}'</td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-400 text-sm">
                              {s.total_points}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-200">{s.goals_scored}</td>
                            <td className="py-2.5 px-3 text-center text-slate-200">{s.assists}</td>
                            <td className="py-2.5 px-3 text-center text-slate-200">{s.clean_sheets}</td>
                            <td className="py-2.5 px-3 text-center text-amber-400">{s.bonus}</td>
                            <td className="py-2.5 px-3 text-right text-slate-400">£{(s.start_cost / 10).toFixed(1)}</td>
                            <td className="py-2.5 px-3 text-right text-blue-300">£{(s.end_cost / 10).toFixed(1)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
    </div>
  );
};
