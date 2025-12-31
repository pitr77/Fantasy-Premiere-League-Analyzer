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
  const [activeHighlight, setActiveHighlight] = useState<{ source: number; target: number } | null>(null);
 
  const tableData = useMemo(() => {
    const stats: Record<number, TeamStats> = {};
 
    teams.forEach((t) => {
      stats[t.id] = { id: t.id, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0, form: [] };
    });
 
    const finishedFixtures = fixtures
      .filter((f) => f.finished)
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
 
    finishedFixtures.forEach((f) => {
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
 
    return Object.values(stats).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  }, [teams, fixtures]);
 
  const getTeamName = (id: number) => teams.find((t) => t.id === id);
 
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 px-2">
          <Trophy className="text-yellow-400 w-5 h-5" /> Premier League Table
        </h2>
 
        <div className="overflow-x-auto pt-10">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700 sticky top-0 z-40 backdrop-blur isolate">
                <th className="px-2 py-2 w-10 min-w-[40px] text-center sticky left-0 top-0 z-[90] bg-slate-900/80 backdrop-blur border-r border-slate-700/50">
                  #
                </th>
            
                <th className="px-3 py-2 w-16 md:w-56 min-w-[64px] sticky left-[40px] top-0 z-[90] bg-slate-900/80 backdrop-blur border-r border-slate-700/50">
                  Team
                </th>
            
                <th className="px-2 py-2 w-12 min-w-[48px] text-center font-bold text-white sticky left-[104px] md:left-[264px] top-0 z-[90] bg-slate-900/80 backdrop-blur border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.35)]">
                  Pts
                </th>
            
                {/* NON-sticky header cells: NO sticky/top/z-index */}
                <th className="px-3 py-2 text-center w-8 bg-slate-900/80 backdrop-blur">MP</th>
                <th className="px-3 py-2 text-center w-8 text-green-400 bg-slate-900/80 backdrop-blur">W</th>
                <th className="px-3 py-2 text-center w-8 text-slate-400 bg-slate-900/80 backdrop-blur">D</th>
                <th className="px-3 py-2 text-center w-8 text-red-400 bg-slate-900/80 backdrop-blur">L</th>
                <th className="px-3 py-2 text-center w-12 bg-slate-900/80 backdrop-blur">GD</th>
                <th className="px-2 py-2 w-24 text-center bg-slate-900/80 backdrop-blur">Form</th>
              </tr>
            </thead>
 
            <tbody className="divide-y divide-slate-700/50 text-sm">  
              {tableData.map((row, index) => {
                const team = getTeamName(row.id);
                const last5 = row.form.slice(-5);
 
                const isSource = activeHighlight?.source === row.id;
                const isTarget = activeHighlight?.target === row.id;
                const isHighlighted = isSource || isTarget;
 
                return (
                  <tr
                    key={row.id}
                    className={`transition-all duration-200 ${
                      isHighlighted
                        ? 'bg-purple-900/40 border-l-2 border-l-purple-400'
                        : 'hover:bg-slate-700/30 border-l-2 border-l-transparent'
                    }`}
                  >
                    <td className="px-2 py-2 w-10 min-w-[40px] text-center font-mono text-slate-500 border-r border-slate-700/50 text-xs sticky left-0 z-30 bg-slate-800">
                      {index + 1}
                    </td>
 
                    <td className="px-3 py-2 w-16 md:w-56 min-w-[64px] font-bold text-white sticky left-[40px] z-30 bg-slate-800 border-r border-slate-700/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          <span className="md:hidden">{team?.short_name}</span>
                          <span className="hidden md:inline">{team?.name}</span>
                        </span>
 
                        {isSource && (
                          <span className="text-[10px] text-purple-300 font-normal px-1.5 py-0.5 bg-purple-900/50 rounded-full hidden md:inline">
                            Current
                          </span>
                        )}
                        {isTarget && (
                          <span className="text-[10px] text-purple-300 animate-pulse font-normal px-1.5 py-0.5 bg-purple-900/50 rounded-full hidden md:inline">
                            Opponent
                          </span>
                        )}
                      </div>
                    </td>
 
                    <td className="px-2 py-2 w-12 min-w-[48px] text-center font-bold text-white sticky left-[104px] md:left-[264px] z-30 bg-slate-800 border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.25)]">
                      {row.pts}
                    </td>
 
                    <td className="px-3 py-2 text-center text-slate-300">{row.played}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{row.win}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{row.draw}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{row.loss}</td>
 
                    <td className="px-3 py-2 text-center text-slate-300 font-mono">
                      {row.gf - row.ga > 0 ? `+${row.gf - row.ga}` : row.gf - row.ga}
                    </td>
 
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-0.5">
                        {last5.map((match, i) => {
                          let colorClass = 'bg-slate-600 border-slate-500';
                          let Icon = Minus;
                          if (match.result === 'W') {
                            colorClass = 'bg-green-500 border-green-400';
                            Icon = Check;
                          }
                          if (match.result === 'L') {
                            colorClass = 'bg-red-500 border-red-400';
                            Icon = X;
                          }
 
                          return (
                            <div
                              key={i}
                              className="relative group/tooltip"
                              onMouseEnter={() => setActiveHighlight({ source: row.id, target: match.opponent })}
                              onMouseLeave={() => setActiveHighlight(null)}
                            >
                              <div className={`w-5 h-5 rounded-sm flex items-center justify-center text-white text-[10px] font-bold ${colorClass} border shadow-sm cursor-help hover:brightness-110 hover:scale-110 transition-transform`}>
                                <Icon size={12} strokeWidth={4} />
                              </div>
 
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block z-[80] whitespace-nowrap pointer-events-none">
                                <div className="bg-slate-900 text-white text-xs px-2 py-1.5 rounded border border-slate-600 shadow-xl flex flex-col items-center">
                                  <span className="font-bold text-slate-300 mb-0.5">vs {getTeamName(match.opponent)?.name}</span>
                                  <span
                                    className={`font-mono font-bold ${
                                      match.result === 'W'
                                        ? 'text-green-400'
                                        : match.result === 'L'
                                          ? 'text-red-400'
                                          : 'text-slate-400'
                                    }`}
                                  >
                                    Result: {match.score}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
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
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div> Win
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-slate-600 rounded-sm"></div> Draw
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div> Loss
          </div>
        </div>
      </div>
    </div>
  );
};
 
export default LeagueTable;