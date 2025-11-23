import React, { useMemo, useState, useEffect } from 'react';
import { FPLFixture, FPLTeam, FPLEvent, FPLPlayer } from '../types';
import { Calendar, LayoutGrid, Activity, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, HelpCircle, Trophy, Shield, Home, ChevronLeft, ChevronRight, BrainCircuit } from 'lucide-react';

interface FixturesProps {
  fixtures: FPLFixture[];
  teams: FPLTeam[];
  events: FPLEvent[];
  players: FPLPlayer[];
}

const Fixtures: React.FC<FixturesProps> = ({ fixtures, teams, events, players }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'planner'>('schedule');
  const [showInfo, setShowInfo] = useState(false);

  // --- Helper Functions ---

  const getTeamName = (id: number) => teams.find(t => t.id === id)?.name || 'Unknown';
  const getTeamShort = (id: number) => teams.find(t => t.id === id)?.short_name || 'UNK';

  const getTeamThreatLevel = (teamId: number): number => {
    const teamPlayers = players
        .filter(p => p.team === teamId)
        .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
        .slice(0, 12); 

    const totalForm = teamPlayers.reduce((acc, p) => acc + parseFloat(p.form), 0);
    return totalForm;
  };

  const getDifficulty = (opponentId: number) => {
    const threat = getTeamThreatLevel(opponentId);
    
    if (threat > 55) return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', label: 'Very Hard', score: 5, threat };
    if (threat > 45) return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600', label: 'Hard', score: 4, threat };
    if (threat > 35) return { bg: 'bg-slate-500', text: 'text-white', border: 'border-slate-600', label: 'Moderate', score: 3, threat };
    if (threat > 25) return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600', label: 'Good', score: 2, threat };
    return { bg: 'bg-green-600', text: 'text-white', border: 'border-green-700', label: 'Easy', score: 1, threat };
  };

  // Get Last 5 Form for a team
  const getTeamForm = (teamId: number) => {
      const finished = fixtures
        .filter(f => f.finished && (f.team_h === teamId || f.team_a === teamId))
        .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
        .slice(-5);
      
      return finished.map(f => {
          const isHome = f.team_h === teamId;
          const hScore = f.team_h_score ?? 0;
          const aScore = f.team_a_score ?? 0;
          
          if (hScore === aScore) return 'D';
          if (isHome) return hScore > aScore ? 'W' : 'L';
          return aScore > hScore ? 'W' : 'L';
      });
  };

  // --- Logic for FDR Predictability ---
  const getFdrCheck = (homeScore: number | null, awayScore: number | null, homeDiff: any, awayDiff: any) => {
      if (homeScore === null || awayScore === null) return null;

      const homeWon = homeScore > awayScore;
      const awayWon = awayScore > homeScore;
      
      const homeStrength = awayDiff.threat; 
      const awayStrength = homeDiff.threat; 
      const gap = 10;

      if (homeStrength > awayStrength + gap) {
          // Home is favorite
          if (homeWon) return { color: 'text-green-500', icon: CheckCircle2, label: 'Expected' };
          if (awayWon) return { color: 'text-red-500', icon: AlertTriangle, label: 'Upset' };
      } else if (awayStrength > homeStrength + gap) {
          // Away is favorite
          if (awayWon) return { color: 'text-green-500', icon: CheckCircle2, label: 'Expected' };
          if (homeWon) return { color: 'text-red-500', icon: AlertTriangle, label: 'Upset' };
      }

      return { color: 'text-slate-600', icon: Activity, label: 'Neutral' };
  };


  // --- Data Preparation ---

  const fixturesByEvent = useMemo(() => {
    const grouped: Record<number, FPLFixture[]> = {};
    fixtures.forEach(f => {
      if (!grouped[f.event]) grouped[f.event] = [];
      grouped[f.event].push(f);
    });
    return grouped;
  }, [fixtures]);

  const nextEvent = events.find(e => e.is_next) || events.find(e => e.is_current) || events[0];
  const [selectedEvent, setSelectedEvent] = useState<number>(nextEvent ? nextEvent.id : 1);

  // --- Month Logic ---
  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    const monthMap: Record<string, FPLEvent[]> = {};

    events.forEach(e => {
        const date = new Date(e.deadline_time);
        const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        uniqueMonths.add(key);
        if (!monthMap[key]) monthMap[key] = [];
        monthMap[key].push(e);
    });

    return Array.from(uniqueMonths).map(m => ({
        name: m,
        events: monthMap[m]
    }));
  }, [events]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Initialize selectedMonth based on selectedEvent on mount or when events change
  useEffect(() => {
      const evt = events.find(e => e.id === selectedEvent);
      if (evt) {
          const date = new Date(evt.deadline_time);
          const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
          setSelectedMonth(key);
      }
  }, [selectedEvent, events]);

  const handleMonthChange = (monthName: string) => {
    setSelectedMonth(monthName);
    const monthData = months.find(m => m.name === monthName);
    if (monthData && monthData.events.length > 0) {
        setSelectedEvent(monthData.events[0].id);
    }
  };

  const handleGwChange = (gwId: number) => {
      setSelectedEvent(gwId);
      // Month state will auto-update via useEffect
  };

  const handleNextGw = () => {
      if (selectedEvent < 38) handleGwChange(selectedEvent + 1);
  };

  const handlePrevGw = () => {
      if (selectedEvent > 1) handleGwChange(selectedEvent - 1);
  };


  const currentFixtures = fixturesByEvent[selectedEvent] || [];

  // --- Statistics Calculation ---
  
  const gwStats = useMemo(() => {
      let totalGoals = 0;
      let cleanSheets = 0;
      let homeWins = 0;
      let totalMatches = 0;
      let correctPreds = 0;

      const eventFixtures = fixturesByEvent[selectedEvent] || [];
      const finishedFixtures = eventFixtures.filter(f => f.finished);

      finishedFixtures.forEach(f => {
          totalMatches++;
          const h = f.team_h_score || 0;
          const a = f.team_a_score || 0;
          totalGoals += (h + a);
          
          // Re-calc Clean Sheets properly
          if ((f.team_a_score || 0) === 0) cleanSheets++;
          if ((f.team_h_score || 0) === 0) cleanSheets++;

          if (h > a) homeWins++;

          // Calc Predictions
          const homeDiff = getDifficulty(f.team_a);
          const awayDiff = getDifficulty(f.team_h);
          const check = getFdrCheck(h, a, homeDiff, awayDiff);
          if (check?.label === 'Expected') correctPreds++;
      });
      
      return {
          totalGoals,
          cleanSheets,
          homeWinPct: totalMatches > 0 ? Math.round((homeWins / totalMatches) * 100) : 0,
          count: totalMatches,
          correctPreds
      };
  }, [fixturesByEvent, selectedEvent, players, teams]); // Added players/teams deps for safety


  // --- Render Components ---

  const renderFormGuide = (form: string[]) => (
      <div className="flex flex-col items-center justify-center py-2 h-full w-full">
          {/* Container for the badges - Simplified */}
          <div className="flex flex-col gap-1 p-1 rounded border border-white/20 w-7 bg-black/10">
              {[...form].reverse().map((res, i) => {
                  let color = 'bg-slate-700 border-slate-600';
                  if (res === 'W') color = 'bg-green-500 border-green-400 text-white shadow-sm';
                  if (res === 'L') color = 'bg-red-500 border-red-400 text-white shadow-sm';
                  if (res === 'D') color = 'bg-slate-500 border-slate-400 text-white';
                  
                  return (
                      <div key={i} className={`w-5 h-4 text-[9px] font-bold flex items-center justify-center rounded-sm border ${color} mx-auto`}>
                          {res}
                      </div>
                  )
              })}
              {form.length === 0 && <span className="text-[8px] text-white/50 text-center">-</span>}
          </div>
      </div>
  );

  const renderSchedule = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Gameweek Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full text-blue-400">
                  <Trophy size={24} />
              </div>
              <div>
                  <h3 className="text-xs text-slate-400 uppercase font-bold">Total Goals</h3>
                  <div className="text-2xl font-bold text-white">{gwStats.totalGoals}</div>
                  <p className="text-[10px] text-slate-500">Scored in {gwStats.count} matches</p>
              </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex items-center gap-4">
               <div className="p-3 bg-green-500/20 rounded-full text-green-400">
                  <Shield size={24} />
              </div>
              <div>
                  <h3 className="text-xs text-slate-400 uppercase font-bold">Clean Sheets</h3>
                  <div className="text-2xl font-bold text-white">{gwStats.cleanSheets}</div>
                  <p className="text-[10px] text-slate-500">Defensive masterclasses</p>
              </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex items-center gap-4">
               <div className="p-3 bg-purple-500/20 rounded-full text-purple-400">
                  <Home size={24} />
              </div>
              <div>
                  <h3 className="text-xs text-slate-400 uppercase font-bold">Home Dominance</h3>
                  <div className="text-2xl font-bold text-white">{gwStats.homeWinPct}%</div>
                  <p className="text-[10px] text-slate-500">Home wins ratio</p>
              </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex items-center gap-4">
               <div className="p-3 bg-pink-500/20 rounded-full text-pink-400">
                  <BrainCircuit size={24} />
              </div>
              <div>
                  <h3 className="text-xs text-slate-400 uppercase font-bold">FDR Accuracy</h3>
                  <div className="text-2xl font-bold text-white">{gwStats.correctPreds} / {gwStats.count}</div>
                  <p className="text-[10px] text-slate-500">Matches following form</p>
              </div>
          </div>
      </div>

      <div className="space-y-3">
        {currentFixtures.length > 0 ? (
            currentFixtures.map((fixture) => {
            const homeDiff = getDifficulty(fixture.team_a);
            const awayDiff = getDifficulty(fixture.team_h);
            const homeForm = getTeamForm(fixture.team_h);
            const awayForm = getTeamForm(fixture.team_a);
            
            const fdrCheck = fixture.finished 
                ? getFdrCheck(fixture.team_h_score, fixture.team_a_score, homeDiff, awayDiff) 
                : null;

            return (
                <div key={fixture.id} className="relative bg-slate-800 rounded-lg border border-slate-700 shadow-sm hover:border-slate-500 transition-all group z-0 hover:z-10 overflow-visible">
                    
                    {/* WIDE Difficulty Bars with Form Inside - width 3rem (w-12) */}
                    <div className={`absolute left-0 top-0 bottom-0 w-12 rounded-l-lg ${homeDiff.bg} shadow-inner border-r border-black/10`}>
                        {renderFormGuide(homeForm)}
                    </div>
                    
                    <div className={`absolute right-0 top-0 bottom-0 w-12 rounded-r-lg ${awayDiff.bg} shadow-inner border-l border-black/10`}>
                        {renderFormGuide(awayForm)}
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center p-4 pl-16 pr-16 h-28">
                        
                        {/* Home Team */}
                        <div className="flex items-center justify-end gap-3 text-right">
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-slate-100 text-lg md:text-xl leading-tight">
                                    {getTeamName(fixture.team_h)}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-1.5 rounded mt-1 ${homeDiff.bg.replace('bg-', 'text-')}`}>
                                    Opponent: {homeDiff.label}
                                </span>
                            </div>
                        </div>
                        
                        {/* Score / Time */}
                        <div className="flex flex-col items-center min-w-[120px] px-2 relative">
                            {fixture.finished ? (
                                <>
                                    <div className="bg-slate-900 px-4 py-1.5 rounded border border-slate-600 mb-1 shadow-inner">
                                        <div className="text-2xl font-bold text-white tracking-widest font-mono">
                                            {fixture.team_h_score} - {fixture.team_a_score}
                                        </div>
                                    </div>
                                    {fdrCheck && (
                                        <div className={`flex items-center gap-1 text-[10px] uppercase font-bold ${fdrCheck.color}`}>
                                            <fdrCheck.icon size={12} /> {fdrCheck.label}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="text-white font-bold text-lg">{new Date(fixture.kickoff_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold">{new Date(fixture.kickoff_time).toLocaleDateString([], {weekday: 'short', day: 'numeric'})}</div>
                                </div>
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-start gap-3 text-left">
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-slate-100 text-lg md:text-xl leading-tight">
                                    {getTeamName(fixture.team_a)}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-1.5 rounded mt-1 ${awayDiff.bg.replace('bg-', 'text-')}`}>
                                    Opponent: {awayDiff.label}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            );
            })
        ) : (
            <div className="text-center text-slate-500 py-10">No fixtures loaded for this Gameweek.</div>
        )}
      </div>
    </div>
  );

  const renderPlanner = () => {
    // Show next 5 Gameweeks starting from selectedEvent
    const startGw = selectedEvent; // Use selected event as start of planner
    const lookahead = 5;
    const planningGws = Array.from({length: lookahead}, (_, i) => startGw + i).filter(id => id <= 38);

    return (
      <div className="overflow-x-auto bg-slate-800 rounded-lg shadow-lg border border-slate-700 animate-in fade-in zoom-in duration-300 pb-20">
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-700 shadow-xl">Team</th>
                  {planningGws.map(gw => (
                      <th key={gw} className="p-2 text-center w-24 border-r border-slate-800">GW {gw}</th>
                  ))}
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
               {teams.map(team => (
                   <tr key={team.id} className="hover:bg-slate-700/30">
                       <td className="p-3 font-bold text-slate-200 sticky left-0 bg-slate-800 z-10 border-r border-slate-700 shadow-xl text-sm">
                           {team.name}
                       </td>
                       {planningGws.map(gw => {
                           const gwFixtures = fixturesByEvent[gw] || [];
                           const match = gwFixtures.find(f => f.team_h === team.id || f.team_a === team.id);
                           
                           if (!match) return <td key={gw} className="p-2 bg-slate-900/50"></td>;

                           const isHome = match.team_h === team.id;
                           const opponentId = isHome ? match.team_a : match.team_h;
                           const opponentShort = getTeamShort(opponentId);
                           const difficulty = getDifficulty(opponentId);

                           return (
                               <td key={gw} className="p-1 border-r border-slate-700/50 relative group">
                                   <div className={`w-full h-10 md:h-12 rounded flex flex-col items-center justify-center ${difficulty.bg} ${difficulty.text} shadow-sm cursor-help border-b-2 ${difficulty.border} hover:brightness-110 transition-all`}>
                                       <span className="text-xs font-bold">{opponentShort} ({isHome ? 'H' : 'A'})</span>
                                       <span className="text-[10px] font-mono opacity-80 mt-0.5">{difficulty.score}</span>
                                   </div>
                                   
                                   {/* Custom CSS Tooltip */}
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block z-50 pointer-events-none">
                                      <div className="bg-slate-900 text-white text-xs rounded-lg py-3 px-4 shadow-2xl border border-slate-600 relative">
                                        <div className="font-bold border-b border-slate-700 pb-2 mb-2 text-sm">{getTeamName(opponentId)}</div>
                                        <div className="flex justify-between text-slate-400 mb-1">
                                            <span>Opponent Strength:</span>
                                            <span className={`${difficulty.threat > 40 ? 'text-red-400' : 'text-green-400'} font-bold`}>{difficulty.threat.toFixed(0)} (Form)</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                            <span>FDR Rating:</span>
                                            <span className="text-white font-bold">{difficulty.label} ({difficulty.score}/5)</span>
                                        </div>
                                        {/* Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-600"></div>
                                      </div>
                                   </div>
                               </td>
                           );
                       })}
                   </tr>
               ))}
            </tbody>
         </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white mb-2">
                    <Calendar className="w-6 h-6 text-purple-400" />
                    Fixtures & FDR Planner
                </h2>
                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setShowInfo(!showInfo)}>
                    <p className="text-slate-400 text-sm">
                        Calculated using <strong>Dynamic Difficulty</strong> based on real-time form.
                    </p>
                    {showInfo ? <ChevronUp size={16} className="text-purple-400"/> : <ChevronDown size={16} className="text-purple-400"/>}
                </div>
            </div>

            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button 
                    onClick={() => setActiveTab('schedule')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    <Calendar size={16} /> Schedule
                </button>
                <button 
                    onClick={() => setActiveTab('planner')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'planner' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    <LayoutGrid size={16} /> FDR Matrix
                </button>
            </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">
             
             {/* Month Selector */}
             <div className="relative w-full sm:w-auto">
                <select 
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="w-full sm:w-48 appearance-none bg-slate-800 text-white text-sm font-bold border border-slate-600 rounded px-4 py-2 pr-8 focus:ring-2 focus:ring-purple-500 outline-none"
                >
                    {months.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
             </div>

             {/* Navigation Buttons */}
             <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                 <button 
                    onClick={handlePrevGw}
                    disabled={selectedEvent <= 1}
                    className="p-2 bg-slate-800 rounded border border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                 >
                     <ChevronLeft size={16} />
                 </button>
                 
                 {/* Gameweek Selector */}
                 <div className="relative flex-1 sm:flex-none">
                     <select 
                        value={selectedEvent}
                        onChange={(e) => handleGwChange(Number(e.target.value))}
                        className="w-full sm:w-64 appearance-none bg-slate-800 text-white text-sm font-bold border border-slate-600 rounded px-4 py-2 pr-8 focus:ring-2 focus:ring-purple-500 outline-none text-center"
                     >
                        {months.find(m => m.name === selectedMonth)?.events.map(e => (
                             <option key={e.id} value={e.id}>
                                 {e.name} {e.is_current ? '(Current)' : e.is_next ? '(Next)' : ''}
                             </option>
                         ))}
                     </select>
                     <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                 </div>

                 <button 
                    onClick={handleNextGw}
                    disabled={selectedEvent >= 38}
                    className="p-2 bg-slate-800 rounded border border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                 >
                     <ChevronRight size={16} />
                 </button>
             </div>
        </div>
        
        {/* Explanation Dropdown */}
        {showInfo && (
            <div className="mt-4 p-4 bg-slate-900/50 border border-purple-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
                    <div>
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2"><HelpCircle size={14} className="text-purple-400"/> Why is this different from Official FPL?</h4>
                        <p className="mb-2">
                            The Official FPL FDR (Fixture Difficulty Rating) is often static. A top team (e.g., Man City) is always rated 5/5 difficulty, even if they have 5 injured starters and have lost 3 games in a row.
                        </p>
                        <p>
                            <strong>Our Dynamic Model</strong> is live. It recalculates difficulty based on the <em>actual performance</em> (Form) of the opponent's best players over the last 30 days.
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-4 h-4 bg-slate-800 border border-white/20 rounded flex items-center justify-center font-bold">W</span>
                            Form guide reads from Top (Newest) to Bottom (Oldest).
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                            <Activity size={14} className="text-blue-400"/> Difficulty Legend
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

      {activeTab === 'schedule' ? renderSchedule() : renderPlanner()}
    </div>
  );
};

export default Fixtures;