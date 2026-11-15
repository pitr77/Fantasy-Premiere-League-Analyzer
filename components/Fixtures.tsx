import React, { useMemo, useState, useEffect } from 'react';
import { FPLFixture, FPLTeam, FPLEvent, FPLPlayer } from '../types';
import { Calendar, LayoutGrid, Activity, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, HelpCircle, Trophy, Shield, Home, ChevronLeft, ChevronRight, BrainCircuit, User, TrendingUp, History, Coins, RefreshCw } from 'lucide-react';
import { TeamIcon } from './TeamIcon';
import TwoPanelTable from './TwoPanelTable';
import ResultChip from './ResultChip';
import { track } from '@/lib/ga';
import { FortunaMatch } from '../services/oddsSnapshotService';

import { calculateLeaguePositions, getDynamicDifficulty } from '../lib/fdrModel';
import { computeTransferIndexForPlayers, TransferIndexResult } from '../lib/transferIndex';
import { getGoalscorerOdds } from '../lib/goalscorerModel';
import FDRRealityAnalysis from './FDRRealityAnalysis';
import { useLanguage } from '../lib/language';

interface FixturesProps {
    fixtures: FPLFixture[];
    teams: FPLTeam[];
    events: FPLEvent[];
    players: FPLPlayer[];
}

