import React, { useMemo, useState } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import { ArrowLeftRight, TrendingUp, Calendar, DollarSign, Filter, Info, ChevronDown, ChevronUp, Calculator, Activity, HelpCircle, ArrowUpDown, Clock, Users, ChevronRight } from 'lucide-react';
import ResultChip from './ResultChip';
import { calculateLeaguePositions, getDynamicDifficulty } from '../lib/fdrModel';
import { computeTransferIndexForPlayers, TransferIndexResult } from '../lib/transferIndex';

interface TransferPicksProps {
    players: FPLPlayer[];
    teams: FPLTeam[];
    fixtures: FPLFixture[];
    events: FPLEvent[];
}

interface PlayerTransferStats extends FPLPlayer {
    transferIndex: number; // 0.00 - 1.00
    fixtureDifficultySum: number; // Lower is better
    nextFixtures: { event: number; opponent: number; difficulty: number; isHome: boolean }[];
    eoFormRatio: number;
    eoPtsRatio: number;
}

const TransferPicks: React.FC<TransferPicksProps> = ({ players, teams, fixtures, events }) => {
    const [activePos, setActivePos] = useState<number>(1); // Default GKP
    const [showInfo, setShowInfo] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'transferIndex',
        direction: 'desc'
    });
    const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);

    const getTeamShort = (id: number) => teams.find(t => t.id === id)?.short_name || "-";

    const getDifficultyColor = (score: number) => {
        switch (score) {
            case 1: return "bg-green-600 text-white border-green-700"; // Easy
            case 2: return "bg-green-500 text-white border-green-600"; // Good
            case 3: return "bg-slate-500 text-white border-slate-600"; // Moderate
            case 4: return "bg-orange-500 text-white border-orange-600"; // Hard
            case 5: return "bg-red-600 text-white border-red-700"; // Very Hard
            case 6: return "bg-slate-900 text-slate-500 border-slate-800"; // Blank
            default: return "bg-slate-800";
        }
    };

    // 2. Process Players & Calculate Index
    const processedPlayers = useMemo(() => {
        return computeTransferIndexForPlayers({
            players,
            fixtures,
            teams,
            events,
            lookahead: 5
        });
    }, [players, fixtures, teams, events]);


    // 3. Sorting & Filtering
    const displayPlayers = useMemo(() => {
        let filtered = processedPlayers.filter(p => p.element_type === activePos);

        return filtered.sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof PlayerTransferStats];
            let valB: any = b[sortConfig.key as keyof PlayerTransferStats];

            // Special sorting for specific columns
            if (sortConfig.key === 'form' || sortConfig.key === 'selected_by_percent') {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            }
            if (sortConfig.key === 'now_cost') {
                valA = a.now_cost;
                valB = b.now_cost;
            }
            // Sort by specific Gameweek Difficulty
            if (sortConfig.key.startsWith('GW')) {
                const gwId = parseInt(sortConfig.key.replace('GW', ''));
                valA = a.nextFixtures.find(f => f.event === gwId)?.difficulty || 6;
                valB = b.nextFixtures.find(f => f.event === gwId)?.difficulty || 6;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }).slice(0, 25);
    }, [processedPlayers, activePos, sortConfig]);

    const mobilePlayers = useMemo(() => {
        return processedPlayers
            .filter(p => p.element_type === activePos)
            .sort((a, b) => b.transferIndex - a.transferIndex)
            .slice(0, 10);
    }, [processedPlayers, activePos]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Get next 5 GW headers
    const nextEvent = events.find(e => e.is_next) || events[0];
    const gwHeaders = Array.from({ length: 5 }, (_, i) => nextEvent.id + i).filter(id => id <= 38);

    // Sorting Header Component
    const SortHeader: React.FC<{ label: string, sortKey: string, align?: "left" | "right" | "center", className?: string }> = ({ label, sortKey, align = "left", className = "" }) => {
        const isActive = sortConfig.key === sortKey;
        return (
            <th
                className={`p-4 cursor-pointer hover:text-white transition-colors group select-none ${className} text-${align}`}
                onClick={() => handleSort(sortKey)}
            >
                <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
                    {label}
                    {isActive ? (
                        sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-blue-400" /> : <ChevronDown size={14} className="text-blue-400" />
                    ) : (
                        <ArrowUpDown size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </th>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div
                    className="cursor-pointer select-none group"
                    onClick={() => setShowInfo(!showInfo)}
                >
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <h2 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <ArrowLeftRight className="text-blue-400 shrink-0" /> Transfer Algorithm Picks
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                                Transfer Index ranks players using 50% current form and 50% upcoming fixture ease.
                            </p>
                        </div>
                        <div className="mt-2 shrink-0 bg-slate-700/50 p-1.5 rounded-lg group-hover:bg-slate-700 transition-colors">
                            {showInfo ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
                        </div>
                    </div>
                </div>

                {/* Info / Legend Dropdown */}
                {showInfo && (
                    <div className="mt-6 pt-6 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">

                            {/* The Algo */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                                    The Algorithm
                                </h4>
                                <p className="text-slate-300 leading-relaxed text-xs">
                                    Transfer Index (0–100) identifies players by weighting recent performance against schedule difficulty.
                                </p>
                                <div className="flex gap-2 text-[10px] text-slate-400">
                                    <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">50% Form</span>
                                    <span className="flex items-center">+</span>
                                    <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">50% Fixtures</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Dynamic Fixture Difficulty is a custom model that adjusts based on team strength and performance trends, differing from the official FPL FDR.
                                </p>
                            </div>

                            {/* Table Metrics */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                                    Key Metrics
                                </h4>
                                <div className="space-y-3 text-xs">
                                    <div className="space-y-1">
                                        <p className="text-slate-300 font-medium">Form</p>
                                        <p className="text-slate-500">Average points per match over the last 30 days.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-300 font-medium">Diff Score</p>
                                        <p className="text-slate-500">Upcoming fixture difficulty sum. Blanks are penalised as 6 points.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Colors */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                                    Difficulty Legend
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-white text-center">
                                    <div className="bg-green-600 rounded py-1.5 border border-green-700/50">Easy (1)</div>
                                    <div className="bg-green-500 rounded py-1.5 border border-green-600/50">Good (2)</div>
                                    <div className="bg-slate-600 rounded py-1.5 border border-slate-700/50">Moderate (3)</div>
                                    <div className="bg-orange-600 rounded py-1.5 border border-orange-700/50">Hard (4)</div>
                                    <div className="bg-red-600 rounded py-1.5 border border-red-700/50 col-span-2">Very Hard (5)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>


            {/* Tabs */}
            <div className="grid grid-cols-4 md:flex gap-2 pb-2">
                {[1, 2, 3, 4].map(pos => (
                    <button
                        key={pos}
                        onClick={() => {
                            setActivePos(pos);
                            setExpandedPlayerId(null);
                        }}
                        className={`px-2 md:px-6 py-3 rounded-lg font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${activePos === pos ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    >
                        {pos === 1 && "GKP"}
                        {pos === 2 && "DEF"}
                        {pos === 3 && "MID"}
                        {pos === 4 && "FWD"}
                    </button>
                ))}
            </div>

            {/* Mobile View (Standard Cards) */}
            <div className="md:hidden space-y-3">
                {mobilePlayers.map((p, idx) => {
                    const isExpanded = expandedPlayerId === p.id;
                    const diffScore = p.fixtureDifficultySum;
                    const ease = 1 - ((diffScore - 5) / 25);
                    const diffWidth = Math.max(0, Math.min(1, ease)) * 100;

                    return (
                        <div
                            key={p.id}
                            className={`bg-slate-800 border ${isExpanded ? 'border-blue-500/50' : 'border-slate-700'} rounded-xl overflow-hidden transition-all`}
                        >
                            {/* Card Header (Clickable) */}
                            <div
                                onClick={() => setExpandedPlayerId(isExpanded ? null : p.id)}
                                className="px-3 py-2 cursor-pointer active:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-[10px] text-slate-500 font-mono font-bold">#{idx + 1}</span>
                                            <span className="font-bold text-white text-sm truncate">{p.web_name}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded-md font-bold border border-green-500/20 leading-none">{p.form}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 leading-none">
                                            <span className="truncate">{getTeamShort(p.team)}</span>
                                            <span className="text-slate-600">|</span>
                                            <span>£{p.now_cost / 10}</span>
                                        </div>
                                    </div>
                                    <div className="text-right pl-2 shrink-0">
                                        <div className="text-blue-400 font-black text-xl leading-none">
                                            {Math.round(p.transferIndex * 100)}
                                        </div>
                                        <div className="text-[8px] text-slate-500 uppercase tracking-tighter">INDEX</div>
                                    </div>
                                </div>

                                {/* Metrics & Fixtures Grid */}
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                        {/* Transfer Index Bar */}
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500">
                                                <span className="truncate mr-1">TRANSFER INDEX</span>
                                                <span className="text-blue-400">{Math.round(p.transferIndex * 100)}</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${p.transferIndex > 0.7 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${p.transferIndex * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        {/* Diff Score Bar */}
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500">
                                                <span>Diff</span>
                                                <span className="text-purple-500">{diffScore}</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500"
                                                    style={{ width: `${diffWidth}%` }}
                                                />
                                            </div>
                                        </div>
                                        {/* Ownership Bar */}
                                        <div className="space-y-0.5 col-span-2">
                                            <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500">
                                                <span>Ownership</span>
                                                <span className="text-slate-300 font-mono">{p.selected_by_percent}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-slate-500"
                                                    style={{ width: `${Math.min(parseFloat(p.selected_by_percent), 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fixtures Timeline */}
                                    <div className="space-y-1">
                                        <div className="flex gap-0.5 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                                            {p.nextFixtures.slice(0, 5).map((f, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 ${getDifficultyColor(f.difficulty)}`}
                                                    title={f.opponent === 0 ? "BLANK" : `GW${f.event} vs ${getTeamShort(f.opponent)}`}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex justify-center -mt-0.5">
                                            {isExpanded ? <ChevronUp size={10} className="text-slate-600" /> : <ChevronDown size={10} className="text-slate-600" />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pt-4 border-t border-slate-700/50 bg-slate-900/30 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm mb-4">
                                        {(p as any).minutes !== undefined && (
                                            <div className="flex justify-between items-center text-slate-400 col-span-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/30">
                                                <span className="flex items-center gap-1.5"><Clock size={14} className="text-blue-400" /> Season Minutes</span>
                                                <span className="text-white font-bold">{(p as any).minutes}</span>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-1 bg-slate-800/30 p-2.5 rounded-lg border border-slate-700/20">
                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                Risk vs Form <HelpCircle size={8} />
                                            </span>
                                            <span className="text-xs font-mono text-blue-300">{p.eoFormRatio.toFixed(1)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 bg-slate-800/30 p-2.5 rounded-lg border border-slate-700/20">
                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                Risk vs Output <HelpCircle size={8} />
                                            </span>
                                            <span className="text-xs font-mono text-blue-300">{p.eoPtsRatio.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Detailed Fixtures List */}
                                    <div className="mt-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <Calendar size={12} className="text-purple-400" /> Upcoming Fixtures
                                        </p>
                                        <div className="space-y-0.5">
                                            {p.nextFixtures.slice(0, 5).map((f, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs py-0 border-b border-slate-800/50 last:border-0">
                                                    <span className={`font-medium ${f.difficulty <= 2 ? 'text-green-400' : f.difficulty >= 4 ? 'text-orange-400' : 'text-slate-300'}`}>
                                                        GW{f.event} vs {f.opponent === 0 ? 'BLANK' : getTeamShort(f.opponent)} ({f.opponent === 0 ? '-' : (f.isHome ? 'H' : 'A')})
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-500 font-mono uppercase">Diff</span>
                                                        <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${getDifficultyColor(f.difficulty)}`}>
                                                            {f.difficulty}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Main Table (Desktop Only) */}
            <div className="hidden md:block bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                                <th className="p-4 w-12 text-center">#</th>
                                <SortHeader label="Player" sortKey="web_name" className="w-64" />
                                <SortHeader label="Transfer Index" sortKey="transferIndex" className="w-36" />
                                <SortHeader label="Price" sortKey="now_cost" align="right" />
                                <SortHeader label="Ownership" sortKey="selected_by_percent" align="right" />
                                <SortHeader label="Form" sortKey="form" align="right" />

                                {gwHeaders.map(gw => (
                                    <SortHeader key={gw} label={`GW${gw}`} sortKey={`GW${gw}`} align="center" className="w-16" />
                                ))}

                                <SortHeader label="Diff Score" sortKey="fixtureDifficultySum" align="center" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-sm">
                            {displayPlayers.map((p, idx) => {
                                const isTopPick = idx < 3;
                                return (
                                    <tr
                                        key={p.id}
                                        className={`hover:bg-slate-700/30 transition-all group relative ${isTopPick ? 'bg-emerald-500/5 border-l-2 border-emerald-500/50' : ''
                                            }`}
                                    >
                                        <td className="p-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-white">{p.web_name}</div>
                                            <div className="text-xs text-slate-500">{getTeamShort(p.team)}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 ml-3">
                                                <span
                                                    className={`font-bold font-mono text-base ${p.transferIndex > 0.7 ? 'text-green-400' : p.transferIndex > 0.5 ? 'text-blue-400' : 'text-slate-400'}`}
                                                    title="Transfer Index is a combined score of recent form and fixture difficulty. Higher = better. 60 = above average."
                                                >
                                                    {Math.round(p.transferIndex * 100)}
                                                </span>
                                                {/* Progress Bar */}
                                                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${p.transferIndex > 0.7 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${p.transferIndex * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-blue-300">£{p.now_cost / 10}</td>
                                        <td className="p-4 text-right font-mono text-slate-300">{p.selected_by_percent}%</td>
                                        <td className="p-4 text-right font-bold text-white">{p.form}</td>

                                        {/* Fixture Cells */}
                                        {gwHeaders.map(gw => {
                                            const fix = p.nextFixtures.find(f => f.event === gw);
                                            if (!fix || fix.opponent === 0) return <td key={gw} className="p-1"><div className="w-full h-8 bg-slate-800 rounded flex items-center justify-center text-[10px] text-slate-600">-</div></td>;

                                            const oppShort = getTeamShort(fix.opponent);
                                            const colorClass = getDifficultyColor(fix.difficulty);

                                            return (
                                                <td key={gw} className="p-1">
                                                    <div className={`w-full h-8 md:h-9 rounded border-b-2 flex flex-col items-center justify-center shadow-sm ${colorClass}`}>
                                                        <span className="text-[10px] font-bold leading-none">{oppShort}</span>
                                                        <span className="text-[9px] opacity-80 leading-none">({fix.isHome ? 'H' : 'A'})</span>
                                                    </div>
                                                </td>
                                            )
                                        })}

                                        <td className="p-4 text-center">
                                            <span className="font-mono text-slate-400">{p.fixtureDifficultySum}</span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DIFF SCORE Legend */}
            <div className="mt-4 px-2">
                <p className="text-xs text-slate-400 italic">
                    <span className="font-bold text-slate-300">Diff Score</span> = sum of Dynamic FDR (1–5) for the next 5 Gameweeks. Lower is better. Blank GWs count as 6 (worse than Very Hard).
                </p>
            </div>

        </div>
    );
};

export default TransferPicks;