import React, { useMemo, useState } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import { ArrowLeftRight, TrendingUp, Calendar, DollarSign, Filter, Info, ChevronDown, ChevronUp, Calculator, Activity, HelpCircle, ArrowUpDown } from 'lucide-react';

interface TransferPicksProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  events: FPLEvent[];
}

interface PlayerTransferStats extends FPLPlayer {
  transferIndex: number; // 0.00 - 1.00
  fixtureDifficultySum: number; // Lower is better
  nextFixtures: { event: number; opponent: number; difficulty: number; isHome: boolean }[];
}

const TransferPicks: React.FC<TransferPicksProps> = ({ players, teams, fixtures, events }) => {
  const [activePos, setActivePos] = useState<number>(1); // Default GKP
  const [showInfo, setShowInfo] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'transferIndex', 
    direction: 'desc' 
  });

  const getTeamShort = (id: number) => teams.find(t => t.id === id)?.short_name || "-";

  // 1. Calculate Team Threat Levels (Dynamic Difficulty)
  // Reused logic: Sum of form of top 12 players per team
  const teamThreatMap = useMemo(() => {
    const map: Record<number, number> = {};
    teams.forEach(t => {
      const teamPlayers = players
        .filter(p => p.team === t.id)
        .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
        .slice(0, 12);
      const totalForm = teamPlayers.reduce((acc, p) => acc + parseFloat(p.form), 0);
      map[t.id] = totalForm;
    });
    return map;
  }, [players, teams]);

  // Helper to map Threat to 1-5 Score
  const getDifficultyScore = (threat: number) => {
    if (threat > 55) return 5;
    if (threat > 45) return 4;
    if (threat > 35) return 3;
    if (threat > 25) return 2;
    return 1;
  };

  const getDifficultyColor = (score: number) => {
    switch (score) {
      case 1: return "bg-green-600 text-white border-green-700"; // Easy
      case 2: return "bg-green-500 text-white border-green-600"; // Good
      case 3: return "bg-slate-500 text-white border-slate-600"; // Moderate
      case 4: return "bg-orange-500 text-white border-orange-600"; // Hard
      case 5: return "bg-red-600 text-white border-red-700"; // Very Hard
      default: return "bg-slate-800";
    }
  };

  // 2. Process Players & Calculate Index
  const processedPlayers = useMemo(() => {
    const nextEvent = events.find(e => e.is_next) || events[0];
    const startGw = nextEvent.id;
    const endGw = Math.min(38, startGw + 4); // Next 5 GWs
    
    // Create a map of fixtures by team and event for O(1) lookup
    const fixtureMap: Record<string, { opponent: number; isHome: boolean }> = {};
    fixtures.filter(f => !f.finished && f.event >= startGw && f.event <= endGw).forEach(f => {
        fixtureMap[`${f.team_h}-${f.event}`] = { opponent: f.team_a, isHome: true };
        fixtureMap[`${f.team_a}-${f.event}`] = { opponent: f.team_h, isHome: false };
    });

    return players
      .filter(p => p.total_points > 10) // Basic filter to remove inactive players
      .map(p => {
        const nextFixtures = [];
        let difficultySum = 0;

        for (let gw = startGw; gw <= endGw; gw++) {
           const match = fixtureMap[`${p.team}-${gw}`];
           if (match) {
               const threat = teamThreatMap[match.opponent] || 0;
               const diffScore = getDifficultyScore(threat);
               difficultySum += diffScore;
               nextFixtures.push({ event: gw, opponent: match.opponent, difficulty: diffScore, isHome: match.isHome });
           } else {
               // Blank Gameweek penalty
               difficultySum += 6; 
               nextFixtures.push({ event: gw, opponent: 0, difficulty: 0, isHome: false });
           }
        }

        // --- THE ALGORITHM ---
        // 1. Normalize Form (0-10 scale usually) -> 0.0 to 1.0
        const formVal = parseFloat(p.form);
        const normForm = Math.min(formVal / 10, 1.0); 

        // 2. Normalize Fixtures (5 games * 1 diff = 5 best, 5 * 5 = 25 worst)
        // Invert so higher is better. Max diff sum = 25.
        // Let's say worst reasonable run is sum 25, best is 5.
        // Score = (25 - sum) / 20.
        // Example: Sum 5 (Easy) -> (25-5)/20 = 1.0
        // Example: Sum 25 (Hard) -> (25-25)/20 = 0.0
        const normFixtures = Math.max(0, Math.min(1, (25 - difficultySum) / 20));

        // 3. Combine (Weighted)
        // 60% Form, 40% Fixtures? Or 50/50? Let's go 50/50
        const index = (normForm * 0.5) + (normFixtures * 0.5);

        return {
            ...p,
            transferIndex: index,
            fixtureDifficultySum: difficultySum,
            nextFixtures
        } as PlayerTransferStats;
      });
  }, [players, fixtures, events, teamThreatMap]);

  // Top 10 Form Players Calculation
  const topFormPlayers = useMemo(() => {
    return [...processedPlayers]
        .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
        .slice(0, 10);
  }, [processedPlayers]);

  // 3. Sorting & Filtering
  const displayPlayers = useMemo(() => {
      let filtered = processedPlayers.filter(p => p.element_type === activePos);
      
      return filtered.sort((a, b) => {
          let valA: any = a[sortConfig.key as keyof PlayerTransferStats];
          let valB: any = b[sortConfig.key as keyof PlayerTransferStats];

          // Special sorting for specific columns
          if (sortConfig.key === 'form' || sortConfig.key === 'selected_by_percent') {
              valA = parseFloat(valA);
              valB = parseFloat(valB);
          }
          if (sortConfig.key === 'now_cost') {
              valA = a.now_cost;
              valB = b.now_cost;
          }
          // Sort by specific Gameweek Difficulty
          if (sortConfig.key.startsWith('GW')) {
              const gwId = parseInt(sortConfig.key.replace('GW', ''));
              valA = a.nextFixtures.find(f => f.event === gwId)?.difficulty || 6;
              valB = b.nextFixtures.find(f => f.event === gwId)?.difficulty || 6;
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      }).slice(0, 25);
  }, [processedPlayers, activePos, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Get next 5 GW headers
  const nextEvent = events.find(e => e.is_next) || events[0];
  const gwHeaders = Array.from({length: 5}, (_, i) => nextEvent.id + i).filter(id => id <= 38);

  // Sorting Header Component
  const SortHeader: React.FC<{ label: string, sortKey: string, align?: "left" | "right" | "center", className?: string }> = ({ label, sortKey, align = "left", className = "" }) => {
      const isActive = sortConfig.key === sortKey;
      return (
          <th 
            className={`p-4 cursor-pointer hover:text-white transition-colors group select-none ${className} text-${align}`}
            onClick={() => handleSort(sortKey)}
          >
              <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
                  {label}
                  {isActive ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-blue-400" /> : <ChevronDown size={14} className="text-blue-400" />
                  ) : (
                      <ArrowUpDown size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
              </div>
          </th>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <ArrowLeftRight className="text-blue-400" /> Transfer Algorithm Picks
                </h2>
                <div className="flex items-center gap-2 cursor-pointer group select-none" onClick={() => setShowInfo(!showInfo)}>
                    <p className="text-slate-400 text-sm">
                        Calculated using weighted <strong>Form (50%)</strong> and <strong>FDR (50%)</strong>.
                    </p>
                    {showInfo ? <ChevronUp size={16} className="text-blue-400"/> : <ChevronDown size={16} className="text-blue-400"/>}
                </div>
            </div>
        </div>

        {/* Info / Legend Dropdown */}
        {showInfo && (
            <div className="mt-4 p-4 bg-slate-900/50 border border-blue-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-300">
                    
                    {/* The Algo */}
                    <div>
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                            <Calculator size={14} className="text-blue-400"/> The Algorithm
                        </h4>
                        <p className="text-xs mb-2 leading-relaxed">
                            We calculate a <strong>Transfer Index (0.00 - 1.00)</strong> to find players in the "Goldilocks Zone" of high performance and easy upcoming games.
                        </p>
                        <div className="flex gap-2 text-[10px] font-mono mt-2">
                            <span className="bg-slate-800 px-2 py-1 rounded border border-slate-600">50% Current Form</span>
                            <span className="text-slate-500">+</span>
                            <span className="bg-slate-800 px-2 py-1 rounded border border-slate-600">50% Fixture Ease</span>
                        </div>
                    </div>

                    {/* Table Metrics */}
                    <div>
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                            <Activity size={14} className="text-green-400"/> Key Metrics
                        </h4>
                        <ul className="space-y-1.5 text-xs">
                            <li className="flex justify-between">
                                <span><strong>Form:</strong></span>
                                <span className="text-slate-400">Avg points per match (last 30 days).</span>
                            </li>
                            <li className="flex justify-between">
                                <span><strong>Diff Score:</strong></span>
                                <span className="text-slate-400">Sum of difficulty for next 5 games.</span>
                            </li>
                            <li className="flex justify-between">
                                <span><strong>Goal:</strong></span>
                                <span className="text-slate-400">Lower Diff Score is better.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Colors */}
                    <div>
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                            <HelpCircle size={14} className="text-orange-400"/> Fixture Difficulty
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-white text-center">
                            <div className="bg-green-600 rounded py-1 border border-green-700">Easy (1)</div>
                            <div className="bg-green-500 rounded py-1 border border-green-600">Good (2)</div>
                            <div className="bg-slate-500 rounded py-1 border border-slate-600">Moderate (3)</div>
                            <div className="bg-orange-500 rounded py-1 border border-orange-600">Hard (4)</div>
                            <div className="bg-red-600 rounded py-1 border border-red-700 col-span-2">Very Hard (5)</div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Top 10 Form Players Horizontal Scroll */}
      <div>
          <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2 px-1">
             <TrendingUp size={16} className="text-green-400" /> Top 10 In-Form Players
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
              {topFormPlayers.map(p => (
                  <div key={p.id} className="min-w-[160px] snap-start bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg flex flex-col gap-2 relative group hover:border-green-500/50 transition-colors">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="font-bold text-white text-sm truncate w-24">{p.web_name}</div>
                              <div className="text-[10px] text-slate-500">{getTeamShort(p.team)} • £{p.now_cost/10}</div>
                          </div>
                          <div className="text-right">
                              <div className="text-lg font-bold text-green-400 leading-none">{p.form}</div>
                              <div className="text-[8px] text-slate-500 uppercase">Form</div>
                          </div>
                      </div>
                      
                      {/* Next 3 Fixtures Visual */}
                      <div className="mt-auto">
                          <div className="text-[9px] text-slate-500 mb-1">Next 3 Fixtures:</div>
                          <div className="flex gap-1 h-1.5 w-full">
                              {p.nextFixtures.slice(0, 3).map((f, i) => (
                                  <div 
                                    key={i} 
                                    className={`flex-1 rounded-full ${getDifficultyColor(f.difficulty)}`}
                                    title={`GW${f.event}: vs ${getTeamShort(f.opponent)}`}
                                  ></div>
                              ))}
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
         {[1, 2, 3, 4].map(pos => (
             <button
                key={pos}
                onClick={() => setActivePos(pos)}
                className={`px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activePos === pos ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
             >
                {pos === 1 && "Goalkeepers"}
                {pos === 2 && "Defenders"}
                {pos === 3 && "Midfielders"}
                {pos === 4 && "Forwards"}
             </button>
         ))}
      </div>

      {/* Main Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                     <th className="p-4 w-12 text-center">#</th>
                     <SortHeader label="Player" sortKey="web_name" className="w-64" />
                     <SortHeader label="Transfer Index" sortKey="transferIndex" className="w-36" />
                     <SortHeader label="Price" sortKey="now_cost" align="right" />
                     <SortHeader label="Form" sortKey="form" align="right" />
                     
                     {gwHeaders.map(gw => (
                         <SortHeader key={gw} label={`GW${gw}`} sortKey={`GW${gw}`} align="center" className="w-16" />
                     ))}

                     <SortHeader label="Diff Score" sortKey="fixtureDifficultySum" align="center" />
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50 text-sm">
                  {displayPlayers.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-700/30 transition-colors group">
                          <td className="p-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-4">
                              <div className="font-bold text-white">{p.web_name}</div>
                              <div className="text-xs text-slate-500">{getTeamShort(p.team)}</div>
                          </td>
                          <td className="p-4">
                              <div className="flex flex-col gap-1">
                                  <span className={`font-bold font-mono text-base ${p.transferIndex > 0.7 ? 'text-green-400' : p.transferIndex > 0.5 ? 'text-blue-400' : 'text-slate-400'}`}>
                                      {p.transferIndex.toFixed(2)}
                                  </span>
                                  {/* Progress Bar */}
                                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${p.transferIndex > 0.7 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${p.transferIndex * 100}%` }}
                                      ></div>
                                  </div>
                              </div>
                          </td>
                          <td className="p-4 text-right font-mono text-blue-300">£{p.now_cost / 10}</td>
                          <td className="p-4 text-right font-bold text-white">{p.form}</td>
                          
                          {/* Fixture Cells */}
                          {gwHeaders.map(gw => {
                              const fix = p.nextFixtures.find(f => f.event === gw);
                              if (!fix || fix.opponent === 0) return <td key={gw} className="p-1"><div className="w-full h-8 bg-slate-800 rounded flex items-center justify-center text-[10px] text-slate-600">-</div></td>;
                              
                              const oppShort = getTeamShort(fix.opponent);
                              const colorClass = getDifficultyColor(fix.difficulty);

                              return (
                                  <td key={gw} className="p-1">
                                      <div className={`w-full h-8 md:h-9 rounded border-b-2 flex flex-col items-center justify-center shadow-sm ${colorClass}`}>
                                          <span className="text-[10px] font-bold leading-none">{oppShort}</span>
                                          <span className="text-[9px] opacity-80 leading-none">({fix.isHome ? 'H' : 'A'})</span>
                                      </div>
                                  </td>
                              )
                          })}

                          <td className="p-4 text-center">
                              <span className="font-mono text-slate-400">{p.fixtureDifficultySum}</span>
                          </td>
                      </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
};

export default TransferPicks;