import React, { useMemo, useState } from 'react';
import { FPLPlayer, FPLTeam } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, Filter, ArrowUpDown, ChevronUp, ChevronDown, User, TrendingUp, DollarSign } from 'lucide-react';

interface PlayerStatsProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
}

const POSITION_MAP: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

const PlayerStats: React.FC<PlayerStatsProps> = ({ players, teams }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [posFilter, setPosFilter] = useState<number | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof FPLPlayer | 'value_season'; direction: 'asc' | 'desc' }>({ 
    key: 'total_points', 
    direction: 'desc' 
  });

  // --- Chart Data ---

  const topScorers = useMemo(() => {
    return [...players]
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 10) // Top 10 for bar chart
      .map(p => ({
        name: p.web_name,
        points: p.total_points,
        cost: p.now_cost / 10,
        team: teams.find(t => t.id === p.team)?.short_name
      }));
  }, [players, teams]);

  // Replaced complex scatter plot with a clear "Value" list
  const topValuePlayers = useMemo(() => {
    // Value = Points / Price. Filter for players with decent minutes/points to avoid cheap bench fodder noise
    return [...players]
        .filter(p => p.total_points > 30) 
        .map(p => ({
            ...p,
            valueRatio: p.total_points / (p.now_cost / 10)
        }))
        .sort((a, b) => b.valueRatio - a.valueRatio)
        .slice(0, 8);
  }, [players]);


  // --- Leaderboard Data ---

  const filteredAndSortedPlayers = useMemo(() => {
    let result = players;

    // 1. Filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.web_name.toLowerCase().includes(lower) || 
        p.second_name.toLowerCase().includes(lower)
      );
    }
    if (teamFilter !== 'all') {
      result = result.filter(p => p.team === teamFilter);
    }
    if (posFilter !== 'all') {
      result = result.filter(p => p.element_type === posFilter);
    }

    // 2. Sort
    result = [...result].sort((a, b) => {
      let valA: number | string = a[sortConfig.key as keyof FPLPlayer];
      let valB: number | string = b[sortConfig.key as keyof FPLPlayer];

      // Handle numeric conversions for string fields
      if (sortConfig.key === 'form' || sortConfig.key === 'ict_index' || sortConfig.key === 'points_per_game') {
        valA = parseFloat(valA as string);
        valB = parseFloat(valB as string);
      }
      
      // Handle special calculated keys
      if (sortConfig.key === 'value_season') { // Points per million
         valA = a.total_points / (a.now_cost / 10);
         valB = b.total_points / (b.now_cost / 10);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result.slice(0, 50); // Pagination limit for performance
  }, [players, searchTerm, teamFilter, posFilter, sortConfig]);

  const handleSort = (key: keyof FPLPlayer | 'value_season') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={14} className="text-slate-600" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-green-400" /> : <ChevronDown size={14} className="text-green-400" />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 p-3 border border-slate-700 rounded shadow-xl">
          <p className="text-white font-bold">{data.name}</p>
          <p className="text-slate-400 text-sm">{data.team}</p>
          <p className="text-green-400 text-sm mt-1">Points: {data.y || data.points}</p>
          <p className="text-blue-400 text-sm">Price: £{data.x || data.cost}</p>
        </div>
      );
    }
    return null;
  };

  // Helper to render position badge color
  const getPosColor = (pos: number) => {
    switch(pos) {
      case 1: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case 2: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case 3: return "bg-green-500/20 text-green-400 border-green-500/30";
      case 4: return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-slate-700 text-white";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Scorers Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="text-green-400" /> Top 10 Scorers
                </h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topScorers} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" stroke="#f8fafc" width={80} tick={{fontSize: 11}} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.4}} />
                            <Bar dataKey="points" fill="#00ff85" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Best Value List (Simplified from Scatter) */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <DollarSign className="text-blue-400" /> Best Value (ROI)
                </h2>
                <p className="text-slate-400 text-xs mb-4">Top return on investment (Points per £ Million cost).</p>
                
                <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {topValuePlayers.map((p, idx) => (
                        <div key={p.id} className="relative group">
                            <div className="flex items-center justify-between z-10 relative">
                                <div className="flex items-center gap-3">
                                    <div className="text-xl font-bold text-slate-600 w-6 text-center">#{idx + 1}</div>
                                    <div>
                                        <div className="font-bold text-white">{p.web_name}</div>
                                        <div className="text-xs text-slate-400">{teams.find(t=>t.id===p.team)?.short_name} • £{p.now_cost/10}m</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-blue-400 font-bold text-lg">{p.valueRatio.toFixed(1)}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Pts/£M</div>
                                </div>
                            </div>
                            {/* Visual Bar Background */}
                            <div className="absolute bottom-0 left-0 h-1 bg-slate-700 w-full rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(p.valueRatio / topValuePlayers[0].valueRatio) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Leaderboard Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <User className="text-purple-400" />
                    Player Statistics
                </h2>
                
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Search player name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="relative">
                           <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                           <select 
                               value={teamFilter}
                               onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                               className="bg-slate-900 border border-slate-600 text-white rounded-lg pl-10 pr-8 py-2 appearance-none focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                           >
                               <option value="all">All Teams</option>
                               {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                           </select>
                        </div>

                        <select 
                             value={posFilter}
                             onChange={(e) => setPosFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                             className="bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 appearance-none focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                        >
                             <option value="all">All Positions</option>
                             <option value={1}>Goalkeepers</option>
                             <option value={2}>Defenders</option>
                             <option value={3}>Midfielders</option>
                             <option value={4}>Forwards</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold">Player</th>
                            <th className="p-4 font-semibold">Team</th>
                            <th className="p-4 font-semibold text-center">Pos</th>
                            <th className="p-4 font-semibold cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('now_cost')}>
                                <div className="flex items-center justify-end gap-1">Cost <SortIcon colKey="now_cost" /></div>
                            </th>
                            <th className="p-4 font-semibold cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('total_points')}>
                                <div className="flex items-center justify-end gap-1">Points <SortIcon colKey="total_points" /></div>
                            </th>
                            <th className="p-4 font-semibold cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('form')}>
                                <div className="flex items-center justify-end gap-1">Form <SortIcon colKey="form" /></div>
                            </th>
                            <th className="p-4 font-semibold cursor-pointer hover:text-white transition-colors text-right hidden md:table-cell" onClick={() => handleSort('ict_index')}>
                                <div className="flex items-center justify-end gap-1">ICT Index <SortIcon colKey="ict_index" /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredAndSortedPlayers.map((player) => (
                            <tr key={player.id} className="hover:bg-slate-700/50 transition-colors group">
                                <td className="p-4 font-medium text-white flex flex-col">
                                    <span>{player.web_name}</span>
                                    <span className="text-xs text-slate-500 font-normal md:hidden">{player.first_name} {player.second_name}</span>
                                </td>
                                <td className="p-4 text-slate-300">{teams.find(t => t.id === player.team)?.name}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getPosColor(player.element_type)}`}>
                                        {POSITION_MAP[player.element_type]}
                                    </span>
                                </td>
                                <td className="p-4 text-right font-mono text-blue-300">£{player.now_cost / 10}</td>
                                <td className="p-4 text-right font-bold text-green-400">{player.total_points}</td>
                                <td className="p-4 text-right font-mono text-slate-300">{player.form}</td>
                                <td className="p-4 text-right font-mono text-slate-400 hidden md:table-cell">{player.ict_index}</td>
                            </tr>
                        ))}
                        {filteredAndSortedPlayers.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-500">
                                    No players found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-3 bg-slate-900/30 text-center text-xs text-slate-500">
                Showing top {Math.min(filteredAndSortedPlayers.length, 50)} results
            </div>
        </div>
    </div>
  );
};

export default PlayerStats;