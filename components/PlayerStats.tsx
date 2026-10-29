"use client";

import React, { useMemo, useState } from 'react';
import { FPLPlayer, FPLTeam, FPLFixture } from '../types';
import {
  Search,
  ChevronDown,
  Info,
  Flame,
  Shield,
  Zap,
  ArrowLeftRight,
  LayoutDashboard,
  X,
  Globe
} from 'lucide-react';
import { PlayerDetailModal } from './PlayerDetailModal';
import { useLanguage, Language } from '../lib/language';

interface PlayerStatsProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures?: FPLFixture[];
}

export type StatsTab = 'overview' | 'attack' | 'defense' | 'involvement' | 'transfers';

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
      align: 'right',
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
      align: 'right',
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
      align: 'right',
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
      align: 'right',
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
      align: 'right',
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
      align: 'right',
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
      align: 'right',
      getValue: (p) => (p.total_points ?? 0) / (p.now_cost / 10 || 1),
      format: (val) => <span className="font-mono text-indigo-300 font-semibold">{Number(val).toFixed(1)}</span>
    }
  ],
  attack: [
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
      align: 'right',
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
      align: 'right',
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
      align: 'right',
      getValue: (p) => parseFloat(p.expected_goal_involvements || '0') || 0,
      format: (val) => <span className="font-mono text-purple-300 font-bold">{Number(val).toFixed(2)}</span>
    },
    {
      key: 'threat',
      label: (lang) => lang === 'sk' ? 'Hrozba' : 'Threat',
      abbr: 'THR',
      description: (lang) => lang === 'sk'
        ? 'Zložka ICT indexu merajúca mieru priameho ohrozenia bránky súpera.'
        : 'ICT component measuring direct threat on the opponent\'s goal.',
      align: 'right',
      getValue: (p) => parseFloat(p.threat || '0') || 0,
      format: (val) => <span className="font-mono text-slate-300">{Number(val).toFixed(0)}</span>
    },
    {
      key: 'creativity',
      label: (lang) => lang === 'sk' ? 'Kreativita' : 'Creativity',
      abbr: 'CRE',
      description: (lang) => lang === 'sk'
        ? 'Zložka ICT indexu hodnotiaca produkciu gólových šancí a kľúčových pasov.'
        : 'ICT component assessing chance creation and key passing frequency.',
      align: 'right',
      getValue: (p) => parseFloat(p.creativity || '0') || 0,
      format: (val) => <span className="font-mono text-slate-300">{Number(val).toFixed(0)}</span>
    }
  ],
  defense: [
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
      key: 'goals_conceded',
      label: (lang) => lang === 'sk' ? 'Inkasované' : 'Conceded',
      abbr: 'GC',
      description: (lang) => lang === 'sk'
        ? 'Počet inkasovaných gólov počas hráčovej prítomnosti na trávniku.'
        : 'Goals conceded while player was on the pitch.',
      align: 'center',
      getValue: (p) => p.goals_conceded ?? 0,
      format: (val) => <span className="font-mono text-slate-400">{val}</span>
    },
    {
      key: 'expected_goals_conceded',
      label: () => 'xGC',
      abbr: 'xGC',
      description: (lang) => lang === 'sk'
        ? 'Expected Goals Conceded: Štatistická kvalita šancí, ktorým obrana hráča čelila.'
        : 'Expected Goals Conceded: Statistical quality of chances conceded.',
      align: 'right',
      getValue: (p) => parseFloat(p.expected_goals_conceded || '0') || 0,
      format: (val) => <span className="font-mono text-rose-300">{Number(val).toFixed(2)}</span>
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
      key: 'clearances_blocks_interceptions',
      label: () => 'CBI',
      abbr: 'CBI',
      description: (lang) => lang === 'sk'
        ? 'Clearances, Blocks, Interceptions: Celkový počet odkopov, blokov a zachytených lôpt.'
        : 'Clearances, Blocks & Interceptions defensively combined.',
      align: 'right',
      getValue: (p) => p.clearances_blocks_interceptions ?? 0,
      format: (val) => <span className="font-mono text-slate-300">{val}</span>
    },
    {
      key: 'recoveries',
      label: (lang) => lang === 'sk' ? 'Získané' : 'Recoveries',
      abbr: 'R',
      description: (lang) => lang === 'sk'
        ? 'Počet získaných voľných lôpt v poli (významný faktor pre BPS obrancov a záložníkov).'
        : 'Loose ball recoveries on field (major BPS booster for defenders/midfielders).',
      align: 'right',
      getValue: (p) => p.recoveries ?? 0,
      format: (val) => <span className="font-mono text-slate-300">{val}</span>
    },
    {
      key: 'tackles',
      label: (lang) => lang === 'sk' ? 'Odoberania' : 'Tackles',
      abbr: 'T',
      description: (lang) => lang === 'sk'
        ? 'Úspešné odoberania lopty v defenzívnych súbojoch (Tackles).'
        : 'Successful tackles winning or dispossessing the opponent.',
      align: 'right',
      getValue: (p) => p.tackles ?? 0,
      format: (val) => <span className="font-mono text-slate-300">{val}</span>
    }
  ],
  involvement: [
    {
      key: 'bonus',
      label: (lang) => lang === 'sk' ? 'Bonusy' : 'Bonus',
      abbr: 'BP',
      description: (lang) => lang === 'sk'
        ? 'Celkový počet bonusových bodov udelených trom najlepším hráčom zápasu (3, 2 alebo 1 bod).'
        : 'Bonus points awarded to the top 3 match performers (3, 2, or 1 pt).',
      align: 'center',
      getValue: (p) => p.bonus ?? 0,
      format: (val) => <span className={`font-mono font-bold ${Number(val) > 0 ? 'text-amber-400 text-sm' : 'text-slate-500'}`}>{val}</span>
    },
    {
      key: 'bps',
      label: () => 'BPS',
      abbr: 'BPS',
      description: (lang) => lang === 'sk'
        ? 'Bonus Points System: Komplexné hodnotenie každého dotyku, prihrávky a akcie v zápase.'
        : 'Bonus Points System: Comprehensive metric evaluating every action on pitch.',
      align: 'right',
      getValue: (p) => p.bps ?? 0,
      format: (val) => <span className="font-mono text-amber-300 font-bold">{val}</span>
    },
    {
      key: 'influence',
      label: (lang) => lang === 'sk' ? 'Vplyv' : 'Influence',
      abbr: 'INF',
      description: (lang) => lang === 'sk'
        ? 'Zložka ICT indexu merajúca mieru vplyvu hráča na výsledok a priebeh zápasu.'
        : 'ICT component evaluating overall match effect and game state influence.',
      align: 'right',
      getValue: (p) => parseFloat(p.influence || '0') || 0,
      format: (val) => <span className="font-mono text-slate-300">{Number(val).toFixed(0)}</span>
    },
    {
      key: 'ict_index',
      label: () => 'ICT',
      abbr: 'II',
      description: (lang) => lang === 'sk'
        ? 'Kombinovaný oficiálny index FPL (Influence + Creativity + Threat).'
        : 'Official FPL metric combining Influence, Creativity, and Threat.',
      align: 'right',
      getValue: (p) => parseFloat(p.ict_index || '0') || 0,
      format: (val) => <span className="font-mono text-purple-400 font-bold">{Number(val).toFixed(1)}</span>
    },
    {
      key: 'yellow_cards',
      label: (lang) => lang === 'sk' ? 'Žlté' : 'Yellow',
      abbr: 'YC',
      description: (lang) => lang === 'sk'
        ? 'Žlté karty udelené hráčovi (každá žltá karta = -1 bod).'
        : 'Yellow cards received (-1 pt each).',
      align: 'center',
      getValue: (p) => p.yellow_cards ?? 0,
      format: (val) => (
        <span className={`font-mono px-1.5 py-0.5 rounded text-xs ${Number(val) > 0 ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-slate-500'}`}>
          {val}
        </span>
      )
    },
    {
      key: 'red_cards',
      label: (lang) => lang === 'sk' ? 'Červené' : 'Red',
      abbr: 'RC',
      description: (lang) => lang === 'sk'
        ? 'Červené karty udelené hráčovi (každá červená karta = -3 body).'
        : 'Red cards received (-3 pts each).',
      align: 'center',
      getValue: (p) => p.red_cards ?? 0,
      format: (val) => (
        <span className={`font-mono px-1.5 py-0.5 rounded text-xs ${Number(val) > 0 ? 'bg-rose-500/30 text-rose-300 font-black' : 'text-slate-500'}`}>
          {val}
        </span>
      )
    },
    {
      key: 'penalties_saved',
      label: (lang) => lang === 'sk' ? 'Chytené pen.' : 'Pen. Saved',
      abbr: 'PS',
      description: (lang) => lang === 'sk'
        ? 'Počet zlikvidovaných penált brankárom (+5 bodov za chytenú penaltu).'
        : 'Penalties saved by goalkeeper (+5 pts each).',
      align: 'center',
      getValue: (p) => p.penalties_saved ?? 0,
      format: (val) => <span className={`font-mono ${Number(val) > 0 ? 'text-emerald-400 font-black' : 'text-slate-500'}`}>{val}</span>
    }
  ],
  transfers: [
    {
      key: 'selected_by_percent',
      label: (lang) => lang === 'sk' ? 'Vlast.%' : 'TSB%',
      abbr: 'TSB%',
      description: (lang) => lang === 'sk'
        ? 'Percentuálne zastúpenie hráča v zostavách všetkých manažérov na svete.'
        : 'Percentage of all active FPL fantasy managers who own this player.',
      align: 'right',
      getValue: (p) => parseFloat(p.selected_by_percent) || 0,
      format: (val) => <span className="font-mono text-purple-300 font-bold">{Number(val).toFixed(1)}%</span>
    },
    {
      key: 'transfers_in_event',
      label: (lang) => lang === 'sk' ? 'Kúpené' : 'Transfers In',
      abbr: 'IN',
      description: (lang) => lang === 'sk'
        ? 'Počet manažérov, ktorí tohto hráča kúpili pred najbližšou uzávierkou kola.'
        : 'Managers who transferred this player IN ahead of the next deadline.',
      align: 'right',
      getValue: (p) => p.transfers_in_event ?? 0,
      format: (val) => <span className="font-mono text-emerald-400 font-bold">+{Number(val).toLocaleString()}</span>
    },
    {
      key: 'transfers_out_event',
      label: (lang) => lang === 'sk' ? 'Predané' : 'Transfers Out',
      abbr: 'OUT',
      description: (lang) => lang === 'sk'
        ? 'Počet manažérov, ktorí tohto hráča predali pred najbližšou uzávierkou kola.'
        : 'Managers who transferred this player OUT ahead of the next deadline.',
      align: 'right',
      getValue: (p) => p.transfers_out_event ?? 0,
      format: (val) => <span className="font-mono text-rose-400 font-bold">-{Number(val).toLocaleString()}</span>
    },
    {
      key: 'net_transfers',
      label: (lang) => lang === 'sk' ? 'Čistá bilancia' : 'Net Transfers',
      abbr: 'NET',
      description: (lang) => lang === 'sk'
        ? 'Čistý rozdiel prestupov v aktuálnom kole (Kúpené - Predané). Hlavný indikátor zmien cien.'
        : 'Net transfer balance (In minus Out) this gameweek. Key price change driver.',
      align: 'right',
      getValue: (p) => (p.transfers_in_event ?? 0) - (p.transfers_out_event ?? 0),
      format: (val) => {
        const num = Number(val);
        const color = num > 0 ? 'text-emerald-400' : num < 0 ? 'text-rose-400' : 'text-slate-400';
        return <span className={`font-mono font-black ${color}`}>{num > 0 ? `+${num.toLocaleString()}` : num.toLocaleString()}</span>;
      }
    },
    {
      key: 'cost_change_start',
      label: (lang) => lang === 'sk' ? 'Zmena ceny' : 'Price Δ',
      abbr: 'Δ£',
      description: (lang) => lang === 'sk'
        ? 'Celkový pohyb ceny hráča od úvodnej štartovacej ceny na začiatku ročníka.'
        : 'Total price change since season start.',
      align: 'right',
      getValue: (p) => (p.cost_change_start ?? 0) / 10,
      format: (val) => {
        const num = Number(val);
        const color = num > 0 ? 'text-emerald-400' : num < 0 ? 'text-rose-400' : 'text-slate-400';
        return <span className={`font-mono font-bold ${color}`}>{num > 0 ? `+£${num.toFixed(1)}m` : num < 0 ? `-£${Math.abs(num).toFixed(1)}m` : '£0.0m'}</span>;
      }
    },
    {
      key: 'transfers_in',
      label: (lang) => lang === 'sk' ? 'Celk. nákupy' : 'Total In',
      abbr: 'TOT IN',
      description: (lang) => lang === 'sk'
        ? 'Celkový kumulatívny počet nákupov hráča od začiatku sezóny.'
        : 'Cumulative transfers in since gameweek 1.',
      align: 'right',
      getValue: (p) => p.transfers_in ?? 0,
      format: (val) => <span className="font-mono text-slate-300 text-xs">{Number(val).toLocaleString()}</span>
    }
  ]
};

