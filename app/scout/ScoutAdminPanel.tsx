'use client';
import { useState } from 'react';

export default function ScoutAdminPanel() {
    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState('general');
    const [secret, setSecret] = useState('');
    const [message, setMessage] = useState('');

    const generate = async () => {
        setLoading(true);
        setMessage('Generating via Gemini API (this may take up to 60s)...');
        try {
            const res = await fetch(`/api/scout/generate?topic=${topic}`, {
                method: 'POST',
                headers: secret ? { 'Authorization': `Bearer ${secret}` } : {}
            });
            const data = await res.json();
            if (res.ok) {
                setMessage('✅ Success: ' + data.article.title);
                setTimeout(() => window.location.reload(), 1500);
            } else {
                setMessage('❌ Error: ' + (data.error || JSON.stringify(data)));
            }
        } catch (e) {
            setMessage('❌ Exception: ' + String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-purple-500/30 p-5 rounded-2xl mb-8 flex flex-col gap-4 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col">
                    <h3 className="text-white font-black text-lg flex items-center gap-2">
                        <span className="text-purple-400">⚡</span> Manual AI Generation
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                        Select a specific FPL Studio topic. The AI will analyze custom metrics directly from our portal.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <input
                        type="password"
                        placeholder="Admin Secret (if req)"
                        value={secret}
                        onChange={e => setSecret(e.target.value)}
                        className="bg-slate-950 text-white rounded-xl px-3 py-2 text-sm border border-slate-700 focus:border-purple-500 focus:outline-none w-full sm:w-36"
                    />
                    <select
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        className="bg-slate-950 text-white rounded-xl px-3 py-2 text-sm border border-slate-700 focus:border-purple-500 focus:outline-none font-medium w-full sm:w-auto"
                    >
                        <option value="general">General Preview</option>
                        <option value="period_analysis">Period Analysis (Form)</option>
                        <option value="fdr_matrix">FDR Matrix (Next 5 GWs)</option>
                        <option value="fixtures_next">Fixtures (Next GW Only)</option>
                        <option value="transfer_picks">Transfer Picks (Next 5 GWs)</option>
                        <option value="transfer_picks_next">Transfer Picks (Next GW Only)</option>
                        <option value="team_analysis">Team Analysis (Att/Def)</option>
                    </select>
                    <button
                        onClick={generate}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-black transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Running...' : 'Generate'}
                    </button>
                </div>
            </div>
            {message && (
                <div className="text-xs font-mono font-medium opacity-90 text-purple-200">
                    {message}
                </div>
            )}
        </div>
    );
}

