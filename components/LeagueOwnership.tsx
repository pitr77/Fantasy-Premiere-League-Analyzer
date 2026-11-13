"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import {
  Users,
  Trophy,
  Crown,
  Search,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Flame,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  User,
  Zap,
  Target
} from 'lucide-react';
import { PlayerDetailModal } from './PlayerDetailModal';
import { useLanguage } from '../lib/language';

interface LeagueOwnershipProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
  fixtures?: FPLFixture[];
  initialLeagueId?: number;
}

export interface OwnerManager {
  entry: number;
  entryName: string;
  playerName: string;
  rank: number;
  totalPoints: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isStarting: boolean;
  position: number;
  multiplier: number;
}

interface PlayerOwnershipRow {
  player: FPLPlayer;
  team: FPLTeam | undefined;
  elementId: number;
  ownedCount: number;
  ownershipPercent: number;
  startingCount: number;
  startingPercent: number;
  benchCount: number;
  captainCount: number;
  captainPercent: number;
  effectiveOwnershipPercent: number;
  managers: OwnerManager[];
}

interface LeagueManager {
  entry: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  totalPoints: number;
  eventPoints: number;
  activeChip: string | null;
  captainId: number | null;
  viceCaptainId: number | null;
}

const STORAGE_KEY_MY_ENTRY = 'fpl_league_my_entry';