const Fixtures: React.FC<FixturesProps> = ({ fixtures, teams, events, players }) => {
    const [lang] = useLanguage();
    const [activeTab, setActiveTab] = useState<'schedule' | 'planner' | 'reality'>('schedule');
    const [showInfo, setShowInfo] = useState(false);
    const [plannerSortMode, setPlannerSortMode] = useState<'none' | 'asc' | 'desc'>('none');
    const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
    const [oddsData, setOddsData] = useState<FortunaMatch[] | null>(null);
    const [oddsLastUpdated, setOddsLastUpdated] = useState<string | null>(null);
    const [isRefreshingOdds, setIsRefreshingOdds] = useState(false);
    const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showOdds, setShowOdds] = useState(true);

    useEffect(() => {
        fetch('/api/odds')
            .then(res => res.json())
            .then(data => {
                if (data.available && Array.isArray(data.matches)) {
                    setOddsData(data.matches);
                    if (data.fetchedAt) setOddsLastUpdated(data.fetchedAt);
                }
            })
            .catch(() => {});
    }, []);

    const formatLastUpdated = (dateStr: string | null) => {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const day = date.toLocaleDateString([], { day: 'numeric', month: 'numeric' });
            return `${time}, ${day}`;
        } catch {
            return null;
        }
    };

    const handleRefreshOdds = async () => {
        if (isRefreshingOdds) return;
        setIsRefreshingOdds(true);
        setRefreshStatus('idle');
        try {
            const res = await fetch('/api/odds', { method: 'POST' });
            const data = await res.json();
            if (data.success && Array.isArray(data.matches)) {
                setOddsData(data.matches);
                if (data.fetchedAt) setOddsLastUpdated(data.fetchedAt);
                setRefreshStatus('success');
                setTimeout(() => setRefreshStatus('idle'), 3000);
            } else {
                setRefreshStatus('error');
                setTimeout(() => setRefreshStatus('idle'), 4000);
            }
        } catch {
            setRefreshStatus('error');
            setTimeout(() => setRefreshStatus('idle'), 4000);
        } finally {
            setIsRefreshingOdds(false);
        }
    };

    const oddsMap = useMemo(() => {
        const map = new Map<string, FortunaMatch>();
        if (!oddsData) return map;
        oddsData.forEach(m => {
            if (m.homeTeamId && m.awayTeamId) {
                map.set(`${m.homeTeamId}-${m.awayTeamId}`, m);
            }
        });
        return map;
    }, [oddsData]);

    const topScorersByFixture = useMemo(() => {
        const map = new Map<number, { name: string; prob: number; odds: number; source: 'fortuna_live' | 'fortuna_model'; teamShort: string }>();
        if (!fixtures || !players || !teams) return map;

        for (const fix of fixtures) {
            const fixtureOdds = oddsMap.get(`${fix.team_h}-${fix.team_a}`);

            // 1. Check if Fortuna live scorers list exists for this match
            if (fixtureOdds?.scorers && fixtureOdds.scorers.length > 0) {
                const sorted = [...fixtureOdds.scorers].sort((a, b) => a.odds - b.odds);
                const top = sorted[0];
                if (top && top.odds && top.odds > 1) {
                    const matchedPlayer = players.find(p =>
                        (p.team === fix.team_h || p.team === fix.team_a) &&
                        (p.web_name.toLowerCase().includes(top.name.toLowerCase()) || top.name.toLowerCase().includes(p.web_name.toLowerCase()))
                    );
                    const teamShort = matchedPlayer ? (teams.find(t => t.id === matchedPlayer.team)?.short_name || '') : '';
                    map.set(fix.id, {
                        name: top.name,
                        prob: Math.round(top.prob * 100),
                        odds: top.odds,
                        source: 'fortuna_live',
                        teamShort
                    });
                    continue;
                }
            }

            // 2. Otherwise calculate goal expectation using goalscorerModel for attacking players in this fixture
            const matchPlayers = players.filter(p => (p.team === fix.team_h || p.team === fix.team_a) && (p.element_type === 3 || p.element_type === 4));
            let best: { name: string; prob: number; rawProb: number; odds: number; source: 'fortuna_live' | 'fortuna_model'; teamShort: string } | null = null;

            for (const p of matchPlayers) {
                const res = getGoalscorerOdds(p, teams, fixtures, fix.event, oddsData);
                if (res && res.goal) {
                    if (!best || res.goal.prob > best.rawProb) {
                        const pTeam = teams.find(t => t.id === p.team);
                        best = {
                            name: p.web_name,
                            prob: Math.round(res.goal.prob * 100),
                            rawProb: res.goal.prob,
                            odds: Number(res.goal.odds.toFixed(2)),
                            source: res.goal.source,
                            teamShort: pTeam?.short_name || ''
                        };
                    }
                }
            }

            if (best) {
                map.set(fix.id, {
                    name: best.name,
                    prob: best.prob,
                    odds: best.odds,
                    source: best.source,
                    teamShort: best.teamShort
                });
            }
        }
        return map;
    }, [fixtures, players, teams, oddsMap, oddsData]);

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


    // --- Render Components & Odds Helpers ---

    const renderCleanSheetBadge = (cs: { yes: number; no: number; prob: number } | null | undefined, teamName: string) => {
        if (!cs) return null;
        const pct = Math.round(cs.prob * 100);
        const fillPercent = Math.min(100, Math.round((cs.prob / 0.45) * 100));

        let containerClass = "bg-slate-900/60 border-slate-800/70 text-slate-500 opacity-80";
        let iconClass = "text-slate-600";
        let barClass = "bg-slate-600";
        let textClass = "text-slate-400";
        let labelTag: string | null = null;

        if (pct >= 38) {
            containerClass = "bg-emerald-950/80 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/40";
            iconClass = "text-emerald-300";
            barClass = "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]";
            textClass = "text-emerald-200 font-black";
            labelTag = "TOP CS";
        } else if (pct >= 28) {
            containerClass = "bg-teal-950/60 border-teal-500/50 text-teal-200 shadow-[0_0_8px_rgba(20,184,166,0.2)]";
            iconClass = "text-teal-400";
            barClass = "bg-teal-400";
            textClass = "text-teal-200 font-bold";
        } else if (pct >= 20) {
            containerClass = "bg-slate-800/80 border-slate-700 text-slate-300";
            iconClass = "text-slate-400";
            barClass = "bg-slate-400";
            textClass = "text-slate-200";
        }

        return (
            <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] transition-all ${containerClass}`}
                title={`Šanca na čisté konto pre ${teamName}: ${pct}% (kurz ${cs.yes.toFixed(2)})`}
            >
                <Shield size={11} className={`${iconClass} shrink-0`} />
                <span className="font-bold text-[9px] uppercase tracking-tight">CS</span>
                <span className={`font-mono ${textClass}`}>{pct}%</span>
                {labelTag && (
                    <span className="text-[8px] bg-emerald-500/30 text-emerald-300 px-1 py-0.2 rounded font-black uppercase tracking-tighter">
                        {labelTag}
                    </span>
                )}
                {/* Visual Mini Progress Bar (Pás) */}
                <div className="w-5 sm:w-6 h-1.5 bg-slate-950/80 rounded-full overflow-hidden shrink-0 border border-white/5">
                    <div
                        style={{ width: `${fillPercent}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                    />
                </div>
            </div>
        );
    };

    const renderOverUnderBadge = (ou: { over: number; under: number; overProb: number | null } | null | undefined) => {
        if (!ou || ou.overProb === null) return null;
        const pct = Math.round(ou.overProb * 100);
        const isHigh = pct >= 58;
        const fillPercent = Math.min(100, Math.round((ou.overProb / 0.70) * 100));

        let containerClass = "bg-slate-800/80 border-slate-700 text-slate-300";
        let barClass = "bg-slate-500";
        let textClass = "text-slate-200";

        if (isHigh) {
            containerClass = "bg-purple-950/85 border-purple-500/70 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.35)] ring-1 ring-purple-400/30";
            barClass = "bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_6px_rgba(168,85,247,0.9)]";
            textClass = "text-purple-100 font-black";
        }

        return (
            <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] transition-all ${containerClass}`}
                title={`Viac ako 2.5 gólu: ${pct}% (kurz ${ou.over.toFixed(2)})`}
            >
                <span className="font-extrabold text-[9px] text-purple-300 font-mono">+2.5</span>
                <span className={`font-mono ${textClass}`}>{pct}%</span>
                {/* Visual Mini Progress Bar (Pás) */}
                <div className="w-5 sm:w-6 h-1.5 bg-slate-950/80 rounded-full overflow-hidden shrink-0 border border-white/5">
                    <div
                        style={{ width: `${fillPercent}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                    />
                </div>
            </div>
        );
    };

    const renderWinOddsBadge = (
        type: '1' | '2',
        odds: number | undefined,
        prob: number | undefined,
        teamName: string,
        isHome: boolean
    ) => {
        if (!odds) return null;
        const pct = prob ? Math.round(prob * 100) : null;
        const isSuperFav = (prob ?? 0) >= 0.60;
        const isFav = (prob ?? 0) >= 0.48;

        let badgeStyle = "bg-slate-800 border-slate-700 text-slate-200";
        let pctColor = "text-slate-400";

        if (isSuperFav) {
            badgeStyle = isHome
                ? "bg-emerald-950/90 border-emerald-400 text-emerald-200 font-black shadow-[0_0_12px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/40"
                : "bg-indigo-950/90 border-indigo-400 text-indigo-200 font-black shadow-[0_0_12px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/40";
            pctColor = isHome ? "text-emerald-300" : "text-indigo-300";
        } else if (isFav) {
            badgeStyle = isHome
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold"
                : "bg-indigo-950/60 border-indigo-500/50 text-indigo-300 font-bold";
            pctColor = isHome ? "text-emerald-300" : "text-indigo-300";
        }

        return (
            <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono transition-all ${badgeStyle}`}
                title={`Kurz na výhru ${teamName}: ${odds.toFixed(2)}${pct ? ` (${pct}%)` : ''}`}
            >
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase">{type}</span>
                <span className="font-bold">{odds.toFixed(2)}</span>
                {pct !== null && (
                    <span className={`text-[10px] font-sans font-extrabold ${pctColor}`}>
                        {pct}%
                    </span>
                )}
            </div>
        );
    };

    const renderSchedule = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">


            <div className="space-y-2">
                {currentFixtures.length > 0 ? (
                    currentFixtures.map((fixture) => {
                        // Use dynamic difficulty with actual fixture data
                        const homeDiff = getDifficulty(fixture.team_a, false); // Home team is home
                        const awayDiff = getDifficulty(fixture.team_h, true);  // Away team is away
                        const fixtureOdds = oddsMap.get(`${fixture.team_h}-${fixture.team_a}`);

                        const fdrCheck = fixture.finished
                            ? getFdrCheck(fixture.team_h_score, fixture.team_a_score, homeDiff, awayDiff)
                            : null;

                        // Visual Card Accent Strip for Elite picks
                        const homeWinProb = fixtureOdds?.probabilities?.home ?? 0;
                        const awayWinProb = fixtureOdds?.probabilities?.away ?? 0;
                        const drawWinProb = fixtureOdds?.probabilities?.draw ?? 0;
                        const homeCsProb = fixtureOdds?.cleanSheet?.home?.prob ?? 0;
                        const awayCsProb = fixtureOdds?.cleanSheet?.away?.prob ?? 0;
                        const over25Prob = fixtureOdds?.overUnder25?.overProb ?? null;

                        const homeWinOdds = fixtureOdds?.odds?.home;
                        const drawWinOdds = fixtureOdds?.odds?.draw;
                        const awayWinOdds = fixtureOdds?.odds?.away;
                        const homeCsOdds = fixtureOdds?.cleanSheet?.home?.yes;
                        const awayCsOdds = fixtureOdds?.cleanSheet?.away?.yes;
                        const over25Odds = fixtureOdds?.overUnder25?.over;
                        const topScorer = topScorersByFixture.get(fixture.id);

                        let cardBorderAccent = "border-slate-700 hover:border-slate-500";
                        if (showOdds && (homeWinProb >= 0.60 || homeCsProb >= 0.38)) {
                            cardBorderAccent = "border-slate-700 hover:border-slate-500 border-l-4 border-l-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.08)]";
                        } else if (showOdds && (awayWinProb >= 0.60 || awayCsProb >= 0.38)) {
                            cardBorderAccent = "border-slate-700 hover:border-slate-500 border-r-4 border-r-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.08)]";
                        }

                        return (
                            <div key={fixture.id} className={`relative bg-slate-800 rounded-lg border shadow-sm transition-all group z-0 hover:z-10 overflow-hidden ${cardBorderAccent}`}>
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

                                {/* Fortuna Odds Section - Sleek Win Probability Bar & FPL Metric Cards */}
                                {showOdds && fixtureOdds && (
                                    <div className="border-t border-slate-700/60 bg-slate-900/90 px-3 md:px-5 py-3 space-y-2.5">
                                        {/* 1. Visual 1-X-2 Win Probability Bar (Hrubý, čitateľný pruh) */}
                                        {fixtureOdds.probabilities && (() => {
                                            const isHomeFav = homeWinProb >= awayWinProb;
                                            const homeWinBg = isHomeFav
                                                ? "bg-gradient-to-r from-emerald-600 to-teal-500"
                                                : "bg-gradient-to-r from-sky-600 to-blue-600";
                                            const awayWinBg = !isHomeFav
                                                ? "bg-gradient-to-r from-emerald-600 to-teal-500"
                                                : "bg-gradient-to-r from-sky-600 to-blue-600";
                                            const homeTextAccent = isHomeFav ? "text-emerald-100" : "text-sky-100";
                                            const awayTextAccent = !isHomeFav ? "text-emerald-100" : "text-sky-100";

                                            return (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 px-0.5 tracking-wider">
                                                        <span>Šanca na výhru</span>
                                                    </div>
                                                    <div className="h-7 sm:h-8 w-full bg-slate-950 rounded-lg overflow-hidden flex shadow-inner border border-slate-800 p-0.5 gap-0.5">
                                                        {/* Home Win Segment */}
                                                        <div
                                                            style={{ width: `${Math.round(homeWinProb * 100)}%` }}
                                                            className={`${homeWinBg} rounded-l-md h-full flex items-center justify-start px-2 min-w-0 transition-all hover:brightness-110 cursor-default`}
                                                            title={`${getTeamName(fixture.team_h)}: ${Math.round(homeWinProb * 100)}% šanca na výhru`}
                                                        >
                                                            <div className="flex items-center gap-1.5 text-white font-sans text-xs font-black truncate">
                                                                <span className="truncate">{getTeamShort(fixture.team_h)}</span>
                                                                <span>{Math.round(homeWinProb * 100)}%</span>
                                                            </div>
                                                        </div>

                                                        {/* Draw Segment */}
                                                        <div
                                                            style={{ width: `${Math.round(drawWinProb * 100)}%` }}
                                                            className="bg-slate-700/90 h-full flex items-center justify-center px-1 min-w-0 transition-all hover:brightness-110 cursor-default"
                                                            title={`Remíza: ${Math.round(drawWinProb * 100)}%`}
                                                        >
                                                            <div className="flex items-center justify-center text-slate-200 font-sans text-xs font-bold truncate">
                                                                <span>{Math.round(drawWinProb * 100)}%</span>
                                                            </div>
                                                        </div>

                                                        {/* Away Win Segment */}
                                                        <div
                                                            style={{ width: `${Math.round(awayWinProb * 100)}%` }}
                                                            className={`${awayWinBg} rounded-r-md h-full flex items-center justify-end px-2 min-w-0 transition-all hover:brightness-110 cursor-default`}
                                                            title={`${getTeamName(fixture.team_a)}: ${Math.round(awayWinProb * 100)}% šanca na výhru`}
                                                        >
                                                            <div className="flex items-center gap-1.5 text-white font-sans text-xs font-black truncate">
                                                                <span>{Math.round(awayWinProb * 100)}%</span>
                                                                <span className="truncate">{getTeamShort(fixture.team_a)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* 2. Visual Clean Sheet Bar (Pruh na čisté konto - rovnaká plná šírka) */}
                                        {(homeCsProb > 0 || awayCsProb > 0) && (
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 px-0.5 tracking-wider">
                                                    <span>Šanca na čisté konto (GKP / DEF)</span>
                                                </div>
                                                <div className="h-7 sm:h-8 w-full bg-slate-950 rounded-lg overflow-hidden grid grid-cols-2 shadow-inner border border-slate-800 p-0.5 gap-0.5 relative">
                                                    {/* Home Team Clean Sheet (Ľavá polovica) */}
                                                    <div className="relative bg-slate-900/60 rounded-l-md h-full overflow-hidden flex items-center px-2 sm:px-2.5 min-w-0 border-r border-slate-700/80">
                                                        {/* Visual Fill 0-100% */}
                                                        <div
                                                            style={{ width: `${Math.round(homeCsProb * 100)}%` }}
                                                            className={`absolute left-0 top-0 bottom-0 transition-all duration-500 rounded-l-md ${
                                                                homeCsProb >= 0.38
                                                                    ? 'bg-gradient-to-r from-emerald-600/90 to-teal-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                                                    : homeCsProb >= 0.28
                                                                    ? 'bg-teal-600/60'
                                                                    : 'bg-slate-700/50'
                                                            }`}
                                                        />
                                                        {/* Text Layer Above */}
                                                        <div className="relative z-10 flex items-center justify-between w-full text-white font-sans text-xs font-bold gap-1">
                                                            <div className="flex items-center gap-1.5 truncate">
                                                                <span className="truncate">{getTeamShort(fixture.team_h)}</span>
                                                                <span className="font-black text-white">{Math.round(homeCsProb * 100)}%</span>
                                                                {homeCsProb >= 0.38 && (
                                                                    <span className="text-[8px] bg-emerald-500/40 text-emerald-200 border border-emerald-400/50 px-1 py-0.2 rounded font-black hidden sm:inline uppercase">
                                                                        TOP CS
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {homeCsOdds && (
                                                                <span className="text-[10px] text-white font-sans font-bold bg-black/40 border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                                                                    kurz {homeCsOdds.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Away Team Clean Sheet (Pravá polovica) */}
                                                    <div className="relative bg-slate-900/60 rounded-r-md h-full overflow-hidden flex items-center px-2 sm:px-2.5 min-w-0">
                                                        {/* Visual Fill 0-100% - uses Emerald for strong defense, Slate for low */}
                                                        <div
                                                            style={{ width: `${Math.round(awayCsProb * 100)}%` }}
                                                            className={`absolute right-0 top-0 bottom-0 transition-all duration-500 rounded-r-md ${
                                                                awayCsProb >= 0.38
                                                                    ? 'bg-gradient-to-l from-emerald-600/90 to-teal-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                                                    : awayCsProb >= 0.28
                                                                    ? 'bg-teal-600/60'
                                                                    : 'bg-slate-700/50'
                                                            }`}
                                                        />
                                                        {/* Text Layer Above */}
                                                        <div className="relative z-10 flex items-center justify-between w-full text-white font-sans text-xs font-bold gap-1">
                                                            {awayCsOdds && (
                                                                <span className="text-[10px] text-white font-sans font-bold bg-black/40 border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                                                                    kurz {awayCsOdds.toFixed(2)}
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-1.5 truncate justify-end">
                                                                {awayCsProb >= 0.38 && (
                                                                    <span className="text-[8px] bg-emerald-500/40 text-emerald-200 border border-emerald-400/50 px-1 py-0.2 rounded font-black hidden sm:inline uppercase">
                                                                        TOP CS
                                                                    </span>
                                                                )}
                                                                <span className="font-black text-white">{Math.round(awayCsProb * 100)}%</span>
                                                                <span className="truncate">{getTeamShort(fixture.team_a)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. Visual Top Goalscorer Threat Bar (Najlepší kurz na gól z oboch tímov) */}
                                        {topScorer && (
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 px-0.5 tracking-wider">
                                                    <span>Najväčší favorit na gól v zápase (MID / FWD)</span>
                                                </div>
                                                <div className="h-7 sm:h-8 w-full bg-slate-950 rounded-lg overflow-hidden relative shadow-inner border border-slate-800 p-0.5">
                                                    {/* Visual Fill 0-100% - Tmavomodrá, s rešpektovaním p-0.5 vnútorného okraja ako prvé dva bary */}
                                                    <div
                                                        style={{ width: `${Math.min(100, topScorer.prob)}%` }}
                                                        className="absolute left-0.5 top-0.5 bottom-0.5 bg-gradient-to-r from-blue-900/90 to-indigo-900/80 rounded-l-md transition-all duration-500 shadow-[0_0_10px_rgba(30,58,138,0.25)]"
                                                    />
                                                    {/* Text Layer Above - nie boldom, percento v rovnakej veľkosti ako prvé dva bary */}
                                                    <div className="relative z-10 flex items-center justify-between w-full h-full text-white font-sans text-xs gap-1 px-2 sm:px-2.5">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <span className="text-white font-medium text-xs truncate">
                                                                {topScorer.name}
                                                            </span>
                                                            {topScorer.teamShort && (
                                                                <span className="text-[9px] bg-slate-800 text-white border border-slate-700 px-1.5 py-0.2 rounded font-medium uppercase shrink-0">
                                                                    {topScorer.teamShort}
                                                                </span>
                                                            )}
                                                            <span className="font-medium text-amber-300 text-xs">
                                                                {topScorer.prob}%
                                                            </span>
                                                        </div>
                                                        {topScorer.odds && (
                                                            <span
                                                                className="text-[10px] text-white font-sans font-bold bg-black/40 border border-white/10 px-1.5 py-0.5 rounded shrink-0 shadow-sm"
                                                                title={topScorer.source === 'fortuna_live' ? 'Fortuna Live kurz na gól' : 'Odhadnutý kurz na gól podľa xG a formy'}
                                                            >
                                                                kurz {topScorer.odds.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
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
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* 1. Standalone Header Frame */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center gap-4">
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                        <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-400 shrink-0" />
                        {lang === 'sk' ? 'Zápasy & FDR Plánovač' : 'Fixtures & FDR Planner'}
                    </h2>
                </div>
            </div>

            {/* 2. Controls Row (Tabs on left, Gameweek & Odds on right) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
                {/* Main Tab Switcher */}
                <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 w-full sm:w-auto self-start">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 sm:flex-none px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'schedule'
                                ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>{lang === 'sk' ? 'Rozpis zápasov' : 'Schedule'}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('planner')}
                        className={`flex-1 sm:flex-none px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'planner'
                                ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>{lang === 'sk' ? 'FDR Matica' : 'FDR Matrix'}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reality')}
                        className={`flex-1 sm:flex-none px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'reality'
                                ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>FDR Reality Check</span>
                    </button>
                </div>

                {/* Gameweek Selector & Fortuna Odds (Schedule & Matrix only) */}
                {activeTab !== 'reality' && (
                    <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                        {/* Gameweek Selector with Navigation */}
                        <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 shadow-sm">
                            <button
                                onClick={handlePrevGw}
                                disabled={selectedEvent <= 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            <div className="relative bg-slate-600/50 border border-slate-500/60 shadow-sm rounded-lg flex items-center px-1">
                                <select
                                    value={selectedEvent}
                                    onChange={(e) => handleGwChange(Number(e.target.value))}
                                    className="appearance-none bg-transparent text-slate-100 text-xs font-bold px-2 py-1 pr-5 outline-none text-center cursor-pointer"
                                >
                                    {events.map(e => (
                                        <option key={e.id} value={e.id} className="bg-slate-800 text-slate-100">
                                            {e.name} {e.is_current ? '(Cur)' : e.is_next ? '(Next)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                            </div>

                            <button
                                onClick={handleNextGw}
                                disabled={selectedEvent >= 38}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 transition-colors"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>

                        {/* Fortuna Odds Toggle & Refresh Controls */}
                        <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 shadow-sm">
                            <button
                                onClick={() => setShowOdds(!showOdds)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                    showOdds
                                        ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                                title="Zobraziť stávkové kurzy z Fortuna.sk"
                            >
                                <span>Kurzy Fortuna</span>
                                {oddsData && oddsData.length > 0 && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Kurzy sú aktívne"></span>
                                )}
                            </button>

                            <button
                                onClick={handleRefreshOdds}
                                disabled={isRefreshingOdds}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                                title={
                                    oddsLastUpdated
                                        ? `Naposledy aktualizované: ${formatLastUpdated(oddsLastUpdated)}. Kliknutím stiahnete najčerstvejšie kurzy z Fortuna.sk`
                                        : 'Stiahnuť aktuálne kurzy z Fortuna.sk'
                                }
                            >
                                <RefreshCw
                                    size={13}
                                    className={`${isRefreshingOdds ? 'animate-spin text-amber-400' : refreshStatus === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}
                                />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. Collapsible Info Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg transition-all">
                <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-700/30 transition-all group"
                >
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                            <HelpCircle size={15} className="text-blue-400" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-white text-xs md:text-sm">Understanding our Dynamic Model</h4>
                            <p className="text-[10px] md:text-xs text-slate-400 hidden sm:block">How we calculate difficulty beyond FPL FDR</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline">{showInfo ? 'Close' : 'Details'}</span>
                        {showInfo ? <ChevronUp size={15} className="text-blue-400" /> : <ChevronDown size={15} className="text-blue-400" />}
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

            {activeTab === 'schedule' && renderSchedule()}
            {activeTab === 'planner' && renderPlanner()}
            {activeTab === 'reality' && (
                <FDRRealityAnalysis
                    fixtures={fixtures}
                    teams={teams}
                    players={players}
                    events={events}
                />
            )}
        </div>
    );
};

export default Fixtures;