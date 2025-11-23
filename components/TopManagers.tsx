import React, { useMemo, useState } from 'react';
import { FPLPlayer, FPLTeam } from '../types';
import { ArrowUpDown, ChevronUp, ChevronDown, Search, Filter, Crown, Info } from 'lucide-react';

interface TopManagersProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
}

const POSITION_MAP: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

const TopManagers: React.FC<TopManagersProps> = ({ players, teams }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [posFilter, setPosFilter] = useState<number | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'sel_num', 
    direction: 'desc' 
  });

  // Prepare data with numeric conversions
  const tableData = useMemo(() => {
    return players.map(p => ({
      ...p,
      id: p.id,
      name: p.web_name,
      full_name: `${p.first_name} ${p.second_name}`,
      cost_num: p.now_cost / 10,
      sel_num: parseFloat(p.selected_by_percent),
      form_num: parseFloat(p.form),
      team_name: teams.find(t => t.id === p.team)?.name || "Unknown",
      short_team: teams.find(t => t.id === p.team)?.short_name || "UNK",
      position_name: POSITION_MAP[p.element_type],
      points_num: p.total_points
    }));
  }, [players, teams]);

  // Filter and Sort
  const filteredData = useMemo(() => {
    let data = tableData;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(p => 
        p.full_name.toLowerCase().includes(lower) || 
        p.web_name.toLowerCase().includes(lower)
      );
    }
    if (teamFilter !== 'all') {
      data = data.filter(p => p.team === teamFilter);
    }
    if (posFilter !== 'all') {
      data = data.filter(p => p.element_type === posFilter);
    }

    return [...data].sort((a, b) => {
      // @ts-ignore
      let valA = a[sortConfig.key];
      // @ts-ignore
      let valB = b[sortConfig.key];

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tableData, searchTerm, teamFilter, posFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={14} className="text-slate-600 inline ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-green-400 inline ml-1" /> 
      : <ChevronDown size={14} className="text-green-400 inline ml-1" />;
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
    <div className="space-y-6">
      
      {/* Header & Filters */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 border-b border-slate-700 pb-6">
           <div className="max-w-3xl">
             <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-3">
               <Crown className="text-yellow-400" />
               Elite Ownership Template
             </h2>
             <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg flex gap-3">
                <Info className="text-blue-400 shrink-0 mt-1" size={20} />
                <div className="text-sm text-slate-300 leading-relaxed">
                   <p className="mb-2">
                     <strong>What is the Top 100 Manager Template?</strong>
                   </p>
                   <p>
                     Due to FPL privacy settings, real-time scraping of individual Top 100 teams is restricted. 
                     However, this leaderboard displays the <strong>"Template"</strong>—the players with the highest 
                     Effective Ownership (EO) across the game. High-ranking managers almost always converge 
                     on these core assets. If a player is here, they are likely in the teams of the world's best.
                   </p>
                </div>
             </div>
           </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
             <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                 <input 
                   type="text" 
                   placeholder="Search player name..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                 />
              </div>

              <div className="flex gap-2">
                <select 
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">All Teams</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.short_name}</option>)}
                </select>

                <select 
                    value={posFilter}
                    onChange={(e) => setPosFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">All Pos</option>
                    <option value={1}>GKP</option>
                    <option value={2}>DEF</option>
                    <option value={3}>MID</option>
                    <option value={4}>FWD</option>
                </select>
              </div>
        </div>
      
        {/* Modern Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold cursor-pointer" onClick={() => handleSort('sel_num')}>Rank <SortIcon colKey="sel_num"/></th>
                <th className="p-4 font-semibold">Player</th>
                <th className="p-4 font-semibold text-center">Pos</th>
                <th className="p-4 font-semibold text-right cursor-pointer" onClick={() => handleSort('cost_num')}>Cost <SortIcon colKey="cost_num"/></th>
                <th className="p-4 font-semibold text-right cursor-pointer" onClick={() => handleSort('points_num')}>Points <SortIcon colKey="points_num"/></th>
                <th className="p-4 font-semibold w-1/4 cursor-pointer" onClick={() => handleSort('sel_num')}>Ownership <SortIcon colKey="sel_num"/></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredData.map((player, index) => (
                <tr key={player.id} className="hover:bg-slate-700/40 transition-colors group">
                  <td className="p-4 font-mono text-slate-500">
                    #{index + 1}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                       <div className="font-bold text-white text-base">
                         {player.web_name}
                       </div>
                       <span className="text-xs text-slate-500 px-2 py-0.5 rounded bg-slate-800 border border-slate-600">
                         {player.short_team}
                       </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getPosColor(player.element_type)}`}>
                      {player.position_name}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-blue-300">
                    £{player.cost_num.toFixed(1)}
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-bold text-green-400 text-lg">{player.points_num}</span>
                  </td>
                  <td className="p-4">
                     <div className="flex items-center gap-3">
                        <span className="text-xs font-mono w-10 text-right">{player.sel_num}%</span>
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-gradient-to-r from-purple-500 to-blue-500" 
                             style={{ width: `${Math.min(player.sel_num, 100)}%` }}
                           ></div>
                        </div>
                     </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-8 text-center text-slate-500">No players found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 text-center text-xs text-slate-500">
           Showing {filteredData.length} players based on current filtering criteria.
        </div>
      </div>
    </div>
  );
};

export default TopManagers;