import React, { useMemo, useState, useEffect } from 'react';
import { FPLFixture, FPLTeam, FPLEvent, FPLPlayer } from '../types';
import { Calendar, LayoutGrid, Activity, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, HelpCircle, Trophy, Shield, Home, ChevronLeft, ChevronRight, BrainCircuit, User } from 'lucide-react';
import { calculateLeaguePositions, getDynamicDifficulty } from '../lib/fdrModel';
import { computeTransferIndexForPlayers, TransferIndexResult } from '../lib/transferIndex';

interface FixturesProps {
    fixtures: FPLFixture[];
    teams: FPLTeam[];
    events: FPLEvent[];
    players: FPLPlayer[];
}

const Fixtures: React.FC<FixturesProps> = ({ fixtures, teams, events, players }) => {
    const [activeTab, setActiveTab] = useState<'schedule' | 'planner'>('schedule');
    const [showInfo, setShowInfo] = useState(false);
    const [plannerSortMode, setPlannerSortMode] = useState<'none' | 'asc' | 'desc'>('none');
    const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);

    // --- Helper Functions ---

    const getTeamName = (id: number) => teams.find(t => t.id === id)?.name || 'Unknown';
    const getTeamShort = (id: number) => teams.find(t => t.id === id)?.short_name || 'UNK';

    /**
     * Calculate current league positions from finished fixtures
     * Returns a map of teamId -> position (1-20)
     */
    const getLeaguePositions = useMemo(() => calculateLeaguePositions(teams, fixtures), [teams, fixtures]);

    const getDifficulty = (opponentId: number) => getDynamicDifficulty(opponentId, players, getLeaguePositions);

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
        const isDraw = homeScore === awayScore;

        // homeDiff.score = how hard the AWAY team is (the opponent for home)
        // awayDiff.score = how hard the HOME team is (the opponent for away)
        // So: Higher score means the team is STRONGER.
        const homeTeamStrength = awayDiff.score;
        const awayTeamStrength = homeDiff.score;

        const strengthGap = homeTeamStrength - awayTeamStrength;

        // 1. CLEAR FAVORITE CASE (Gap >= 1)
        if (strengthGap >= 1) {
            // Home is favorite
            if (homeWon) return { color: 'text-green-500', icon: CheckCircle2, label: 'Expected' };
            if (awayWon) return { color: 'text-red-500', icon: AlertTriangle, label: 'Upset' };
            if (isDraw && strengthGap >= 1.5) return { color: 'text-orange-400', icon: AlertTriangle, label: 'Upset' };
        } else if (strengthGap <= -1) {
            // Away is favorite
            if (awayWon) return { color: 'text-green-500', icon: CheckCircle2, label: 'Expected' };
            if (homeWon) return { color: 'text-red-500', icon: AlertTriangle, label: 'Upset' };
            if (isDraw && strengthGap <= -1.5) return { color: 'text-orange-400', icon: AlertTriangle, label: 'Upset' };
        }

        // 2. CLOSE GAMES OR EXPECTED DRAWS
        if (isDraw) return { color: 'text-slate-600', icon: Activity, label: 'Neutral' };

        // If a win happened in a close game, check if it was against a slightly harder opponent
        if (homeWon && homeDiff.score <= 2) return { color: 'text-green-500', icon: CheckCircle2, label: 'Expected' };
        if (awayWon && awayDiff.score <= 2) return { color: 'text-green-500', icon: CheckCircle2, label: 'Expected' };

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

    // --- Planner Data Pre-computation ---

    const planningGws = useMemo(() => {
        const startGw = selectedEvent;
        const lookahead = 5;
        return Array.from({ length: lookahead }, (_, i) => startGw + i).filter(id => id <= 38);
    }, [selectedEvent]);

    const sortedTeams = useMemo(() => {
        const teamsWithScores = teams.map(team => {
            let diffScore = 0;
            const fixtureDifficulties: number[] = [];

            planningGws.forEach(gw => {
                const gwFixtures = fixturesByEvent[gw] || [];
                const match = gwFixtures.find(f => f.team_h === team.id || f.team_a === team.id);
                if (match) {
                    const opponentId = match.team_h === team.id ? match.team_a : match.team_h;
                    const score = getDifficulty(opponentId).score;
                    diffScore += score;
                    fixtureDifficulties.push(score);
                } else {
                    fixtureDifficulties.push(6); // Treat as blank for calc
                }
            });

            // Compute easy runs (3+ consecutive fixtures with difficulty <= 2)
            const isInEasyRun = new Array(fixtureDifficulties.length).fill(false);
            let hasEasyRun = false;
            let currentStreak: number[] = [];

            for (let i = 0; i < fixtureDifficulties.length; i++) {
                if (fixtureDifficulties[i] <= 2) {
                    currentStreak.push(i);
                } else {
                    if (currentStreak.length >= 3) {
                        currentStreak.forEach(idx => isInEasyRun[idx] = true);
                        hasEasyRun = true;
                    }
                    currentStreak = [];
                }
            }
            if (currentStreak.length >= 3) {
                currentStreak.forEach(idx => isInEasyRun[idx] = true);
                hasEasyRun = true;
            }

            return { ...team, diffScore, isInEasyRun, hasEasyRun };
        });

        if (plannerSortMode === 'none') return teamsWithScores;

        return [...teamsWithScores].sort((a, b) => {
            if (plannerSortMode === 'asc') return a.diffScore - b.diffScore;
            return b.diffScore - a.diffScore;
        });
    }, [teams, planningGws, fixturesByEvent, plannerSortMode]);

    const togglePlannerSort = () => {
        if (plannerSortMode === 'none') setPlannerSortMode('asc');
        else if (plannerSortMode === 'asc') setPlannerSortMode('desc');
        else setPlannerSortMode('none');
    };

    const topPlayersByTeam = useMemo(() => {
        const allStats = computeTransferIndexForPlayers({
            players,
            fixtures,
            teams,
            events,
            lookahead: 5
        });

        const map = new Map<number, TransferIndexResult[]>();
        teams.forEach(team => {
            const teamPlayers = allStats
                .filter(p => p.team === team.id)
                .sort((a, b) => b.transferIndex - a.transferIndex)
                .slice(0, 3);
            map.set(team.id, teamPlayers);
        });
        return map;
    }, [players, fixtures, teams, events]);

    const getPositionLabel = (type: number) => {
        if (type === 1) return 'GKP';
        if (type === 2) return 'DEF';
        if (type === 3) return 'MID';
        return 'FWD';
    };


    // --- Render Components ---

    const renderFormGuide = (form: string[], label?: string) => (
        <div
            className="flex flex-col items-center justify-center py-2 h-full w-full truncate"
            title="Form — last 5 league matches (top = newest)."
        >
            {label && (
                <span className="text-[6px] md:text-[8px] text-white/80 uppercase font-black mb-1 leading-none text-center tracking-tighter">
                    {label}
                </span>
            )}
            {/* Container for the badges - Simplified */}
            <div className="flex flex-col gap-0.5 p-0.5 rounded border border-white/10 w-5 md:w-7 bg-black/10">
                {[...form].reverse().map((res, i) => {
                    let color = 'bg-slate-700 border-slate-600';
                    if (res === 'W') color = 'bg-green-500 border-green-400 text-white shadow-sm';
                    if (res === 'L') color = 'bg-red-500 border-red-400 text-white shadow-sm';
                    if (res === 'D') color = 'bg-slate-500 border-slate-400 text-white';

                    return (
                        <div
                            key={i}
                            className={`w-3 h-3 md:w-5 md:h-4 text-[7px] md:text-[9px] font-bold flex items-center justify-center rounded-sm border ${color} mx-auto ${i === 0 ? 'ring-1 ring-white/60 z-10' : ''}`}
                        >
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
                        // Use dynamic difficulty with actual fixture data
                        const homeDiff = getDifficulty(fixture.team_a);
                        const awayDiff = getDifficulty(fixture.team_h);
                        const homeForm = getTeamForm(fixture.team_h);
                        const awayForm = getTeamForm(fixture.team_a);

                        const fdrCheck = fixture.finished
                            ? getFdrCheck(fixture.team_h_score, fixture.team_a_score, homeDiff, awayDiff)
                            : null;

                        return (
                            <div key={fixture.id} className="relative bg-slate-800 rounded-lg border border-slate-700 shadow-sm hover:border-slate-500 transition-all group z-0 hover:z-10 overflow-visible">

                                {/* WIDE Difficulty Bars with Form Inside - width 3rem (w-12) on desktop, w-8 on mobile */}
                                <div className={`absolute left-0 top-0 bottom-0 w-8 md:w-12 rounded-l-lg ${homeDiff.bg} shadow-inner border-r border-black/10`}>
                                    {renderFormGuide(homeForm, "HOME FORM")}
                                </div>

                                <div className={`absolute right-0 top-0 bottom-0 w-8 md:w-12 rounded-r-lg ${awayDiff.bg} shadow-inner border-l border-black/10`}>
                                    {renderFormGuide(awayForm, "AWAY FORM")}
                                </div>

                                <div className="grid grid-cols-[1fr_auto_1fr] items-center p-4 pl-10 pr-10 md:pl-16 md:pr-16 h-28 gap-2">

                                    {/* Home Team */}
                                    <div className="flex items-center justify-end gap-3 text-right overflow-hidden">
                                        <div className="flex flex-col items-end min-w-0">
                                            <span className="font-bold text-slate-100 text-sm md:text-xl leading-tight truncate w-full text-right">
                                                {getTeamName(fixture.team_h)}
                                            </span>
                                            <span className={`text-[9px] md:text-[10px] uppercase font-bold px-1.5 rounded mt-1 ${homeDiff.bg.replace('bg-', 'text-')} truncate`}>
                                                Op: {homeDiff.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Score / Time */}
                                    <div className="flex flex-col items-center min-w-[80px] md:min-w-[120px] px-2 relative">
                                        {fixture.finished ? (
                                            <>
                                                <div className="bg-slate-900 px-2 md:px-4 py-1.5 rounded border border-slate-600 mb-1 shadow-inner">
                                                    <div className="text-xl md:text-2xl font-bold text-white tracking-widest font-mono">
                                                        {fixture.team_h_score} - {fixture.team_a_score}
                                                    </div>
                                                </div>
                                                {fdrCheck && (
                                                    <div className={`flex items-center gap-1 text-[9px] md:text-[10px] uppercase font-bold ${fdrCheck.color} whitespace-nowrap`}>
                                                        <fdrCheck.icon size={12} /> {fdrCheck.label}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center">
                                                <div className="text-white font-bold text-base md:text-lg">{new Date(fixture.kickoff_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold">{new Date(fixture.kickoff_time).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Away Team */}
                                    <div className="flex items-center justify-start gap-3 text-left overflow-hidden">
                                        <div className="flex flex-col items-start min-w-0">
                                            <span className="font-bold text-slate-100 text-sm md:text-xl leading-tight truncate w-full">
                                                {getTeamName(fixture.team_a)}
                                            </span>
                                            <span className={`text-[9px] md:text-[10px] uppercase font-bold px-1.5 rounded mt-1 ${awayDiff.bg.replace('bg-', 'text-')} truncate`}>
                                                Op: {awayDiff.label}
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
        return (
            <div className="overflow-x-auto bg-slate-800 rounded-lg shadow-lg border border-slate-700 animate-in fade-in zoom-in duration-300 pb-20">
                <table className="w-full text-left border-collapse min-w-[550px] md:min-w-full">
                    <thead>
                        <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider">
                            <th className="p-3 md:p-4 sticky left-0 bg-slate-900 z-20 border-r border-slate-700 shadow-xl">Team</th>
                            {planningGws.map(gw => (
                                <th key={gw} className="p-2 text-center w-20 md:w-24 border-r border-slate-800 whitespace-nowrap">GW {gw}</th>
                            ))}
                            <th
                                className="p-2 text-right w-20 md:w-24 cursor-pointer hover:text-white transition-colors group"
                                onClick={togglePlannerSort}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    <span>DIFF SCORE</span>
                                    <span className="text-purple-400">
                                        {plannerSortMode === 'asc' ? '↑' : plannerSortMode === 'desc' ? '↓' : ''}
                                    </span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {sortedTeams.map(team => {
                            const isExpanded = expandedTeamId === team.id;
                            const playersForTeam = topPlayersByTeam.get(team.id) || [];

                            return (
                                <React.Fragment key={team.id}>
                                    <tr
                                        className={`hover:bg-slate-700/30 transition-all cursor-pointer group/row ${isExpanded ? 'bg-slate-700/20' : ''}`}
                                        onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                                    >
                                        <td className="p-2 md:p-3 font-bold text-slate-200 sticky left-0 bg-slate-800 z-10 border-r border-slate-700 shadow-xl text-xs md:text-sm whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <ChevronRight size={14} className={`text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-purple-400' : ''}`} />
                                                <span className="sm:hidden">{team.short_name}</span>
                                                <span className="hidden sm:block">{team.name}</span>
                                            </div>
                                        </td>
                                        {planningGws.map((gw, index) => {
                                            const gwFixtures = fixturesByEvent[gw] || [];
                                            const match = gwFixtures.find(f => f.team_h === team.id || f.team_a === team.id);

                                            const isEasyStreakCell = (team as any).isInEasyRun[index];

                                            if (!match) return (
                                                <td key={gw} className="p-2 bg-slate-900/50 relative">
                                                    {isEasyStreakCell && <div className="absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-emerald-400/70 pointer-events-none z-10" />}
                                                </td>
                                            );

                                            const isHome = match.team_h === team.id;
                                            const opponentId = isHome ? match.team_a : match.team_h;
                                            const opponentShort = getTeamShort(opponentId);
                                            const difficulty = getDifficulty(opponentId);

                                            return (
                                                <td key={gw} className="p-0.5 md:p-1 border-r border-slate-700/50 relative group">
                                                    <div
                                                        className={`w-full h-9 md:h-12 rounded flex flex-col items-center justify-center ${difficulty.bg} ${difficulty.text} shadow-sm cursor-default border-b-2 ${difficulty.border} hover:brightness-110 transition-all relative`}
                                                        title={`${getTeamName(opponentId)} | FDR: ${difficulty.label} (${difficulty.score}/5) | Form: ${difficulty.threat.toFixed(0)}`}
                                                    >
                                                        {isEasyStreakCell && <div className="absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-emerald-400/70 pointer-events-none z-10" />}
                                                        <span className="text-[10px] md:text-xs font-bold leading-tight">{opponentShort} ({isHome ? 'H' : 'A'})</span>
                                                        <span className="text-[8px] md:text-[10px] font-mono opacity-80">{difficulty.score}</span>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="p-2 md:p-4 text-right">
                                            <span className={`text-sm md:text-base font-black font-mono ${team.diffScore <= 10 ? 'text-green-400' :
                                                team.diffScore >= 18 ? 'text-red-400' :
                                                    'text-slate-200'
                                                }`}>
                                                {team.diffScore}
                                            </span>
                                            {(team as any).hasEasyRun && (
                                                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                                                    3× EASY
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-slate-950/40 border-l-2 border-purple-500/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <td colSpan={planningGws.length + 2} className="p-3 md:p-4">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-2 text-slate-400 text-[10px] md:text-xs uppercase font-bold tracking-wider mb-1">
                                                        <User size={14} className="text-purple-400" />
                                                        Top Assets by Transfer Index
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        {playersForTeam.map(p => (
                                                            <div key={p.id} className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-3 flex flex-col gap-2 hover:border-slate-500 transition-colors shadow-lg">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <div className="font-bold text-slate-100 text-sm">{p.web_name}</div>
                                                                        <div className="text-[10px] text-slate-500 uppercase font-medium">
                                                                            {getPositionLabel(p.element_type)} · £{p.now_cost / 10}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-purple-500/10 text-purple-400 text-[10px] font-black px-1.5 py-0.5 rounded border border-purple-500/20">
                                                                        TI {p.transferIndex.toFixed(2)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-end mt-1">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] text-slate-500 uppercase font-bold leading-none mb-1">Recent Form</span>
                                                                        <span className="text-lg font-black text-white leading-none">{p.form}</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-[8px] text-slate-500 uppercase font-bold leading-none mb-1">Next 5 Diff</div>
                                                                        <div className={`text-xs font-mono font-bold ${p.fixtureDifficultySum <= 10 ? 'text-green-400' :
                                                                            p.fixtureDifficultySum >= 18 ? 'text-red-400' :
                                                                                'text-slate-300'
                                                                            }`}>
                                                                            {p.fixtureDifficultySum}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
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

                {/* New Premium Collapsible Info Section */}
                <div className="mt-6 bg-slate-900/40 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg transition-all border-l-4 border-l-purple-500/50">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                                <HelpCircle size={20} className="text-purple-400" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-white text-sm md:text-base">Understanding our Dynamic Model & Difficulty Legend</h4>
                                <p className="text-[10px] md:text-xs text-slate-400">Learn how we calculate fixture difficulty beyond the standard FPL FDR</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:inline">{showInfo ? 'Close' : 'View Details'}</span>
                            {showInfo ? <ChevronUp size={20} className="text-purple-400" /> : <ChevronDown size={20} className="text-purple-400" />}
                        </div>
                    </button>

                    {showInfo && (
                        <div className="p-6 border-t border-slate-700/60 bg-slate-900/20 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h5 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                        Why is this different?
                                    </h5>
                                    <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-medium">
                                        <p>
                                            Our Dynamic Difficulty is live. It combines two signals:
                                        </p>
                                        <ul className="space-y-3 ml-1">
                                            <li className="flex gap-3 items-start">
                                                <span className="text-purple-400 font-bold mt-0.5">•</span>
                                                <span><strong className="text-purple-400">Team form</strong> – FPL form of the opponent’s key players</span>
                                            </li>
                                            <li className="flex gap-3 items-start">
                                                <span className="text-purple-400 font-bold mt-0.5">•</span>
                                                <span><strong className="text-purple-400">League position</strong> – adjustments for top vs. bottom half teams</span>
                                            </li>
                                        </ul>
                                        <p className="text-slate-400">
                                            So a big club in bad form becomes easier, while in-form underdogs become tougher than their pre-season FDR.
                                        </p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-700/40 flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className="w-5 h-5 bg-green-500 border border-green-400 rounded flex items-center justify-center font-bold text-white text-[10px] shadow-[0_0_8px_rgba(34,197,94,0.2)]">W</div>
                                            <div className="w-5 h-5 bg-slate-600 border border-slate-500 rounded flex items-center justify-center font-bold text-white text-[10px]">D</div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">
                                            Form: Top (New) to Bottom (Old) • Table & Form refresh every GW
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="group flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <div className="w-1.5 h-6 bg-green-600 rounded-full shadow-[0_0_10px_rgba(22,163,74,0.3)]"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-green-400 font-bold uppercase tracking-tight w-12">Level 1</span>
                                                <span className="text-xs text-white font-semibold italic">Easy</span>
                                            </div>
                                        </div>
                                        <div className="group flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <div className="w-1.5 h-6 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.3)]"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-green-300 font-bold uppercase tracking-tight w-12">Level 2</span>
                                                <span className="text-xs text-white font-semibold italic">Good</span>
                                            </div>
                                        </div>
                                        <div className="group flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <div className="w-1.5 h-6 bg-slate-500 rounded-full"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight w-12">Level 3</span>
                                                <span className="text-xs text-white font-semibold italic">Moderate</span>
                                            </div>
                                        </div>
                                        <div className="group flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <div className="w-1.5 h-6 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.3)]"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-tight w-12">Level 4</span>
                                                <span className="text-xs text-white font-semibold italic">Hard</span>
                                            </div>
                                        </div>
                                        <div className="group flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <div className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.3)]"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-red-400 font-bold uppercase tracking-tight w-12">Level 5</span>
                                                <span className="text-xs text-white font-semibold italic">Very Hard</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="px-1 text-[10px] text-slate-500 italic flex items-center gap-1.5">
                                        <Activity size={12} className="text-blue-400/50" /> Based on form + position mapping.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'schedule' ? renderSchedule() : renderPlanner()}
        </div>
    );
};

export default Fixtures;