import React, { useMemo, useState } from 'react';
import { FPLTeam, FPLFixture } from '../types';
import { TrendingUp, Shield, Info, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import TwoPanelTable from './TwoPanelTable';
import ResultChip from './ResultChip';



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
   const [mobileView, setMobileView] = useState<'STATS' | 'FORM'>('STATS');
   const [infoExpanded, setInfoExpanded] = useState(false); // Collapsed by default on mobile, but we can detect screen size or just default to false for simplicity.


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

            {/* Info Box - Collapsible */}
            <div className="mt-4">
               <button
                  onClick={() => setInfoExpanded(!infoExpanded)}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-2 group"
               >
                  <Info size={16} className="text-blue-400" />
                  <span>About these metrics</span>
                  {infoExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
               </button>

               {infoExpanded && (
                  <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg flex gap-3 text-sm text-slate-300 animate-in slide-in-from-top-2 duration-200">
                     <div className="hidden md:block">
                        <Info className="text-blue-400 shrink-0" size={18} />
                     </div>
                     <div>
                        <p className="font-bold text-white mb-1">
                           {activeTab === 'ATTACK' ? 'Goal Scoring Potential' : 'Defensive Solidity'}
                        </p>
                        <p className="leading-relaxed">
                           We calculate stats based on the last 5 matches played by each team.
                           <br />
                           <span className="text-green-400 font-bold">Green numbers</span> indicate elite performance (e.g., Scoring &gt; 2.0 per game or Conceding &lt; 0.8).
                        </p>
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* Mobile View Toggle */}
         <div className="md:hidden flex justify-center mb-2">
            <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex w-full max-w-[300px]">
               <button
                  onClick={() => setMobileView('STATS')}
                  className={`flex-1 px-4 py-1.5 rounded text-sm font-bold transition-all ${mobileView === 'STATS' ? 'bg-slate-700 text-white shadow' : 'text-slate-400'}`}
               >
                  Stats
               </button>
               <button
                  onClick={() => setMobileView('FORM')}
                  className={`flex-1 px-4 py-1.5 rounded text-sm font-bold transition-all ${mobileView === 'FORM' ? 'bg-slate-700 text-white shadow' : 'text-slate-400'}`}
               >
                  Form
               </button>
            </div>
         </div>

         {/* Main Table Container */}
         <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            {mobileView === 'STATS' ? (
               <div className="w-full overflow-x-hidden md:overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-0 md:table-auto">
                     <thead>
                        <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-sm uppercase tracking-wider font-bold">
                           <th className="p-3 md:p-5 w-10 sm:w-12 md:w-20 text-center sticky left-0 z-20 bg-slate-900 border-b border-slate-700">Rank</th>
                           <th className="p-3 md:p-5 w-20 sm:w-24 md:w-64 sticky left-10 sm:left-12 md:left-20 z-20 bg-slate-900 border-b border-slate-700 border-r border-slate-700">Team</th>
                           <th className="p-3 md:p-5 text-center hidden md:table-cell border-b border-slate-700">Games</th>
                           {activeTab === 'ATTACK' ? (
                              <>
                                 <th className="p-3 md:p-5 text-right border-b border-slate-700 w-[22%] sm:w-auto">Scored</th>
                                 <th className="p-3 md:p-5 text-right border-b border-slate-700 text-white font-bold w-[28%] sm:w-auto">GS/G</th>
                                 <th className="p-3 md:p-5 text-right border-b border-slate-700 hidden md:table-cell">FTS</th>
                              </>
                           ) : (
                              <>
                                 <th className="p-3 md:p-5 text-right border-b border-slate-700 w-[22%] sm:w-auto">Conceded</th>
                                 <th className="p-3 md:p-5 text-right border-b border-slate-700 text-white font-bold w-[28%] sm:w-auto">GC/G</th>
                                 <th className="p-3 md:p-5 text-right border-b border-slate-700 hidden md:table-cell">CS</th>
                              </>
                           )}
                           <th className="p-3 md:p-5 text-center hidden md:table-cell border-b border-slate-700 font-mono">GD</th>
                           <th className="p-3 md:p-5 text-left pl-8 hidden md:table-cell border-b border-slate-700">Match History</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-700/50">
                        {sortedData.map((team, idx) => {
                           const perGame = team.played > 0
                              ? (activeTab === 'ATTACK' ? team.scored / team.played : team.conceded / team.played)
                              : 0;

                           let statColor = "text-white";
                           if (activeTab === 'ATTACK') {
                              if (perGame >= 2.0) statColor = "text-green-400 font-bold";
                              else if (perGame <= 0.8 && team.played > 0) statColor = "text-red-400";
                           } else {
                              if (perGame <= 0.8 && team.played > 0) statColor = "text-green-400 font-bold";
                              else if (perGame >= 2.0) statColor = "text-red-400";
                           }

                           return (
                              <tr key={team.id} className="hover:bg-slate-700/30 transition-colors group text-[11px] md:text-base">
                                 <td className="p-3 md:p-5 text-center text-slate-500 font-mono sticky left-0 z-10 bg-slate-800 transition-colors group-hover:bg-slate-700 border-b border-slate-700/50">#{idx + 1}</td>
                                 <td className="p-3 md:p-5 font-bold text-white sticky left-10 sm:left-12 md:left-20 z-10 bg-slate-800 transition-colors group-hover:bg-slate-700 border-b border-slate-700/50 truncate border-r border-slate-700">
                                    <span className="md:hidden">{team.short_name}</span>
                                    <span className="hidden md:inline">{team.name}</span>
                                 </td>
                                 <td className="p-3 md:p-5 text-center text-slate-300 hidden md:table-cell border-b border-slate-700/50 font-medium">{team.played}</td>
                                 {activeTab === 'ATTACK' ? (
                                    <>
                                       <td className="p-3 md:p-5 text-right text-slate-300 border-b border-slate-700/50 font-medium">{team.scored}</td>
                                       <td className={`p-3 md:p-5 text-right text-sm md:text-xl font-mono border-b border-slate-700/50 ${statColor}`}>
                                          {perGame.toFixed(2)}
                                       </td>
                                       <td className="p-3 md:p-5 text-right text-slate-400 hidden md:table-cell border-b border-slate-700/50">{team.failedToScore}</td>
                                    </>
                                 ) : (
                                    <>
                                       <td className="p-3 md:p-5 text-right text-slate-300 border-b border-slate-700/50 font-medium">{team.conceded}</td>
                                       <td className={`p-3 md:p-5 text-right text-sm md:text-xl font-mono border-b border-slate-700/50 ${statColor}`}>
                                          {perGame.toFixed(2)}
                                       </td>
                                       <td className="p-3 md:p-5 text-right text-slate-400 hidden md:table-cell border-b border-slate-700/50">{team.cleanSheets}</td>
                                    </>
                                 )}
                                 <td className="p-3 md:p-5 text-center font-mono text-slate-400 hidden md:table-cell border-b border-slate-700/50">
                                    <span className={`font-bold ${team.scored - team.conceded > 0 ? "text-green-400" : team.scored - team.conceded < 0 ? "text-red-400" : ""}`}>
                                       {team.scored - team.conceded > 0 ? '+' : ''}{team.scored - team.conceded}
                                    </span>
                                 </td>
                                 <td className="p-3 md:p-5 pl-8 hidden md:table-cell border-b border-slate-700/50">
                                    <div className="flex items-center gap-1.5 flex-row">
                                       {team.results.map((res, i) => (
                                          <ResultChip
                                             key={i}
                                             label={getTeamShort(res.opponent)}
                                             value={res.score}
                                             variant={res.result}
                                          />
                                       ))}
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            ) : (
               <TwoPanelTable
                  leftHeader={
                     <>
                        <span className="w-8 sm:w-10 text-center">Rank</span>
                        <span className="ml-2 sm:ml-4 flex-1">Team</span>
                     </>
                  }
                  rightHeader="Match History (Newest → Oldest)"
                  rows={sortedData.map((team, idx) => ({
                     key: team.id,
                     left: (
                        <>
                           <span className="w-8 sm:w-10 text-center text-slate-500 font-mono text-[11px] sm:text-sm">#{idx + 1}</span>
                           <div className="ml-2 sm:ml-4 flex-1 min-w-0">
                              <span className="block font-bold text-white text-[11px] sm:text-sm truncate">
                                 <span className="md:hidden">{team.short_name}</span>
                                 <span className="hidden md:inline">{team.name}</span>
                              </span>
                           </div>
                        </>
                     ),
                     right: (
                        <div className="flex items-center gap-1.5 h-full">
                           {team.results.map((res, i) => (
                              <ResultChip
                                 key={i}
                                 label={getTeamShort(res.opponent)}
                                 value={res.score}
                                 variant={res.result}
                              />
                           ))}
                        </div>
                     )
                  }))}
               />
            )}
         </div>
      </div>
   );
};

export default TeamAnalysis;