export const LeagueOwnership: React.FC<LeagueOwnershipProps> = ({
  players,
  teams,
  events,
  fixtures,
  initialLeagueId = 1286619,
}) => {
  const [lang] = useLanguage();
  const [leagueId, setLeagueId] = useState<number>(initialLeagueId);
  const [inputLeagueId, setInputLeagueId] = useState<string>(String(initialLeagueId));
  const [leagueData, setLeagueData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // User identity in league (Peter's Team default or saved in localStorage)
  const [myEntryId, setMyEntryId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_MY_ENTRY);
      if (saved) return Number(saved);
    }
    return 6229937; // Peter's Team entry ID
  });

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ownership' | 'differentials' | 'captains' | 'standings'>('ownership');
  const [posFilter, setPosFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minOwnership, setMinOwnership] = useState<number>(0);
  const [maxRivalOwners, setMaxRivalOwners] = useState<number>(2);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<FPLPlayer | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{
    key: 'ownershipPercent' | 'effectiveOwnershipPercent' | 'captainPercent' | 'startingPercent' | 'cost' | 'form' | 'pts';
    direction: 'asc' | 'desc';
  }>({
    key: 'ownershipPercent',
    direction: 'desc',
  });

  const playerMap = useMemo(() => {
    const map = new Map<number, FPLPlayer>();
    for (const p of players) {
      map.set(p.id, p);
    }
    return map;
  }, [players]);

  const teamMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    for (const t of teams) {
      map.set(t.id, t);
    }
    return map;
  }, [teams]);

  const fetchLeagueOwnership = async (id: number, gw?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/fpl/league/${id}/ownership${gw ? `?event=${gw}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Chyba pri sťahovaní dát ligy (${res.status})`);
      }
      const data = await res.json();
      setLeagueData(data);
      if (!selectedEvent && data.event) {
        setSelectedEvent(data.event);
      }
      // If no myEntryId chosen yet, check if Peter's Team is in this league
      if (!myEntryId && data.managers) {
        const found = data.managers.find(
          (m: any) =>
            m.entryName?.toLowerCase().includes('peter') ||
            m.playerName?.toLowerCase().includes('kalavsky')
        );
        if (found) {
          setMyEntryId(found.entry);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Nepodarilo sa načítať dáta miniligy.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeagueOwnership(leagueId, selectedEvent);
  }, [leagueId, selectedEvent]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeagueOwnership(leagueId, selectedEvent);
  };

  const handleLeagueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputLeagueId.trim(), 10);
    if (parsed && parsed > 0 && parsed !== leagueId) {
      setLeagueId(parsed);
      setSelectedEvent(null);
    }
  };

  const handleSelectMyTeam = (entryId: number) => {
    setMyEntryId(entryId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MY_ENTRY, String(entryId));
    }
  };

  // Find info about "My Team"
  const myManager: LeagueManager | undefined = useMemo(() => {
    if (!leagueData?.managers || !myEntryId) return undefined;
    return leagueData.managers.find((m: LeagueManager) => m.entry === myEntryId);
  }, [leagueData, myEntryId]);

  // Rivals placed above me in standings
  const rivalsAboveMe: LeagueManager[] = useMemo(() => {
    if (!leagueData?.managers || !myManager) return [];
    return leagueData.managers.filter((m: LeagueManager) => m.rank < myManager.rank);
  }, [leagueData, myManager]);

  const rivalsAboveIds = useMemo(() => {
    return new Set(rivalsAboveMe.map(m => m.entry));
  }, [rivalsAboveMe]);

  // Process rows with player details
  const enrichedRows: PlayerOwnershipRow[] = useMemo(() => {
    if (!leagueData?.ownership) return [];
    return (leagueData.ownership as any[])
      .map(item => {
        const p = playerMap.get(item.elementId);
        if (!p) return null;
        const t = teamMap.get(p.team);
        return {
          player: p,
          team: t,
          elementId: item.elementId,
          ownedCount: item.ownedCount,
          ownershipPercent: item.ownershipPercent,
          startingCount: item.startingCount,
          startingPercent: item.startingPercent,
          benchCount: item.benchCount,
          captainCount: item.captainCount,
          captainPercent: item.captainPercent,
          effectiveOwnershipPercent: item.effectiveOwnershipPercent,
          managers: item.managers || [],
        };
      })
      .filter((r): r is PlayerOwnershipRow => r !== null);
  }, [leagueData, playerMap, teamMap]);

  // Set of players owned by My Team
  const myOwnedPlayerIds = useMemo(() => {
    if (!myEntryId || !leagueData?.ownership) return new Set<number>();
    const set = new Set<number>();
    for (const o of leagueData.ownership) {
      if (o.managers?.some((m: any) => m.entry === myEntryId)) {
        set.add(o.elementId);
      }
    }
    return set;
  }, [myEntryId, leagueData]);

  // Top differentials to catch rivals above me (across ALL active Premier League players)
  const chaseDifferentials = useMemo(() => {
    if (!leagueData?.ownership) return [];

    const leagueOwnershipMap = new Map<number, PlayerOwnershipRow>();
    for (const r of enrichedRows) {
      leagueOwnershipMap.set(r.elementId, r);
    }

    return players
      .filter(p => {
        // Active PL players with form > 2.5 and some minutes
        const formNum = parseFloat(p.form) || 0;
        if (formNum < 2.5 || (p.minutes || 0) < 180) return false;

        // Position filter if set
        if (posFilter !== 'all' && p.element_type !== posFilter) return false;

        // Search term if set
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const tName = teamMap.get(p.team)?.name?.toLowerCase() || '';
          const tShort = teamMap.get(p.team)?.short_name?.toLowerCase() || '';
          if (
            !p.web_name.toLowerCase().includes(q) &&
            !p.first_name.toLowerCase().includes(q) &&
            !p.second_name.toLowerCase().includes(q) &&
            !tName.includes(q) &&
            !tShort.includes(q)
          ) {
            return false;
          }
        }

        // Must NOT be owned by me
        if (myOwnedPlayerIds.has(p.id)) return false;

        // Check how many rivals above me own this player (must be <= maxRivalOwners)
        const leagueRow = leagueOwnershipMap.get(p.id);
        const ownedByRivalsAboveCount = leagueRow
          ? leagueRow.managers.filter(m => rivalsAboveIds.has(m.entry)).length
          : 0;
        if (ownedByRivalsAboveCount > maxRivalOwners) return false;

        return true;
      })
      .map(p => {
        const leagueRow = leagueOwnershipMap.get(p.id);
        const t = teamMap.get(p.team);
        const ownedByRivalsAboveCount = leagueRow
          ? leagueRow.managers.filter(m => rivalsAboveIds.has(m.entry)).length
          : 0;
        return {
          player: p,
          team: t,
          leagueOwn: leagueRow ? leagueRow.ownershipPercent : 0,
          ownedCount: leagueRow ? leagueRow.ownedCount : 0,
          ownedByRivalsAboveCount,
          form: parseFloat(p.form) || 0,
          pts: p.total_points,
          cost: p.now_cost / 10,
          ppg: parseFloat(p.points_per_game) || 0,
          row: leagueRow,
        };
      })
      .sort((a, b) => b.form - a.form || b.pts - a.pts);
  }, [players, enrichedRows, myOwnedPlayerIds, rivalsAboveIds, posFilter, searchTerm, maxRivalOwners, teamMap]);

  // Filter and sort for Tab 1
  const filteredRows = useMemo(() => {
    let result = enrichedRows;

    if (posFilter !== 'all') {
      result = result.filter(r => r.player.element_type === posFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        r =>
          r.player.web_name.toLowerCase().includes(q) ||
          r.player.first_name.toLowerCase().includes(q) ||
          r.player.second_name.toLowerCase().includes(q) ||
          (r.team?.name.toLowerCase().includes(q) ?? false) ||
          (r.team?.short_name.toLowerCase().includes(q) ?? false)
      );
    }

    if (minOwnership > 0) {
      result = result.filter(r => r.ownershipPercent >= minOwnership);
    }

    return [...result].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortConfig.key === 'ownershipPercent') {
        valA = a.ownershipPercent;
        valB = b.ownershipPercent;
      } else if (sortConfig.key === 'effectiveOwnershipPercent') {
        valA = a.effectiveOwnershipPercent;
        valB = b.effectiveOwnershipPercent;
      } else if (sortConfig.key === 'captainPercent') {
        valA = a.captainPercent;
        valB = b.captainPercent;
      } else if (sortConfig.key === 'startingPercent') {
        valA = a.startingPercent;
        valB = b.startingPercent;
      } else if (sortConfig.key === 'cost') {
        valA = a.player.now_cost;
        valB = b.player.now_cost;
      } else if (sortConfig.key === 'form') {
        valA = parseFloat(a.player.form) || 0;
        valB = parseFloat(b.player.form) || 0;
      } else if (sortConfig.key === 'pts') {
        valA = a.player.total_points;
        valB = b.player.total_points;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [enrichedRows, posFilter, searchTerm, minOwnership, sortConfig]);

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const getPosBadge = (element_type: number) => {
    switch (element_type) {
      case 1:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">GKP</span>;
      case 2:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">DEF</span>;
      case 3:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-green-500/10 text-green-400 border border-green-500/20">MID</span>;
      case 4:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">FWD</span>;
      default:
        return null;
    }
  };

  // Captaincy stats
  const captainsList = useMemo(() => {
    if (!enrichedRows.length) return [];
    return enrichedRows
      .filter(r => r.captainCount > 0)
      .sort((a, b) => b.captainCount - a.captainCount);
  }, [enrichedRows]);

  const templateCount = useMemo(() => {
    return enrichedRows.filter(r => r.ownershipPercent >= 50).length;
  }, [enrichedRows]);

  const differentialsCount = useMemo(() => {
    return enrichedRows.filter(r => r.ownershipPercent <= 20 && r.ownershipPercent > 0).length;
  }, [enrichedRows]);

  const toggleRow = (elementId: number) => {
    setExpandedRow(prev => (prev === elementId ? null : elementId));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header & League Switcher */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                <Users size={22} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                  <span>{leagueData?.league?.name || 'Miniliga'}</span>
                  {leagueData?.totalManagers ? (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {leagueData.totalManagers} manažérov
                    </span>
                  ) : null}
                </h1>
                <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                  Vlastníctvo hráčov, kapitáni a zostavy v tvojej súkromnej FPL lige pre GW{leagueData?.event || selectedEvent || ''}
                </p>
              </div>
            </div>
          </div>

          {/* Quick League ID Input & Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <form onSubmit={handleLeagueSubmit} className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  type="text"
                  value={inputLeagueId}
                  onChange={e => setInputLeagueId(e.target.value)}
                  placeholder="ID ligy..."
                  className="w-28 sm:w-36 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-purple-500 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Načítať
              </button>
            </form>

            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Obnoviť dáta"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-purple-400' : ''} />
            </button>
          </div>
        </div>

        {/* Gameweek Selector & "My Team" badge */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Kolo:</span>
            <div className="flex gap-1 overflow-x-auto max-w-[260px] sm:max-w-md py-1 custom-scrollbar">
              {events
                .filter(e => e.id <= (events.find(ev => ev.is_current)?.id || 38))
                .slice(-10)
                .map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${(selectedEvent || leagueData?.event) === ev.id
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                  >
                    GW{ev.id}
                  </button>
                ))}
            </div>
          </div>

          {/* Manager Selector: "Môj tím v lige" */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
            <User size={14} className="text-purple-400 shrink-0" />
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Môj tím:</span>
            <select
              value={myEntryId || ''}
              onChange={e => handleSelectMyTeam(Number(e.target.value))}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-1"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">Vyber svoj tím...</option>
              {leagueData?.managers?.map((m: LeagueManager) => (
                <option key={m.entry} value={m.entry} className="bg-slate-900 text-white">
                  #{m.rank} {m.entryName} ({m.playerName})
                </option>
              ))}
            </select>
            {myManager && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                #{myManager.rank} · {myManager.totalPoints}b
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats Pill */}
        {leagueData && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Flame size={13} className="text-emerald-400" />
                <span>Template (&ge;50%): <b className="text-white font-mono">{templateCount}</b></span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1">
                <Sparkles size={13} className="text-purple-400" />
                <span>Diferenciály (&le;20%): <b className="text-white font-mono">{differentialsCount}</b></span>
              </span>
            </div>
            {myManager && rivalsAboveMe.length > 0 && (
              <div className="text-[11px] text-amber-300/90 flex items-center gap-1">
                <Target size={13} className="text-amber-400" />
                <span>Pred tebou: <b className="text-white">{rivalsAboveMe.length} súperov</b> (strata na lídra: <b className="text-white">{(leagueData.managers[0]?.totalPoints || 0) - myManager.totalPoints}b</b>)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className="text-xs underline font-bold hover:text-white"
          >
            Skúsiť znova
          </button>
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('ownership')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'ownership'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
        >
          <Users size={15} />
          <span>Vlastníctvo hráčov ({enrichedRows.length})</span>
        </button>

        {/* TAB: DIFERENCIÁLY NA DOBIHNUTIE */}
        <button
          onClick={() => setActiveTab('differentials')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'differentials'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20'
              : 'bg-slate-800/80 text-amber-300/80 hover:text-white border border-amber-500/20'
            }`}
        >
          <Target size={15} className={activeTab === 'differentials' ? 'text-white' : 'text-amber-400'} />
          <span>Lovci bodov: Rozdiely na súperov ({chaseDifferentials.length})</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>
        </button>

        <button
          onClick={() => setActiveTab('captains')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'captains'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
        >
          <Crown size={15} className="text-amber-400" />
          <span>Kapitáni ({captainsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('standings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'standings'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
        >
          <Trophy size={15} className="text-yellow-400" />
          <span>Tabuľka ligy ({leagueData?.managers?.length || 0})</span>
        </button>
      </div>

      {loading && !leagueData ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
          <h4 className="text-white font-bold text-base mb-1">Počítam vlastníctvo v lige...</h4>
          <p className="text-xs text-slate-400">Sťahujem zostavy všetkých manažérov pre GW{selectedEvent || ''}</p>
        </div>
      ) : null}

      {/* TAB: CHASE DIFFERENTIALS (HRÁČI NA DOBIHNUTIE SÚPEROV) */}
      {activeTab === 'differentials' && leagueData && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Explanation Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-800 to-slate-800 border border-amber-500/30 p-4 rounded-xl flex gap-3.5 items-start">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 mt-0.5">
              <Zap size={20} />
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-amber-300 text-sm block mb-1">
                Ako funguje filter pre {myManager?.entryName || "Peter's Team"}:
              </span>
              Tento filter vyberá hráčov s <strong>vysokou formou (&gt;2.5)</strong>, ktorých v minilige <strong>vlastnia najviac {maxRivalOwners === 0 ? '0' : maxRivalOwners} súperi z {rivalsAboveMe.length} tímov pred tebou</strong> a ty ich zatiaľ nemáš. Ak títo hráči zabodujú, získavaš body, ktoré väčšina tvojich priamych rivalov nedostane.
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPosFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 'all' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Všetci ({chaseDifferentials.length})
              </button>
              <button
                onClick={() => setPosFilter(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 1 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                GKP
              </button>
              <button
                onClick={() => setPosFilter(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 2 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                DEF
              </button>
              <button
                onClick={() => setPosFilter(3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 3 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                MID
              </button>
              <button
                onClick={() => setPosFilter(4)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 4 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                FWD
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Hľadať diferenciál..."
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-8 pr-3 py-2 outline-none focus:border-amber-500"
                />
              </div>

              {/* Max Rivals Ownership Selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Max u súperov:</span>
                <select
                  value={maxRivalOwners}
                  onChange={e => setMaxRivalOwners(Number(e.target.value))}
                  className="bg-transparent text-amber-300 font-bold text-xs outline-none cursor-pointer pr-1 font-mono"
                >
                  <option value={0} className="bg-slate-900 text-white">0 súperov (nikto)</option>
                  <option value={1} className="bg-slate-900 text-white">max 1 súper</option>
                  <option value={2} className="bg-slate-900 text-white">max 2 súperi</option>
                  <option value={3} className="bg-slate-900 text-white">max 3 súperi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Differentials Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700 select-none">
                    <th className="py-3 px-3 w-10 text-center text-xs">#</th>
                    <th className="py-3 px-3 min-w-[170px]">Hráč</th>
                    <th className="py-3 px-3 text-center min-w-[110px]">Vlastníctvo v lige</th>
                    <th className="py-3 px-3 text-center min-w-[120px]">Top 6 rivali pred tebou</th>
                    <th className="py-3 px-3 text-center w-20">Cena</th>
                    <th className="py-3 px-3 text-center w-20">Forma</th>
                    <th className="py-3 px-3 text-center w-20">Body</th>
                    <th className="py-3 px-3 text-center w-20">Body/Z</th>
                    <th className="py-3 px-3 text-center w-24">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-xs sm:text-sm">
                  {chaseDifferentials.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Nenašli sa žiadne vhodné diferenciály podľa zvoleného filtra.
                      </td>
                    </tr>
                  ) : (
                    chaseDifferentials.map((item, idx) => (
                      <tr
                        key={item.player.id}
                        onClick={() => setSelectedPlayerForDetail(item.player)}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-500 text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white group-hover:text-amber-300 transition-colors">
                              {item.player.web_name}
                            </span>
                            {getPosBadge(item.player.element_type)}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{item.team?.name || '-'}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-500">Svetové TSB: {item.player.selected_by_percent}%</span>
                          </div>
                        </td>

                        {/* League Ownership */}
                        <td className="py-3 px-3 text-center">
                          {item.leagueOwn === 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/30">
                              0 / {leagueData.totalManagers} (0%)
                            </span>
                          ) : (
                            <span className="font-mono text-slate-300 text-xs">
                              <strong className="text-white font-bold">{item.ownedCount}/{leagueData.totalManagers}</strong>
                              <span className="text-slate-400 text-[11px] ml-1">({item.leagueOwn}%)</span>
                            </span>
                          )}
                        </td>

                        {/* Rivals Above Status */}
                        <td className="py-3 px-3 text-center">
                          {item.ownedByRivalsAboveCount === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-xs font-bold font-mono border border-emerald-500/30">
                              <CheckCircle2 size={12} className="text-emerald-400" />
                              0 z {rivalsAboveMe.length} súperov
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs font-bold font-mono border border-amber-500/30">
                              {item.ownedByRivalsAboveCount} z {rivalsAboveMe.length} súperov
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-mono text-blue-300 text-xs font-semibold">
                          £{item.cost.toFixed(1)}m
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-black text-amber-400 text-xs sm:text-sm">
                          {item.form.toFixed(1)}
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-bold text-white text-xs">
                          {item.pts}
                        </td>

                        <td className="py-3 px-3 text-center font-mono text-slate-300 text-xs">
                          {item.ppg.toFixed(1)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedPlayerForDetail(item.player);
                            }}
                            className="px-2.5 py-1 bg-slate-700/60 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold transition-all"
                          >
                            Štatistiky
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-700 text-xs text-slate-500 flex items-center justify-between">
              <span>Zobrazených: <b className="text-white font-mono">{chaseDifferentials.length}</b> potenciálnych diferenciálov</span>
              <span className="text-slate-400">Kliknutím na hráča otvoríte detail a históriu</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: OWNERSHIP TABLE */}
      {activeTab === 'ownership' && leagueData && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            {/* Position Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPosFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Všetci
              </button>
              <button
                onClick={() => setPosFilter(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 1 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                GKP
              </button>
              <button
                onClick={() => setPosFilter(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 2 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                DEF
              </button>
              <button
                onClick={() => setPosFilter(3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 3 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                MID
              </button>
              <button
                onClick={() => setPosFilter(4)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${posFilter === 4 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                FWD
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Hľadať hráča alebo tím..."
                className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-8 pr-3 py-2 outline-none focus:border-purple-500"
              />
            </div>

            {/* Min Ownership filter */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">Min %:</span>
              <select
                value={minOwnership}
                onChange={e => setMinOwnership(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer font-mono"
              >
                <option value={0}>Všetci (0%+)</option>
                <option value={20}>&ge; 20%</option>
                <option value={40}>&ge; 40%</option>
                <option value={60}>&ge; 60% (Template)</option>
                <option value={80}>&ge; 80% (Core)</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700 select-none">
                    <th className="py-3 px-3 w-10 text-center text-xs">#</th>
                    <th className="py-3 px-3 min-w-[170px]">Hráč</th>
                    <th
                      onClick={() => handleSort('ownershipPercent')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors min-w-[110px]"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Vlastníctvo</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'ownershipPercent' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('effectiveOwnershipPercent')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors min-w-[90px]"
                      title="Effective Ownership: zohľadňuje kapitánov s dvojitým bodovým násobením (C = 2x, TC = 3x)"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>EO %</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'effectiveOwnershipPercent' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('startingPercent')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors min-w-[90px]"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Základ %</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'startingPercent' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('captainPercent')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors min-w-[90px]"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Kapitán %</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'captainPercent' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('cost')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors w-20"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Cena</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'cost' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('form')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors w-20"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Forma</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'form' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('pts')}
                      className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors w-20"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Body</span>
                        <ArrowUpDown size={12} className={sortConfig.key === 'pts' ? 'text-purple-400' : 'text-slate-600'} />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center w-28">Kto vlastní</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-700/50 text-xs sm:text-sm">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        Nenašli sa žiadni hráči vyhovujúci filtrom.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => {
                      const isExpanded = expandedRow === r.elementId;
                      const isHighOwnership = r.ownershipPercent >= 60;
                      const isDifferential = r.ownershipPercent <= 20;
                      const inMySquad = myOwnedPlayerIds.has(r.elementId);
                      const ownedByRivalsAboveCount = r.managers.filter(m => rivalsAboveIds.has(m.entry)).length;

                      return (
                        <React.Fragment key={r.elementId}>
                          <tr
                            onClick={() => toggleRow(r.elementId)}
                            className={`cursor-pointer hover:bg-slate-700/40 transition-colors select-none ${inMySquad ? 'bg-purple-950/20' : isHighOwnership ? 'bg-slate-800/80' : ''
                              } ${isExpanded ? 'bg-slate-700/30' : ''}`}
                            title="Kliknutím rozbalíte zoznam manažérov, ktorí tohto hráča vlastnia"
                          >
                            <td className="py-3 px-3 text-center text-slate-500 font-mono text-xs">
                              {idx + 1}
                            </td>

                            {/* Player Info + My Team Pill */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-left font-bold text-white group-hover:text-purple-400 transition-colors">
                                  {r.player.web_name}
                                </span>
                                {getPosBadge(r.player.element_type)}
                                {inMySquad && (
                                  <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                    V TVOJOM TÍME
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPlayerForDetail(r.player);
                                  }}
                                  className="text-slate-500 hover:text-purple-400 p-0.5 rounded transition-colors ml-auto sm:ml-0"
                                  title="Otvoriť kompletný detail a štatistiky hráča"
                                >
                                  <Info size={13} />
                                </button>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{r.team?.name || '-'}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-500">Svetové TSB: {r.player.selected_by_percent}%</span>
                              </div>
                            </td>

                            {/* Ownership Bar */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-black text-sm ${isHighOwnership
                                      ? 'text-emerald-400'
                                      : isDifferential
                                        ? 'text-purple-300'
                                        : 'text-white'
                                    }`}>
                                    {r.ownedCount} / {leagueData.totalManagers}
                                  </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({r.ownershipPercent}%)
                                    </span>
                                </div>
                                <div className="w-20 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${isHighOwnership
                                        ? 'bg-emerald-500'
                                        : r.ownershipPercent >= 35
                                          ? 'bg-blue-500'
                                          : 'bg-purple-500'
                                      }`}
                                    style={{ width: `${r.ownershipPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Effective Ownership */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-xs sm:text-sm">
                              <span className={r.effectiveOwnershipPercent > 100 ? 'text-amber-400' : 'text-slate-300'}>
                                {r.effectiveOwnershipPercent}%
                              </span>
                            </td>

                            {/* Starting % */}
                            <td className="py-3 px-3 text-center font-mono text-xs text-slate-300">
                              <div>{r.startingPercent}%</div>
                              {r.benchCount > 0 && (
                                <div className="text-[9px] text-slate-500">({r.benchCount} na lavičke)</div>
                              )}
                            </td>

                            {/* Captain % */}
                            <td className="py-3 px-3 text-center font-mono text-xs">
                              {r.captainCount > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
                                  {r.captainPercent}% ({r.captainCount}x)
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            {/* Cost */}
                            <td className="py-3 px-3 text-center font-mono text-blue-300 text-xs">
                              £{(r.player.now_cost / 10).toFixed(1)}m
                            </td>

                            {/* Form */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-green-400 text-xs">
                              {r.player.form}
                            </td>

                            {/* Points */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-white text-xs">
                              {r.player.total_points}
                            </td>

                            {/* Managers toggle */}
                            <td className="py-3 px-3 text-center">
                              <div className="px-2 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-all inline-flex items-center gap-1">
                                <span>{r.ownedCount} tímov</span>
                                {isExpanded ? <ChevronUp size={12} className="text-purple-400" /> : <ChevronDown size={12} />}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Managers List: Sorted by league rank */}
                          {isExpanded && (
                            <tr className="bg-slate-900/70 border-b border-slate-700/60">
                              <td colSpan={10} className="p-3.5 pl-6 sm:pl-8">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">
                                        Manažéri vlastniaci {r.player.web_name}:
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        (zoradené podľa aktuálneho poradia v lige)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                      {myManager && (
                                        <span className="font-mono">
                                          Top {rivalsAboveMe.length} pred tebou: <b className="text-white">{ownedByRivalsAboveCount}x</b>
                                        </span>
                                      )}
                                      <span>•</span>
                                      <span>{r.ownedCount} z {leagueData.totalManagers} v lige</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                    {r.managers.map((m) => {
                                      const isMe = m.entry === myEntryId;
                                      const isRivalAbove = rivalsAboveIds.has(m.entry);
                                      return (
                                        <div
                                          key={m.entry}
                                          className={`border rounded-xl p-2.5 flex items-center justify-between text-xs transition-colors ${isMe
                                              ? 'bg-purple-950/40 border-purple-500/60 shadow-sm'
                                              : isRivalAbove
                                                ? 'bg-slate-800/90 border-slate-700/80'
                                                : 'bg-slate-850/60 border-slate-800'
                                            }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${isMe
                                                ? 'bg-purple-500 text-white'
                                                : isRivalAbove
                                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                  : 'bg-slate-700 text-slate-300'
                                              }`}>
                                              {m.rank}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <div className="font-bold text-white truncate text-xs flex items-center gap-1">
                                                <span className="truncate">{m.entryName}</span>
                                                {isMe && <span className="text-[9px] text-purple-400 font-bold">(TY)</span>}
                                              </div>
                                              <div className="text-[10px] text-slate-400 truncate">
                                                {m.playerName}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                            {m.isCaptain && (
                                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[9px] font-mono flex items-center gap-0.5">
                                                <Crown size={9} /> C
                                              </span>
                                            )}
                                            {m.isViceCaptain && (
                                              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold text-[9px] font-mono">
                                                VC
                                              </span>
                                            )}
                                            {!m.isStarting && (
                                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-mono">
                                                Lavička
                                              </span>
                                            )}
                                            <span className="text-[10px] text-slate-500 font-mono">
                                              {m.totalPoints}b
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-700 text-xs text-slate-500 flex items-center justify-between">
              <span>Zobrazených: <b className="text-white font-mono">{filteredRows.length}</b> hráčov</span>
              <span className="font-mono">Liga ID: {leagueId}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAPTAINS BREAKDOWN */}
      {activeTab === 'captains' && leagueData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {captainsList.map(c => {
            const isMajority = c.captainPercent >= 50;
            return (
              <div
                key={c.elementId}
                onClick={() => setSelectedPlayerForDetail(c.player)}
                className={`bg-slate-800 border ${isMajority ? 'border-amber-500/50 shadow-amber-500/10' : 'border-slate-700'
                  } rounded-xl p-4 shadow-lg hover:border-purple-500/60 cursor-pointer transition-all group`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                      <Crown size={18} />
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-base group-hover:text-purple-300 transition-colors">
                        {c.player.web_name}
                      </h4>
                      <p className="text-xs text-slate-400">{c.team?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-black text-amber-400">
                      {c.captainCount}x
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">
                      {c.captainPercent}% ligy
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-1">
                  <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Kapitánovali tímy (zoradené podľa tabuľky):
                  </div>
                  <div className="space-y-1">
                    {c.managers.filter(m => m.isCaptain).map(m => (
                      <div key={m.entry} className="text-xs text-slate-300 font-mono flex items-center justify-between">
                        <span className="truncate">#{m.rank} {m.entryName} ({m.playerName})</span>
                        <span className="text-[10px] text-slate-500">{m.totalPoints}b</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: STANDINGS & CHIPS */}
      {activeTab === 'standings' && leagueData?.managers && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Tím / Manažér</th>
                  <th className="py-3 px-3 text-center">Body v kole</th>
                  <th className="py-3 px-3 text-center">Celkové body</th>
                  <th className="py-3 px-3 text-center">Kapitán</th>
                  <th className="py-3 px-3 text-center">Aktívny Chip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {leagueData.managers.map((m: LeagueManager) => {
                  const cap = m.captainId ? playerMap.get(m.captainId) : null;
                  const isMe = m.entry === myEntryId;
                  return (
                    <tr
                      key={m.entry}
                      className={`hover:bg-slate-700/30 transition-colors ${isMe ? 'bg-purple-950/30 border-l-2 border-purple-500' : ''
                        }`}
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                        {m.rank}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>{m.entryName}</span>
                          {isMe && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono">
                              Môj tím
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{m.playerName}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                        {m.eventPoints ?? '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-white text-base">
                        {m.totalPoints}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {cap ? (
                          <div className="inline-flex items-center gap-1 font-bold text-amber-300">
                            <Crown size={12} />
                            <span>{cap.web_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {m.activeChip ? (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold uppercase font-mono">
                            {m.activeChip}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Player Detail Modal */}
      {selectedPlayerForDetail && (
        <PlayerDetailModal
          player={selectedPlayerForDetail}
          isOpen={Boolean(selectedPlayerForDetail)}
          onClose={() => setSelectedPlayerForDetail(null)}
          teams={teams}
          allPlayers={players}
          fixtures={fixtures}
        />
      )}
    </div>
  );
};

export default LeagueOwnership;
