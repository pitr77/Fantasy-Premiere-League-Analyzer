import React, { useState, useEffect, useMemo } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import { supabase } from '../lib/supabaseClient';
import { TeamIcon } from './TeamIcon';
import { getDynamicDifficulty, calculateLeaguePositions } from '../lib/fdrModel';
import { CircleUserRound, Shield, Zap, Search, X, Loader2, Trophy, ArrowRight } from 'lucide-react';

interface MiniChallengeProps {
    players: FPLPlayer[];
    teams: FPLTeam[];
    events: FPLEvent[];
    fixtures: FPLFixture[];
}

export default function MiniChallenge({ players, teams, events, fixtures }: MiniChallengeProps) {
    const [gkId, setGkId] = useState<number | null>(null);
    const [defId, setDefId] = useState<number | null>(null);
    const [midId, setMidId] = useState<number | null>(null);
    const [fwdId, setFwdId] = useState<number | null>(null);
    const [captainId, setCaptainId] = useState<number | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [selectorPos, setSelectorPos] = useState<'G' | 'D' | 'M' | 'F' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const nextEvent = events.find(e => e.is_next);
    const eventId = nextEvent?.id;
    const deadline = nextEvent?.deadline_time;

    const isLocked = nextEvent ? new Date() > new Date(nextEvent.deadline_time) : true;

    const leaguePositions = useMemo(() => calculateLeaguePositions(teams, fixtures), [teams, fixtures]);

    useEffect(() => {
        async function loadPicks() {
            if (!eventId) {
                setIsLoading(false);
                return;
            }
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (!authData?.user) {
                    setIsLoading(false);
                    return;
                }

                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token;

                const res = await fetch(`/api/challenge?gw=${eventId}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (!res.ok) throw new Error('Failed to load picks');
                const { picks } = await res.json();

                if (picks) {
                    setGkId(picks.gk_id);
                    setDefId(picks.def_id);
                    setMidId(picks.mid_id);
                    setFwdId(picks.fwd_id);
                    setCaptainId(picks.captain_id);
                }
            } catch (err: any) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        loadPicks();
    }, [eventId]);

    const handleSave = async () => {
        if (!eventId || !gkId || !defId || !midId || !fwdId || !captainId) {
            setError('Please select all 4 players and a captain.');
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccessMsg(null);

        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
            setError('You must be logged in to save picks.');
            setIsSaving(false);
            return;
        }

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            const payload = { gameweek: eventId, gk_id: gkId, def_id: defId, mid_id: midId, fwd_id: fwdId, captain_id: captainId };
            const res = await fetch(`/api/challenge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to save picks');

            setSuccessMsg('Your picks have been saved successfully! Good luck!');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const openSelector = (posType: number) => {
        if (isLocked) return;
        const posMap: Record<number, 'G' | 'D' | 'M' | 'F'> = { 1: 'G', 2: 'D', 3: 'M', 4: 'F' };
        setSelectorPos(posMap[posType]);
        setSearchQuery('');
    };

    const getPlayerDetails = (id: number | null) => {
        if (!id) return null;
        const p = players.find(x => x.id === id);
        if (!p) return null;
        const t = teams.find(x => x.id === p.team);

        // Get next fixture diff
        const nextMatch = fixtures.find(f => !f.finished && f.event === eventId && (f.team_h === p.team || f.team_a === p.team));
        let diff = 3;
        let opponentId = 0;
        let isHome = false;
        if (nextMatch) {
            isHome = nextMatch.team_h === p.team;
            opponentId = isHome ? nextMatch.team_a : nextMatch.team_h;
            diff = getDynamicDifficulty(opponentId, players, leaguePositions, !isHome).score;
        }

        return { player: p, team: t, diff, opp: teams.find(x => x.id === opponentId)?.short_name, isHome };
    };

    const filteredPlayers = useMemo(() => {
        if (!selectorPos) return [];
        let posFilter = 1;
        if (selectorPos === 'D') posFilter = 2;
        if (selectorPos === 'M') posFilter = 3;
        if (selectorPos === 'F') posFilter = 4;

        return players
            .filter(p => p.element_type === posFilter)
            .filter(p => p.web_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, 50); // Top 50 by form
    }, [players, selectorPos, searchQuery]);

    const handleSelectPlayer = (id: number) => {
        if (selectorPos === 'G') setGkId(id);
        if (selectorPos === 'D') setDefId(id);
        if (selectorPos === 'M') setMidId(id);
        if (selectorPos === 'F') setFwdId(id);

        // Auto-clear captain if that player was captain
        if (captainId === gkId && selectorPos === 'G') setCaptainId(null);
        if (captainId === defId && selectorPos === 'D') setCaptainId(null);
        if (captainId === midId && selectorPos === 'M') setCaptainId(null);
        if (captainId === fwdId && selectorPos === 'F') setCaptainId(null);

        setSelectorPos(null);
    };

    const handleToggleCaptain = (id: number) => {
        if (isLocked) return;
        setCaptainId(prev => prev === id ? null : id);
    };

    const renderSlot = (title: string, posType: number, id: number | null) => {
        const data = getPlayerDetails(id);

        const diffColor = (d: number) => {
            if (d === 1) return 'bg-emerald-500 text-white';
            if (d === 2) return 'bg-green-500 text-white';
            if (d === 3) return 'bg-slate-500 text-white';
            if (d === 4) return 'bg-orange-500 text-white';
            return 'bg-red-500 text-white';
        };

        return (
            <div className="flex flex-col items-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{title}</div>

                {data ? (
                    <div className="relative group w-40 flex flex-col items-center">
                        {/* Captain Badge */}
                        {captainId === id && (
                            <div className="absolute -top-3 -right-3 z-10 bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shadow-lg shadow-amber-500/50 border-2 border-slate-900">
                                C
                            </div>
                        )}

                        {/* Player Card */}
                        <button
                            onClick={() => openSelector(posType)}
                            className={`w-full bg-slate-800 rounded-2xl p-4 border-2 transition-all shadow-xl
                ${captainId === id ? 'border-amber-500 shadow-amber-500/20' : 'border-slate-700 hover:border-purple-500 hover:shadow-purple-500/20'}
                ${isLocked && 'cursor-default opacity-80'}
              `}
                        >
                            <div className="w-16 h-16 mx-auto bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
                                <TeamIcon code={data.team?.short_name || ''} alt={data.team?.name || ''} size={40} />
                            </div>

                            <div className="text-center">
                                <div className="font-bold text-white text-base truncate mb-1">{data.player.web_name}</div>
                                <div className="text-xs text-slate-400 capitalize">{data.team?.short_name}</div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                                <div className="text-xs text-slate-500 font-medium">vs {data.opp} {data.isHome ? '(H)' : '(A)'}</div>
                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${diffColor(data.diff)}`}>
                                    FDR {data.diff}
                                </div>
                            </div>
                        </button>

                        {/* Action */}
                        {!isLocked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleToggleCaptain(id); }}
                                className={`mt-4 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${captainId === id ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700'}`}
                            >
                                {captainId === id ? 'Remove Captain' : 'Make Captain'}
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => openSelector(posType)}
                        className="w-40 h-[190px] border-2 border-dashed border-slate-700 bg-slate-800/50 hover:bg-slate-800 rounded-2xl flex flex-col items-center justify-center transition-colors group"
                    >
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-3 group-hover:bg-purple-600/20 group-hover:text-purple-400 text-slate-500 transition-colors">
                            <CircleUserRound size={24} />
                        </div>
                        <span className="text-sm font-bold text-slate-400 group-hover:text-white">Add Player</span>
                    </button>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    const isComplete = gkId && defId && midId && fwdId && captainId;

    return (
        <div className="max-w-5xl mx-auto space-y-6 lg:space-y-8">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/20 blur-[100px] rounded-full pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-purple-500/20 p-2.5 rounded-xl border border-purple-500/30 text-purple-400">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">5-a-side Challenge</h1>
                                <p className="text-slate-400 text-sm mt-1">Pick 4 players + 1 Captain to compete.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-6">
                            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
                                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Gameweek</span>
                                <span className="text-lg font-black text-white">{eventId || '?'}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
                                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Deadline</span>
                                <span className="text-sm font-semibold text-white">
                                    {deadline ? new Date(deadline).toLocaleString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                                </span>
                            </div>
                            {isLocked && (
                                <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                    <Shield size={16} /> Locked
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0">
                        {!isLocked && (
                            <button
                                onClick={handleSave}
                                disabled={!isComplete || isSaving}
                                className={`flex items-center justify-center gap-2 w-full md:w-auto px-8 py-4 rounded-2xl font-black transition-all shadow-xl
                  ${isComplete && !isSaving
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 active:scale-95'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border-2 border-slate-700'
                                    }`}
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap size={20} />}
                                {isSaving ? 'Saving...' : 'Lock in Picks'}
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm font-medium">
                        {successMsg}
                    </div>
                )}
            </div>

            {/* The Pitch */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-12 relative overflow-hidden">
                {/* Background pitch design */}
                <div className="absolute inset-x-8 inset-y-8 border-2 border-white/5 rounded-[40px] pointer-events-none" />
                <div className="absolute left-1/2 -top-20 w-80 h-40 border-2 border-white/5 rounded-full -translate-x-1/2 pointer-events-none" />
                <div className="absolute left-1/2 -bottom-20 w-80 h-40 border-2 border-white/5 rounded-full -translate-x-1/2 pointer-events-none" />
                <div className="absolute top-1/2 left-8 right-8 h-px bg-white/5 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 w-40 h-40 border-2 border-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-8 gap-y-16 lg:gap-x-16 pt-8 pb-12">
                    {renderSlot('Goalkeeper', 1, gkId)}
                    {renderSlot('Defender', 2, defId)}
                    {renderSlot('Midfielder', 3, midId)}
                    {renderSlot('Forward', 4, fwdId)}
                </div>
            </div>

            {/* Selector Modal */}
            {selectorPos && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectorPos(null)} />

                    <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
                            <h3 className="text-xl font-black text-white">
                                Select {selectorPos === 'G' ? 'Goalkeeper' : selectorPos === 'D' ? 'Defender' : selectorPos === 'M' ? 'Midfielder' : 'Forward'}
                            </h3>
                            <button onClick={() => setSelectorPos(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 border-b border-slate-800 shrink-0 bg-slate-900/50">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search players by name..."
                                    className="w-full bg-slate-800 border items-center border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                            {filteredPlayers.length === 0 ? (
                                <div className="text-center p-8 text-slate-500">No players found matching "{searchQuery}"</div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredPlayers.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelectPlayer(p.id)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 transition-colors text-left group"
                                        >
                                            <div>
                                                <div className="font-bold text-white text-base">{p.web_name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    £{(p.now_cost / 10).toFixed(1)}m • {teams.find(t => t.id === p.team)?.short_name} • Form {p.form}
                                                </div>
                                            </div>
                                            <ArrowRight size={18} className="text-slate-600 group-hover:text-purple-400 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
