import React, { useMemo } from 'react';
import { BootstrapStatic, FPLPlayer, FPLFixture } from '../types';
import { TrendingUp, Lightbulb, Shield, Target, ChevronRight } from 'lucide-react';

interface DashboardProps {
    data: BootstrapStatic;
    myTeam: FPLPlayer[];
    fixtures: FPLFixture[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, myTeam, fixtures }) => {

    // 1. Top 3 In-Form Players
    const topFormPlayers = useMemo(() => {
        return [...data.elements]
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, 3);
    }, [data.elements]);

    // 2. Hidden Gems (Form > 4.0, Ownership < 10%)
    const hiddenGems = useMemo(() => {
        return data.elements
            .filter(p => parseFloat(p.selected_by_percent) < 10.0)
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, 3);
    }, [data.elements]);

    // 3. Easy Fixtures (Target Fixtures for Next GW)
    const targetFixtures = useMemo(() => {
        const nextEvent = data.events.find(e => e.is_next);
        if (!nextEvent) return [];

        // Calculate Team Strengths dynamically (Sum of top 11 form)
        const teamStrength: Record<number, number> = {};
        data.teams.forEach(t => {
            const teamPlayers = data.elements
                .filter(p => p.team === t.id)
                .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
                .slice(0, 11);
            teamStrength[t.id] = teamPlayers.reduce((acc, p) => acc + parseFloat(p.form), 0);
        });

        // Filter upcoming fixtures
        const upcoming = fixtures.filter(f => f.event === nextEvent.id);

        // Find mismatches (High strength team vs Low strength opponent)
        const opportunities = upcoming.map(f => {
            const hStrength = teamStrength[f.team_h] || 0;
            const aStrength = teamStrength[f.team_a] || 0;
            const hName = data.teams.find(t => t.id === f.team_h)?.short_name;
            const aName = data.teams.find(t => t.id === f.team_a)?.short_name;

            // If Home is much stronger
            if (hStrength > aStrength + 15) {
                return { team: hName, opponent: aName, isHome: true, diff: hStrength - aStrength };
            }
            // If Away is much stronger
            if (aStrength > hStrength + 15) {
                return { team: aName, opponent: hName, isHome: false, diff: aStrength - hStrength };
            }
            return null;
        }).filter(Boolean);

        // Sort by biggest mismatch and take top 3
        // @ts-ignore
        return opportunities.sort((a, b) => b.diff - a.diff).slice(0, 3);

    }, [data, fixtures]);

    const nextEvent = data.events.find(e => e.is_next);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-purple-900 to-slate-900 p-8 rounded-2xl shadow-2xl border border-purple-500/20 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Welcome to FPL STUDIO</h1>
                    <p className="text-purple-200 text-lg max-w-2xl">
                        The ultimate portal for Fantasy Premier League statistics, team planning, and advanced analytics.
                    </p>

                    {nextEvent && (
                        <div className="mt-6 inline-flex items-center bg-slate-800/80 backdrop-blur px-4 py-2 rounded-lg border border-purple-500/50">
                            <span className="text-green-400 font-bold mr-2">NEXT DEADLINE:</span>
                            <span className="text-white">{nextEvent.name} - {new Date(nextEvent.deadline_time).toLocaleString()}</span>
                        </div>
                    )}
                </div>
                {/* Decorative background elements */}
                <div className="absolute -right-10 -top-10 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-20 w-32 h-32 bg-green-500/10 rounded-full blur-2xl"></div>
            </div>

            {/* Actionable Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Card 1: Easy Fixtures */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Target size={20} /></div>
                        <h3 className="text-slate-200 font-bold text-sm uppercase">Target Fixtures (Next GW)</h3>
                    </div>
                    <div className="flex-1 space-y-2">
                        {targetFixtures.length > 0 ? (
                            targetFixtures.map((fix: any, i: number) => (
                                <div key={i} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                    <div className="font-bold text-white">{fix.team}</div>
                                    <div className="text-xs text-slate-500">vs</div>
                                    <div className="text-sm text-slate-300">{fix.opponent} <span className="text-[10px] text-slate-500">({fix.isHome ? 'H' : 'A'})</span></div>
                                </div>
                            ))
                        ) : (
                            <div className="text-slate-500 text-sm italic">No clear easy fixtures this week.</div>
                        )}
                    </div>
                </div>

                {/* Card 2: In Form Trio */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><TrendingUp size={20} /></div>
                        <h3 className="text-slate-200 font-bold text-sm uppercase">In-Form Leaders</h3>
                    </div>
                    <div className="flex-1 space-y-2">
                        {topFormPlayers.map((p) => (
                            <div key={p.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                <div>
                                    <div className="font-bold text-white text-sm">{p.web_name}</div>
                                    <div className="text-[10px] text-slate-500">{data.teams.find(t => t.id === p.team)?.short_name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-green-400 font-bold text-sm">{p.form}</div>
                                    <div className="text-[9px] text-slate-500 uppercase">Form</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card 3: Hidden Gems */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400"><Lightbulb size={20} /></div>
                        <h3 className="text-slate-200 font-bold text-sm uppercase">Hidden Gems</h3>
                    </div>
                    <div className="flex-1 space-y-2">
                        {hiddenGems.map((p) => (
                            <div key={p.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                <div>
                                    <div className="font-bold text-white text-sm">{p.web_name}</div>
                                    <div className="text-[10px] text-slate-500">Own: {p.selected_by_percent}%</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-yellow-400 font-bold text-sm">{p.form}</div>
                                    <div className="text-[9px] text-slate-500 uppercase">Form</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Status Summary */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Shield className="w-5 h-5 text-purple-400" /> Current Team Form Status</h3>
                    {myTeam.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                            <p>No team built yet.</p>
                            <p className="text-sm mt-2">Go to the "My Team" tab to start building.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[...myTeam].sort((a, b) => parseFloat(b.form) - parseFloat(a.form)).slice(0, 5).map(p => (
                                <div key={p.id} className="flex justify-between items-center bg-slate-700/30 p-3 rounded hover:bg-slate-700/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-white">{p.web_name}</span>
                                        <span className="text-xs text-slate-500">{data.teams.find(t => t.id === p.team)?.short_name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="block text-green-400 font-bold text-sm">{p.form}</span>
                                            <span className="text-[9px] text-slate-500 uppercase">Form</span>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-600" />
                                    </div>
                                </div>
                            ))}
                            {myTeam.length > 5 && (
                                <div className="text-center pt-2">
                                    <span className="text-xs text-purple-400 cursor-pointer hover:text-purple-300">View full team...</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation Helper */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-bold mb-4 text-white">Quick Actions</h3>
                        <ul className="space-y-4 text-slate-300">
                            <li className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded transition-colors">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">1</span>
                                <span>Check <strong>Fixtures</strong> for FDR Planner.</span>
                            </li>
                            <li className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded transition-colors">
                                <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
                                <span>Analyze <strong>Detailed Stats</strong> for differentials.</span>
                            </li>
                            <li className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded transition-colors">
                                <span className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-bold">3</span>
                                <span>Use <strong>Transfer Picks</strong> algorithm.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;