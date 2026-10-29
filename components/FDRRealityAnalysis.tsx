import React, { useState, useEffect, useMemo } from 'react';
import { FPLFixture, FPLPlayer, FPLTeam, FPLEvent } from '../types';
import {
  computeGlobalFDRReality,
  loadBatchPlayerFDRProfiles,
  computePositionalImpacts,
  computeAllPlayersPointsBreakdown,
  loadSinglePlayerFDRProfile,
  PlayerFDRProfile,
  GlobalFDRRealityReport,
  FDRPositionImpact,
  PlayerFDRArchetype,
  PlayerPointsBreakdown
} from '../lib/fdrAnalysisModel';
import { TeamIcon } from './TeamIcon';
import { PlayerDetailModal } from './PlayerDetailModal';
import {
  TrendingUp,
  Shield,
  Target,
  Home,
  AlertTriangle,
  Sparkles,
  Zap,
  HelpCircle,
  Search,
  Filter,
  Flame,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BarChart2,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface FDRRealityAnalysisProps {
  fixtures: FPLFixture[];
  teams: FPLTeam[];
  players: FPLPlayer[];
  events: FPLEvent[];
}

const POSITION_LABELS: Record<number, { name: string; short: string; color: string; bg: string }> = {
  1: { name: 'Brankári', short: 'GKP', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  2: { name: 'Obrancovia', short: 'DEF', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  3: { name: 'Stredopoliari', short: 'MID', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  4: { name: 'Útočníci', short: 'FWD', color: 'text-rose-400', bg: 'bg-rose-400/10' },
};

const FDRRealityAnalysis: React.FC<FDRRealityAnalysisProps> = ({
  fixtures,
  teams,
  players,
  events,
}) => {
  // Global instant stats from fixtures
  const globalStats: GlobalFDRRealityReport = useMemo(() => {
    return computeGlobalFDRReality(fixtures, teams);
  }, [fixtures, teams]);

  // Player profiles state
  const [profiles, setProfiles] = useState<PlayerFDRProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const [hasLoadedProfiles, setHasLoadedProfiles] = useState(false);

  // Filters & Tabs
  const [activeSubTab, setActiveSubTab] = useState<'verdict' | 'positions' | 'all_players' | 'players' | 'teams'>('all_players');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosFilter, setSelectedPosFilter] = useState<number | 'all'>('all');
  const [selectedArchetypeFilter, setSelectedArchetypeFilter] = useState<PlayerFDRArchetype | 'all'>('all');
  const [sortKey, setSortKey] = useState<'points' | 'drop' | 'fdr2' | 'fdr45'>('points');

  // All players breakdown state
  const [allPlayersSearch, setAllPlayersSearch] = useState('');
  const [allPlayersPos, setAllPlayersPos] = useState<number | 'all'>('all');
  const [allPlayersTeam, setAllPlayersTeam] = useState<number | 'all'>('all');
  const [allPlayersSource, setAllPlayersSource] = useState<string>('all');
  const [allPlayersSort, setAllPlayersSort] = useState<'total_points' | 'ptsGoals' | 'ptsAssists' | 'ptsCleanSheets' | 'ptsBonus' | 'ptsAppearance' | 'ppg' | 'value'>('total_points');
  const [allPlayersLimit, setAllPlayersLimit] = useState(50);
  const [allPlayersOnlyActive, setAllPlayersOnlyActive] = useState(true);
  const [loadingSingleId, setLoadingSingleId] = useState<number | null>(null);

  // Selected player for detail modal / inspection
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<FPLPlayer | null>(null);
  const [inspectedProfile, setInspectedProfile] = useState<PlayerFDRProfile | null>(null);

  // Auto-load top players on mount (or top 55 players)
  useEffect(() => {
    if (hasLoadedProfiles || loadingProfiles || players.length === 0) return;

    const loadTopPlayers = async () => {
      setLoadingProfiles(true);
      // Pick top 60 players across all positions (by total points + ownership)
      const sortedPool = [...players]
        .filter(p => p.total_points > 15)
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 55);

      try {
        const loaded = await loadBatchPlayerFDRProfiles(
          sortedPool,
          fixtures,
          teams,
          (cur, tot) => setLoadProgress({ loaded: cur, total: tot })
        );
        setProfiles(loaded);
        setHasLoadedProfiles(true);
      } catch (err) {
        console.error('Error loading FDR player profiles:', err);
      } finally {
        setLoadingProfiles(false);
      }
    };

    loadTopPlayers();
  }, [players, fixtures, teams, hasLoadedProfiles, loadingProfiles]);

  // Positional averages
  const positionImpacts: FDRPositionImpact[] = useMemo(() => {
    if (profiles.length === 0) return [];
    return computePositionalImpacts(profiles);
  }, [profiles]);

  // All players breakdown
  const allBreakdowns: PlayerPointsBreakdown[] = useMemo(() => {
    return computeAllPlayersPointsBreakdown(players, teams);
  }, [players, teams]);

  // Macro positional points distribution across whole league
  const leaguePositionalBreakdown = useMemo(() => {
    const res: Record<number, {
      count: number;
      totalPts: number;
      pctGoals: number;
      pctAssists: number;
      pctCleanSheets: number;
      pctBonus: number;
      pctAppearance: number;
      pctSaves: number;
    }> = {};

    [1, 2, 3, 4].forEach(pos => {
      const pList = allBreakdowns.filter(p => p.element_type === pos && p.total_points > 0);
      const totalPts = pList.reduce((s, p) => s + p.total_points, 0) || 1;
      const ptsGoals = pList.reduce((s, p) => s + p.ptsGoals, 0);
      const ptsAssists = pList.reduce((s, p) => s + p.ptsAssists, 0);
      const ptsCleanSheets = pList.reduce((s, p) => s + p.ptsCleanSheets, 0);
      const ptsBonus = pList.reduce((s, p) => s + p.ptsBonus, 0);
      const ptsAppearance = pList.reduce((s, p) => s + p.ptsAppearance, 0);
      const ptsSaves = pList.reduce((s, p) => s + p.ptsSaves, 0);

      const posPositive = Math.max(1, ptsGoals + ptsAssists + ptsCleanSheets + ptsBonus + ptsAppearance + ptsSaves);

      res[pos] = {
        count: pList.length,
        totalPts,
        pctGoals: Math.round((ptsGoals / posPositive) * 100),
        pctAssists: Math.round((ptsAssists / posPositive) * 100),
        pctCleanSheets: Math.round((ptsCleanSheets / posPositive) * 100),
        pctBonus: Math.round((ptsBonus / posPositive) * 100),
        pctAppearance: Math.round((ptsAppearance / posPositive) * 100),
        pctSaves: Math.round((ptsSaves / posPositive) * 100),
      };
    });

    return res;
  }, [allBreakdowns]);

  // Filtered all players breakdown
  const filteredAllBreakdowns = useMemo(() => {
    return allBreakdowns.filter(p => {
      if (allPlayersOnlyActive && p.minutes <= 0) return false;
      if (allPlayersPos !== 'all' && p.element_type !== allPlayersPos) return false;
      if (allPlayersTeam !== 'all' && p.team !== allPlayersTeam) return false;
      if (allPlayersSource !== 'all' && p.primarySourceKey !== allPlayersSource) return false;
      if (allPlayersSearch.trim()) {
        const q = allPlayersSearch.toLowerCase();
        const matches = p.web_name.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          p.second_name.toLowerCase().includes(q) ||
          p.team_short.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    }).sort((a, b) => {
      if (allPlayersSort === 'total_points') return b.total_points - a.total_points;
      if (allPlayersSort === 'ptsGoals') return b.ptsGoals - a.ptsGoals;
      if (allPlayersSort === 'ptsAssists') return b.ptsAssists - a.ptsAssists;
      if (allPlayersSort === 'ptsCleanSheets') return b.ptsCleanSheets - a.ptsCleanSheets;
      if (allPlayersSort === 'ptsBonus') return b.ptsBonus - a.ptsBonus;
      if (allPlayersSort === 'ptsAppearance') return b.ptsAppearance - a.ptsAppearance;
      if (allPlayersSort === 'ppg') return parseFloat(b.points_per_game || '0') - parseFloat(a.points_per_game || '0');
      if (allPlayersSort === 'value') {
        const valA = a.total_points / (a.now_cost / 10);
        const valB = b.total_points / (b.now_cost / 10);
        return valB - valA;
      }
      return 0;
    });
  }, [allBreakdowns, allPlayersOnlyActive, allPlayersPos, allPlayersTeam, allPlayersSource, allPlayersSearch, allPlayersSort]);

  // On-demand FDR profile loader for any player
  const handleInspectAnyPlayerFDR = async (playerId: number) => {
    const original = players.find(p => p.id === playerId);
    if (!original) return;

    const existing = profiles.find(p => p.id === playerId);
    if (existing) {
      setInspectedProfile(existing);
      return;
    }

    setLoadingSingleId(playerId);
    try {
      const prof = await loadSinglePlayerFDRProfile(original, fixtures, teams);
      if (prof) {
        setProfiles(prev => [...prev, prof]);
        setInspectedProfile(prof);
      } else {
        setSelectedPlayerForModal(original);
      }
    } catch {
      setSelectedPlayerForModal(original);
    } finally {
      setLoadingSingleId(null);
    }
  };

  // Filtered player profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (selectedPosFilter !== 'all' && p.element_type !== selectedPosFilter) return false;
      if (selectedArchetypeFilter !== 'all' && p.archetype !== selectedArchetypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.web_name.toLowerCase().includes(q) && !p.team_short.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortKey === 'points') return b.total_points - a.total_points;
      if (sortKey === 'drop') return b.dropPct - a.dropPct;
      if (sortKey === 'fdr2') return b.avgPtsFdr2 - a.avgPtsFdr2;
      if (sortKey === 'fdr45') return b.avgPtsFdr45 - a.avgPtsFdr45;
      return 0;
    });
  }, [profiles, selectedPosFilter, selectedArchetypeFilter, searchQuery, sortKey]);

  // Team FDR stats
  const teamFDRPerformance = useMemo(() => {
    const finished = fixtures.filter(f => f.finished && f.team_h_score !== null && f.team_a_score !== null);
    const map = new Map<number, {
      team: FPLTeam;
      fdr2Matches: number;
      fdr2Wins: number;
      fdr2CleanSheets: number;
      fdr45Matches: number;
      fdr45Wins: number;
      fdr45CleanSheets: number;
    }>();

    teams.forEach(t => {
      map.set(t.id, {
        team: t,
        fdr2Matches: 0,
        fdr2Wins: 0,
        fdr2CleanSheets: 0,
        fdr45Matches: 0,
        fdr45Wins: 0,
        fdr45CleanSheets: 0,
      });
    });

    finished.forEach(f => {
      const hDiff = f.team_h_difficulty || 3;
      const aDiff = f.team_a_difficulty || 3;
      const hScore = f.team_h_score!;
      const aScore = f.team_a_score!;

      const hStat = map.get(f.team_h);
      if (hStat) {
        if (hDiff <= 2) {
          hStat.fdr2Matches++;
          if (hScore > aScore) hStat.fdr2Wins++;
          if (aScore === 0) hStat.fdr2CleanSheets++;
        } else if (hDiff >= 4) {
          hStat.fdr45Matches++;
          if (hScore > aScore) hStat.fdr45Wins++;
          if (aScore === 0) hStat.fdr45CleanSheets++;
        }
      }

      const aStat = map.get(f.team_a);
      if (aStat) {
        if (aDiff <= 2) {
          aStat.fdr2Matches++;
          if (aScore > hScore) aStat.fdr2Wins++;
          if (hScore === 0) aStat.fdr2CleanSheets++;
        } else if (aDiff >= 4) {
          aStat.fdr45Matches++;
          if (aScore > hScore) aStat.fdr45Wins++;
          if (hScore === 0) aStat.fdr45CleanSheets++;
        }
      }
    });

    return Array.from(map.values())
      .filter(t => t.fdr2Matches + t.fdr45Matches > 0)
      .sort((a, b) => {
        const aWinRate = a.fdr2Matches > 0 ? a.fdr2Wins / a.fdr2Matches : 0;
        const bWinRate = b.fdr2Matches > 0 ? b.fdr2Wins / b.fdr2Matches : 0;
        return bWinRate - aWinRate;
      });
  }, [fixtures, teams]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Banner / Verdict Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} className="text-indigo-400" />
              <span>Dátový Verdikt &bull; Skutočná úspešnosť FDR</span>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Má zmysel sledovať zápasy a FDR?{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                JEDNOZNAČNE ÁNO.
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Analýza všetkých <strong>{globalStats.totalFinishedFixtures} odohraných zápasov</strong> tejto sezóny
              preukazuje dramatické rozdiely: obrana stráca v ťažkých dueloch až{' '}
              <strong className="text-rose-400">{Math.abs(globalStats.fdr2Vs45CleanSheetDiffPct)}% čistých kont</strong>, kým prémioví útočníci
              dokážu bodovať aj proti najťažším súperom.
            </p>
          </div>

          {/* Quick Stat Pill in Hero */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full sm:w-auto">
            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-3 px-4 shadow-lg flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-lg">
                +{Math.abs(globalStats.fdr2Vs45GoalsDiffPct)}%
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gólová explózia</div>
                <div className="text-xs font-semibold text-slate-200">Viac gólov v FDR 2 vs FDR 4/5</div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-3 px-4 shadow-lg flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/20 text-rose-400 font-black text-lg">
                {globalStats.fdr2Vs45CleanSheetDiffPct}%
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Prepad obrany</div>
                <div className="text-xs font-semibold text-slate-200">Menej čistých kont v FDR 4/5</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Macro Key Metrics Bar */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {globalStats.keyConclusions.map((kc, idx) => {
            const colorClasses = {
              emerald: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400',
              amber: 'border-amber-500/30 bg-amber-950/20 text-amber-400',
              rose: 'border-rose-500/30 bg-rose-950/20 text-rose-400',
              purple: 'border-purple-500/30 bg-purple-950/20 text-purple-400',
              blue: 'border-blue-500/30 bg-blue-950/20 text-blue-400',
            }[kc.color];

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.02] flex flex-col justify-between ${colorClasses}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      Zistenie #{idx + 1}
                    </span>
                    <span className="text-xs font-black px-1.5 py-0.5 rounded bg-slate-900/80 border border-white/10">
                      {kc.highlight}
                    </span>
                  </div>
                  <h4 className="text-xs md:text-sm font-bold text-white mb-1.5 leading-snug">
                    {kc.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                    {kc.body}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono font-bold text-white">
                  <span className="text-slate-400 text-[10px] font-sans">Hodnota:</span>
                  <span>{kc.stat}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveSubTab('verdict')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeSubTab === 'verdict'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <BarChart2 size={16} />
          <span>FDR vs Realita (Makro dáta)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('positions')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeSubTab === 'positions'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Layers size={16} />
          <span>Vplyv podľa pozícií (GKP/DEF/MID/FWD)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('all_players')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all relative ${
            activeSubTab === 'all_players'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <BarChart2 size={16} />
          <span>Rozpad bodov hráčov (Všetci {players.length})</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-white font-extrabold">
            KOMPLET
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('players')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all relative ${
            activeSubTab === 'players'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Target size={16} />
          <span>FDR Citlivosť & Archetypy</span>
          {profiles.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500 text-white font-extrabold">
              {profiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('teams')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeSubTab === 'teams'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Shield size={16} />
          <span>Tímová úspešnosť v FDR 2 vs FDR 4/5</span>
        </button>
      </div>

      {/* ----------------- SUB-TAB 1: VERDICT & MACRO BREAKDOWN ----------------- */}
      {activeSubTab === 'verdict' && (
        <div className="space-y-6">
          {/* Difficulty Breakdown Table */}
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart2 size={18} className="text-purple-400" />
                  Výsledky zápasov Premier League rozdelené podľa FDR
                </h3>
                <p className="text-xs text-slate-400">
                  Čím nižšie FDR, tým vyššia pravdepodobnosť výhry, gólov a čistých kont
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Spolu zápasových inštancií: <strong className="text-white">{globalStats.totalTeamInstances}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Obtiažnosť (FDR)</th>
                    <th className="py-2.5 px-3 text-center">Počet inštancií</th>
                    <th className="py-2.5 px-3 text-center">Výhry (Win %)</th>
                    <th className="py-2.5 px-3 text-center">Čisté kontá (CS %)</th>
                    <th className="py-2.5 px-3 text-center">Góly na zápas</th>
                    <th className="py-2.5 px-3 text-center">Inkasované na zápas</th>
                    <th className="py-2.5 px-3 text-right">Šanca na CS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-xs font-medium text-slate-200">
                  {[2, 3, 4, 5].map(diff => {
                    const s = globalStats.statsByFdr[diff];
                    if (!s || s.matchesCount === 0) return null;

                    const badgeColor = {
                      2: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                      3: 'bg-slate-700 text-slate-300 border-slate-600',
                      4: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      5: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                    }[diff];

                    return (
                      <tr key={diff} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${badgeColor}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">{s.matchesCount} zápasov</td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={s.winPct >= 50 ? 'text-emerald-400' : s.winPct <= 25 ? 'text-rose-400' : 'text-slate-300'}>
                            {s.winPct}% ({s.wins}W / {s.draws}D / {s.losses}L)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={s.cleanSheetPct >= 30 ? 'text-emerald-400' : s.cleanSheetPct <= 15 ? 'text-rose-400' : 'text-slate-300'}>
                            {s.cleanSheetPct}% ({s.cleanSheets} CS)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-100">
                          {s.avgGoalsScored}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                          {s.avgGoalsConceded}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="w-24 ml-auto bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                            <div
                              className={`h-full ${
                                s.cleanSheetPct >= 30 ? 'bg-emerald-400' : s.cleanSheetPct >= 20 ? 'bg-amber-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${Math.min(100, s.cleanSheetPct * 2.5)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Home vs Away Comparison Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Home size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Domáce prostredie (Home Advantage)</h4>
                    <p className="text-xs text-slate-400">FPL hráči doma získavajú výrazne viac bodov</p>
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">Výhry domácich:</span>
                      <span className="font-mono font-bold text-emerald-400">{globalStats.homeWinPct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${globalStats.homeWinPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">Čisté kontá doma:</span>
                      <span className="font-mono font-bold text-emerald-400">{globalStats.homeCleanSheetPct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${globalStats.homeCleanSheetPct * 2}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">Priemer strelených gólov:</span>
                      <span className="font-mono font-bold text-emerald-400">{globalStats.homeAvgGoals} na zápas</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-300 italic">
                💡 <strong>Tip pre FPL:</strong> Ak váhaš medzi dvoma obrancami s rovnakým FDR, vždy uprednostni domáceho.
              </div>
            </div>

            <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Target size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Vonkajšie zápasy (Away Impact)</h4>
                    <p className="text-xs text-slate-400">Hostia majú ťažšiu cestu k clean sheetom</p>
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">Výhry hostí:</span>
                      <span className="font-mono font-bold text-indigo-400">{globalStats.awayWinPct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${globalStats.awayWinPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">Čisté kontá vonku:</span>
                      <span className="font-mono font-bold text-indigo-400">{globalStats.awayCleanSheetPct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${globalStats.awayCleanSheetPct * 2}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">Priemer strelených gólov:</span>
                      <span className="font-mono font-bold text-indigo-400">{globalStats.awayAvgGoals} na zápas</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-300 italic">
                ⚠️ <strong>Pozor:</strong> Vonku aj silné tímy inkasujú o 40% častejšie než na vlastnom trávniku.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SUB-TAB 2: POSITIONS IMPACT ----------------- */}
      {activeSubTab === 'positions' && (
        <div className="space-y-6">
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-5 shadow-lg">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Layers size={18} className="text-purple-400" />
              Ktorá pozícia trpí na ťažký žreb najviac?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Mnoho manažérov predáva útočníkov, keď majú ťažký žreb. Dáta však ukazujú, že to je najčastejšia chyba:
              <strong> útočníci a elitní krídelníci skórujú aj proti silným súperom</strong>, kým obranné body (clean sheets) v ťažkých zápasoch takmer úplne miznú.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {positionImpacts.map(pos => {
                const isDef = pos.positionId === 2;
                const isGkp = pos.positionId === 1;
                const isFwd = pos.positionId === 4;

                const posConfig = POSITION_LABELS[pos.positionId];

                return (
                  <div
                    key={pos.positionId}
                    className={`p-5 rounded-xl border bg-slate-900/60 transition-all ${
                      isDef
                        ? 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                        : isFwd
                        ? 'border-emerald-500/40'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${posConfig.bg} ${posConfig.color}`}>
                          {posConfig.short}
                        </span>
                        <h4 className="text-sm font-bold text-white">{pos.positionName}</h4>
                      </div>
                      <span
                        className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                          pos.dropPct >= 40
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : pos.dropPct <= 20
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {pos.dropPct > 0 ? `-${pos.dropPct}% prepad` : 'Min. prepad'}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-300 mb-3">
                      Verdikt: <span className={isDef ? 'text-rose-400 font-black' : isFwd ? 'text-emerald-400 font-black' : 'text-slate-200'}>{pos.verdict}</span>
                    </div>

                    {/* Progress Comparison */}
                    <div className="space-y-2 mb-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-emerald-400 font-bold">Ľahký žreb (FDR 2 priemer):</span>
                          <span className="font-mono font-bold text-white">{pos.avgPtsFdr2} bodov / zápas</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, pos.avgPtsFdr2 * 14)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-rose-400 font-bold">Ťažký žreb (FDR 4/5 priemer):</span>
                          <span className="font-mono font-bold text-white">{pos.avgPtsFdr45} bodov / zápas</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, pos.avgPtsFdr45 * 14)}%` }} />
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      👉 <strong>Pravidlo:</strong> {pos.recommendation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SUB-TAB: ALL PLAYERS HISTORICAL POINTS BREAKDOWN ----------------- */}
      {activeSubTab === 'all_players' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart2 size={18} className="text-purple-400" />
                  Historický rozpad bodovania všetkých {players.length} hráčov
                </h3>
                <p className="text-xs text-slate-400">
                  Zistite z čoho reálne pramenia body každého hráča: góly, asistencie, čisté kontá, bonusy, odohrané minúty a zákroky.
                </p>
              </div>

              {/* Legend of stacked bar */}
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-300 flex-wrap bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-black">Zložky:</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Góly</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> Asistencie</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Čisté kontá</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Bonus</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span> Zákroky</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> Minúty</span>
              </div>
            </div>

            {/* Positional Macro Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[1, 2, 3, 4].map(pid => {
                const pInfo = POSITION_LABELS[pid];
                const pStat = leaguePositionalBreakdown[pid];
                if (!pStat) return null;

                return (
                  <div key={pid} className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${pInfo.bg} ${pInfo.color}`}>
                        {pInfo.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{pStat.count} hráčov</span>
                    </div>

                    <div className="space-y-1.5 text-xs pt-1">
                      {pid === 4 && (
                        <>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Góly:</span><strong className="text-emerald-400">{pStat.pctGoals}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Minúty:</span><strong className="text-purple-300">{pStat.pctAppearance}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Asistencie:</span><strong className="text-blue-300">{pStat.pctAssists}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Bonusy:</span><strong className="text-amber-300">{pStat.pctBonus}% bodov</strong></div>
                        </>
                      )}
                      {pid === 3 && (
                        <>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Góly:</span><strong className="text-emerald-400">{pStat.pctGoals}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Asistencie:</span><strong className="text-blue-400">{pStat.pctAssists}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Minúty:</span><strong className="text-purple-300">{pStat.pctAppearance}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Čisté kontá:</span><strong className="text-cyan-300">{pStat.pctCleanSheets}% bodov</strong></div>
                        </>
                      )}
                      {pid === 2 && (
                        <>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Čisté kontá:</span><strong className="text-cyan-400">{pStat.pctCleanSheets}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Minúty:</span><strong className="text-purple-300">{pStat.pctAppearance}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Góly + Asistencie:</span><strong className="text-emerald-300">{pStat.pctGoals + pStat.pctAssists}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Bonusy:</span><strong className="text-amber-300">{pStat.pctBonus}% bodov</strong></div>
                        </>
                      )}
                      {pid === 1 && (
                        <>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Čisté kontá:</span><strong className="text-cyan-400">{pStat.pctCleanSheets}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Zákroky (Saves):</span><strong className="text-orange-400">{pStat.pctSaves}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Minúty:</span><strong className="text-purple-300">{pStat.pctAppearance}% bodov</strong></div>
                          <div className="flex justify-between text-[11px]"><span className="text-slate-400">Bonusy:</span><strong className="text-amber-300">{pStat.pctBonus}% bodov</strong></div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/80 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                {/* Search */}
                <div className="relative md:col-span-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Vyhľadať ľubovoľného hráča alebo tím..."
                    value={allPlayersSearch}
                    onChange={e => {
                      setAllPlayersSearch(e.target.value);
                      setAllPlayersLimit(50);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Team Selector */}
                <select
                  value={allPlayersTeam}
                  onChange={e => {
                    setAllPlayersTeam(e.target.value === 'all' ? 'all' : Number(e.target.value));
                    setAllPlayersLimit(50);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">Všetky kluby (20)</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* Sort selector */}
                <select
                  value={allPlayersSort}
                  onChange={e => setAllPlayersSort(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="total_points">Zoradiť: Celkové body</option>
                  <option value="ptsGoals">Zoradiť: Body z gólov</option>
                  <option value="ptsAssists">Zoradiť: Body z asistencií</option>
                  <option value="ptsCleanSheets">Zoradiť: Body z čistých kont</option>
                  <option value="ptsBonus">Zoradiť: Bonusové body (BPS)</option>
                  <option value="ptsAppearance">Zoradiť: Odohrané minúty</option>
                  <option value="ppg">Zoradiť: Body na zápas (PPG)</option>
                  <option value="value">Zoradiť: Hodnota (Pts / £m)</option>
                </select>
              </div>

              {/* Second row of pills */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                {/* Pos Buttons */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    onClick={() => { setSelectedPosFilter('all'); setAllPlayersPos('all'); setAllPlayersLimit(50); }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      allPlayersPos === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Všetky posty
                  </button>
                  {[1, 2, 3, 4].map(pid => (
                    <button
                      key={pid}
                      onClick={() => { setAllPlayersPos(pid); setAllPlayersLimit(50); }}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        allPlayersPos === pid ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {POSITION_LABELS[pid].short}
                    </button>
                  ))}
                </div>

                {/* Primary Source Filter */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    onClick={() => { setAllPlayersSource('all'); setAllPlayersLimit(50); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      allPlayersSource === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Všetky zdroje
                  </button>
                  <button
                    onClick={() => { setAllPlayersSource('goals'); setAllPlayersLimit(50); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      allPlayersSource === 'goals' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                    }`}
                  >
                    ⚽ Góly
                  </button>
                  <button
                    onClick={() => { setAllPlayersSource('assists'); setAllPlayersLimit(50); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      allPlayersSource === 'assists' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400 hover:bg-slate-700'
                    }`}
                  >
                    👟 Asistencie
                  </button>
                  <button
                    onClick={() => { setAllPlayersSource('clean_sheets'); setAllPlayersLimit(50); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      allPlayersSource === 'clean_sheets' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-cyan-400 hover:bg-slate-700'
                    }`}
                  >
                    🛡️ Čisté kontá
                  </button>
                  <button
                    onClick={() => { setAllPlayersSource('bonus'); setAllPlayersLimit(50); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      allPlayersSource === 'bonus' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                    }`}
                  >
                    ⭐ Bonusy
                  </button>
                </div>

                {/* Only active toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none ml-auto">
                  <input
                    type="checkbox"
                    checked={allPlayersOnlyActive}
                    onChange={e => setAllPlayersOnlyActive(e.target.checked)}
                    className="accent-purple-600 rounded"
                  />
                  <span>Iba aktívni (odohrali minúty)</span>
                </label>
              </div>
            </div>
          </div>

          {/* All Players Table */}
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Hráč</th>
                    <th className="py-3 px-3 text-center">Body (PPG)</th>
                    <th className="py-3 px-3 text-center">Rozpad zložiek bodov</th>
                    <th className="py-3 px-3 text-center">Góly</th>
                    <th className="py-3 px-3 text-center">Asistencie</th>
                    <th className="py-3 px-3 text-center">Čisté kontá</th>
                    <th className="py-3 px-3 text-center">Bonus</th>
                    <th className="py-3 px-3 text-center">Minúty</th>
                    <th className="py-3 px-3">Hlavný motor</th>
                    <th className="py-3 px-3 text-right">Inšpekcia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-xs font-medium text-slate-200">
                  {filteredAllBreakdowns.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        Žiadni hráči nezodpovedajú zvoleným filtrom.
                      </td>
                    </tr>
                  ) : (
                    filteredAllBreakdowns.slice(0, allPlayersLimit).map((p, idx) => {
                      const pos = POSITION_LABELS[p.element_type];

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-700/40 transition-colors group cursor-pointer"
                          onClick={() => {
                            const original = players.find(x => x.id === p.id);
                            if (original) setSelectedPlayerForModal(original);
                          }}
                        >
                          {/* Rank */}
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {idx + 1}
                          </td>

                          {/* Player info */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <TeamIcon code={p.team_short} alt={p.team_short} size={22} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white group-hover:text-purple-300 transition-colors">
                                    {p.web_name}
                                  </span>
                                  <span className={`text-[9px] font-extrabold px-1 rounded ${pos.bg} ${pos.color}`}>
                                    {pos.short}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {p.team_short} &bull; £{(p.now_cost / 10).toFixed(1)}m
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Total points & PPG */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="font-mono font-black text-sm text-white">
                              {p.total_points}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {p.points_per_game} ppg
                            </div>
                          </td>

                          {/* Stacked contribution bar */}
                          <td className="py-2.5 px-3 text-center min-w-[140px]">
                            <div className="space-y-1">
                              <div
                                className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden flex border border-slate-700/60 shadow-inner"
                                title={`Góly: ${p.pctGoals}% (${p.ptsGoals}b) · Asistencie: ${p.pctAssists}% (${p.ptsAssists}b) · CS: ${p.pctCleanSheets}% (${p.ptsCleanSheets}b) · Bonus: ${p.pctBonus}% (${p.ptsBonus}b) · Minúty: ${p.pctAppearance}% (${p.ptsAppearance}b)`}
                              >
                                {p.pctGoals > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${p.pctGoals}%` }} />}
                                {p.pctAssists > 0 && <div className="bg-blue-400 h-full" style={{ width: `${p.pctAssists}%` }} />}
                                {p.pctCleanSheets > 0 && <div className="bg-cyan-400 h-full" style={{ width: `${p.pctCleanSheets}%` }} />}
                                {p.pctBonus > 0 && <div className="bg-amber-400 h-full" style={{ width: `${p.pctBonus}%` }} />}
                                {p.pctSaves > 0 && <div className="bg-orange-400 h-full" style={{ width: `${p.pctSaves}%` }} />}
                                {p.pctAppearance > 0 && <div className="bg-purple-400 h-full" style={{ width: `${p.pctAppearance}%` }} />}
                              </div>
                              <div className="flex justify-between text-[9px] font-mono text-slate-400 px-0.5">
                                <span className="text-emerald-400 font-bold">{p.pctGoals > 0 ? `${p.pctGoals}% G` : ''}</span>
                                <span className="text-cyan-400 font-bold">{p.pctCleanSheets > 0 ? `${p.pctCleanSheets}% CS` : ''}</span>
                                <span className="text-amber-400 font-bold">{p.pctBonus > 0 ? `${p.pctBonus}% B` : ''}</span>
                              </div>
                            </div>
                          </td>

                          {/* Goals */}
                          <td className="py-2.5 px-3 text-center">
                            <span className={`font-mono font-bold ${p.goals_scored > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {p.goals_scored > 0 ? `${p.goals_scored} (${p.ptsGoals}b)` : '-'}
                            </span>
                          </td>

                          {/* Assists */}
                          <td className="py-2.5 px-3 text-center">
                            <span className={`font-mono font-bold ${p.assists > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                              {p.assists > 0 ? `${p.assists} (${p.ptsAssists}b)` : '-'}
                            </span>
                          </td>

                          {/* Clean Sheets */}
                          <td className="py-2.5 px-3 text-center">
                            <span className={`font-mono font-bold ${p.clean_sheets > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                              {p.clean_sheets > 0 ? `${p.clean_sheets} (${p.ptsCleanSheets}b)` : '-'}
                            </span>
                          </td>

                          {/* Bonus */}
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className={p.bonus > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                              {p.bonus > 0 ? `+${p.bonus}` : '-'}
                            </span>
                          </td>

                          {/* Minutes */}
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                            {p.minutes}'
                            <span className="text-[10px] text-purple-300 ml-1 font-semibold">
                              (~{p.ptsAppearance}b)
                            </span>
                          </td>

                          {/* Primary Source Badge */}
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${p.primarySourceColor}`}>
                              {p.primarySourceLabel}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleInspectAnyPlayerFDR(p.id)}
                                disabled={loadingSingleId === p.id}
                                className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[10px] font-bold border border-indigo-500/40 transition-colors flex items-center gap-1"
                                title="Načítať a analyzovať FDR citlivosť tohto hráča"
                              >
                                {loadingSingleId === p.id ? (
                                  <RefreshCw size={11} className="animate-spin text-indigo-300" />
                                ) : (
                                  <TrendingUp size={11} />
                                )}
                                <span>FDR</span>
                              </button>

                              <button
                                onClick={() => {
                                  const original = players.find(x => x.id === p.id);
                                  if (original) setSelectedPlayerForModal(original);
                                }}
                                className="px-2 py-1 bg-slate-900 hover:bg-purple-600 text-slate-300 hover:text-white rounded text-[10px] font-bold border border-slate-700 transition-colors"
                              >
                                Detail
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Load more controls */}
            {filteredAllBreakdowns.length > allPlayersLimit && (
              <div className="p-4 border-t border-slate-700/60 bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 font-mono">
                  Zobrazených <strong>{allPlayersLimit}</strong> z <strong>{filteredAllBreakdowns.length}</strong> filtrovaných hráčov
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAllPlayersLimit(prev => prev + 50)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 transition-colors"
                  >
                    + Načítať ďalších 50
                  </button>
                  <button
                    onClick={() => setAllPlayersLimit(filteredAllBreakdowns.length)}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors"
                  >
                    Zobraziť všetkých ({filteredAllBreakdowns.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- SUB-TAB 3: PLAYERS & ARCHETYPES ----------------- */}
      {activeSubTab === 'players' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-4 shadow-lg space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Hľadať hráča alebo tím..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Pos Filter */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
                <button
                  onClick={() => setSelectedPosFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    selectedPosFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Všetky pozície
                </button>
                {[1, 2, 3, 4].map(pid => (
                  <button
                    key={pid}
                    onClick={() => setSelectedPosFilter(pid)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      selectedPosFilter === pid ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {POSITION_LABELS[pid].short}
                  </button>
                ))}
              </div>

              {/* Archetype Filter */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
                <button
                  onClick={() => setSelectedArchetypeFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    selectedArchetypeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Všetky typy
                </button>
                <button
                  onClick={() => setSelectedArchetypeFilter('fixture_proof')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    selectedArchetypeFilter === 'fixture_proof'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-emerald-400 hover:bg-slate-800'
                  }`}
                >
                  💎 Fixture-Proof
                </button>
                <button
                  onClick={() => setSelectedArchetypeFilter('flat_track_bully')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    selectedArchetypeFilter === 'flat_track_bully'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 text-amber-400 hover:bg-slate-800'
                  }`}
                >
                  🦁 Flat-Track Bully
                </button>
              </div>
            </div>

            {/* Loading progress bar if still fetching */}
            {loadingProfiles && (
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/30 flex items-center gap-3">
                <RefreshCw size={14} className="animate-spin text-purple-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300 font-semibold">Analyzujem históriu zápasov top hráčov...</span>
                    <span className="font-mono text-purple-300 font-bold">{loadProgress.loaded} / {loadProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-300"
                      style={{ width: `${loadProgress.total > 0 ? (loadProgress.loaded / loadProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Archetypes Explainer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>💎 Fixture-Proof Hráči</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold">Nezávislí</span>
                </div>
                <p className="text-slate-300 mt-1">
                  Týmto hráčom je jedno, proti komu hrajú. Ich bodový priemer v ťažkých dueloch (FDR 4/5) neklesá
                  o viac ako 12%. <strong>Nikdy ich nepredávajte kvôli žrebu!</strong>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <Flame size={18} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>🦁 Flat-Track Bullies</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-bold">Závislí</span>
                </div>
                <p className="text-slate-300 mt-1">
                  Explodujú bodovo v ľahkých zápasoch (FDR 2), ale proti silným tímom klesajú na 1-2 body.
                  <strong> Ideálni kandidáti na cielené krátkodobé nákupy a následný predaj.</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Players Table */}
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Hráč</th>
                    <th className="py-3 px-3">Typ citlivosti</th>
                    <th className="py-3 px-3 text-center">FDR 2 (Ľahký)</th>
                    <th className="py-3 px-3 text-center">FDR 3 (Stredný)</th>
                    <th className="py-3 px-3 text-center">FDR 4/5 (Ťažký)</th>
                    <th className="py-3 px-3 text-center">Doma vs Vonku</th>
                    <th className="py-3 px-3 text-center">Prepad v FDR 4/5</th>
                    <th className="py-3 px-4 text-right">Akcia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-xs font-medium text-slate-200">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {searchQuery.trim() ? (
                          <div className="space-y-3 max-w-md mx-auto">
                            <div>V načítaných profiloch sa nenašiel hráč „{searchQuery}“.</div>
                            {(() => {
                              const match = players.find(p =>
                                p.web_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.second_name.toLowerCase().includes(searchQuery.toLowerCase())
                              );
                              if (match) {
                                return (
                                  <div className="p-3 bg-slate-900 rounded-lg border border-indigo-500/40 inline-flex items-center gap-3">
                                    <span className="text-white font-bold">{match.web_name}</span>
                                    <button
                                      onClick={() => handleInspectAnyPlayerFDR(match.id)}
                                      disabled={loadingSingleId === match.id}
                                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5"
                                    >
                                      {loadingSingleId === match.id ? <RefreshCw size={12} className="animate-spin" /> : <TrendingUp size={12} />}
                                      <span>Načítať FDR analýzu pre {match.web_name}</span>
                                    </button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : loadingProfiles ? (
                          'Načítavam profily...'
                        ) : (
                          'Žiadni hráči nezodpovedajú filtrom.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map(p => {
                      const pos = POSITION_LABELS[p.element_type];

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-700/40 transition-colors group cursor-pointer"
                          onClick={() => setInspectedProfile(p)}
                        >
                          {/* Player info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <TeamIcon code={p.team_short} alt={p.team_short} size={22} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white group-hover:text-purple-300 transition-colors">
                                    {p.web_name}
                                  </span>
                                  <span className={`text-[10px] font-extrabold px-1 rounded ${pos.bg} ${pos.color}`}>
                                    {pos.short}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {p.team_short} &bull; £{(p.now_cost / 10).toFixed(1)}m &bull; {p.total_points} pts
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Archetype Badge */}
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${p.badgeBg}`}>
                              {p.archetypeLabel}
                            </span>
                          </td>

                          {/* FDR 2 avg */}
                          <td className="py-3 px-3 text-center">
                            <div className="font-mono font-bold text-emerald-400">
                              {p.avgPtsFdr2 > 0 ? `${p.avgPtsFdr2} pts` : '-'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {p.fdr2Games} záp.
                            </div>
                          </td>

                          {/* FDR 3 avg */}
                          <td className="py-3 px-3 text-center">
                            <div className="font-mono font-bold text-slate-200">
                              {p.avgPtsFdr3 > 0 ? `${p.avgPtsFdr3} pts` : '-'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {p.fdr3Games} záp.
                            </div>
                          </td>

                          {/* FDR 4/5 avg */}
                          <td className="py-3 px-3 text-center">
                            <div className={`font-mono font-bold ${
                              p.avgPtsFdr45 >= 4.5
                                ? 'text-emerald-400'
                                : p.avgPtsFdr45 <= 2.2 && p.fdr45Games >= 2
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}>
                              {p.avgPtsFdr45 > 0 ? `${p.avgPtsFdr45} pts` : '-'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {p.fdr45Games} záp.
                            </div>
                          </td>

                          {/* Home vs Away */}
                          <td className="py-3 px-3 text-center font-mono text-[11px]">
                            <span className="text-emerald-400 font-bold">{p.avgPtsHome}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-slate-300">{p.avgPtsAway}</span>
                          </td>

                          {/* Drop Pct */}
                          <td className="py-3 px-3 text-center">
                            {p.fdr45Games > 0 && p.fdr2Games > 0 ? (
                              <span className={`font-mono font-bold text-xs ${
                                p.dropPct >= 40
                                  ? 'text-rose-400'
                                  : p.dropPct <= 12
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}>
                                {p.dropPct > 0 ? `-${p.dropPct}%` : `+${Math.abs(p.dropPct)}%`}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono">-</span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const original = players.find(x => x.id === p.id);
                                if (original) setSelectedPlayerForModal(original);
                              }}
                              className="px-2 py-1 bg-slate-900 hover:bg-purple-600 text-slate-300 hover:text-white rounded text-[11px] font-bold border border-slate-700 transition-colors"
                            >
                              Profil
                            </button>
                          </td>
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

      {/* ----------------- SUB-TAB 4: TEAM FDR PERFORMANCE ----------------- */}
      {activeSubTab === 'teams' && (
        <div className="space-y-6">
          <div className="bg-slate-800/90 rounded-xl border border-slate-700 p-5 shadow-lg">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Shield size={18} className="text-purple-400" />
              Ako tímy Premier League reálne zvládajú ľahký vs ťažký žreb?
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Ktoré tímy sú spoľahlivé v FDR 2 a ktoré zlyhávajú aj proti papierovo slabým súperom?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamFDRPerformance.map(item => {
                const fdr2WinRate = item.fdr2Matches > 0
                  ? Math.round((item.fdr2Wins / item.fdr2Matches) * 100)
                  : 0;
                const fdr2CsRate = item.fdr2Matches > 0
                  ? Math.round((item.fdr2CleanSheets / item.fdr2Matches) * 100)
                  : 0;

                return (
                  <div key={item.team.id} className="p-4 rounded-xl border border-slate-700 bg-slate-900/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <TeamIcon code={item.team.short_name} alt={item.team.name} size={28} />
                        <div>
                          <h4 className="text-sm font-bold text-white leading-tight">{item.team.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{item.team.short_name}</span>
                        </div>
                      </div>

                      <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Úspešnosť v FDR 2:</span>
                          <span className={`font-mono font-bold ${fdr2WinRate >= 65 ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {fdr2WinRate}% výhier ({item.fdr2Wins}/{item.fdr2Matches})
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Čisté kontá v FDR 2:</span>
                          <span className={`font-mono font-bold ${fdr2CsRate >= 40 ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {fdr2CsRate}% ({item.fdr2CleanSheets} CS)
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                          <span className="text-slate-400">Výhry v FDR 4/5:</span>
                          <span className="font-mono font-bold text-slate-300">
                            {item.fdr45Wins} z {item.fdr45Matches}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- INSPECTED PLAYER DETAIL MODAL / SLIDEOUT ----------------- */}
      {inspectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamIcon code={inspectedProfile.team_short} alt={inspectedProfile.team_short} size={32} />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{inspectedProfile.web_name}</h3>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${POSITION_LABELS[inspectedProfile.element_type].bg} ${POSITION_LABELS[inspectedProfile.element_type].color}`}>
                      {POSITION_LABELS[inspectedProfile.element_type].short}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {inspectedProfile.team_short} &bull; £{(inspectedProfile.now_cost / 10).toFixed(1)}m &bull; {inspectedProfile.total_points} celkových bodov
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectedProfile(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              {/* Archetype banner */}
              <div className={`p-4 rounded-xl border ${inspectedProfile.badgeBg} flex items-center justify-between`}>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Klasifikácia citlivosti na FDR</div>
                  <div className="text-base font-black text-white mt-0.5">{inspectedProfile.archetypeLabel}</div>
                  <div className="text-xs text-slate-300 mt-1">{inspectedProfile.archetypeDescription}</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs text-slate-400">Prepad v FDR 4/5</div>
                  <div className="text-lg font-black text-white">
                    {inspectedProfile.dropPct > 0 ? `-${inspectedProfile.dropPct}%` : '0%'}
                  </div>
                </div>
              </div>

              {/* Stats by difficulty */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase">FDR 2 (Ľahký)</div>
                  <div className="text-lg font-black text-white mt-1 font-mono">{inspectedProfile.avgPtsFdr2} pts</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{inspectedProfile.fdr2Games} zápasov</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
                  <div className="text-[10px] text-slate-300 font-bold uppercase">FDR 3 (Stredný)</div>
                  <div className="text-lg font-black text-white mt-1 font-mono">{inspectedProfile.avgPtsFdr3} pts</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{inspectedProfile.fdr3Games} zápasov</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
                  <div className="text-[10px] text-rose-400 font-bold uppercase">FDR 4/5 (Ťažký)</div>
                  <div className="text-lg font-black text-white mt-1 font-mono">{inspectedProfile.avgPtsFdr45} pts</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{inspectedProfile.fdr45Games} zápasov</div>
                </div>
              </div>

              {/* Match-by-match breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-purple-400" />
                  Zoznam odohraných zápasov a získané body podľa FDR
                </h4>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
                  {inspectedProfile.matchHistory.map((m, idx) => {
                    const fdrColor = {
                      2: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                      3: 'bg-slate-700 text-slate-300 border-slate-600',
                      4: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      5: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                    }[m.fdr] || 'bg-slate-700 text-slate-300';

                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-500 text-[11px] w-8">GW{m.round}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${fdrColor}`}>
                            FDR {m.fdr}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {m.wasHome ? 'vs' : '@'} {m.opponentShort}
                          </span>
                          {m.scoreStr && (
                            <span className="text-[10px] text-slate-500 font-mono">({m.scoreStr})</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-slate-400">
                            {m.goals > 0 && <span className="text-emerald-400 mr-1.5 font-bold">{m.goals}G</span>}
                            {m.assists > 0 && <span className="text-blue-400 mr-1.5 font-bold">{m.assists}A</span>}
                            {m.cleanSheet && <span className="text-cyan-400 mr-1.5 font-bold">CS</span>}
                            <span>{m.minutes}'</span>
                          </div>
                          <span className={`font-mono font-black text-sm w-12 text-right ${
                            m.points >= 6 ? 'text-emerald-400' : m.points <= 2 ? 'text-slate-400' : 'text-slate-200'
                          }`}>
                            {m.points} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end">
              <button
                onClick={() => setInspectedProfile(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Zavrieť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Player Detail Modal */}
      {selectedPlayerForModal && (
        <PlayerDetailModal
          player={selectedPlayerForModal}
          isOpen={Boolean(selectedPlayerForModal)}
          onClose={() => setSelectedPlayerForModal(null)}
          teams={teams}
          allPlayers={players}
          fixtures={fixtures}
        />
      )}
    </div>
  );
};

export default FDRRealityAnalysis;
