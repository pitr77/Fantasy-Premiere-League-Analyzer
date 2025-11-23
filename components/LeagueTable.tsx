import React, { useMemo, useState } from 'react';
import { FPLTeam, FPLFixture } from '../types';
import { Trophy, Minus, Check, X } from 'lucide-react';

interface LeagueTableProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

interface TeamStats {
  id: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  pts: number;
  form: { result: 'W' | 'D' | 'L'; opponent: number; score: string; date: string }[];
}

const LeagueTable: React.FC<LeagueTableProps> = ({ teams, fixtures }) => {
  // We now track both the team row we are hovering FROM and the opponent team row
  const [activeHighlight, setActiveHighlight] = useState<{ source: number; target: number } | null>(null);
  
  const tableData = useMemo(() => {
    const stats: Record<number, TeamStats> = {};

    // Initialize
    teams.forEach(t => {
      stats[t.id] = { id: t.id, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0, form: [] };
    });

    // Process finished fixtures
    const finishedFixtures = fixtures.filter(f => f.finished).sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

    finishedFixtures.forEach(f => {
      const home = stats[f.team_h];
      const away = stats[f.team_a];

      if (!home || !away) return;

      const hScore = f.team_h_score ?? 0;
      const aScore = f.team_a_score ?? 0;

      home.played++;
      away.played++;
      home.gf += hScore;
      home.ga += aScore;
      away.gf += aScore;
      away.ga += hScore;

      if (hScore > aScore) {
        home.win++;
        home.pts += 3;
        away.loss++;
        home.form.push({ result: 'W', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
        away.form.push({ result: 'L', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
      } else if (hScore < aScore) {
        away.win++;
        away.pts += 3;
        home.loss++;
        away.form.push({ result: 'W', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
        home.form.push({ result: 'L', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
      } else {
        home.draw++;
        home.pts += 1;
        away.draw++;
        away.pts += 1;
        home.form.push({ result: 'D', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
        away.form.push({ result: 'D', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
      }
    });

    // Sort
    return Object.values(stats).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  }, [teams, fixtures]);

  const getTeamName = (id: number) => teams.find(t => t.id === id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 px-2">
           <Trophy className="text-yellow-400 w-5 h-5" /> Premier League Table
        </h2>

        <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-slate-900/50 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700">
                    <th className="px-3 py-2 w-8 text-center">#</th>
                    <th className="px-3 py-2 w-48 md:w-64">Team</th>
                    <th className="px-3 py-2 text-center w-8">MP</th>
                    <th className="px-3 py-2 text-center w-8 text-green-400">W</th>
                    <th className="px-3 py-2 text-center w-8 text-slate-400">D</th>
                    <th className="px-3 py-2 text-center w-8 text-red-400">L</th>
                    <th className="px-3 py-2 text-center w-12">GD</th>
                    <th className="px-3 py-2 text-center w-12 font-bold text-white">Pts</th>
                    <th className="px-3 py-2 w-40 text-center">Last 5 Matches</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                 {tableData.map((row, index) => {
                    const team = getTeamName(row.id);
                    const last5 = row.form.slice(-5);
                    
                    // Highlight logic: Is this the source row OR the target row?
                    const isSource = activeHighlight?.source === row.id;
                    const isTarget = activeHighlight?.target === row.id;
                    const isHighlighted = isSource || isTarget;

                    return (
                        <tr 
                          key={row.id} 
                          className={`transition-all duration-200 ${isHighlighted ? 'bg-purple-900/40 border-l-2 border-l-purple-400' : 'hover:bg-slate-700/30 border-l-2 border-l-transparent'}`}
                        >
                           <td className="px-3 py-2 text-center font-mono text-slate-500 border-r border-slate-700/50 text-xs">
                              {index + 1}
                           </td>
                           <td className="px-3 py-2 font-bold text-white flex items-center gap-2">
                              <span className="truncate">{team?.name}</span>
                              {isSource && <span className="text-[10px] text-purple-300 font-normal px-1.5 py-0.5 bg-purple-900/50 rounded-full">Current</span>}
                              {isTarget && <span className="text-[10px] text-purple-300 animate-pulse font-normal px-1.5 py-0.5 bg-purple-900/50 rounded-full">Opponent</span>}
                           </td>
                           <td className="px-3 py-2 text-center text-slate-300">{row.played}</td>
                           <td className="px-3 py-2 text-center text-slate-300">{row.win}</td>
                           <td className="px-3 py-2 text-center text-slate-300">{row.draw}</td>
                           <td className="px-3 py-2 text-center text-slate-300">{row.loss}</td>
                           <td className="px-3 py-2 text-center text-slate-300 font-mono">
                              {row.gf - row.ga > 0 ? `+${row.gf - row.ga}` : row.gf - row.ga}
                           </td>
                           <td className="px-3 py-2 text-center font-bold text-white bg-slate-700/20 rounded">
                              {row.pts}
                           </td>
                           <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                 {last5.map((match, i) => {
                                     let colorClass = "bg-slate-600 border-slate-500";
                                     let Icon = Minus;
                                     if (match.result === 'W') { colorClass = "bg-green-500 border-green-400"; Icon = Check; }
                                     if (match.result === 'L') { colorClass = "bg-red-500 border-red-400"; Icon = X; }
                                     
                                     return (
                                         <div 
                                            key={i} 
                                            className="relative group/tooltip"
                                            onMouseEnter={() => setActiveHighlight({ source: row.id, target: match.opponent })}
                                            onMouseLeave={() => setActiveHighlight(null)}
                                          >
                                            <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-white text-[10px] font-bold ${colorClass} border shadow-sm cursor-help hover:brightness-110 hover:scale-110 transition-transform`}>
                                                <Icon size={12} strokeWidth={4} />
                                            </div>
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block z-50 whitespace-nowrap pointer-events-none">
                                                <div className="bg-slate-900 text-white text-xs px-2 py-1.5 rounded border border-slate-600 shadow-xl flex flex-col items-center">
                                                    <span className="font-bold text-slate-300 mb-0.5">vs {getTeamName(match.opponent)?.name}</span>
                                                    <span className={`font-mono font-bold ${match.result === 'W' ? 'text-green-400' : match.result === 'L' ? 'text-red-400' : 'text-slate-400'}`}>
                                                        Result: {match.score}
                                                    </span>
                                                </div>
                                            </div>
                                         </div>
                                     )
                                 })}
                              </div>
                           </td>
                        </tr>
                    );
                 })}
              </tbody>
           </table>
        </div>
        <div className="mt-2 flex gap-4 text-[10px] text-slate-400 justify-end px-2">
             <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div> Win</div>
             <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-600 rounded-sm"></div> Draw</div>
             <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div> Loss</div>
        </div>
      </div>
    </div>
  );
};

export default LeagueTable;