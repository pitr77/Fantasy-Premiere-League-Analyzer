"use client";

import React, { useMemo, useState } from 'react';
import { FPLPlayer, FPLTeam, FPLFixture } from '../types';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  X,
  BarChart2
} from 'lucide-react';
import { PlayerDetailModal } from './PlayerDetailModal';
import { useLanguage, Language } from '../lib/language';

interface PlayerStatsProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures?: FPLFixture[];
}

export type StatsTab = 'overview' | 'advanced';

interface MetricColumn {
  key: string;
  label: (lang: Language) => string;
  abbr: string;
  description: (lang: Language) => string;
  align?: 'left' | 'center' | 'right';
  getValue: (p: FPLPlayer) => number | string;
  format: (val: any, p: FPLPlayer) => React.ReactNode;
}

const TAB_COLUMNS: Record<StatsTab, MetricColumn[]> = {
  overview: [
    {
      key: 'now_cost',
      label: (lang) => lang === 'sk' ? 'Cena' : 'Cost',
      abbr: '£',
      description: (lang) => lang === 'sk' 
        ? 'Aktuálna trhová cena hráča vo Fantasy Premier League (v miliónoch).'
        : 'Current market price in Fantasy Premier League (in millions).',
      align: 'center',
      getValue: (p) => p.now_cost / 10,
      format: (val) => <span className="font-mono text-blue-300 font-semibold">£{Number(val).toFixed(1)}m</span>
    },
    {
      key: 'total_points',
      label: (lang) => lang === 'sk' ? 'Body' : 'Points',
      abbr: 'PTS',
      description: (lang) => lang === 'sk'
        ? 'Celkový počet bodov získaných v prebiehajúcej sezóne.'
        : 'Total points accumulated across all gameweeks this season.',
      align: 'center',
      getValue: (p) => p.total_points ?? 0,
      format: (val) => <span className="font-mono font-black text-emerald-400 text-sm">{val}</span>
    },
    {
      key: 'form',
      label: (lang) => lang === 'sk' ? 'Forma' : 'Form',
      abbr: 'FORM',
      description: (lang) => lang === 'sk'
        ? 'Priemerný bodový zisk hráča za zápas za posledných 30 dní.'
        : 'Average points per match scored by the player over the last 30 days.',
      align: 'center',
      getValue: (p) => parseFloat(p.form) || 0,
      format: (val) => (
        <span className={`font-mono font-bold ${Number(val) >= 6 ? 'text-emerald-400' : Number(val) >= 4 ? 'text-blue-300' : 'text-slate-300'}`}>
          {Number(val).toFixed(1)}
        </span>
      )
    },
    {
      key: 'selected_by_percent',
      label: (lang) => lang === 'sk' ? 'Vlast.%' : 'TSB%',
      abbr: 'TSB%',
      description: (lang) => lang === 'sk'
        ? 'Vlastníctvo: Percento tímov vo svetovom FPL, ktoré majú hráča na súpiske (Teams Selected By).'
        : 'Ownership: Percentage of all active FPL fantasy managers who own this player (Teams Selected By).',
      align: 'center',
      getValue: (p) => parseFloat(p.selected_by_percent) || 0,
      format: (val) => <span className="font-mono text-purple-300 font-semibold">{Number(val).toFixed(1)}%</span>
    },
    {
      key: 'points_per_game',
      label: (lang) => lang === 'sk' ? 'Body/Z' : 'PPG',
      abbr: 'PPG',
      description: (lang) => lang === 'sk'
        ? 'Priemerný počet bodov na jeden odohraný zápas v sezóne.'
        : 'Points Per Game: Average points scored per match played this season.',
      align: 'center',
      getValue: (p) => parseFloat(p.points_per_game) || 0,
      format: (val) => <span className="font-mono text-slate-300">{Number(val).toFixed(1)}</span>
    },
    {
      key: 'minutes',
      label: (lang) => lang === 'sk' ? 'Minúty' : 'Mins',
      abbr: 'MP',
      description: (lang) => lang === 'sk'
        ? 'Celkový počet odohraných minút v aktuálnej sezóne.'
        : 'Total minutes played on pitch this season.',
      align: 'center',
      getValue: (p) => p.minutes ?? 0,
      format: (val) => <span className="font-mono text-slate-400 text-xs">{val}'</span>
    },
    {
      key: 'value_season',
      label: (lang) => lang === 'sk' ? 'Výkon/£' : 'Value',
      abbr: 'VFM',
      description: (lang) => lang === 'sk'
        ? 'Pomer cena/výkon: Celkový počet bodov na každú £1m ceny hráča (Value for Money).'
        : 'Value for Money: Total points divided by current cost in £m.',
      align: 'center',
      getValue: (p) => (p.total_points ?? 0) / (p.now_cost / 10 || 1),
      format: (val) => <span className="font-mono text-indigo-300 font-semibold">{Number(val).toFixed(1)}</span>
    }
  ],
  advanced: [
    {
      key: 'goals_scored',
      label: (lang) => lang === 'sk' ? 'Góly' : 'Goals',
      abbr: 'GS',
      description: (lang) => lang === 'sk'
        ? 'Počet strelených gólov v sezóne (Útočník: 4b, Záložník: 5b, Obranca/GKP: 6b).'
        : 'Total goals scored (FWD: 4 pts, MID: 5 pts, DEF/GKP: 6 pts).',
      align: 'center',
      getValue: (p) => p.goals_scored ?? 0,
      format: (val) => <span className={`font-mono font-bold ${Number(val) > 0 ? 'text-emerald-400 text-sm' : 'text-slate-500'}`}>{val}</span>
    },
    {
      key: 'assists',
      label: (lang) => lang === 'sk' ? 'Asist.' : 'Assists',
      abbr: 'A',
      description: (lang) => lang === 'sk'
        ? 'Počet gólových asistencií a vybojovaných penált (3 body za asistenciu).'
        : 'Total goal assists and won penalties/rebounds (3 pts each).',
      align: 'center',
      getValue: (p) => p.assists ?? 0,
      format: (val) => <span className={`font-mono font-bold ${Number(val) > 0 ? 'text-blue-400 text-sm' : 'text-slate-500'}`}>{val}</span>
    },
    {
      key: 'expected_goals',
      label: () => 'xG',
      abbr: 'xG',
      description: (lang) => lang === 'sk'
        ? 'Expected Goals: Štatistická kvalita a pravdepodobnosť gólu zo všetkých striel hráča.'
        : 'Expected Goals: Statistical probability and quality of shots converting to goals.',
      align: 'center',
      getValue: (p) => parseFloat(p.expected_goals || '0') || 0,
      format: (val) => <span className="font-mono text-emerald-300 font-semibold">{Number(val).toFixed(2)}</span>
    },
    {
      key: 'expected_assists',
      label: () => 'xA',
      abbr: 'xA',
      description: (lang) => lang === 'sk'
        ? 'Expected Assists: Pravdepodobnosť, že prihrávky hráča vyústia do gólovej asistencie.'
        : 'Expected Assists: Likelihood that passes result in a goal assist.',
      align: 'center',
      getValue: (p) => parseFloat(p.expected_assists || '0') || 0,
      format: (val) => <span className="font-mono text-blue-300 font-semibold">{Number(val).toFixed(2)}</span>
    },
    {
      key: 'expected_goal_involvements',
      label: () => 'xGI',
      abbr: 'xGI',
      description: (lang) => lang === 'sk'
        ? 'Expected Goal Involvement: Súčet xG a xA hráča (celkový útočný potenciál).'
        : 'Expected Goal Involvement: Combined xG + xA attacking potential.',
      align: 'center',
      getValue: (p) => parseFloat(p.expected_goal_involvements || '0') || 0,
      format: (val) => <span className="font-mono text-purple-300 font-bold">{Number(val).toFixed(2)}</span>
    },
    {
      key: 'clean_sheets',
      label: (lang) => lang === 'sk' ? 'Čisté kontá' : 'Clean Sheets',
      abbr: 'CS',
      description: (lang) => lang === 'sk'
        ? 'Zápasy s odohratím min. 60 minút bez inkasovaného gólu (GKP/DEF: 4b, MID: 1b).'
        : 'Matches played min. 60 mins without conceding (DEF/GKP: 4 pts, MID: 1 pt).',
      align: 'center',
      getValue: (p) => p.clean_sheets ?? 0,
      format: (val) => <span className={`font-mono font-bold ${Number(val) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{val}</span>
    },
    {
      key: 'saves',
      label: (lang) => lang === 'sk' ? 'Zákroky' : 'Saves',
      abbr: 'S',
      description: (lang) => lang === 'sk'
        ? 'Úspešné brankárske zákroky (každé 3 zákroky = 1 bonusový bod pre GKP).'
        : 'Goalkeeper saves (every 3 saves = 1 bonus point).',
      align: 'center',
      getValue: (p) => p.saves ?? 0,
      format: (val) => <span className={`font-mono ${Number(val) > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>{val}</span>
    },
    {
      key: 'ict_index',
      label: () => 'ICT',
      abbr: 'ICT',
      description: (lang) => lang === 'sk'
        ? 'Kombinovaný oficiálny index FPL (Influence + Creativity + Threat).'
        : 'Official FPL metric combining Influence, Creativity, and Threat.',
      align: 'center',
      getValue: (p) => parseFloat(p.ict_index || '0') || 0,
      format: (val) => <span className="font-mono text-purple-400 font-bold">{Number(val).toFixed(1)}</span>
    },
    {
      key: 'bps',
      label: (lang) => lang === 'sk' ? 'Bonusy' : 'BPS',
      abbr: 'BPS',
      description: (lang) => lang === 'sk'
        ? 'Bonus Points System: Podrobný štatistický algoritmus určujúci zisk bonusových bodov.'
        : 'Bonus Points System: Detailed algorithmic score determining bonus allocation.',
      align: 'center',
      getValue: (p) => p.bps ?? 0,
      format: (val) => <span className="font-mono text-amber-300 font-bold">{val}</span>
    }
  ]
};

const TAB_CONFIG: { 
  id: StatsTab; 
  label: (lang: Language) => string; 
  defaultSort: string 
}[] = [
  { 
    id: 'overview', 
    label: (lang) => lang === 'sk' ? 'Prehľad' : 'Overview', 
    defaultSort: 'total_points' 
  },
  { 
    id: 'advanced', 
    label: (lang) => lang === 'sk' ? 'Rozšírené' : 'Advanced', 
    defaultSort: 'goals_scored' 
  }
];

export const PlayerStats: React.FC<PlayerStatsProps> = ({ players, teams, fixtures }) => {
  const [lang] = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [posFilter, setPosFilter] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'total_points',
    direction: 'desc'
  });
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<FPLPlayer | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<{
    key: string;
    label: string;
    abbr: string;
    description: string;
    rect: DOMRect;
  } | null>(null);

  const activeColumns = useMemo(() => TAB_COLUMNS[activeTab], [activeTab]);

  const handleTabChange = (newTab: StatsTab) => {
    setActiveTab(newTab);
    const colExists = TAB_COLUMNS[newTab].some(c => c.key === sortConfig.key);
    if (!colExists) {
      const config = TAB_CONFIG.find(t => t.id === newTab);
      setSortConfig({
        key: config?.defaultSort || TAB_COLUMNS[newTab][0].key,
        direction: 'desc'
      });
    }
  };

  const filteredAndSortedPlayers = useMemo(() => {
    let result = players.filter(player => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const fullName = `${player.first_name} ${player.second_name}`.toLowerCase();
        const webName = player.web_name.toLowerCase();
        if (!fullName.includes(query) && !webName.includes(query)) {
          return false;
        }
      }

      if (teamFilter !== 'all' && player.team !== teamFilter) {
        return false;
      }

      if (posFilter !== 'all' && player.element_type !== posFilter) {
        return false;
      }

      return true;
    });

    result.sort((a, b) => {
      const metric = activeColumns.find(c => c.key === sortConfig.key);
      let valA: any = metric ? metric.getValue(a) : (a as any)[sortConfig.key];
      let valB: any = metric ? metric.getValue(b) : (b as any)[sortConfig.key];

      if (typeof valA === 'string' && !isNaN(Number(valA))) valA = Number(valA);
      if (typeof valB === 'string' && !isNaN(Number(valB))) valB = Number(valB);

      if (valA === valB) return (b.total_points || 0) - (a.total_points || 0);
      return sortConfig.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return result;
  }, [players, searchTerm, teamFilter, posFilter, sortConfig, activeColumns]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const getTeam = (teamId: number) => teams.find(t => t.id === teamId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="text-blue-400 shrink-0" />
          {lang === 'sk' ? 'Štatistiky Hráčov' : 'Player Statistics'}
        </h2>
      </div>

      {/* Controls row: Positions filter on left, 2 Categories on right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
        {/* Position Filter */}
        <div className="grid grid-cols-5 md:flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 self-start">
          {(['all', 1, 2, 3, 4] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosFilter(pos)}
              className={`px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                posFilter === pos
                  ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {pos === 'all'
                ? (lang === 'sk' ? 'Všetci' : 'All')
                : ({ 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' } as Record<number, string>)[pos]}
            </button>
          ))}
        </div>

        {/* 2 Categories Switcher (Overview vs Advanced) */}
        <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 self-start md:self-auto">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label(lang)}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Club Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search Input */}
        <div className="relative sm:col-span-7 lg:col-span-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          <input 
            type="text" 
            placeholder={lang === 'sk' ? "Hľadať hráča podľa mena..." : "Search player by name..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm rounded-xl pl-10 pr-9 py-2 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500 shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        {/* Team Filter */}
        <div className="relative sm:col-span-5 lg:col-span-4">
          <select 
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-3 py-2 appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none cursor-pointer pr-8 shadow-sm"
          >
            <option value="all">
              {lang === 'sk' ? `Všetky kluby (${teams.length})` : `All Clubs (${teams.length})`}
            </option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.short_name})</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700 select-none">
                <th className="py-3 px-2 w-10 text-center text-xs text-slate-500">#</th>
                <th className="py-3 px-3 font-bold text-left min-w-[130px] sm:min-w-[150px]">
                  {lang === 'sk' ? 'Hráč' : 'Player'}
                </th>
                <th className="py-3 px-2 font-bold text-left w-20 sm:w-24">
                  {lang === 'sk' ? 'Klub' : 'Club'}
                </th>
                <th className="py-3 px-2 font-bold text-center w-14">
                  {lang === 'sk' ? 'Poz' : 'Pos'}
                </th>

                {/* Dynamic Columns for active tab with Hover Tooltip */}
                {activeColumns.map((col) => {
                  const isSorted = sortConfig.key === col.key;
                  const label = col.label(lang);
                  const description = col.description(lang);

                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredMetric({
                          key: col.key,
                          label,
                          abbr: col.abbr,
                          description,
                          rect
                        });
                      }}
                      onMouseLeave={() => setHoveredMetric(null)}
                      className={`py-3 px-2.5 font-bold cursor-pointer transition-colors relative group/th select-none text-center ${
                        isSorted ? 'text-blue-400 bg-slate-700/30' : 'hover:text-white hover:bg-slate-700/20'
                      }`}
                    >
                      <div className="w-full flex items-center justify-center">
                        <div className="relative inline-flex items-center justify-center">
                          <span className="whitespace-nowrap border-b border-dotted border-slate-600/70 group-hover/th:border-blue-400 transition-colors">
                            {label}
                          </span>
                          <span className="absolute left-full ml-1 flex items-center">
                            {isSorted ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp size={12} className="text-blue-400 shrink-0" />
                              ) : (
                                <ChevronDown size={12} className="text-blue-400 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="text-slate-600 opacity-0 group-hover/th:opacity-100 transition-opacity shrink-0" />
                            )}
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-700/50 text-sm">
              {filteredAndSortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={4 + activeColumns.length} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search size={28} className="text-slate-600 mb-1" />
                      <p className="text-sm font-semibold text-slate-400">
                        {lang === 'sk' ? 'Nenašli sa žiadni hráči' : 'No players found'}
                      </p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setTeamFilter('all');
                          setPosFilter('all');
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
                      >
                        {lang === 'sk' ? 'Resetovať filtre' : 'Reset filters'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedPlayers.map((player, idx) => {
                  const team = getTeam(player.team);
                  const posConfig = player.element_type === 1 
                    ? { short: "GKP", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" }
                    : player.element_type === 2 
                    ? { short: "DEF", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" }
                    : player.element_type === 3 
                    ? { short: "MID", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
                    : { short: "FWD", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" };

                  return (
                    <tr
                      key={player.id}
                      className="group hover:bg-slate-700/30 transition-all cursor-pointer"
                      onClick={() => setSelectedPlayerForDetail(player)}
                    >
                      {/* Rank */}
                      <td className="py-3 px-2 text-center font-mono text-slate-500 text-xs">
                        {idx + 1}
                      </td>

                      {/* Player Name */}
                      <td className="py-3 px-3 text-left">
                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                          <span className="truncate">{player.web_name}</span>
                          {player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== 100 && (
                            <span 
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                player.chance_of_playing_next_round === 0 ? 'bg-rose-500' : 'bg-amber-400'
                              }`} 
                              title={`Šanca na štart: ${player.chance_of_playing_next_round}%`}
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate hidden sm:block">
                          {player.first_name} {player.second_name}
                        </div>
                      </td>

                      {/* Team */}
                      <td className="py-3 px-2 text-slate-300 font-medium text-left">
                        <span className="hidden sm:inline">{team?.name || '—'}</span>
                        <span className="sm:hidden font-mono text-xs text-slate-400">{team?.short_name || '—'}</span>
                      </td>

                      {/* Position */}
                      <td className="py-3 px-2 text-center">
                        <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded border ${posConfig.color}`}>
                          {posConfig.short}
                        </span>
                      </td>

                      {/* Dynamic Columns for active tab */}
                      {activeColumns.map((col) => {
                        const rawVal = col.getValue(player);
                        const isSortedCol = sortConfig.key === col.key;

                        return (
                          <td
                            key={col.key}
                            className={`py-3 px-3 ${
                              col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                            } ${isSortedCol ? 'bg-slate-700/30' : ''}`}
                          >
                            {col.format(rawVal, player)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 sm:p-4 bg-slate-900/60 border-t border-slate-700 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {lang === 'sk'
              ? `Celkovo v databáze: ${players.length} hráčov Premier League`
              : `Total in database: ${players.length} Premier League players`}
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              {lang === 'sk' ? '100% pripravený' : '100% available'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              {lang === 'sk' ? 'Otázny štart' : 'Doubtful'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              {lang === 'sk' ? 'Zranený / trest' : 'Injured / Suspended'}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Tooltip positioned ABOVE the hovered column header */}
      {hoveredMetric && (() => {
        const isNearTop = hoveredMetric.rect.top < 150;
        const leftPos = Math.max(
          150,
          Math.min(
            (typeof window !== 'undefined' ? window.innerWidth : 1000) - 150,
            hoveredMetric.rect.left + hoveredMetric.rect.width / 2
          )
        );

        return (
          <div
            style={{
              position: 'fixed',
              left: leftPos,
              top: isNearTop ? hoveredMetric.rect.bottom + 10 : hoveredMetric.rect.top - 10,
              transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
            }}
            className="z-[9999] pointer-events-none w-64 sm:w-72 p-3 bg-slate-900/98 backdrop-blur-md text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 text-left normal-case font-normal select-none transition-all duration-150 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-white text-xs">{hoveredMetric.label}</span>
              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {hoveredMetric.abbr}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300 whitespace-normal">
              {hoveredMetric.description}
            </p>
            <div className="mt-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
              <span>{lang === 'sk' ? 'Kliknutím zoradíte' : 'Click column to sort'}</span>
              <span className="font-mono text-slate-400">{hoveredMetric.key}</span>
            </div>
            {/* Arrow pointing to the column header */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 border-slate-700 rotate-45 ${
                isNearTop ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r'
              }`}
            />
          </div>
        );
      })()}

      {/* Player Detail Modal */}
      {selectedPlayerForDetail && (
        <PlayerDetailModal
          player={selectedPlayerForDetail}
          isOpen={Boolean(selectedPlayerForDetail)}
          onClose={() => setSelectedPlayerForDetail(null)}
          teams={teams}
          allPlayers={players}
          fixtures={fixtures}
        />
      )}
    </div>
  );
};

export default PlayerStats;
