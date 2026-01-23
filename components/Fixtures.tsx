import React, { useMemo, useState, useEffect } from 'react';
import { FPLFixture, FPLTeam, FPLEvent, FPLPlayer } from '../types';
import { Calendar, LayoutGrid, Activity, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, HelpCircle, Trophy, Shield, Home, ChevronLeft, ChevronRight, BrainCircuit, User, TrendingUp, History } from 'lucide-react';
import { TeamIcon } from './TeamIcon';
import TwoPanelTable from './TwoPanelTable';
import ResultChip from './ResultChip';
import { track } from '@/lib/ga';


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


    const getDifficulty = (opponentId: number, isAway: boolean = false) => getDynamicDifficulty(opponentId, players, getLeaguePositions, isAway);

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
    // --- UI Helpers ---
    const difficultyBadgeClass = (level: string) => {
        const lower = level.toLowerCase();
        if (lower.includes('very hard')) return "bg-red-500/90 text-slate-50";
        if (lower.includes('hard')) return "bg-orange-500/90 text-slate-950";
        if (lower.includes('moderate')) return "bg-amber-500/90 text-slate-950";
        if (lower.includes('easy')) return "bg-emerald-500/90 text-slate-950";
        return "bg-slate-500/90 text-slate-50";
    };



    const getShortDiffLabel = (label: string) => {
        const lower = label.toLowerCase();
        if (lower.includes('very hard')) return 'V.HARD';
        if (lower.includes('hard')) return 'HARD';
        if (lower.includes('moderate')) return 'MOD';
        if (lower.includes('easy')) return 'EASY';
        return label;
    };

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
        const prevGw = selectedEvent;
        setSelectedEvent(gwId);
        track("select_gameweek", {
            gw: gwId,
            prev_gw: prevGw,
            module: "fixtures",
            method: "dropdown"
        });
    };

    const handleNextGw = () => {
        if (selectedEvent < 38) {
            const nextGw = selectedEvent + 1;
            const prevGw = selectedEvent;
            setSelectedEvent(nextGw);
            track("select_gameweek", {
                gw: nextGw,
                prev_gw: prevGw,
                module: "fixtures",
                method: "arrows"
            });
        }
    };

    const handlePrevGw = () => {
        if (selectedEvent > 1) {
            const prevGwVal = selectedEvent - 1;
            const currentGw = selectedEvent;
            setSelectedEvent(prevGwVal);
            track("select_gameweek", {
                gw: prevGwVal,
                prev_gw: currentGw,
                module: "fixtures",
                method: "arrows"
            });
        }
    };


    const currentFixtures = fixturesByEvent[selectedEvent] || [];

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
                    const isHome = match.team_h === team.id;
                    const opponentId = isHome ? match.team_a : match.team_h;
                    const score = getDifficulty(opponentId, !isHome).score;
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


    const renderSchedule = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">


            <div className="space-y-2">
                {currentFixtures.length > 0 ? (
                    currentFixtures.map((fixture) => {
                        // Use dynamic difficulty with actual fixture data
                        const homeDiff = getDifficulty(fixture.team_a, false); // Home team is home
                        const awayDiff = getDifficulty(fixture.team_h, true);  // Away team is away

                        const fdrCheck = fixture.finished
                            ? getFdrCheck(fixture.team_h_score, fixture.team_a_score, homeDiff, awayDiff)
                            : null;

                        return (
                            <div key={fixture.id} className="relative bg-slate-800 rounded-lg border border-slate-700 shadow-sm hover:border-slate-500 transition-all group z-0 hover:z-10 overflow-hidden">
                                <div className="grid grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1.3fr)] items-center py-2 px-4 md:px-6 h-auto min-h-[64px] gap-3">

                                    {/* Home Team Block */}
                                    <div className="flex flex-col items-start gap-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <TeamIcon code={getTeamShort(fixture.team_h)} alt={getTeamName(fixture.team_h)} size={24} />
                                            <span className="text-sm md:text-lg font-bold text-slate-50 truncate leading-tight">
                                                {getTeamName(fixture.team_h)}
                                            </span>
                                        </div>
                                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-tight ${difficultyBadgeClass(homeDiff.label)}`}>
                                            {getShortDiffLabel(homeDiff.label)}
                                        </span>
                                    </div>

                                    {/* Center Block: Status / Score / Time */}
                                    <div className="flex flex-col items-center min-w-[80px] md:min-w-[120px] px-1">
                                        {fixture.finished ? (
                                            <>
                                                <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 mb-1 shadow-inner">
                                                    <div className="text-xl md:text-2xl font-black text-white tracking-widest font-mono">
                                                        {fixture.team_h_score}-{fixture.team_a_score}
                                                    </div>
                                                </div>
                                                {fdrCheck && (
                                                    <div className={`flex items-center gap-1 text-[9px] md:text-[10px] uppercase font-black ${fdrCheck.color} whitespace-nowrap opacity-90`}>
                                                        <fdrCheck.icon size={10} /> {fdrCheck.label}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-700/50">
                                                <div className="text-white font-black text-xs md:text-base leading-none">
                                                    {new Date(fixture.kickoff_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="text-[9px] md:text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                                                    {new Date(fixture.kickoff_time).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Away Team Block */}
                                    <div className="flex flex-col items-end gap-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-row-reverse">
                                            <TeamIcon code={getTeamShort(fixture.team_a)} alt={getTeamName(fixture.team_a)} size={24} />
                                            <span className="text-sm md:text-lg font-bold text-slate-50 truncate leading-tight text-right">
                                                {getTeamName(fixture.team_a)}
                                            </span>
                                        </div>
                                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-tight ${difficultyBadgeClass(awayDiff.label)}`}>
                                            {getShortDiffLabel(awayDiff.label)}
                                        </span>
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
            <div className="space-y-4">
                {/* Desktop/Tablet Table (Hidden on small screens) */}
                <div className="hidden md:block overflow-x-auto bg-slate-800 rounded-lg shadow-lg border border-slate-700 animate-in fade-in zoom-in duration-300 pb-20">
                    <table className="w-full text-left border-collapse md:table-auto">
                        <thead>
                            <tr className="bg-slate-900 text-slate-400 text-sm uppercase tracking-wider font-bold">
                                <th
                                    className="p-4 md:p-5 text-center w-20 sticky left-0 bg-slate-900 z-30 border-r border-slate-700 shadow-xl cursor-pointer hover:text-white transition-colors group"
                                    onClick={togglePlannerSort}
                                >
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="leading-tight text-[10px]">AVG</span>
                                        <span className="leading-tight text-[10px]">DIFF</span>
                                        <span className="text-purple-400 text-xs mt-0.5">
                                            {plannerSortMode === 'asc' ? '↑' : plannerSortMode === 'desc' ? '↓' : ''}
                                        </span>
                                    </div>
                                </th>
                                <th className="p-4 md:p-5 sticky left-[80px] bg-slate-900 z-20 border-r border-slate-700 shadow-xl text-sm w-64">Team</th>
                                {planningGws.map(gw => (
                                    <th key={gw} className="p-4 md:p-5 text-center w-28 border-r border-slate-800 whitespace-nowrap text-sm">GW {gw}</th>
                                ))}
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
                                            onClick={() => {
                                                setExpandedTeamId(isExpanded ? null : team.id);
                                            }}
                                        >
                                            <td className="p-4 md:p-5 text-center sticky left-0 bg-slate-800 z-10 border-r border-slate-700 shadow-xl w-20">
                                                <span className={`text-xl font-black font-mono ${team.diffScore <= 10 ? 'text-green-400' :
                                                    team.diffScore >= 18 ? 'text-red-400' :
                                                        'text-slate-200'
                                                    }`}>
                                                    {team.diffScore}
                                                </span>
                                            </td>
                                            <td className="p-4 md:p-5 font-bold text-white sticky left-[80px] bg-slate-800 z-10 border-r border-slate-700 shadow-xl text-base whitespace-nowrap w-64">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <ChevronRight size={16} className={`shrink-0 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-purple-400' : ''}`} />
                                                    <span className="truncate">{team.name}</span>
                                                    {(team as any).hasEasyRun && (
                                                        <span className="shrink-0 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] px-2 py-0.5 whitespace-nowrap shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                                                            3× EASY
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {planningGws.map((gw, index) => {
                                                const gwFixtures = fixturesByEvent[gw] || [];
                                                const match = gwFixtures.find(f => f.team_h === team.id || f.team_a === team.id);

                                                if (!match) return <td key={gw} className="p-4 md:p-5 bg-slate-900/50 relative"></td>;

                                                const isHome = match.team_h === team.id;
                                                const isAway = !isHome;
                                                const opponentId = isHome ? match.team_a : match.team_h;
                                                const opponentShort = getTeamShort(opponentId);
                                                const difficulty = getDifficulty(opponentId, isAway);

                                                return (
                                                    <td key={gw} className="p-2 md:p-3 border-r border-slate-700/50 relative group">
                                                        <ResultChip
                                                            label={`${opponentShort}${isHome ? 'H' : 'A'}`}
                                                            value={String(difficulty.score)}
                                                            bgClass={difficulty.bg}
                                                            borderClass={`border-b-2 ${difficulty.border}`}
                                                            textClass={difficulty.text}
                                                            title={`${getTeamName(opponentId)} | FDR: ${difficulty.label} (${difficulty.score}/5)`}
                                                            className="w-full hover:brightness-110 h-10"
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-950/40 border-l-4 border-purple-500 animation-in slide-in-from-top-2 duration-300">
                                                <td colSpan={planningGws.length + 2} className="p-6">
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex items-center gap-2 text-purple-400 text-xs uppercase font-black tracking-widest">
                                                            <History size={16} />
                                                            Key Assets for {team.name}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            {playersForTeam.map(p => (
                                                                <div key={p.id} className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-4 flex flex-col gap-3 hover:border-purple-500/50 transition-all hover:shadow-lg group/asset">
                                                                    <div className="font-bold text-white text-base truncate group-hover/asset:text-purple-300 transition-colors">{p.web_name}</div>
                                                                    <div className="flex items-center justify-between text-xs">
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="uppercase text-slate-500 text-[9px] font-black">Position</span>
                                                                            <span className="text-slate-200 font-bold">{getPositionLabel(p.element_type)}</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 border-l border-slate-700 pl-4">
                                                                            <span className="text-[9px] text-slate-500 uppercase font-black">Cost</span>
                                                                            <span className="text-slate-200 font-bold">£{p.now_cost / 10}m</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 border-l border-slate-700 pl-4">
                                                                            <span className="text-[9px] text-slate-500 uppercase font-black">Form</span>
                                                                            <span className="text-white font-black">{p.form}</span>
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

                {/* Mobile/Tablet 2-Panel Layout */}
                <div className="md:hidden">
                    <TwoPanelTable
                        leftHeader={
                            <div className="flex items-center gap-2 cursor-pointer" onClick={togglePlannerSort}>
                                <div className="flex flex-col items-center">
                                    <span className="text-[8px] font-black">FDR</span>
                                    <span className="text-purple-400 text-[8px]">
                                        {plannerSortMode === 'asc' ? '↑' : plannerSortMode === 'desc' ? '↓' : ''}
                                    </span>
                                </div>
                                <span>Team</span>
                            </div>
                        }
                        rightHeader="FDR Matrix (Next 5 GWs)"
                        leftWidthClass="w-[100px] sm:w-[130px]"
                        rows={sortedTeams.map(team => ({
                            key: team.id,
                            left: (
                                <div className="flex items-center gap-2 w-full min-w-0">
                                    <span className={`text-[10px] font-black font-mono shrink-0 w-4 text-center ${team.diffScore <= 10 ? 'text-green-400' :
                                        team.diffScore >= 18 ? 'text-red-400' :
                                            'text-slate-200'
                                        }`}>
                                        {team.diffScore}
                                    </span>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-white text-[11px] truncate uppercase leading-tight">
                                            {team.short_name}
                                        </span>
                                        {(team as any).hasEasyRun && (
                                            <span className="text-[7px] text-emerald-400 font-black tracking-tighter uppercase leading-none mt-0.5">
                                                3x Easy
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ),
                            right: (
                                <div className="flex items-center gap-1 h-full">
                                    {planningGws.map((gw) => {
                                        const gwFixtures = fixturesByEvent[gw] || [];
                                        const match = gwFixtures.find(f => f.team_h === team.id || f.team_a === team.id);

                                        if (!match) return <div key={gw} className="w-11 h-9 bg-slate-900/40 rounded-md border border-slate-700/30"></div>;

                                        const isHome = match.team_h === team.id;
                                        const isAway = !isHome;
                                        const opponentId = isHome ? match.team_a : match.team_h;
                                        const opponentShort = getTeamShort(opponentId);
                                        const difficulty = getDifficulty(opponentId, isAway);

                                        return (
                                            <ResultChip
                                                key={gw}
                                                label={opponentShort}
                                                value={`${difficulty.score}${isHome ? 'H' : 'A'}`}
                                                bgClass={difficulty.bg}
                                                borderClass={`border-b-2 ${difficulty.border}`}
                                                textClass={difficulty.text}
                                                className="w-11"
                                            />
                                        );
                                    })}
                                </div>
                            )
                        }))}
                    />
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-3 md:space-y-6">

            {/* Header & Controls */}
            <div className="bg-slate-800 p-3 md:p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 md:gap-4">
                    <div>
                        <h2 className="text-lg md:text-2xl font-bold flex items-center gap-2 text-white mb-0.5 md:mb-2">
                            <Calendar className="w-4 h-4 md:w-6 md:h-6 text-purple-400" />
                            Fixtures & FDR Planner
                        </h2>
                    </div>

                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 md:py-2 rounded-md text-[10px] md:text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Calendar size={12} className="md:w-3.5 md:h-3.5" /> Schedule
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('planner');
                            }}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 md:py-2 rounded-md text-[10px] md:text-sm font-bold transition-all ${activeTab === 'planner' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <LayoutGrid size={12} className="md:w-3.5 md:h-3.5" /> FDR Matrix
                        </button>
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div className="mt-3 md:mt-6 flex flex-col sm:flex-row gap-2 md:gap-4 items-center bg-slate-900/50 p-1.5 md:p-3 rounded-lg border border-slate-700">

                    {/* Month Selector */}
                    <div className="relative w-full sm:w-auto">
                        <select
                            value={selectedMonth}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            className="w-full sm:w-48 appearance-none bg-slate-800 text-white text-[11px] md:text-sm font-bold border border-slate-600 rounded px-3 md:px-4 py-1 md:py-2 pr-8 focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            {months.map(m => (
                                <option key={m.name} value={m.name}>{m.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-1.5 md:gap-2 w-full sm:w-auto justify-center">
                        <button
                            onClick={handlePrevGw}
                            disabled={selectedEvent <= 1}
                            className="p-1 md:p-2 bg-slate-800 rounded border border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft size={14} className="md:w-4 md:h-4" />
                        </button>

                        {/* Gameweek Selector */}
                        <div className="relative flex-1 sm:flex-none">
                            <select
                                value={selectedEvent}
                                onChange={(e) => handleGwChange(Number(e.target.value))}
                                className="w-full sm:w-64 appearance-none bg-slate-800 text-white text-[11px] md:text-sm font-bold border border-slate-600 rounded px-2 md:px-4 py-1 md:py-2 pr-8 focus:ring-2 focus:ring-purple-500 outline-none text-center"
                            >
                                {months.find(m => m.name === selectedMonth)?.events.map(e => (
                                    <option key={e.id} value={e.id}>
                                        {e.name} {e.is_current ? '(Cur)' : e.is_next ? '(Next)' : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>

                        <button
                            onClick={handleNextGw}
                            disabled={selectedEvent >= 38}
                            className="p-1 md:p-2 bg-slate-800 rounded border border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight size={14} className="md:w-4 md:h-4" />
                        </button>
                    </div>
                </div>

                {/* New Premium Collapsible Info Section */}
                <div className="mt-3 md:mt-6 bg-slate-900/40 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg transition-all border-l-4 border-l-purple-500/50">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="w-full flex items-center justify-between p-2 md:p-4 hover:bg-slate-800/40 transition-all group"
                    >
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="p-1 md:p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                                <HelpCircle size={16} className="md:w-4.5 md:h-4.5" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-white text-[11px] md:text-base">Understanding our Dynamic Model</h4>
                                <p className="text-[9px] md:text-xs text-slate-400 hidden md:block">How we calculate difficulty beyond FPL FDR</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden md:inline">{showInfo ? 'Close' : 'Details'}</span>
                            {showInfo ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
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