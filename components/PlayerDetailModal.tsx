import React, { useState, useEffect, useMemo } from 'react';
import { FPLPlayer, FPLTeam, FPLElementSummary, FPLFixture } from '../types';
import { getPlayerSummary, getPlayerImageUrl } from '../services/fplService';
import { Top100Snapshot, Top100PlayerSignal } from '../services/top100Service';
import { findTop100Signal } from '../lib/top100Matcher';
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
  History
} from 'lucide-react';

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
  teams,
  allPlayers = [],
  top100Snapshot,
  fixtures = [],
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'rankings' | 'past'>('history');
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
    return teams.find((t) => t.id === player.team) || null;
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
    if (!player || !top100Snapshot?.templateAnalysis?.templateTiers) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const playerNorm = norm(player.web_name);
    return top100Snapshot.templateAnalysis.templateTiers.find((t) => norm(t.player).includes(playerNorm) || playerNorm.includes(norm(t.player)));
  }, [player, top100Snapshot]);

  // League Rankings within position and overall
  const rankings = useMemo(() => {
    if (!player || allPlayers.length === 0) return null;

    const samePos = allPlayers.filter((p) => p.element_type === player.element_type);
    const totalInPos = samePos.length;
    const totalOverall = allPlayers.length;

    // Helper to calculate rank (1-based)
    const getRank = (list: FPLPlayer[], scoreFn: (p: FPLPlayer) => number) => {
      const sorted = [...list].sort((a, b) => scoreFn(b) - scoreFn(a));
      const idx = sorted.findIndex((p) => p.id === player.id);
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

  if (!isOpen || !player) return null;

  const pointsHistory = summary?.history || [];
  const pastSeasons = summary?.history_past || [];

  // Upcoming 5-6 fixtures
  const upcomingFixtures = useMemo(() => {
    if (!player) return [];

    // 1. Try summary.fixtures from FPL API element-summary first
    if (summary?.fixtures && Array.isArray(summary.fixtures) && summary.fixtures.length > 0) {
      return summary.fixtures
        .filter((f: any) => !f.finished)
        .slice(0, 6)
        .map((f: any) => {
          const isHome = Boolean(f.is_home);
          const oppId = isHome ? f.team_a : f.team_h;
          const oppTeam = teams.find((t) => t.id === oppId);
          return {
            id: f.id,
            event: f.event,
            isHome,
            opponentShort: oppTeam?.short_name || (isHome ? `T${f.team_a}` : `T${f.team_h}`),
            opponentName: oppTeam?.name || 'Unknown',
            difficulty: f.difficulty || 3,
            kickoffTime: f.kickoff_time,
          };
        });
    }

    // 2. Fallback to fixtures prop if summary is still loading or empty
    if (fixtures && fixtures.length > 0) {
      return fixtures
        .filter((f) => !f.finished && (f.team_h === player.team || f.team_a === player.team))
        .sort((a, b) => (a.event || 99) - (b.event || 99))
        .slice(0, 6)
        .map((f) => {
          const isHome = f.team_h === player.team;
          const oppId = isHome ? f.team_a : f.team_h;
          const oppTeam = teams.find((t) => t.id === oppId);
          const difficulty = isHome ? (f.team_h_difficulty || 3) : (f.team_a_difficulty || 3);
          return {
            id: f.id,
            event: f.event,
            isHome,
            opponentShort: oppTeam?.short_name || 'UNK',
            opponentName: oppTeam?.name || 'Unknown',
            difficulty,
            kickoffTime: f.kickoff_time,
          };
        });
    }

    return [];
  }, [player, summary?.fixtures, fixtures, teams]);

  const getDifficultyColor = (score: number) => {
    switch (score) {
      case 1:
        return 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50';
      case 2:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 3:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
      case 4:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 5:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
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
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                    <Shield size={28} className={posInfo.color} />
                    <span className="text-[10px] font-bold mt-1 uppercase font-mono">{team?.short_name || 'FPL'}</span>
                  </div>
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
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border font-mono transition-all hover:scale-105 shadow-sm ${diffCls}`}
                      title={`${fix.opponentName} (${fix.isHome ? 'Doma' : 'Vonku'}) · Kolo ${fix.event} · FDR ${fix.difficulty}/5`}
                    >
                      <div className="flex items-center justify-between w-full text-[9px] font-bold opacity-80 px-0.5">
                        <span>GW{fix.event}</span>
                        <span className="text-[8px] font-extrabold px-1 rounded bg-black/40">
                          {fix.isHome ? 'DOMA' : 'VON'}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm font-black tracking-tight my-1 truncate max-w-full">
                        {fix.opponentShort}
                      </div>
                      <div className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/30 border border-white/10">
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
                      const opp = teams.find((t) => t.id === h.opponent_team)?.short_name || 'UNK';
                      const heightPercent = maxGwPoints > 0 ? Math.max(12, (h.total_points / Math.max(maxGwPoints, 12)) * 100) : 10;
                      return (
                        <div key={h.round} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 bg-slate-950 text-white text-[10px] font-mono py-1 px-1.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                            GW{h.round}: {h.total_points} pts vs {opp} ({h.was_home ? 'H' : 'A'}) · {h.minutes}'
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

              {/* Detailed Match History Table */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden shadow">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Activity size={14} className="text-emerald-400" />
                    Zápasový denník (Aktuálna sezóna)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Spolu odohraných: <strong className="text-white font-mono">{player.minutes} minút</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-700/60 select-none">
                        <th className="py-2.5 px-3">Kolo</th>
                        <th className="py-2.5 px-3">Súper</th>
                        <th className="py-2.5 px-3 text-center">Výsledok</th>
                        <th className="py-2.5 px-3 text-right">Minúty</th>
                        <th className="py-2.5 px-3 text-right font-bold text-white">Body</th>
                        <th className="py-2.5 px-2 text-center" title="Góly">G</th>
                        <th className="py-2.5 px-2 text-center" title="Asistencie">A</th>
                        <th className="py-2.5 px-2 text-center" title="Čisté konto">CS</th>
                        <th className="py-2.5 px-2 text-center" title="Bonusové body">Bonus</th>
                        <th className="py-2.5 px-3 text-right" title="Bonus Points System">BPS</th>
                        <th className="py-2.5 px-3 text-right" title="Expected Goals (xG)">xG</th>
                        <th className="py-2.5 px-3 text-right" title="Expected Assists (xA)">xA</th>
                        <th className="py-2.5 px-3 text-right">Cena</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40 font-mono">
                      {pointsHistory.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-8 text-center text-slate-400 font-sans text-xs">
                            Zatiaľ žiadne odohrané zápasy v tejto sezóne.
                          </td>
                        </tr>
                      ) : (
                        [...pointsHistory].reverse().map((h) => {
                          const opp = teams.find((t) => t.id === h.opponent_team)?.short_name || `ID ${h.opponent_team}`;
                          const res = getResultBadge(h);
                          const hasScore = h.team_h_score !== null && h.team_a_score !== null && h.team_h_score !== undefined && h.team_a_score !== undefined;
                          const scoreText = hasScore ? (h.was_home ? `${h.team_h_score}-${h.team_a_score}` : `${h.team_a_score}-${h.team_h_score}`) : '-';
                          return (
                            <tr key={h.round} className="hover:bg-slate-800/60 transition-colors">
                              <td className="py-2 px-3 font-bold text-white">GW{h.round}</td>
                              <td className="py-2 px-3">
                                <span className="font-semibold text-slate-200">{opp}</span>
                                <span className="text-[10px] text-slate-500 ml-1 font-sans">
                                  ({h.was_home ? 'Doma' : 'Vonku'})
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {hasScore ? (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${res.cls}`}>
                                    {scoreText} ({res.text})
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[11px]">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-300">{h.minutes}'</td>
                              <td className="py-2 px-3 text-right">
                                <span className={`inline-block px-2 py-0.5 rounded border text-xs ${getPointsBadgeClass(h.total_points)}`}>
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
                              <td className="py-2 px-3 text-right text-slate-400">{h.bps}</td>
                              <td className="py-2 px-3 text-right text-slate-400 font-sans text-[11px]">{h.expected_goals}</td>
                              <td className="py-2 px-3 text-right text-slate-400 font-sans text-[11px]">{h.expected_assists}</td>
                              <td className="py-2 px-3 text-right text-blue-300">£{(h.value / 10).toFixed(1)}</td>
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