const TAB_CONFIG: { 
  id: StatsTab; 
  label: (lang: Language) => string; 
  icon: React.ReactNode; 
  defaultSort: string 
}[] = [
  { 
    id: 'overview', 
    label: (lang) => lang === 'sk' ? 'Prehľad' : 'Overview', 
    icon: <LayoutDashboard size={14} />, 
    defaultSort: 'total_points' 
  },
  { 
    id: 'attack', 
    label: (lang) => lang === 'sk' ? 'Útok & xG' : 'Attack & xG', 
    icon: <Flame size={14} />, 
    defaultSort: 'goals_scored' 
  },
  { 
    id: 'defense', 
    label: (lang) => lang === 'sk' ? 'Obrana & Brankári' : 'Defense & GK', 
    icon: <Shield size={14} />, 
    defaultSort: 'clean_sheets' 
  },
  { 
    id: 'involvement', 
    label: (lang) => lang === 'sk' ? 'Bonusy & ICT' : 'Bonus & ICT', 
    icon: <Zap size={14} />, 
    defaultSort: 'bps' 
  },
  { 
    id: 'transfers', 
    label: (lang) => lang === 'sk' ? 'Prestupy & Trh' : 'Transfers & Market', 
    icon: <ArrowLeftRight size={14} />, 
    defaultSort: 'net_transfers' 
  },
];

