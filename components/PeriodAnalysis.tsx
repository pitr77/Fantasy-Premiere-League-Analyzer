
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent } from '../types';
import { getPlayerSummary } from '../services/fplService';
import { CalendarRange, RefreshCw, AlertCircle, TrendingUp, Activity, Target, Zap, ArrowUpDown, ChevronUp, ChevronDown, Shield } from 'lucide-react';
import TwoPanelTable from './TwoPanelTable';

interface PeriodAnalysisProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
}

interface AggregatedStats {
  id: number;
  web_name: string;
  team: string;
  element_type: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  total_points: number;
  ownership: string;
  median_points: number;
  consistency: number; // % of games with > 2 points
  matches_played: number;
  points_history: { points: number; round: number }[]; // Array of scores with rounds

  // Start Rate & Availability Metrics
  startRate: number; // % of GWs where player played (minutes > 0)
  games_available: number;
  games_played: number;
  zero_starts: number;
  zero_points: number;
  starts_count: number;

  // Defensive
  goals_conceded: number;
  def_pts_proxy: number;

  // Attacking Underlying
  threat: number;
  creativity: number;
}

const PeriodAnalysis: React.FC<PeriodAnalysisProps> = ({ players, teams, events }) => {
  // Identify the last finished gameweek to mark as "Latest"
  const lastFinishedEventId = useMemo(() => events.filter(e => e.finished).pop()?.id || 1, [events]);

  // Determine defaults based on current gameweek context
  const currentEventId = events.find(e => e.is_current)?.id || events.find(e => e.is_next)?.id || lastFinishedEventId;
  const defaultTo = lastFinishedEventId; // Default to last finished data
  const defaultFrom = Math.max(1, defaultTo - 4); // Last 5 GWs

  const [fromGw, setFromGw] = useState<number>(defaultFrom);
  const [toGw, setToGw] = useState<number>(defaultTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AggregatedStats[]>([]);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // Filters & Sorting
  const [activePos, setActivePos] = useState<number | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AggregatedStats | 'ownership_num'; direction: 'asc' | 'desc' }>({
    key: 'total_points',
    direction: 'desc'
  });

  // UX Toggles
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollLeft > 4 && showSwipeHint) {
      setShowSwipeHint(false);
    }
  };

  // Reset expanded row when switching tabs to prevent layout jumping
  useEffect(() => {
    setExpandedRow(null);
  }, [activePos]);

  // Helper: safe number parsing
  const toNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Core Analysis Function
  const runAnalysis = useCallback(async (start: number, end: number) => {
    if (start > end) {
      setError("Start Gameweek must be before End Gameweek.");
      return;
    }
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const topPlayers = [...players]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 50);

      const totalGwRange = end - start + 1;

      const promises = topPlayers.map(async (player) => {
        try {
          const summary = await getPlayerSummary(player.id);

          const relevantHistory = summary.history.filter(
            h => h.round >= start && h.round <= end
          );

          if (relevantHistory.length === 0) return null;

          // Calculate Median
          const pointsArr = relevantHistory.map(h => h.total_points).sort((a, b) => a - b);
          let median = 0;
          if (pointsArr.length > 0) {
            const mid = Math.floor(pointsArr.length / 2);
            median = pointsArr.length % 2 !== 0 ? pointsArr[mid] : (pointsArr[mid - 1] + pointsArr[mid]) / 2;
          }

          // Calculate Consistency
          const returns = relevantHistory.filter(h => h.total_points > 2).length;
          const consistency = relevantHistory.length > 0 ? (returns / relevantHistory.length) * 100 : 0;

          // Calculate Start Rate
          const playedGwSet = new Set(relevantHistory.filter(h => h.minutes > 0).map(h => h.round));
          const gamesPlayed = playedGwSet.size;
          const startRate = (gamesPlayed / totalGwRange) * 100;
          const zeroStarts = totalGwRange - gamesPlayed;
          const zeroPoints = relevantHistory.filter(h => h.minutes > 0 && h.total_points === 0).length;

          // Aggregate stats
          const agg = relevantHistory.reduce((acc, match) => ({
            goals: acc.goals + match.goals_scored,
            assists: acc.assists + match.assists,
            clean_sheets: acc.clean_sheets + match.clean_sheets,
            goals_conceded: acc.goals_conceded + match.goals_conceded,
            bonus: acc.bonus + match.bonus,
            total_points: acc.total_points + match.total_points,
            threat: acc.threat + toNum((match as any).threat),
            creativity: acc.creativity + toNum((match as any).creativity),
          }), { goals: 0, assists: 0, clean_sheets: 0, goals_conceded: 0, bonus: 0, total_points: 0, threat: 0, creativity: 0 });

          const historyNewestFirst = relevantHistory.map(h => ({
            points: h.total_points,
            round: h.round
          })).reverse();

          // Started count (using starts field if available, otherwise fallback to minutes >= 60)
          const startsCount = relevantHistory.filter(h => (h as any).starts !== undefined ? (h as any).starts === 1 : h.minutes >= 60).length;

          // Defensive Proxy Logic
          let defPtsProxy = 0;
          if (player.element_type <= 2) { // GK or DEF
            defPtsProxy = (agg.clean_sheets * 4) - Math.floor(agg.goals_conceded / 2);
          } else if (player.element_type === 3) { // MID
            defPtsProxy = agg.clean_sheets * 1;
          }

          return {
            id: player.id,
            web_name: player.web_name,
            team: teams.find(t => t.id === player.team)?.short_name || "UNK",
            element_type: player.element_type,
            ownership: player.selected_by_percent,
            median_points: median,
            consistency: consistency,
            startRate: startRate,
            games_available: totalGwRange,
            games_played: gamesPlayed,
            zero_starts: zeroStarts,
            zero_points: zeroPoints,
            starts_count: startsCount,
            goals_conceded: agg.goals_conceded,
            def_pts_proxy: defPtsProxy,
            matches_played: relevantHistory.length,
            points_history: historyNewestFirst,
            ...agg
          };
        } catch (err) {
          console.warn(`Failed to fetch history for ${player.web_name}`, err);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((r): r is AggregatedStats => r !== null);
      setData(validResults);

    } catch (err) {
      console.error(err);
      setError("Failed to fetch player data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [players, teams]);

  // Auto-load on mount
  useEffect(() => {
    if (!hasAutoLoaded && players.length > 0) {
      runAnalysis(defaultFrom, defaultTo);
      setHasAutoLoaded(true);
    }
  }, [hasAutoLoaded, players, defaultFrom, defaultTo, runAnalysis]);

  const handleAnalyzeClick = () => {
    runAnalysis(fromGw, toGw);
  };

  const handlePreset = (count: number) => {
    // Determine 'end' as the last finished gameweek or current
    const end = lastFinishedEventId;
    const start = Math.max(1, end - count + 1);

    setFromGw(start);
    setToGw(end);

    // Trigger analysis immediately
    runAnalysis(start, end);
  };

  const isPresetActive = (count: number) => {
    const end = lastFinishedEventId;
    const start = Math.max(1, end - count + 1);
    return fromGw === start && toGw === end;
  };

  // --- Processing for Display ---
  const processedData = useMemo(() => {
    let filtered = data;
    if (activePos !== 'all') {
      filtered = filtered.filter(p => p.element_type === activePos);
    }

    return filtered.sort((a, b) => {
      let valA: any = a[sortConfig.key === 'ownership_num' ? 'ownership' : sortConfig.key];
      let valB: any = b[sortConfig.key === 'ownership_num' ? 'ownership' : sortConfig.key];

      if (sortConfig.key === 'ownership_num' || sortConfig.key === 'ownership') {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, activePos, sortConfig]);

  const handleSort = (key: keyof AggregatedStats | 'ownership_num') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    const activeKey = sortConfig.key === 'ownership_num' ? 'ownership' : sortConfig.key;
    const targetKey = colKey === 'ownership_num' ? 'ownership' : colKey;

    if (activeKey !== targetKey) return <ArrowUpDown size={12} className="text-slate-600 sm:size-[14px] inline ml-1" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="text-purple-400 sm:size-[14px] inline ml-1" />
      : <ChevronDown size={12} className="text-purple-400 sm:size-[14px] inline ml-1" />;
  };

  const InfoIcon = ({ children }: { children: React.ReactNode }) => (
    <div className="relative group inline-block ml-1">
      <AlertCircle size={12} className="text-slate-500 hover:text-slate-300 transition-colors sm:size-[14px]" />
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 hidden group-hover:block w-56 p-3 bg-slate-900 border border-slate-700 rounded shadow-2xl text-[10px] normal-case tracking-normal text-slate-200 z-[999] ring-1 ring-slate-700 pointer-events-none">
        {children}
      </div>
    </div>
  );

  // --- Relative Rank Helpers ---
  const getMetricRating = useCallback((value: number, elementType: number, key: 'threat' | 'creativity' | 'def_pts_proxy') => {
    const values = data
      .filter(p => p.element_type === elementType)
      .map(p => p[key]);

    if (values.length < 20) return { label: 'Medium', segments: 5 };

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.filter(v => v < value).length;
    const percentile = count / (sorted.length - 1);

    if (percentile >= 0.90) return { label: 'Elite', segments: 10 };
    if (percentile >= 0.75) return { label: 'High', segments: 8 };
    if (percentile >= 0.40) return { label: 'Medium', segments: 5 };
    if (percentile >= 0.15) return { label: 'Low', segments: 3 };
    return { label: 'Very Low', segments: 1 };
  }, [data]);

  const MetricRatingBar = ({ segments, colorClass }: { segments: number; colorClass: string }) => (
    <div className="flex gap-0.5 ml-2">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className={`h-2 w-1 rounded-sm ${i < segments ? colorClass.replace('text-', 'bg-') : 'bg-slate-700'}`}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 overflow-x-hidden">
      {/* Header & Controls */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
              <img
                src="/icons/period_kalendar.png"
                alt=""
                aria-hidden="true"
                className="w-6 h-6"
              /> Period Analysis
            </h2>
            <p className="text-slate-400 text-sm mb-4">Analyze player performance over a specific range of Gameweeks.</p>

            {/* Legend Toggle */}
            <div className="mt-4">
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium text-left flex items-center gap-1"
              >
                {showLegend ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                How to read these metrics? (Legend)
              </button>

              {showLegend && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                    <h4 className="text-blue-400 font-bold text-[10px] uppercase tracking-wider mb-1">Median Points</h4>
                    <p className="text-[11px] text-slate-300 leading-tight">Typical points return (middle score).</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">Less affected by one big haul.</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                    <h4 className="text-green-400 font-bold text-[10px] uppercase tracking-wider mb-1">Points Consistency</h4>
                    <p className="text-[11px] text-slate-300 leading-tight">Percent of played matches with 3+ points.</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">Played = minutes &gt; 0.</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                    <h4 className="text-orange-400 font-bold text-[10px] uppercase tracking-wider mb-1">Start Rate</h4>
                    <p className="text-[11px] text-slate-300 leading-tight">How often the player gets minutes.</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">Percent of GWs where played (min &gt; 0).</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                    <h4 className="text-red-400 font-bold text-[10px] uppercase tracking-wider mb-1">Threat</h4>
                    <p className="text-[11px] text-slate-300 leading-tight">Goal threat indicator (proxy for xG).</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">Higher = more scoring chances.</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                    <h4 className="text-sky-400 font-bold text-[10px] uppercase tracking-wider mb-1">Creativity</h4>
                    <p className="text-[11px] text-slate-300 leading-tight">Chance creation indicator (proxy for xA).</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">Higher = more assist potential.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Help Panel */}
            <div className="mt-4">
              <button
                onClick={() => setShowHelpPanel(!showHelpPanel)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium text-left"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    {showHelpPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Quick reading order
                  </div>
                  {!showHelpPanel && (
                    <p className="text-[10px] text-slate-500 font-normal pl-4">
                      Median &rarr; Consistency &rarr; Start Rate &rarr; Threat / Creativity
                    </p>
                  )}
                </div>
              </button>
              {showHelpPanel && (
                <div className="mt-2 p-4 bg-slate-900/80 border border-slate-700 rounded-lg animate-in slide-in-from-top-1 duration-200">
                  <ul className="text-xs text-slate-300 space-y-3">
                    <li className="flex gap-2">
                      <span className="text-purple-400 font-bold shrink-0">1) Median</span>
                      <span>&rarr; What you typically get.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-purple-400 font-bold shrink-0">2) Consistency</span>
                      <span>&rarr; How often the player delivers usable points.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-purple-400 font-bold shrink-0">3) Start Rate (check only)</span>
                      <span>&rarr; Is there rotation or bench risk?</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-purple-400 font-bold shrink-0">4) Threat / Creativity</span>
                      <span>&rarr; Is there upside beyond recent points?</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            <div className="flex gap-2 items-center w-full">
              {[3, 5, 10].map(c => (
                <button
                  key={c}
                  onClick={() => handlePreset(c)}
                  className={`flex-1 md:flex-none px-3 py-2 text-xs font-bold rounded transition-colors border ${isPresetActive(c) ? 'bg-purple-600 border-purple-500 text-white shadow' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'}`}
                >
                  Last {c}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">From</label>
                <select value={fromGw} onChange={(e) => setFromGw(Number(e.target.value))} className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-3 py-2 w-32 focus:ring-2 focus:ring-purple-500 outline-none">
                  {events.map(e => <option key={e.id} value={e.id}>GW {e.id}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">To</label>
                <select value={toGw} onChange={(e) => setToGw(Number(e.target.value))} className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-3 py-2 w-32 focus:ring-2 focus:ring-purple-500 outline-none">
                  {events.map(e => <option key={e.id} value={e.id}>GW {e.id} {e.id === lastFinishedEventId ? '(Latest)' : ''}</option>)}
                </select>
              </div>
              <button onClick={handleAnalyzeClick} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/20 ml-2">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Analyze'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 p-3 rounded flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>
      </div>

      {data.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setActivePos('all')}
            className={`flex-1 min-w-max px-3 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm rounded-lg font-bold transition-all whitespace-nowrap ${activePos === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <span className="sm:hidden">All</span>
            <span className="hidden sm:inline">All Players</span>
          </button>
          {[1, 2, 3, 4].map(pos => (
            <button
              key={pos}
              onClick={() => setActivePos(pos)}
              className={`flex-1 min-w-max px-3 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm rounded-lg font-bold transition-all whitespace-nowrap ${activePos === pos ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {pos === 1 ? (
                <>
                  <span className="sm:hidden">GK</span>
                  <span className="hidden sm:inline">Goalkeepers</span>
                </>
              ) : pos === 2 ? (
                <>
                  <span className="sm:hidden">DEF</span>
                  <span className="hidden sm:inline">Defenders</span>
                </>
              ) : pos === 3 ? (
                <>
                  <span className="sm:hidden">MID</span>
                  <span className="hidden sm:inline">Midfielders</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">FWD</span>
                  <span className="hidden sm:inline">Forwards</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {processedData.length > 0 && (
        <div className="space-y-8">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
            <div className="p-4 border-b border-slate-700 bg-slate-900/30">
              <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp size={18} className="text-green-400" /> Points & Consistency</h3>
            </div>
            <div className="relative group/table">
              <div
                ref={tableWrapperRef}
                onScroll={handleTableScroll}
                className="overflow-x-auto no-scrollbar overscroll-x-contain"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider sticky top-0 z-40">
                      <th className="px-1 py-2 sm:px-3 sm:py-4 w-12 text-center bg-slate-900 border-b border-slate-700 hidden sm:table-cell">#</th>
                      <th className="px-2 py-2 sm:px-4 sm:py-4 cursor-pointer hover:text-white sticky left-0 z-50 bg-slate-900 border-b border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.3)] w-[110px] min-w-[110px] sm:w-auto" onClick={() => handleSort('web_name')}>PLAYER <SortIcon colKey="web_name" /></th>
                      <th className="px-1 py-2 sm:px-3 sm:py-4 text-right cursor-pointer hover:text-white bg-slate-900 border-b border-slate-700 hidden sm:table-cell" onClick={() => handleSort('ownership_num')}>OWN <SortIcon colKey="ownership" /></th>
                      <th className="px-1 py-2 sm:px-3 sm:py-4 text-left text-slate-300 bg-slate-900 border-b border-slate-700 sticky left-[110px] sm:static z-40 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.3)] sm:shadow-none min-w-[120px] sm:min-w-0">
                        <span className="sm:hidden">FORM</span>
                        <span className="hidden sm:inline">POINTS HISTORY</span>
                        <InfoIcon>
                          <strong className="block mb-1 text-white">Points History</strong>
                          Match-by-match points from newest to oldest in the selected period.
                        </InfoIcon>
                      </th>
                      <th className="px-1 py-2 sm:px-3 sm:py-4 text-right text-blue-400 font-bold cursor-pointer hover:text-white bg-slate-900 border-b border-slate-700" onClick={() => handleSort('median_points')}>MEDIAN <SortIcon colKey="median_points" /></th>
                      <th className="px-1 py-2 sm:px-3 sm:py-4 text-right text-green-400 font-bold cursor-pointer hover:text-white bg-slate-900 border-b border-slate-700" onClick={() => handleSort('consistency')}>CONS. <span className="hidden sm:inline">CONSISTENCY</span> <SortIcon colKey="consistency" /></th>
                      <th className="px-1 py-2 sm:px-3 sm:py-4 text-right text-orange-400 font-bold cursor-pointer hover:text-white bg-slate-900 border-b border-slate-700" onClick={() => handleSort('startRate')}>SRATE <SortIcon colKey="startRate" /></th>
                      <th className="px-1 py-2 sm:px-3 sm:py-4 text-right font-bold text-white cursor-pointer hover:text-white bg-slate-900 border-b border-slate-700" onClick={() => handleSort('total_points')}><span className="text-[10px] sm:text-xs">PTS</span> <SortIcon colKey="total_points" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-[11px] sm:text-sm">
                    {processedData.map((p, idx) => (
                      <React.Fragment key={p.id}>
                        <tr className={`group odd:bg-white/[0.02] even:bg-transparent hover:bg-white/[0.04] transition-colors cursor-pointer ${expandedRow === p.id ? 'bg-slate-700/50' : ''}`} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                          <td className="px-1 py-2 sm:px-3 sm:py-4 text-center text-slate-500 font-mono hidden sm:table-cell">{idx + 1}</td>
                          <td className="px-2 py-2 sm:px-4 sm:py-4 sticky left-0 z-30 bg-slate-800 group-odd:bg-[#1f293d] group-hover:bg-[#252f44] border-r border-slate-700/50 w-[110px] min-w-[110px] sm:w-auto">
                            <div className="font-bold text-white flex items-center justify-between gap-1 truncate leading-tight">
                              <span className="truncate text-sm">{p.web_name}</span>
                              {expandedRow === p.id ? <ChevronUp size={12} className="shrink-0 sm:size-[14px]" /> : <ChevronDown size={12} className="shrink-0 sm:size-[14px]" />}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5 sm:mt-1">{p.team}</div>
                          </td>
                          <td className="px-1 py-2 sm:px-3 sm:py-4 text-right font-mono text-slate-400 hidden sm:table-cell">{p.ownership}%</td>
                          <td className="px-1 py-2 sm:px-3 sm:py-4 sticky left-[110px] sm:static z-20 bg-slate-800 group-odd:bg-[#1f293d] group-hover:bg-[#252f44] border-r border-slate-700/50 sm:border-r-0 min-w-[120px] sm:min-w-0">
                            <div className="flex justify-start gap-0.5 sm:gap-1 mt-3 sm:mt-4">
                              {p.points_history.map((h, i) => {
                                const isFirst = i === 0;
                                const isLast = i === p.points_history.length - 1;
                                return (
                                  <div key={i} className="relative group/badge flex flex-col items-center">
                                    {(isFirst || isLast) && (
                                      <div className="absolute top-[-1.15rem] left-0 w-full text-center">
                                        <span className="text-[7px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tighter">GW{h.round}</span>
                                      </div>
                                    )}
                                    <div className={`w-5 h-5 sm:w-6 sm:h-6 flex-none flex items-center justify-center text-[9px] sm:text-[10px] font-bold rounded-md border ${h.points >= 10 ? 'bg-purple-600 text-white' : h.points >= 6 ? 'bg-green-600 text-white' : h.points > 2 ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                      {h.points}
                                    </div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/badge:block w-max px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[9px] text-white z-50 pointer-events-none">
                                      GW {h.round}: {h.points} pts
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-1 py-2 sm:px-3 sm:py-4 text-right font-mono font-bold text-blue-300">{p.median_points}</td>
                          <td className="px-1 py-2 sm:px-3 sm:py-4 text-right font-mono font-bold text-green-400">{p.consistency.toFixed(0)}%</td>
                          <td className={`px-1 py-2 sm:px-3 sm:py-4 text-right font-mono font-bold ${p.startRate < 80 ? 'text-amber-500/80' : 'text-orange-300'}`}>{p.startRate.toFixed(0)}%</td>
                          <td className="px-1 py-2 sm:px-3 sm:py-4 text-right font-bold text-white text-[11px] sm:text-sm">{p.total_points}</td>
                        </tr>
                        {expandedRow === p.id && (
                          <tr className="bg-slate-900/40">
                            <td colSpan={8} className="p-0 border-none">
                              <div className="sticky left-0 w-[calc(100vw-48px)] sm:w-full p-4 sm:p-6 overflow-x-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                      <Target size={14} className="text-red-400" /> ATTACKING
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                        <div className="flex justify-between text-[10px] font-bold text-red-400 mb-1">
                                          <span>THREAT</span>
                                          <span>{p.threat.toFixed(1)}</span>
                                        </div>
                                        <MetricRatingBar segments={getMetricRating(p.threat, p.element_type, 'threat').segments} colorClass="text-red-400" />
                                      </div>
                                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                        <div className="flex justify-between text-[10px] font-bold text-sky-400 mb-1">
                                          <span>CREATIVITY</span>
                                          <span>{p.creativity.toFixed(1)}</span>
                                        </div>
                                        <MetricRatingBar segments={getMetricRating(p.creativity, p.element_type, 'creativity').segments} colorClass="text-sky-400" />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                      <Shield size={14} className="text-blue-400" /> DEFENSIVE
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                        <div className="flex justify-between text-[10px] font-bold text-blue-400 mb-1">
                                          <span>DEF POINTS</span>
                                          <span>{p.def_pts_proxy.toFixed(1)}</span>
                                        </div>
                                        <MetricRatingBar segments={getMetricRating(p.def_pts_proxy, p.element_type, 'def_pts_proxy').segments} colorClass="text-blue-400" />
                                      </div>
                                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 flex flex-col justify-center gap-1.5">
                                        <div className="text-[10px] font-bold text-emerald-400 flex justify-between">
                                          <span>CS</span>
                                          <span className="text-white font-mono">{p.clean_sheets}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 flex justify-between border-t border-slate-700/50 pt-1">
                                          <span>GC</span>
                                          <span className="text-white font-mono">{p.goals_conceded}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-3 hidden md:block">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                      <CalendarRange size={14} className="text-orange-400" /> AVAILABILITY
                                    </h4>
                                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 space-y-2 text-[10px] font-bold">
                                      <div className="flex justify-between text-red-400 border-b border-slate-700/30 pb-1">
                                        <span>MISSED</span>
                                        <span className="text-white font-mono">{p.zero_starts}</span>
                                      </div>
                                      <div className="flex justify-between text-orange-400">
                                        <span>CAMEOS</span>
                                        <span className="text-white font-mono">{p.zero_points}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {showSwipeHint && (
                <div className="md:hidden pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-slate-950/60 to-transparent z-[60]" />
              )}
            </div>
            <div className="p-4 bg-slate-900/50 border-t border-slate-700 text-xs text-slate-400">
              Consistency measures returns when played. Start Rate shows how often a player gets minutes.
            </div>
          </div>


        </div>
      )}
    </div>
  );
};

export default PeriodAnalysis;
