import React, { useMemo, useState } from 'react';
import { BootstrapStatic, FPLPlayer, FPLFixture } from '../types';
import { TrendingUp, TrendingDown, Lightbulb, Zap, CalendarRange, ChevronRight, Trophy, BrainCircuit, Sparkles, Users, ArrowLeftRight } from 'lucide-react';
import { View } from '../App';
import { getDynamicDifficulty, calculateLeaguePositions } from '../lib/fdrModel';
import { TeamIcon } from './TeamIcon';

interface DashboardProps {
    data: BootstrapStatic;
    myTeam: FPLPlayer[];
    fixtures: FPLFixture[];
    onNavigate: (view: View, label: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, myTeam, fixtures, onNavigate }) => {
    const [swingTab, setSwingTab] = useState<'improving' | 'worsening'>('improving');

    const nextEvent = data.events.find(e => e.is_next);
    const positionMap = useMemo(() => calculateLeaguePositions(data.teams, fixtures), [data.teams, fixtures]);

    // 1. Fixture Swing Analysis (Schedule change over next 5 GWs)
    const fixtureSwing = useMemo(() => {
        if (!nextEvent) return null;

        const currentEventId = nextEvent.id;
        const next5Ids = Array.from({ length: 5 }, (_, i) => currentEventId + i);
        const last5Ids = Array.from({ length: 5 }, (_, i) => currentEventId - 5 + i).filter(id => id > 0);

        const swings = data.teams.map(team => {
            const getAvgFdr = (eventIds: number[]) => {
                const teamFixtures = fixtures.filter(f =>
                    eventIds.includes(f.event) && (f.team_h === team.id || f.team_a === team.id)
                );
                if (teamFixtures.length === 0) return 3;
                const scores = teamFixtures.map(f => {
                    const isHome = f.team_h === team.id;
                    const opponentId = isHome ? f.team_a : f.team_h;
                    return getDynamicDifficulty(opponentId, data.elements, positionMap, !isHome).score;
                });
                return scores.reduce((a, b) => a + b, 0) / scores.length;
            };

            const avgNext5 = getAvgFdr(next5Ids);
            const avgLast5 = getAvgFdr(last5Ids);
            const swing = avgLast5 - avgNext5; // Positive means improving (easier), negative means worsening

            const next5 = next5Ids.map(id => {
                const f = fixtures.find(fix => fix.event === id && (fix.team_h === team.id || fix.team_a === team.id));
                if (!f) return { bg: 'bg-slate-700', border: 'border-slate-600', label: 'Blank' };
                const isHome = f.team_h === team.id;
                const oppId = isHome ? f.team_a : f.team_h;
                return getDynamicDifficulty(oppId, data.elements, positionMap, !isHome);
            });

            return { team, swing, avgNext5, next5 };
        });

        const improving = [...swings]
            .sort((a, b) => b.swing - a.swing)
            .slice(0, 5);

        const worsening = [...swings]
            .sort((a, b) => a.swing - b.swing)
            .slice(0, 5);

        return { improving, worsening };
    }, [data.teams, fixtures, data.elements, nextEvent, positionMap]);

    // 2. Hidden Gems (Form > 4.0, Ownership < 10%)
    const hiddenGems = useMemo(() => {
        return data.elements
            .filter(p => parseFloat(p.selected_by_percent) < 10.0 && parseFloat(p.form) > 4.0)
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, 5);
    }, [data.elements]);

    // 3. Easy Fixtures (Optimized for visualization)
    const targetFixtures = useMemo(() => {
        if (!nextEvent) return [];
        const upcoming = fixtures.filter(f => f.event === nextEvent.id);

        return upcoming.map(f => {
            const hName = data.teams.find(t => t.id === f.team_h)?.short_name || 'UNK';
            const aName = data.teams.find(t => t.id === f.team_a)?.short_name || 'UNK';
            const hDiff = getDynamicDifficulty(f.team_a, data.elements, positionMap, false);
            const aDiff = getDynamicDifficulty(f.team_h, data.elements, positionMap, true);

            return [
                { team: hName, opponent: aName, isHome: true, difficulty: hDiff },
                { team: aName, opponent: hName, isHome: false, difficulty: aDiff }
            ];
        }).flat()
            .sort((a, b) => a.difficulty.score - b.difficulty.score)
            .slice(0, 6);
    }, [fixtures, nextEvent, data.elements, data.teams, positionMap]);

    // 4. In-Form Leaders
    const topFormPlayers = useMemo(() => {
        return [...data.elements]
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, 5);
    }, [data.elements]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">

            {/* Hero Banner (Compact) */}
            <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900 px-6 py-5 rounded-2xl shadow-xl border border-purple-500/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Welcome to FPL STUDIO</h2>
                        <p className="text-purple-200/80 text-xs md:text-sm max-w-xl">
                            The ultimate portal for Fantasy Premier League statistics, team planning, and advanced analytics.
                        </p>
                    </div>

                    {nextEvent && (
                        <div className="inline-flex items-center bg-slate-800/80 backdrop-blur px-3.5 py-1.5 rounded-lg border border-purple-500/40 shrink-0 self-start md:self-center">
                            <span className="text-emerald-400 font-black text-xs mr-2">NEXT DEADLINE:</span>
                            <span className="text-white text-xs font-mono font-semibold">{nextEvent.name} - {new Date(nextEvent.deadline_time).toLocaleString()}</span>
                        </div>
                    )}
                </div>
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-600/10 rounded-full blur-2xl pointer-events-none"></div>
            </div>

            {/* AI GW Preview Banner */}
            <a
                href="/scout"
                className="group relative overflow-hidden bg-slate-900 border border-purple-500/30 rounded-2xl p-5 hover:bg-slate-800/90 transition-all shadow-xl hover:shadow-purple-500/10 flex items-center justify-between gap-4"
            >
                <div className="relative z-10 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400 shrink-0">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-black text-lg tracking-tight">AI GW Preview</span>
                            <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-black rounded-full animate-pulse">NEW</span>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                            Get AI-generated gameweek reports, differential picks, and captaincy advice.
                        </p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-purple-400 font-bold text-xs group-hover:translate-x-1 transition-transform shrink-0">
                    <span>Open Scout</span>
                    <ChevronRight size={16} />
                </div>
            </a>

            <div className="grid grid-cols-12 gap-6">
                {/* Row 1: Target Fixtures (8) + In Form Leaders (4) */}
                <div className="col-span-12 lg:col-span-8">
                    {/* Easy Fixtures */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Zap size={20} /></div>
                            <h3 className="text-slate-200 font-bold text-sm uppercase">Fixtures to Target (Next GW)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {targetFixtures.length > 0 ? (
                                targetFixtures.map((fix, i) => (
                                    <div key={i} className="flex flex-col justify-between bg-slate-900/50 p-4 rounded border border-slate-700/50 hover:bg-slate-900/80 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex flex-col">
                                                <div className="font-black text-white text-lg">{fix.team}</div>
                                                <div className="text-[11px] text-slate-500">v {fix.opponent} ({fix.isHome ? 'H' : 'A'})</div>
                                            </div>
                                            <TeamIcon code={fix.team} alt={fix.team} size={32} />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider">
                                                <span className="text-slate-500">Difficulty</span>
                                                <span className={fix.difficulty.score <= 2 ? 'text-emerald-400' : 'text-slate-300'}>{fix.difficulty.label}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${fix.difficulty.bg}`}
                                                    style={{ width: `${(6 - fix.difficulty.score) * 20}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full text-slate-500 text-sm italic py-4 text-center">No clear easy fixtures for the next gameweek.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4">
                    {/* In Form Trio */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><TrendingUp size={20} /></div>
                                <h3 className="text-slate-200 font-bold text-sm uppercase">In-Form Leaders</h3>
                            </div>
                        </div>
                        <div className="flex-1 space-y-3">
                            {topFormPlayers.map((p) => (
                                <div key={p.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded border border-slate-700/50 hover:bg-slate-900/80 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="font-bold text-white text-sm">{p.web_name}</div>
                                            <div className="text-[10px] text-slate-500 lowercase first-letter:uppercase">{data.teams.find(t => t.id === p.team)?.short_name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-400 font-bold text-sm tracking-tight">{p.form}</div>
                                        <div className="text-[9px] text-slate-500 uppercase">Form</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2: Fixture Swing (8) + Hidden Gems (4) */}
                <div className="col-span-12 lg:col-span-8">
                    {fixtureSwing && (
                        <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-slate-700 h-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <CalendarRange className="w-5 h-5 text-blue-400" /> <span className="hidden sm:inline">Fixture Swing (Next 5 GWs)</span><span className="sm:hidden">Fixture Swing</span>
                                </h3>

                                {/* Mobile/Tablet Toggle */}
                                <div className="lg:hidden flex bg-slate-900 p-1 rounded-lg border border-slate-700 w-full sm:w-auto">
                                    <button
                                        onClick={() => setSwingTab('improving')}
                                        className={`flex-1 sm:px-4 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${swingTab === 'improving' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <TrendingUp size={12} /> Improving
                                    </button>
                                    <button
                                        onClick={() => setSwingTab('worsening')}
                                        className={`flex-1 sm:px-4 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${swingTab === 'worsening' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <TrendingDown size={12} /> Worsening
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Improving List */}
                                <div className={`${swingTab === 'improving' ? 'block' : 'hidden'} lg:block`}>
                                    <h4 className="hidden lg:flex text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 items-center gap-2">
                                        <TrendingUp size={14} /> Improving Schedule
                                    </h4>
                                    <div className="space-y-3">
                                        {fixtureSwing.improving.map(item => (
                                            <div key={item.team.id} className="bg-slate-900/50 p-2.5 lg:p-4 rounded border border-slate-700/50 hover:bg-slate-900/80 transition-colors">
                                                <div className="flex justify-between items-center mb-2 lg:mb-0">
                                                    <div className="flex items-center gap-2.5 lg:gap-3">
                                                        <div className="lg:hidden"><TeamIcon code={item.team.short_name} alt={item.team.name} size={20} /></div>
                                                        <div className="hidden lg:block"><TeamIcon code={item.team.short_name} alt={item.team.name} size={24} /></div>
                                                        <div className="font-bold text-white text-sm lg:min-w-[40px] lowercase first-letter:uppercase lg:normal-case">{item.team.short_name}</div>
                                                    </div>
                                                    <div className={`text-sm font-black lg:hidden text-emerald-400`}>
                                                        {item.swing >= 0 ? '+' : ''}{item.swing.toFixed(1)}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between lg:justify-end gap-3 lg:gap-4">
                                                    <div className="flex flex-1 lg:flex-none gap-1">
                                                        {item.next5.map((d, i) => (
                                                            <div key={i} className={`w-7 lg:w-3.5 h-3 lg:h-3.5 rounded-[4px] ${d.bg} border ${d.border}`} title={d.label}></div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-baseline lg:items-end flex-col lg:min-w-[70px] text-right">
                                                        <div className="text-white font-bold text-[10px] lg:text-xs">
                                                            {item.avgNext5.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">avg</span>
                                                        </div>
                                                        <div className={`hidden lg:block text-[10px] text-emerald-400 font-black`}>
                                                            {item.swing >= 0 ? '+' : ''}{item.swing.toFixed(1)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Worsening List */}
                                <div className={`${swingTab === 'worsening' ? 'block' : 'hidden'} lg:block`}>
                                    <h4 className="hidden lg:flex text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4 items-center gap-2">
                                        <TrendingDown size={14} /> Worsening Schedule
                                    </h4>
                                    <div className="space-y-3">
                                        {fixtureSwing.worsening.map(item => (
                                            <div key={item.team.id} className="bg-slate-900/50 p-2.5 lg:p-4 rounded border border-slate-700/50 hover:bg-slate-900/80 transition-colors">
                                                <div className="flex justify-between items-center mb-2 lg:mb-0">
                                                    <div className="flex items-center gap-2.5 lg:gap-3">
                                                        <div className="lg:hidden"><TeamIcon code={item.team.short_name} alt={item.team.name} size={20} /></div>
                                                        <div className="hidden lg:block"><TeamIcon code={item.team.short_name} alt={item.team.name} size={24} /></div>
                                                        <div className="font-bold text-white text-sm lg:min-w-[40px] lowercase first-letter:uppercase lg:normal-case">{item.team.short_name}</div>
                                                    </div>
                                                    <div className={`text-sm font-black lg:hidden text-red-400`}>
                                                        {item.swing >= 0 ? '+' : ''}{item.swing.toFixed(1)}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between lg:justify-end gap-3 lg:gap-4">
                                                    <div className="flex flex-1 lg:flex-none gap-1">
                                                        {item.next5.map((d, i) => (
                                                            <div key={i} className={`w-7 lg:w-3.5 h-3 lg:h-3.5 rounded-[4px] ${d.bg} border ${d.border}`} title={d.label}></div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-baseline lg:items-end flex-col lg:min-w-[70px] text-right">
                                                        <div className="text-white font-bold text-[10px] lg:text-xs">
                                                            {item.avgNext5.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">avg</span>
                                                        </div>
                                                        <div className={`hidden lg:block text-[10px] text-red-400 font-black`}>
                                                            {item.swing >= 0 ? '+' : ''}{item.swing.toFixed(1)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="col-span-12 lg:col-span-4">
                    {/* Hidden Gems */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400"><Lightbulb size={20} /></div>
                            <h3 className="text-slate-200 font-bold text-sm uppercase">Hidden Gems</h3>
                        </div>
                        <div className="flex-1 space-y-3">
                            {hiddenGems.length > 0 ? hiddenGems.map((p) => (
                                <div key={p.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded border border-slate-700/50 hover:bg-slate-900/80 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-white text-sm">{p.web_name}</div>
                                        <div className="text-[10px] text-slate-500 lowercase first-letter:uppercase">{data.teams.find(t => t.id === p.team)?.short_name}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-yellow-400 font-bold text-sm tracking-tight">{p.form}</div>
                                        <div className="text-[9px] text-slate-500 uppercase">Form</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-slate-500 text-sm italic py-4 text-center">No gems found (Form {'>'} 4.0).</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;