import React, { useMemo, useState, useEffect } from 'react';
import { FPLPlayer, FPLTeam } from '../types';
import { ArrowUpDown, ChevronUp, ChevronDown, Search, Crown, Info, Flame, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Users, Sparkles, Filter } from 'lucide-react';
import { Top100Snapshot, Top100TemplateTierPlayer, Top100PositionLeader } from '../services/top100Service';

interface TopManagersProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
}

const POSITION_MAP: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

const TopManagers: React.FC<TopManagersProps> = ({ players, teams }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [posFilter, setPosFilter] = useState<number | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'sel_num', 
    direction: 'desc' 
  });

  // Top 100 Manager state
  const [top100Data, setTop100Data] = useState<Top100Snapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'top100' | 'template'>('top100');

  // Template tab states (Google Sheet gid 1772307187)
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [templatePosFilter, setTemplatePosFilter] = useState<'all' | 'GK' | 'DEF' | 'MID' | 'FWD'>('all');
  const [templateTierFilter, setTemplateTierFilter] = useState<string>('all');
  const [templateDivergenceFilter, setTemplateDivergenceFilter] = useState<'all' | 'bias' | 'faded'>('all');
  const [templateSortConfig, setTemplateSortConfig] = useState<{
    key: 'rank' | 'top100Own' | 'overallOwn' | 'delta' | 'price' | 'appearances';
    direction: 'asc' | 'desc';
  }>({
    key: 'rank',
    direction: 'asc'
  });

  useEffect(() => {
    fetch('/api/top100')
      .then(res => res.json())
      .then(data => {
        if (data.available) {
          setTop100Data(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleRefreshTop100 = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/top100', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTop100Data(data);
      }
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  };

  // Prepare data with numeric conversions
  const tableData = useMemo(() => {
    return players.map(p => ({
      ...p,
      id: p.id,
      name: p.web_name,
      full_name: `${p.first_name} ${p.second_name}`,
      cost_num: p.now_cost / 10,
      sel_num: parseFloat(p.selected_by_percent),
      form_num: parseFloat(p.form),
      team_name: teams.find(t => t.id === p.team)?.name || "Unknown",
      short_team: teams.find(t => t.id === p.team)?.short_name || "UNK",
      position_name: POSITION_MAP[p.element_type],
      points_num: p.total_points
    }));
  }, [players, teams]);

  // Filter and Sort
  const filteredData = useMemo(() => {
    let data = tableData;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(p => 
        p.full_name.toLowerCase().includes(lower) || 
        p.web_name.toLowerCase().includes(lower)
      );
    }
    if (teamFilter !== 'all') {
      data = data.filter(p => p.team === teamFilter);
    }
    if (posFilter !== 'all') {
      data = data.filter(p => p.element_type === posFilter);
    }

    return [...data].sort((a, b) => {
      // @ts-ignore
      let valA = a[sortConfig.key];
      // @ts-ignore
      let valB = b[sortConfig.key];

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tableData, searchTerm, teamFilter, posFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={14} className="text-slate-600 inline ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-green-400 inline ml-1" /> 
      : <ChevronDown size={14} className="text-green-400 inline ml-1" />;
  };

  const getPosColor = (posStr: string | number) => {
    const p = String(posStr).toUpperCase();
    if (p === '1' || p === 'GK' || p === 'GKP') return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (p === '2' || p === 'DEF') return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (p === '3' || p === 'MID') return "bg-green-500/20 text-green-400 border-green-500/30";
    if (p === '4' || p === 'FWD') return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-slate-700 text-white";
  };

  const getTemplatePosBadge = (pos: string) => {
    const p = (pos || '').toUpperCase();
    if (p === 'GK' || p === 'GKP') return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (p === 'DEF') return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (p === 'MID') return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (p === 'FWD') return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    return "bg-slate-700 text-white border-slate-600";
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'Template Core':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Strong Template':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Differential':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Elite Differential':
        return 'bg-slate-700/60 text-slate-300 border-slate-600';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const handleTemplateSort = (key: 'rank' | 'top100Own' | 'overallOwn' | 'delta' | 'price' | 'appearances') => {
    setTemplateSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const TemplateSortIcon = ({ colKey }: { colKey: 'rank' | 'top100Own' | 'overallOwn' | 'delta' | 'price' | 'appearances' }) => {
    if (templateSortConfig.key !== colKey) return <ArrowUpDown size={14} className="text-slate-600 inline ml-1" />;
    return templateSortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-purple-400 inline ml-1" /> 
      : <ChevronDown size={14} className="text-purple-400 inline ml-1" />;
  };

  const filteredTemplateTiers = useMemo(() => {
    const list = top100Data?.templateAnalysis?.templateTiers || [];
    let result = [...list];

    if (templateSearchTerm) {
      const lower = templateSearchTerm.toLowerCase();
      result = result.filter(p =>
        p.player.toLowerCase().includes(lower) ||
        p.team.toLowerCase().includes(lower)
      );
    }

    if (templatePosFilter !== 'all') {
      result = result.filter(p => p.pos.toUpperCase() === templatePosFilter.toUpperCase());
    }

    if (templateTierFilter !== 'all') {
      result = result.filter(p => p.tier === templateTierFilter);
    }

    if (templateDivergenceFilter === 'bias') {
      result = result.filter(p => p.delta >= 5);
    } else if (templateDivergenceFilter === 'faded') {
      result = result.filter(p => p.delta <= -5);
    }

    result.sort((a, b) => {
      let valA: number = (a as any)[templateSortConfig.key];
      let valB: number = (b as any)[templateSortConfig.key];

      if (templateSortConfig.key === 'price') {
        valA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
        valB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
      }

      if (valA < valB) return templateSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return templateSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    top100Data?.templateAnalysis?.templateTiers,
    templateSearchTerm,
    templatePosFilter,
    templateTierFilter,
    templateDivergenceFilter,
    templateSortConfig,
  ]);

  return (
    <div className="space-y-6">
      
      {/* Top Header & Sub-navigation */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-5">
           <div>
             <h2 className="text-2xl font-bold text-white flex items-center gap-2">
               <Crown className="text-yellow-400" />
               Top 100 Manager Intel & Market
             </h2>
             <p className="text-slate-400 text-sm mt-1">
               Reálne prestupy 100 najlepších svetových FPL manažérov a ich trhový konsenzus.
             </p>
           </div>

           <div className="flex items-center gap-2">
              <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex">
                <button
                  onClick={() => setActiveTab('top100')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'top100' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Top 100 Prestupy
                </button>
                <button
                  onClick={() => setActiveTab('template')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'template' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Top 100 Template
                </button>
              </div>

              <button
                onClick={handleRefreshTop100}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all disabled:opacity-50"
                title="Obnoviť dáta z Google Sheetu"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-amber-400' : 'text-slate-400'} />
                <span className="hidden sm:inline">Aktualizovať</span>
              </button>
           </div>
        </div>

        {/* Informational banner highlighting minus one gameweek context */}
        <div className="mt-4 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex gap-3 items-start">
          <Info className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-amber-300 block mb-0.5">
              Dôležitý kontext k časovaniu dát (GW{top100Data?.closedDeadlineGw || 5} uzávierka):
            </span>
            Oficiálne pravidlá FPL držia zostavy a prestupy súperov pred deadline-om v tajnosti. Tieto dáta preto zachytávajú 
            <strong> poslednú uzavretú uzávierku (GW{top100Data?.closedDeadlineGw || 5})</strong>. Elitní manažéri však plánujú 
            na 3–5 kôl dopredu — vidíte presne, do koho investovali kapitál a koho sa pred týmto blokom zápasov zbavili.
            {top100Data?.refreshedAt && (
              <span className="block mt-1 text-slate-400 font-mono text-[11px]">
                Posledný prepočet tabuľky: {top100Data.refreshedAt}
              </span>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'top100' && top100Data && (
        <div className="space-y-6">
          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Najkupovanejší</span>
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
              <div className="text-lg md:text-xl font-black text-white truncate">
                {top100Data.mostBought.player}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                <span>{top100Data.mostBought.team}</span>
                <span className="font-bold text-emerald-400 font-mono">+{top100Data.mostBought.count} manažérov</span>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Najpredávanejší</span>
                <TrendingDown size={14} className="text-rose-400" />
              </div>
              <div className="text-lg md:text-xl font-black text-white truncate">
                {top100Data.mostSold.player}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                <span>{top100Data.mostSold.team}</span>
                <span className="font-bold text-rose-400 font-mono">-{top100Data.mostSold.count} manažérov</span>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Čistý prírastok (Net Buy)</span>
                <Flame size={14} className="text-emerald-400" />
              </div>
              <div className="text-lg md:text-xl font-black text-white truncate">
                {top100Data.strongestNetBuy.player}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                <span>{top100Data.strongestNetBuy.team}</span>
                <span className="font-bold text-emerald-400 font-mono">Net +{top100Data.strongestNetBuy.net}</span>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Čistý odliv (Net Sell)</span>
                <AlertTriangle size={14} className="text-rose-400" />
              </div>
              <div className="text-lg md:text-xl font-black text-white truncate">
                {top100Data.strongestNetSell.player}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                <span>{top100Data.strongestNetSell.team}</span>
                <span className="font-bold text-rose-400 font-mono">Net {top100Data.strongestNetSell.net}</span>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Net Buys vs Net Sells */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Net Buys Leaderboard */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                    <TrendingUp size={16} />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">Top 10 Net Nákupy Elity</h3>
                    <p className="text-[11px] text-slate-400">Hráči s najvyšším čistým prírastkom do zostáv</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  GW{top100Data.closedDeadlineGw}
                </span>
              </div>

              <div className="space-y-2">
                {top100Data.netBuys.map((b) => (
                  <div key={b.player} className="flex items-center justify-between p-2.5 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-700/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-bold text-slate-500 w-4">#{b.rank}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPosColor(b.pos)}`}>
                        {b.pos}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-white text-sm block truncate">{b.player}</span>
                        <span className="text-[10px] text-slate-400">{b.team} · Form {b.form}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-emerald-400 text-sm">+{b.net}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{b.in} IN / {b.out} OUT</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Net Sells Leaderboard */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
                    <TrendingDown size={16} />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">Top 10 Net Predaje Elity</h3>
                    <p className="text-[11px] text-slate-400">Hráči, ktorých sa elita najviac zbavovala</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                  GW{top100Data.closedDeadlineGw}
                </span>
              </div>

              <div className="space-y-2">
                {top100Data.netSells.map((s) => (
                  <div key={s.player} className="flex items-center justify-between p-2.5 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-700/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-bold text-slate-500 w-4">#{s.rank}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPosColor(s.pos)}`}>
                        {s.pos}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-white text-sm block truncate">{s.player}</span>
                        <span className="text-[10px] text-slate-400">{s.team} · Form {s.form}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-rose-400 text-sm">{s.net}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.in} IN / {s.out} OUT</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Divided Opinion & Position Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Divided Opinion */}
            <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5 shadow">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">Divided Opinion / Churn</h3>
                    <p className="text-[11px] text-slate-400">Hráči, ktorých časť elity masívne kupovala a časť predávala</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase font-semibold border-b border-slate-700/60 pb-2">
                      <th className="pb-2">Hráč</th>
                      <th className="pb-2">Cena</th>
                      <th className="pb-2 text-center">IN</th>
                      <th className="pb-2 text-center">OUT</th>
                      <th className="pb-2 text-right">Net</th>
                      <th className="pb-2 text-right">Celk. Vlastníctvo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {top100Data.dividedOpinion.map(d => (
                      <tr key={d.player} className="hover:bg-slate-700/30">
                        <td className="py-2.5 font-bold text-white">
                          {d.player} <span className="text-[10px] text-slate-500 font-normal">({d.team})</span>
                        </td>
                        <td className="py-2.5 font-mono text-blue-300">{d.price}</td>
                        <td className="py-2.5 text-center font-mono text-emerald-400 font-bold">{d.in}</td>
                        <td className="py-2.5 text-center font-mono text-rose-400 font-bold">{d.out}</td>
                        <td className={`py-2.5 text-right font-mono font-bold ${d.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {d.net > 0 ? `+${d.net}` : d.net}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-300">{d.ownership}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Position Activity Breakdown */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/60">
                  <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                    <Users size={16} />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">Alokácia prestupov</h3>
                    <p className="text-[11px] text-slate-400">Podiel transferov podľa pozícií</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {top100Data.positionActivity.map(pos => (
                    <div key={pos.pos} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white">{pos.pos}</span>
                        <span className="text-blue-400 font-mono">{pos.shareIn}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: pos.shareIn }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{pos.in} príchodov</span>
                        <span>{pos.out} odchodov</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-900/60 rounded-lg border border-slate-700/40 text-[11px] text-slate-400">
                💡 <strong className="text-slate-300">Zistenie:</strong> Elita pred GW5 masívne preskupovala kapitál do zálohy (38.3%) a obrany (33.3%).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Tab (Full Google Sheets gid 1772307187 Template Analysis) */}
      {activeTab === 'template' && (
        <div className="space-y-6">
          {/* Section 1: Top 100 Template By Position */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-700/80 gap-2">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg">
                    <Crown size={18} />
                  </span>
                  TOP 100 TEMPLATE PODĽA POZÍCIÍ
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Najpopulárnejší hráči v 100 elitných tímoch (Top 5 na každej pozícii z Google Sheets analýzy)
                </p>
              </div>
              <div className="text-xs text-slate-400 bg-slate-900/80 border border-slate-700/60 px-3 py-1.5 rounded-lg font-mono self-start sm:self-auto">
                Vzorka: <strong className="text-white">100 Top 100 zostáv</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* GK Card */}
              <div className="bg-slate-900/70 rounded-xl border border-slate-700/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧤</span>
                      <h4 className="font-bold text-white text-sm">Brankári (GK)</h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                      GKP
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(top100Data?.templateAnalysis?.templateByPos?.GK || []).map(p => (
                      <div key={p.player} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/70 border border-slate-700/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-500 w-4">#{p.rank}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.player}</div>
                            <div className="text-[10px] text-slate-400">{p.team}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-yellow-300">{p.own}</div>
                          <div className="w-14 bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-yellow-400 h-full rounded-full" style={{ width: p.own }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DEF Card */}
              <div className="bg-slate-900/70 rounded-xl border border-slate-700/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🛡️</span>
                      <h4 className="font-bold text-white text-sm">Obrancovia (DEF)</h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      DEF
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(top100Data?.templateAnalysis?.templateByPos?.DEF || []).map(p => (
                      <div key={p.player} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/70 border border-slate-700/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-500 w-4">#{p.rank}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.player}</div>
                            <div className="text-[10px] text-slate-400">{p.team}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-blue-300">{p.own}</div>
                          <div className="w-14 bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-blue-400 h-full rounded-full" style={{ width: p.own }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MID Card */}
              <div className="bg-slate-900/70 rounded-xl border border-slate-700/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      <h4 className="font-bold text-white text-sm">Záložníci (MID)</h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      MID
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(top100Data?.templateAnalysis?.templateByPos?.MID || []).map(p => (
                      <div key={p.player} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/70 border border-slate-700/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-500 w-4">#{p.rank}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.player}</div>
                            <div className="text-[10px] text-slate-400">{p.team}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-emerald-300">{p.own}</div>
                          <div className="w-14 bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full" style={{ width: p.own }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* FWD Card */}
              <div className="bg-slate-900/70 rounded-xl border border-slate-700/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      <h4 className="font-bold text-white text-sm">Útočníci (FWD)</h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      FWD
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(top100Data?.templateAnalysis?.templateByPos?.FWD || []).map(p => (
                      <div key={p.player} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/70 border border-slate-700/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-500 w-4">#{p.rank}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.player}</div>
                            <div className="text-[10px] text-slate-400">{p.team}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-rose-300">{p.own}</div>
                          <div className="w-14 bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-rose-400 h-full rounded-full" style={{ width: p.own }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Full Top 100 Template Tiers Table */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-700/80 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg">
                    <Sparkles size={18} />
                  </span>
                  TOP 100 TEMPLATE TIERS & KONSENZUS
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  152 hráčov zoradených podľa vlastníctva u elity vs. celkové FPL vlastníctvo a elitná divergencia
                </p>
              </div>

              {/* Quick Summary Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold">
                  Core: 5 hráčov (≥50%)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold">
                  Strong: 16 hráčov (25–49%)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold">
                  Diff: 17 hráčov (10–24%)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-700/60 border border-slate-600 text-slate-300 font-bold">
                  Elite Diff: 114 hráčov (&lt;10%)
                </span>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Hľadať hráča alebo tím..." 
                  value={templateSearchTerm}
                  onChange={(e) => setTemplateSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <select 
                  value={templatePosFilter}
                  onChange={(e) => setTemplatePosFilter(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Všetky pozície (All Pos)</option>
                  <option value="GK">Brankári (GK)</option>
                  <option value="DEF">Obrancovia (DEF)</option>
                  <option value="MID">Záložníci (MID)</option>
                  <option value="FWD">Útočníci (FWD)</option>
                </select>
              </div>

              <div>
                <select 
                  value={templateTierFilter}
                  onChange={(e) => setTemplateTierFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Všetky Template Tiery</option>
                  <option value="Template Core">Template Core (≥50%)</option>
                  <option value="Strong Template">Strong Template (25–49%)</option>
                  <option value="Differential">Differential (10–24%)</option>
                  <option value="Elite Differential">Elite Differential (&lt;10%)</option>
                </select>
              </div>

              <div>
                <select 
                  value={templateDivergenceFilter}
                  onChange={(e) => setTemplateDivergenceFilter(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Všetka divergencia (Top 100 vs Trh)</option>
                  <option value="bias">🔥 Elitný Favorit (Delta ≥ +5%)</option>
                  <option value="faded">⚠️ Faded by Elite (Delta ≤ -5%)</option>
                </select>
              </div>
            </div>

            {/* Template Tiers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="p-3 font-semibold cursor-pointer" onClick={() => handleTemplateSort('rank')}>
                      Rank <TemplateSortIcon colKey="rank" />
                    </th>
                    <th className="p-3 font-semibold">Hráč & Klub</th>
                    <th className="p-3 font-semibold text-center">Poz</th>
                    <th className="p-3 font-semibold text-right cursor-pointer" onClick={() => handleTemplateSort('price')}>
                      Cena <TemplateSortIcon colKey="price" />
                    </th>
                    <th className="p-3 font-semibold w-1/4 cursor-pointer" onClick={() => handleTemplateSort('top100Own')}>
                      Top 100 Vlastníctvo <TemplateSortIcon colKey="top100Own" />
                    </th>
                    <th className="p-3 font-semibold text-right cursor-pointer" onClick={() => handleTemplateSort('overallOwn')}>
                      Celkový Trh <TemplateSortIcon colKey="overallOwn" />
                    </th>
                    <th className="p-3 font-semibold text-center cursor-pointer" onClick={() => handleTemplateSort('delta')}>
                      Divergencia (Delta) <TemplateSortIcon colKey="delta" />
                    </th>
                    <th className="p-3 font-semibold text-center">Tier</th>
                    <th className="p-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredTemplateTiers.map((p) => {
                    const isPositiveDelta = p.delta >= 5;
                    const isNegativeDelta = p.delta <= -5;

                    return (
                      <tr key={`${p.rank}-${p.player}`} className="hover:bg-slate-700/40 transition-colors group">
                        <td className="p-3 font-mono text-slate-500 text-xs">
                          #{p.rank}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{p.player}</span>
                            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-medium">
                              {p.team}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getTemplatePosBadge(p.pos)}`}>
                            {p.pos}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-blue-300 font-bold text-xs">
                          {p.price}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-purple-300 font-bold">{p.top100Own}%</span>
                              <span className="text-[10px] text-slate-500">{p.appearances}/100 zostáv</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full"
                                style={{ width: `${Math.min(p.top100Own, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-300 text-xs">
                          {p.overallOwn}%
                        </td>
                        <td className="p-3 text-center">
                          {isPositiveDelta ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <Flame size={12} className="text-emerald-400" />
                              +{p.delta}%
                            </span>
                          ) : isNegativeDelta ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              <TrendingDown size={12} className="text-rose-400" />
                              {p.delta}%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-mono text-slate-400 bg-slate-900 border border-slate-700">
                              {p.delta > 0 ? `+${p.delta}` : p.delta}%
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getTierBadge(p.tier)}`}>
                            {p.tier}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-xs text-slate-400">
                          {p.status}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTemplateTiers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 text-sm">
                        Žiadni hráči nezodpovedajú zvoleným filtrom.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <span>Zobrazených: <strong className="text-white">{filteredTemplateTiers.length}</strong> z 152 hráčov</span>
              <span>Zdroj: Google Sheets (gid 1772307187)</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TopManagers;