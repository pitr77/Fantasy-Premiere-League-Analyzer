
import React, { useState, useEffect, useMemo } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent } from '../types';
import { getPlayerSummary } from '../services/fplService';
import { CalendarRange, RefreshCw, AlertCircle, Info, TrendingUp, Activity, Target, Zap, List, HelpCircle, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

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
  
  // Attacking Underlying
  threat: number;
  creativity: number;
}

const PeriodAnalysis: React.FC<PeriodAnalysisProps> = ({ players, teams, events }) => {
  // Determine defaults based on current gameweek
  const currentEventId = events.find(e => e.is_current)?.id || 1;
  const defaultFrom = Math.max(1, currentEventId - 4); // Last 5 GWs including current

  const [fromGw, setFromGw] = useState<number>(defaultFrom);
  const [toGw, setToGw] = useState<number>(currentEventId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AggregatedStats[]>([]);
  
  // Filters & Sorting
  const [activePos, setActivePos] = useState<number | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AggregatedStats | 'ownership_num'; direction: 'asc' | 'desc' }>({ 
    key: 'total_points', 
    direction: 'desc' 
  });

  const gameweeks = events.map(e => e.id);

  const handlePreset = (count: number) => {
      const end = currentEventId;
      const start = Math.max(1, end - count + 1);
      setFromGw(start);
      setToGw(end);
  };

  const isPresetActive = (count: number) => {
      const end = currentEventId;
      const start = Math.max(1, end - count + 1);
      return fromGw === start && toGw === end;
  };

  const handleAnalyze = async () => {
    if (fromGw > toGw) {
      setError("Start Gameweek must be before End Gameweek.");
      return;
    }
    setLoading(true);
    setError(null);
    setData([]);

    try {
      // To avoid overloading the proxy/API, we only fetch detailed stats for the Top 50 players
      // sorted by total_points. In a real app with a backend, we would fetch all.
      const topPlayers = [...players]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 50);

      // Create an array of promises to fetch data in parallel (with caution)
      const promises = topPlayers.map(async (player) => {
        try {
          const summary = await getPlayerSummary(player.id);
          
          // Filter history for the selected range
          const relevantHistory = summary.history.filter(
            h => h.round >= fromGw && h.round <= toGw
          );

          if (relevantHistory.length === 0) return null;

          // Calculate Median
          const pointsArr = relevantHistory.map(h => h.total_points).sort((a, b) => a - b);
          let median = 0;
          if (pointsArr.length > 0) {
              const mid = Math.floor(pointsArr.length / 2);
              median = pointsArr.length % 2 !== 0 ? pointsArr[mid] : (pointsArr[mid - 1] + pointsArr[mid]) / 2;
          }

          // Calculate Consistency (Returns > 2 points)
          const returns = relevantHistory.filter(h => h.total_points > 2).length;
          const consistency = (returns / relevantHistory.length) * 100;

          // Aggregate stats
          const agg = relevantHistory.reduce((acc, match) => ({
            goals: acc.goals + match.goals_scored,
            assists: acc.assists + match.assists,
            clean_sheets: acc.clean_sheets + match.clean_sheets,
            bonus: acc.bonus + match.bonus,
            total_points: acc.total_points + match.total_points,
            threat: acc.threat + parseFloat(match.threat),
            creativity: acc.creativity + parseFloat(match.creativity),
          }), { goals: 0, assists: 0, clean_sheets: 0, bonus: 0, total_points: 0, threat: 0, creativity: 0 });

          // Get raw points chronological for display
          const historyChronological = relevantHistory.map(h => h.total_points); // Already chronologically sorted by API usually, or round

          return {
            id: player.id,
            web_name: player.web_name,
            team: teams.find(t => t.id === player.team)?.short_name || "UNK",
            element_type: player.element_type,
            ownership: player.selected_by_percent,
            median_points: median,
            consistency: consistency,
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
      
      // Filter out failed requests and sort by points
      const validResults = results
        .filter((r): r is AggregatedStats => r !== null);

      setData(validResults);

    } catch (err) {
      console.error(err);
      setError("Failed to fetch player data. Please try again later.");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header & Controls */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
              <CalendarRange className="text-purple-400" /> Period Analysis
            </h2>
            <p className="text-slate-400 text-sm mb-4">Analyze player performance over a specific range of Gameweeks.</p>
            
            {/* Legend Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <h4 className="text-white font-bold text-xs mb-1 flex items-center gap-2">
                        <Activity size={14} className="text-blue-400" /> Median Points (Typical Score)
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        The middle value of their scores. Unlike 'Average', this ignores one-off lucky weeks (hauls) to show you what the player <em>typically</em> scores.
                    </p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <h4 className="text-white font-bold text-xs mb-1 flex items-center gap-2">
                        <Zap size={14} className="text-green-400" /> Consistency (Reliability)
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        The percentage of matches where the player scored <strong>more than 2 points</strong>. Higher means they rarely "blank".
                    </p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <h4 className="text-white font-bold text-xs mb-1 flex items-center gap-2">
                        <Target size={14} className="text-red-400" /> Threat (xG Proxy)
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Measures a player's threat on goal. High Threat usually correlates with high <strong>Expected Goals (xG)</strong>.
                    </p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <h4 className="text-white font-bold text-xs mb-1 flex items-center gap-2">
                        <List size={14} className="text-blue-400" /> Creativity (xA Proxy)
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Measures ability to create chances. High Creativity usually correlates with high <strong>Expected Assists (xA)</strong>.
                    </p>
                </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase">From GW</label>
              <select 
                value={fromGw}
                onChange={(e) => setFromGw(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 w-24 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {gameweeks.map(gw => <option key={gw} value={gw}>{gw}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase">To GW</label>
              <select 
                value={toGw}
                onChange={(e) => setToGw(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 w-24 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {gameweeks.map(gw => <option key={gw} value={gw}>{gw}</option>)}
              </select>
            </div>

            {/* Presets */}
            <div className="flex gap-1 h-full items-end pb-0.5">
               <button 
                 onClick={() => handlePreset(3)} 
                 className={`px-3 py-1.5 text-xs text-white rounded transition-colors border ${isPresetActive(3) ? 'bg-purple-600 border-purple-500 font-bold shadow' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
               >
                   Last 3
               </button>
               <button 
                 onClick={() => handlePreset(5)} 
                 className={`px-3 py-1.5 text-xs text-white rounded transition-colors border ${isPresetActive(5) ? 'bg-purple-600 border-purple-500 font-bold shadow' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
               >
                   Last 5
               </button>
               <button 
                 onClick={() => handlePreset(10)} 
                 className={`px-3 py-1.5 text-xs text-white rounded transition-colors border ${isPresetActive(10) ? 'bg-purple-600 border-purple-500 font-bold shadow' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
               >
                   Last 10
               </button>
            </div>

            <div className="flex-1"></div>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Analyze Period'}
            </button>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 p-3 rounded flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>
      </div>

      {/* Position Filter Tabs */}
      {data.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button 
                onClick={() => setActivePos('all')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activePos === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
                All Players
            </button>
            {[1, 2, 3, 4].map(pos => (
                <button
                    key={pos}
                    onClick={() => setActivePos(pos)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activePos === pos ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                    {pos === 1 ? "Goalkeepers" : pos === 2 ? "Defenders" : pos === 3 ? "Midfielders" : "Forwards"}
                </button>
            ))}
          </div>
      )}

      {/* Results Tables */}
      {processedData.length > 0 && (
        <>
        {/* Table 1: Points & Reliability */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center flex-wrap gap-2">
             <h3 className="font-bold text-white flex items-center gap-2">
               <TrendingUp size={18} className="text-green-400"/> Points & Consistency
             </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('web_name')}>Player <SortIcon colKey="web_name"/></th>
                  <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ownership_num')}>Own <SortIcon colKey="ownership"/></th>
                  <th className="p-4 text-right text-slate-300">Points History</th>
                  <th className="p-4 text-right text-blue-400 font-bold cursor-pointer hover:text-white" title="Median Score" onClick={() => handleSort('median_points')}>Median <SortIcon colKey="median_points"/></th>
                  <th className="p-4 text-right text-green-400 font-bold cursor-pointer hover:text-white" title="% of games with > 2 points" onClick={() => handleSort('consistency')}>Consist. <SortIcon colKey="consistency"/></th>
                  <th className="p-4 text-right font-bold text-white cursor-pointer hover:text-white" onClick={() => handleSort('total_points')}>Total Pts <SortIcon colKey="total_points"/></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {processedData.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-white">{p.web_name}</div>
                      <div className="text-xs text-slate-500">{p.team}</div>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-400">{p.ownership}%</td>
                    
                    {/* Points History Visualization */}
                    <td className="p-4">
                       <div className="flex justify-end gap-1">
                          {p.points_history.map((pt, i) => (
                              <div 
                                key={i} 
                                className={`w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-[9px] md:text-[10px] font-bold rounded border ${
                                    pt >= 10 ? 'bg-purple-600 border-purple-500 text-white' :
                                    pt >= 6 ? 'bg-green-600 border-green-500 text-white' :
                                    pt > 2 ? 'bg-slate-600 border-slate-500 text-white' :
                                    'bg-slate-800 border-slate-700 text-slate-500'
                                }`}
                                title={`Match ${i+1}: ${pt} pts`}
                              >
                                  {pt}
                              </div>
                          ))}
                       </div>
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-blue-300 bg-blue-900/10 border-l border-r border-slate-700/50">
                        {p.median_points}
                    </td>
                    
                    <td className="p-4 text-right font-mono font-bold text-green-400">
                        {p.consistency.toFixed(0)}%
                    </td>

                    <td className="p-4 text-right font-bold text-white text-base">{p.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Underlying Stats */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden mt-8">
          <div className="p-4 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center flex-wrap gap-2">
             <h3 className="font-bold text-white flex items-center gap-2">
               <Target size={18} className="text-red-400"/> Attacking Underlying Stats (Proxies)
             </h3>
             <span className="text-[10px] text-slate-500">*Threat ≈ xG, Creativity ≈ xA</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('web_name')}>Player <SortIcon colKey="web_name"/></th>
                  <th className="p-4 text-right text-red-400 cursor-pointer hover:text-white" onClick={() => handleSort('threat')}>Threat <SortIcon colKey="threat"/></th>
                  <th className="p-4 text-right text-blue-400 cursor-pointer hover:text-white" onClick={() => handleSort('creativity')}>Creativity <SortIcon colKey="creativity"/></th>
                  <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('goals')}>Goals <SortIcon colKey="goals"/></th>
                  <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('assists')}>Assists <SortIcon colKey="assists"/></th>
                  <th className="p-4 text-right text-yellow-400 cursor-pointer hover:text-white" onClick={() => handleSort('bonus')}>Bonus <SortIcon colKey="bonus"/></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {processedData.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-white">{p.web_name}</div>
                      <div className="text-xs text-slate-500">{p.team}</div>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-300">{p.threat.toFixed(1)}</td>
                    <td className="p-4 text-right font-mono text-slate-300">{p.creativity.toFixed(1)}</td>
                    <td className="p-4 text-right font-bold text-white">{p.goals}</td>
                    <td className="p-4 text-right font-bold text-white">{p.assists}</td>
                    <td className="p-4 text-right font-mono text-yellow-400">{p.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default PeriodAnalysis;
