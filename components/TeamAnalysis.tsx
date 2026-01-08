import React, { useMemo, useState } from 'react';
import { FPLTeam, FPLFixture } from '../types';
import { TrendingUp, Shield, Info, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface TeamAnalysisProps {
   teams: FPLTeam[];
   fixtures: FPLFixture[];
}

interface TeamPeriodStats {
   id: number;
   name: string;
   short_name: string;
   played: number;
   scored: number;
   conceded: number;
   cleanSheets: number;
   failedToScore: number;
   results: { opponent: number; score: string; result: 'W' | 'D' | 'L'; isHome: boolean }[];
}

const TeamAnalysis: React.FC<TeamAnalysisProps> = ({ teams, fixtures }) => {
   const [activeTab, setActiveTab] = useState<'ATTACK' | 'DEFENSE'>('ATTACK');

   // 1. Calculate Stats for Last 5 Matches
   const stats = useMemo(() => {
      // Find the last finished fixture to determine "current" state
      const finishedFixtures = fixtures
         .filter((f) => {
            const hasKickoff = Boolean(f.kickoff_time);
            const hasScore =
               f.team_h_score !== null && f.team_h_score !== undefined &&
               f.team_a_score !== null && f.team_a_score !== undefined;

            // Score check je najistejší; finished flag nech je len doplnok
            return hasKickoff && (f.finished === true || hasScore);
         })
         .sort(
            (a, b) =>
               new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime()
         );


      if (finishedFixtures.length === 0) return [];

      // Identify the specific matches for each team (last 5 per team)
      // We can't just take "Last 5 GWs" globally because of blanks/doubles. 
      // We take the last 5 finished games for *each* team individually.

      const teamStatsMap: Record<number, TeamPeriodStats> = {};

      // Init
      teams.forEach(t => {
         teamStatsMap[t.id] = {
            id: t.id,
            name: t.name,
            short_name: t.short_name,
            played: 0,
            scored: 0,
            conceded: 0,
            cleanSheets: 0,
            failedToScore: 0,
            results: []
         };
      });

      // Populate
      teams.forEach(t => {
         const teamFixtures = finishedFixtures
            .filter(f => f.team_h === t.id || f.team_a === t.id)
            .slice(0, 5); // Take last 5 matches

         teamFixtures.forEach(f => {
            const stats = teamStatsMap[t.id];
            const isHome = f.team_h === t.id;
            const gf = isHome ? (f.team_h_score ?? 0) : (f.team_a_score ?? 0);
            const ga = isHome ? (f.team_a_score ?? 0) : (f.team_h_score ?? 0);
            const opponent = isHome ? f.team_a : f.team_h;

            stats.played++;
            stats.scored += gf;
            stats.conceded += ga;

            if (ga === 0) stats.cleanSheets++;
            if (gf === 0) stats.failedToScore++;

            let res: 'W' | 'D' | 'L' = 'D';
            if (gf > ga) res = 'W';
            if (gf < ga) res = 'L';

            stats.results.push({
               opponent,
               score: `${gf}-${ga}`,
               result: res,
               isHome
            });
         });
         // Reverse results to show oldest -> newest (or keep newest first, we'll decide in render)
      });

      return Object.values(teamStatsMap);
   }, [teams, fixtures]);

   // 2. Sort Data based on Tab
   const sortedData = useMemo(() => {
      return [...stats].sort((a, b) => {
         if (activeTab === 'ATTACK') {
            // Sort by Goals Scored per Game (Desc)
            const aGPG = a.scored / (a.played || 1);
            const bGPG = b.scored / (b.played || 1);
            if (bGPG !== aGPG) return bGPG - aGPG;
            return b.scored - a.scored;
         } else {
            // Sort by Goals Conceded per Game (Asc - Lower is better)
            const aGCPG = a.conceded / (a.played || 1);
            const bGCPG = b.conceded / (b.played || 1);
            if (aGCPG !== bGCPG) return aGCPG - bGCPG; // Lower is better
            return b.cleanSheets - a.cleanSheets;
         }
      });
   }, [stats, activeTab]);

   const getTeamShort = (id: number) => teams.find(t => t.id === id)?.short_name || 'UNK';

   return (
      <div className="space-y-6 animate-in fade-in duration-500">

         {/* Header */}
         <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
               <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                     {activeTab === 'ATTACK' ? <TrendingUp className="text-green-400" /> : <Shield className="text-blue-400" />}
                     Team Form Analysis
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                     Analyzing performance over the <strong>Last 5 Matches</strong>.
                  </p>
               </div>

               {/* Tab Switcher */}
               <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex">
                  <button
                     onClick={() => setActiveTab('ATTACK')}
                     className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'ATTACK' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                     <TrendingUp size={16} /> Attacking
                  </button>
                  <button
                     onClick={() => setActiveTab('DEFENSE')}
                     className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'DEFENSE' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                     <Shield size={16} /> Defensive
                  </button>
               </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg flex gap-3 text-sm text-slate-300">
               <Info className="text-blue-400 shrink-0" size={18} />
               <div>
                  <p>
                     <strong>{activeTab === 'ATTACK' ? 'Goal Scoring Potential' : 'Defensive Solidity'}</strong>
                  </p>
                  {activeTab === 'ATTACK' ? (
                     <p>
                        <strong>Attacking metrics calculation:</strong>
                        <br />
                        • <strong>Goals Scored (GS)</strong>: Total goals scored in last 5 matches
                        <br />
                        • <strong>GS / Game</strong>: Goals Scored ÷ Games Played (higher is better)
                        <br />
                        • <strong>Failed to Score</strong>: Number of matches with 0 goals scored
                        <br />
                        <span className="text-green-400 font-bold">Green numbers</span> indicate elite attacking (GS/Game &gt; 2.0)
                     </p>
                  ) : (
                     <p>
                        <strong>Defensive metrics calculation:</strong>
                        <br />
                        • <strong>Goals Conceded (GC)</strong>: Total goals conceded in last 5 matches
                        <br />
                        • <strong>GC / Game</strong>: Goals Conceded ÷ Games Played (lower is better)
                        <br />
                        • <strong>Clean Sheets</strong>: Number of matches with 0 goals conceded
                        <br />
                        <span className="text-green-400 font-bold">Green numbers</span> indicate elite defense (GC/Game &lt; 0.8)
                     </p>
                  )}
               </div>
            </div>
         </div>

         {/* Main Table */}
         <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                        <th className="p-4 w-12 text-center">Rank</th>
                        <th className="p-4 w-48">Team</th>
                        <th className="p-4 text-center">Games</th>

                        {/* Dynamic Columns based on Tab */}
                        {activeTab === 'ATTACK' ? (
                           <>
                              <th className="p-4 text-right">Goals Scored</th>
                              <th className="p-4 text-right text-white font-bold">GS / Game</th>
                              <th className="p-4 text-right">Failed to Score</th>
                           </>
                        ) : (
                           <>
                              <th className="p-4 text-right">Goals Conceded</th>
                              <th className="p-4 text-right text-white font-bold">GC / Game</th>
                              <th className="p-4 text-right">Clean Sheets</th>
                           </>
                        )}

                        <th className="p-4 text-center">Goal Diff</th>
                        <th className="p-4 text-left pl-8">Match History (Oldest → Newest)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                     {sortedData.map((team, idx) => {
                        const perGame = activeTab === 'ATTACK'
                           ? (team.scored / team.played)
                           : (team.conceded / team.played);

                        // Color coding logic
                        let statColor = "text-white";
                        if (activeTab === 'ATTACK') {
                           if (perGame >= 2.0) statColor = "text-green-400 font-bold";
                           else if (perGame <= 0.8) statColor = "text-red-400";
                        } else {
                           if (perGame <= 0.8) statColor = "text-green-400 font-bold";
                           else if (perGame >= 2.0) statColor = "text-red-400";
                        }

                        return (
                           <tr key={team.id} className="hover:bg-slate-700/30 transition-colors group">
                              <td className="p-4 text-center text-slate-500 font-mono">#{idx + 1}</td>
                              <td className="p-4 font-bold text-white text-base">
                                 {team.name}
                              </td>
                              <td className="p-4 text-center text-slate-300">{team.played}</td>

                              {activeTab === 'ATTACK' ? (
                                 <>
                                    <td className="p-4 text-right text-slate-300">{team.scored}</td>
                                    <td className={`p-4 text-right text-lg font-mono ${statColor}`}>
                                       {perGame.toFixed(2)}
                                    </td>
                                    <td className="p-4 text-right text-slate-400">{team.failedToScore}</td>
                                 </>
                              ) : (
                                 <>
                                    <td className="p-4 text-right text-slate-300">{team.conceded}</td>
                                    <td className={`p-4 text-right text-lg font-mono ${statColor}`}>
                                       {perGame.toFixed(2)}
                                    </td>
                                    <td className="p-4 text-right text-slate-400">{team.cleanSheets}</td>
                                 </>
                              )}

                              <td className="p-4 text-center font-mono text-slate-400">
                                 <span className={team.scored - team.conceded > 0 ? "text-green-400" : team.scored - team.conceded < 0 ? "text-red-400" : ""}>
                                    {team.scored - team.conceded > 0 ? '+' : ''}{team.scored - team.conceded}
                                 </span>
                              </td>

                              <td className="p-4 pl-8">
                                 <div className="flex items-center gap-1.5">
                                    {/* Sort oldest to newest for the timeline view */}
                                    {[...team.results].reverse().map((res, i) => (
                                       <div key={i} className="relative group/tooltip">
                                          <div className={`
                                          w-12 h-8 rounded flex flex-col items-center justify-center border shadow-sm cursor-help
                                          ${res.result === 'W' ? 'bg-green-600 border-green-500' : res.result === 'D' ? 'bg-slate-600 border-slate-500' : 'bg-red-600 border-red-500'}
                                       `}>
                                             <span className="text-[10px] font-bold text-white leading-none mb-0.5">{getTeamShort(res.opponent)}</span>
                                             <span className="text-[9px] text-white/90 leading-none font-mono">{res.score}</span>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
};

export default TeamAnalysis;