const PlayerStats: React.FC<PlayerStatsProps> = ({ players, teams, fixtures }) => {
  const [lang, setLang] = useLanguage();
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [posFilter, setPosFilter] = useState<number | 'all'>('all');
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'total_points', 
    direction: 'desc' 
  });
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<FPLPlayer | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const activeColumns = useMemo(() => TAB_COLUMNS[activeTab], [activeTab]);

  const handleTabChange = (newTab: StatsTab) => {
    setActiveTab(newTab);
    const colExists = TAB_COLUMNS[newTab].some(c => c.key === sortConfig.key);
    if (!colExists) {
      const def = TAB_CONFIG.find(t => t.id === newTab)?.defaultSort || 'total_points';
      setSortConfig({ key: def, direction: 'desc' });
    }
  };

  // --- Leaderboard Data ---
  const filteredAndSortedPlayers = useMemo(() => {
    let result = players;

    // 1. Filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.web_name.toLowerCase().includes(lower) || 
        p.second_name.toLowerCase().includes(lower) ||
        p.first_name.toLowerCase().includes(lower)
      );
    }
    if (teamFilter !== 'all') {
      result = result.filter(p => p.team === teamFilter);
    }
    if (posFilter !== 'all') {
      result = result.filter(p => p.element_type === posFilter);
    }

    // 2. Sort
    result = [...result].sort((a, b) => {
      const metric = activeColumns.find(c => c.key === sortConfig.key);
      let valA: number | string = metric ? metric.getValue(a) : (a as any)[sortConfig.key];
      let valB: number | string = metric ? metric.getValue(b) : (b as any)[sortConfig.key];

      if (typeof valA === 'string') valA = parseFloat(valA) || 0;
      if (typeof valB === 'string') valB = parseFloat(valB) || 0;

      if (valA === valB) {
        return (b.total_points ?? 0) - (a.total_points ?? 0);
      }
      return sortConfig.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return result;
  }, [players, searchTerm, teamFilter, posFilter, sortConfig, activeColumns]);

  const paginatedPlayers = useMemo(() => {
    if (pageSize === 'all') return filteredAndSortedPlayers;
    return filteredAndSortedPlayers.slice(0, pageSize);
  }, [filteredAndSortedPlayers, pageSize]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const getTeam = (teamId: number) => teams.find(t => t.id === teamId);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig.key !== colKey) {
      return <span className="opacity-20 text-[10px] ml-0.5">↕</span>;
    }
    return (
      <span className="text-purple-400 font-black text-xs ml-0.5">
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Container Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-visible">
        {/* Header with Title & Language Switcher */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {lang === 'sk' ? 'PREMIER LEAGUE DATABÁZA' : 'PREMIER LEAGUE DATABASE'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {lang === 'sk' ? 'Štatistiky Hráčov' : 'Player Statistics'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                {lang === 'sk' 
                  ? 'Kompletné oficiálne štatistiky FPL rozdelené do prehľadných tematických kategórií. Kliknutím na meno hráča otvoríte jeho profil.'
                  : 'Official comprehensive FPL metrics organized into focused categories. Click any player name to open their full profile.'}
              </p>
            </div>

            {/* Top Controls: Language Switcher & Page Size */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Language Switcher */}
              <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-xl p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setLang('sk')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    lang === 'sk'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Slovenčina"
                >
                  <span className="text-sm leading-none">🇸🇰</span>
                  <span>SK</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    lang === 'en'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="English"
                >
                  <span className="text-sm leading-none">🇬🇧</span>
                  <span>EN</span>
                </button>
              </div>

              {/* Page Size Toggle */}
              <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-xl p-1">
                <span className="text-[10px] text-slate-400 font-bold px-2 uppercase tracking-wider hidden sm:inline">
                  {lang === 'sk' ? 'Zobraziť:' : 'Show:'}
                </span>
                {([50, 100, 'all'] as const).map((limit) => (
                  <button
                    key={limit}
                    onClick={() => setPageSize(limit)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      pageSize === limit
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {limit === 'all' ? (lang === 'sk' ? 'Všetci' : 'All') : `Top ${limit}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TAB SWITCHER */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar border-b border-slate-800/80 mb-4">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shadow-sm ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/20'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/40'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label(lang)}</span>
                </button>
              );
            })}
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-6 lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <input 
                type="text" 
                placeholder={lang === 'sk' ? "Hľadať hráča podľa mena..." : "Search player by name..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 text-white text-xs sm:text-sm rounded-xl pl-10 pr-9 py-2 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all placeholder:text-slate-500"
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
            <div className="relative sm:col-span-3 lg:col-span-4">
              <select 
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full bg-slate-950/80 border border-slate-700/80 text-white text-xs sm:text-sm rounded-xl px-3 py-2 appearance-none focus:ring-2 focus:ring-purple-500/50 outline-none cursor-pointer pr-8"
              >
                <option value="all">
                  {lang === 'sk' ? `Všetky kluby (${teams.length})` : `All Clubs (${teams.length})`}
                </option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.short_name})</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            {/* Position Filter */}
            <div className="relative sm:col-span-3 lg:col-span-3">
              <select 
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full bg-slate-950/80 border border-slate-700/80 text-white text-xs sm:text-sm rounded-xl px-3 py-2 appearance-none focus:ring-2 focus:ring-purple-500/50 outline-none cursor-pointer pr-8"
              >
                <option value="all">{lang === 'sk' ? 'Všetky pozície' : 'All Positions'}</option>
                <option value={1}>{lang === 'sk' ? 'Brankári (GKP)' : 'Goalkeepers (GKP)'}</option>
                <option value={2}>{lang === 'sk' ? 'Obrancovia (DEF)' : 'Defenders (DEF)'}</option>
                <option value={3}>{lang === 'sk' ? 'Záložníci (MID)' : 'Midfielders (MID)'}</option>
                <option value={4}>{lang === 'sk' ? 'Útočníci (FWD)' : 'Forwards (FWD)'}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Informative Tooltip Hint */}
        <div className="px-4 sm:px-6 py-2 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="text-blue-400 shrink-0" />
            <span>
              {lang === 'sk' ? (
                <>Pre vysvetlenie metriky prejdite myšou na ikonu <strong className="text-slate-300">(i)</strong> v záhlaví. Kliknutím zoradíte tabuľku.</>
              ) : (
                <>Hover over the <strong className="text-slate-300">(i)</strong> icon in any column header for explanations. Click to sort.</>
              )}
            </span>
          </div>
          <span className="font-mono text-slate-500 hidden sm:inline">
            {lang === 'sk' ? 'Zobrazených:' : 'Showing:'} <strong className="text-slate-300">{filteredAndSortedPlayers.length}</strong> {lang === 'sk' ? 'hráčov' : 'players'}
          </span>
        </div>

        {/* Table Container - compact padding & clear widths to avoid horizontal scroll */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-400 text-xs uppercase font-extrabold border-b border-slate-800 select-none">
                <th className="py-2.5 px-2 font-extrabold w-9 text-center text-slate-500">#</th>
                <th className="py-2.5 px-3 font-extrabold min-w-[130px] sm:min-w-[150px]">
                  {lang === 'sk' ? 'Hráč' : 'Player'}
                </th>
                <th className="py-2.5 px-2 font-extrabold w-20 sm:w-24">
                  {lang === 'sk' ? 'Klub' : 'Club'}
                </th>
                <th className="py-2.5 px-2 font-extrabold text-center w-14">
                  {lang === 'sk' ? 'Poz' : 'Pos'}
                </th>

                {/* Dynamic Columns for active tab with Info Tooltips */}
                {activeColumns.map((col) => {
                  const isSorted = sortConfig.key === col.key;
                  const label = col.label(lang);
                  const description = col.description(lang);

                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`py-2.5 px-2 sm:px-2.5 font-extrabold cursor-pointer transition-colors relative group/th ${
                        col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                      } ${isSorted ? 'text-white bg-slate-800/40' : 'hover:text-white hover:bg-slate-800/20'}`}
                    >
                      <div className={`inline-flex items-center gap-1 ${
                        col.align === 'center' ? 'justify-center' : col.align === 'left' ? 'justify-start' : 'justify-end'
                      }`}>
                        <span className="whitespace-nowrap">{label}</span>
                        <SortIcon colKey={col.key} />
                        
                        {/* Info Icon with Hover/Click Tooltip */}
                        <div
                          className="relative inline-flex items-center ml-0.5 group/info"
                          onMouseEnter={() => setActiveTooltip(col.key)}
                          onMouseLeave={() => setActiveTooltip(null)}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTooltip(curr => curr === col.key ? null : col.key);
                            }}
                            className="p-0.5 text-slate-500 hover:text-blue-400 group-hover/info:text-blue-400 transition-colors cursor-help focus:outline-none"
                            title={description}
                          >
                            <Info size={11} className="opacity-70 group-hover/info:opacity-100" />
                          </button>

                          {/* Hover Tooltip Popup */}
                          <div
                            className={`${
                              activeTooltip === col.key
                                ? 'visible opacity-100 pointer-events-auto'
                                : 'invisible opacity-0 pointer-events-none group-hover/info:visible group-hover/info:opacity-100'
                            } transition-all duration-200 absolute z-50 bottom-full mb-2 right-1/2 translate-x-1/2 w-60 sm:w-64 p-3 bg-slate-900/98 backdrop-blur-md text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 text-left normal-case font-normal`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                              <span className="font-bold text-white text-xs">{label}</span>
                              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {col.abbr}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-300">
                              {description}
                            </p>
                            <div className="mt-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
                              <span>{lang === 'sk' ? 'Kliknutím zoradíte' : 'Click column to sort'}</span>
                              <span className="text-purple-400 font-mono font-bold">{col.key}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
              {paginatedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={4 + activeColumns.length} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="text-base font-bold text-slate-300">
                        {lang === 'sk' ? 'Nenašli sa žiadni hráči' : 'No players found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lang === 'sk' 
                          ? 'Skúste zmeniť vyhľadávací výraz alebo upravte zvolené filtre.'
                          : 'Try adjusting your search query or clear the active filters.'}
                      </p>
                      <button
                        onClick={() => { setSearchTerm(''); setTeamFilter('all'); setPosFilter('all'); }}
                        className="text-xs text-purple-400 hover:text-purple-300 font-bold underline pt-2"
                      >
                        {lang === 'sk' ? 'Resetovať filtre' : 'Reset filters'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPlayers.map((player, idx) => {
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
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedPlayerForDetail(player)}
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 text-xs">
                        {idx + 1}
                      </td>

                      {/* Player Name */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
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
                      <td className="py-2.5 px-2 text-slate-300 font-medium">
                        <span className="hidden sm:inline">{team?.name || '—'}</span>
                        <span className="sm:hidden font-mono text-xs text-slate-400">{team?.short_name || '—'}</span>
                      </td>

                      {/* Position */}
                      <td className="py-2.5 px-2 text-center">
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
                            className={`py-2.5 px-2 sm:px-2.5 ${
                              col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                            } ${isSortedCol ? 'bg-purple-950/15' : ''}`}
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

        {/* Footer info */}
        <div className="p-3 sm:p-4 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
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

      {/* Player Detail Modal */}
      {selectedPlayerForDetail && (
        <PlayerDetailModal
          player={selectedPlayerForDetail}
          isOpen={true}
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