
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent } from '../types';
import { getPlayerSummary } from '../services/fplService';
import { CalendarRange, RefreshCw, AlertCircle, TrendingUp, Activity, Target, Zap, ArrowUpDown, ChevronUp, ChevronDown, Shield } from 'lucide-react';

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
  points_history: number[]; // Array of scores

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

  // Risk Adjusted
  adj_points: number;

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
  const [riskPenaltyEnabled, setRiskPenaltyEnabled] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showHelpPanel, setShowHelpPanel] = useState(false);

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

          const historyChronological = relevantHistory.map(h => h.total_points);

          // Started count (using starts field if available, otherwise fallback to minutes >= 60)
          const startsCount = relevantHistory.filter(h => (h as any).starts !== undefined ? (h as any).starts === 1 : h.minutes >= 60).length;

          // Defensive Proxy Logic
          let defPtsProxy = 0;
          if (player.element_type <= 2) { // GK or DEF
            defPtsProxy = (agg.clean_sheets * 4) - Math.floor(agg.goals_conceded / 2);
          } else if (player.element_type === 3) { // MID
            defPtsProxy = agg.clean_sheets * 1;
          }

          // Risk Adjusted Points
          const adjPoints = agg.total_points - ((zeroStarts * 1.0) + (zeroPoints * 0.5));

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
            adj_points: adjPoints,
            matches_played: relevantHistory.length,
            points_history: historyChronological,
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

    if (activeKey !== targetKey) return <ArrowUpDown size={14} className="text-slate-600 inline ml-1" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={14} className="text-purple-400 inline ml-1" />
      : <ChevronDown size={14} className="text-purple-400 inline ml-1" />;
  };

  const InfoIcon = ({ children }: { children: React.ReactNode }) => (
    <div className="relative group inline-block ml-1">
      <AlertCircle size={14} className="text-slate-500 hover:text-slate-300 transition-colors" />
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
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

            {/* Legend Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
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
            <div className="flex gap-2 items-center">
              {[3, 5, 10].map(c => (
                <button
                  key={c}
                  onClick={() => handlePreset(c)}
                  className={`px-3 py-2 text-xs font-bold rounded transition-colors border ${isPresetActive(c) ? 'bg-purple-600 border-purple-500 text-white shadow' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'}`}
                >
                  Last {c}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActivePos('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activePos === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>All Players</button>
          {[1, 2, 3, 4].map(pos => (
            <button key={pos} onClick={() => setActivePos(pos)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activePos === pos ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {pos === 1 ? "Goalkeepers" : pos === 2 ? "Defenders" : pos === 3 ? "Midfielders" : "Forwards"}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <button onClick={() => setRiskPenaltyEnabled(!riskPenaltyEnabled)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${riskPenaltyEnabled ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          <Activity size={14} /> Risk Penalty: {riskPenaltyEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {processedData.length > 0 && (
        <div className="space-y-8">
          {/* Table 1: Primary Metrics */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg" style={{ overflow: 'visible' }}>
            <div className="p-4 border-b border-slate-700 bg-slate-900/30">
              <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp size={18} className="text-green-400" /> Points & Consistency</h3>
            </div>
            <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
              <div className="min-w-full inline-block align-middle overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ overflow: 'visible' }}>
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-20">
                      <th className="p-4 w-12 text-center bg-slate-900/90 border-b border-slate-700 hidden sm:table-cell">#</th>
                      <th className="p-4 cursor-pointer hover:text-white sticky left-0 z-30 bg-slate-900/95 border-b border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.3)]" onClick={() => handleSort('web_name')}>PLAYER <SortIcon colKey="web_name" /></th>
                      <th className="p-4 text-right cursor-pointer hover:text-white bg-slate-900/90 border-b border-slate-700" onClick={() => handleSort('ownership_num')}>OWN <SortIcon colKey="ownership" /></th>
                      <th className="p-4 text-right text-slate-300 bg-slate-900/90 border-b border-slate-700 hidden sm:table-cell">
                        POINTS HISTORY
                        <InfoIcon>
                          <strong className="block mb-1 text-white">Points History</strong>
                          Match-by-match points in the selected period.
                          <br /><br />
                          <span className="text-slate-400">How to read it:</span><br />
                          Look for patterns, not single results.
                        </InfoIcon>
                      </th>
                      <th className="p-4 text-right text-blue-400 font-bold cursor-pointer hover:text-white bg-slate-900/90 border-b border-slate-700" onClick={() => handleSort('median_points')}>
                        MEDIAN <SortIcon colKey="median_points" />
                        <InfoIcon>
                          <strong className="block mb-1 text-white">Median Points</strong>
                          Median shows a player’s typical points return when he plays.
                          It is less affected by one big haul or one bad game.
                          <br /><br />
                          <span className="text-slate-400">How to read it:</span><br />
                          Half of the matches are above this value and half below.
                          This is the player’s baseline output.
                        </InfoIcon>
                      </th>
                      <th className="p-4 text-right text-green-400 font-bold cursor-pointer hover:text-white bg-slate-900/90 border-b border-slate-700" onClick={() => handleSort('consistency')}>
                        POINTS CONSISTENCY <SortIcon colKey="consistency" />
                        <InfoIcon>
                          <strong className="block mb-1 text-white">Points Consistency</strong>
                          How often the player delivers usable points.
                          <br /><br />
                          Percent of played matches with 3+ points.
                          Played = minutes &gt; 0.
                          <br /><br />
                          <span className="text-slate-400">How to read it:</span><br />
                          Higher value means fewer frustrating blanks.
                        </InfoIcon>
                      </th>
                      <th className="p-4 text-right text-orange-400 font-bold cursor-pointer hover:text-white bg-slate-900/90 border-b border-slate-700" onClick={() => handleSort('startRate')}>
                        START RATE <SortIcon colKey="startRate" />
                        <InfoIcon>
                          <strong className="block mb-1 text-white">Start Rate</strong>
                          How often the player gets minutes.
                          <br /><br />
                          Used as a rotation / availability check, not a performance metric.
                        </InfoIcon>
                      </th>
                      {riskPenaltyEnabled && <th className="p-4 text-right text-red-400 font-bold cursor-pointer hover:text-white bg-slate-900/90 border-b border-slate-700" onClick={() => handleSort('adj_points')}>Adj. Pts <SortIcon colKey="adj_points" /></th>}
                      <th className="p-4 text-right font-bold text-white cursor-pointer hover:text-white bg-slate-900/90 border-b border-slate-700" onClick={() => handleSort('total_points')}>TOTAL PTS <SortIcon colKey="total_points" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {processedData.map((p, idx) => (
                      <React.Fragment key={p.id}>
                        <tr className={`hover:bg-slate-700/30 transition-colors cursor-pointer ${expandedRow === p.id ? 'bg-slate-700/50' : ''}`} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                          <td className="p-4 text-center text-slate-500 font-mono hidden sm:table-cell">{idx + 1}</td>
                          <td className="p-4 sticky left-0 z-10 bg-slate-800 border-r border-slate-700/50">
                            <div className="font-bold text-white flex items-center justify-between">{p.web_name} {expandedRow === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>
                            <div className="text-xs text-slate-500">{p.team}</div>
                          </td>
                          <td className="p-4 text-right font-mono text-slate-400">{p.ownership}%</td>
                          <td className="p-4 hidden sm:table-cell text-right">
                            <div className="flex justify-end gap-1">
                              {p.points_history.map((pt, i) => (
                                <div key={i} className={`w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded border ${pt >= 10 ? 'bg-purple-600 text-white' : pt >= 6 ? 'bg-green-600 text-white' : pt > 2 ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{pt}</div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-blue-300">{p.median_points}</td>
                          <td className="p-4 text-right font-mono font-bold text-green-400">
                            <div className="relative group inline-block">
                              {p.consistency.toFixed(0)}%
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[10px] font-normal tracking-normal text-slate-200 z-50 pointer-events-none">
                                Percent of played matches with 3+ points.
                                <br />
                                Played = appearances with minutes &gt; 0.
                              </div>
                            </div>
                          </td>
                          <td className={`p-4 text-right font-mono font-bold ${p.startRate < 80 ? 'text-amber-500/80' : 'text-orange-300'}`}>
                            <div className="relative group inline-block">
                              <div className="flex items-center justify-end gap-1">
                                {p.startRate < 80 && <AlertCircle size={12} className="opacity-70" />}
                                {p.startRate.toFixed(0)}%
                              </div>
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[10px] font-normal tracking-normal text-slate-200 z-50 pointer-events-none text-left">
                                <p className="mb-1">How often the player gets minutes.</p>
                                <p className="text-slate-400 mb-2">Used as a rotation / availability check, not a performance metric.</p>
                                <div className="pt-2 border-t border-slate-800 font-mono text-[9px] flex items-center justify-between">
                                  <span className="text-slate-200">Started: {p.starts_count}/{p.games_available}</span>
                                  <span className="text-slate-500 mx-1">&bull;</span>
                                  <span className="text-slate-300">Played: {p.games_played}/{p.games_available}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          {riskPenaltyEnabled && <td className="p-4 text-right font-mono font-bold text-red-400">{p.adj_points.toFixed(1)}</td>}
                          <td className="p-4 text-right font-bold text-white text-base">{p.total_points}</td>
                        </tr>
                        {expandedRow === p.id && (
                          <tr className="bg-slate-900/40">
                            <td colSpan={riskPenaltyEnabled ? 9 : 8} className="p-0 border-none overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                  <div className="flex flex-col h-full space-y-3">
                                    <div className="space-y-1">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Target size={14} className="text-red-400" /> ATTACKING
                                      </h4>
                                      <p className="text-[10px] text-slate-500 leading-tight">Underlying attacking involvement.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs flex-1">
                                      <div className="bg-slate-800/50 p-2.5 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:bg-slate-700/50 relative group cursor-help">
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center justify-between">
                                            <span>THREAT</span>
                                            <span className="text-white text-xs font-mono">{p.threat.toFixed(1)}</span>
                                          </div>
                                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
                                            {(() => {
                                              const rating = getMetricRating(p.threat, p.element_type, 'threat');
                                              return (
                                                <>
                                                  <span className="text-[9px] opacity-60 font-normal normal-case">{rating.label}</span>
                                                  <MetricRatingBar segments={rating.segments} colorClass="text-red-400" />
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50">
                                          <p className="font-bold mb-1">How to read:</p>
                                          <p>Relative ranking among players in the same position for this period.</p>
                                          <p className="mt-1 opacity-60 italic">Measures goal-scoring danger. Higher = more shots and chances close to goal.</p>
                                        </div>
                                      </div>
                                      <div className="bg-slate-800/50 p-2.5 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-sky-400 transition-colors hover:bg-slate-700/50 relative group cursor-help">
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center justify-between">
                                            <span>CREATIVITY</span>
                                            <span className="text-white text-xs font-mono">{p.creativity.toFixed(1)}</span>
                                          </div>
                                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
                                            {(() => {
                                              const rating = getMetricRating(p.creativity, p.element_type, 'creativity');
                                              return (
                                                <>
                                                  <span className="text-[9px] opacity-60 font-normal normal-case">{rating.label}</span>
                                                  <MetricRatingBar segments={rating.segments} colorClass="text-sky-400" />
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50">
                                          <p className="font-bold mb-1">How to read:</p>
                                          <p>Relative ranking among players in the same position for this period.</p>
                                          <p className="mt-1 opacity-60 italic">Measures chance creation for teammates. Higher = more assist potential.</p>
                                        </div>
                                      </div>
                                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-emerald-400">GOALS: {p.goals}</div>
                                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-emerald-400">ASSISTS: {p.assists}</div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col h-full space-y-3">
                                    <div className="space-y-1">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Shield size={14} className="text-blue-400" /> Defensive
                                      </h4>
                                      <p className="text-[10px] text-slate-500 leading-tight">Shows defensive contribution and clean sheet value.</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 text-xs flex-1">
                                      <div className="bg-slate-800/50 p-2.5 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-blue-400 transition-colors hover:bg-slate-700/50 relative group cursor-help">
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center justify-between">
                                            <span>DEFENSIVE POINTS</span>
                                            <span className="text-white text-xs font-mono">{p.def_pts_proxy.toFixed(1)}</span>
                                          </div>
                                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
                                            {(() => {
                                              const rating = getMetricRating(p.def_pts_proxy, p.element_type, 'def_pts_proxy');
                                              return (
                                                <>
                                                  <span className="text-[9px] opacity-60 font-normal normal-case">{rating.label}</span>
                                                  <MetricRatingBar segments={rating.segments} colorClass="text-blue-400" />
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50">
                                          <p className="font-bold mb-1">How to read:</p>
                                          <p>Relative ranking among players in the same position for this period.</p>
                                          <p className="mt-1 opacity-60 italic">Total points earned from defensive actions. Includes clean sheets, goals conceded impact and bonuses.</p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-emerald-400">CLEAN SHEETS: {p.clean_sheets}
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50 pointer-events-none">
                                            Matches with no goals conceded while playing.
                                          </div></div>
                                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-slate-300 relative group cursor-help">
                                          GOALS CONCEDED: {p.goals_conceded}
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50 pointer-events-none">
                                            Goals conceded while the player was on the pitch.
                                          </div>

                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col h-full space-y-3">
                                    <div className="space-y-1">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><CalendarRange size={14} className="text-orange-400" /> Availability</h4>
                                      <p className="text-[10px] text-slate-500 leading-tight">Shows minutes security and rotation risk.</p>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 text-[10px] flex-1 flex flex-col justify-center">
                                      <div className="space-y-4">
                                        {/* Risk / Missed Metrics Only */}
                                        <div className="relative group cursor-help text-red-400 font-bold uppercase tracking-wider flex justify-between items-center border-b border-slate-700/30 pb-2">
                                          <span>MISSED MATCHES</span>
                                          <span className="text-white font-mono">{p.zero_starts}</span>
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50">
                                            Matches where the player did not play at all.
                                          </div>
                                        </div>
                                        <div className="relative group cursor-help text-orange-400 font-bold uppercase tracking-wider flex justify-between items-center">
                                          <span>0-POINT CAMEOS</span>
                                          <span className="text-white font-mono">{p.zero_points}</span>
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl text-[9px] normal-case tracking-normal font-normal text-slate-200 z-50">
                                            Matches played with zero points. Often late subs or low involvement.
                                          </div>
                                        </div>
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
