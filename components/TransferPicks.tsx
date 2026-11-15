import React, { useMemo, useState, useEffect } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import { ArrowLeftRight, TrendingUp, Calendar, DollarSign, Filter, Info, ChevronDown, ChevronUp, Calculator, Activity, HelpCircle, ArrowUpDown, Clock, Users, ChevronRight, AlertTriangle, Coins, RefreshCw, Target, Flame, Sparkles } from 'lucide-react';
import ResultChip from './ResultChip';
import { calculateLeaguePositions, getDynamicDifficulty } from '../lib/fdrModel';
import { computeTransferIndexForPlayers, TransferIndexResult } from '../lib/transferIndex';
import { projectPlayer } from '../lib/playerProjection';
import { track } from '@/lib/ga';
import { FortunaMatch } from '../services/oddsSnapshotService';
import { getGoalscorerOdds, GoalscorerOddsResult } from '../lib/goalscorerModel';
import { Top100Snapshot, Top100PlayerSignal, Top100TemplateTierPlayer } from '../services/top100Service';
import { findTop100Signal, findTop100TemplateTier } from '../lib/top100Matcher';
import { PlayerDetailModal } from './PlayerDetailModal';
import { useLanguage, Language } from '../lib/language';
import { t } from '../lib/translations';

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
    expectedPoints: number;
    startProbability: number;
    confidence: number;
    goalscorer?: GoalscorerOddsResult | null;
    top100Signal?: Top100PlayerSignal | null;
    top100Template?: Top100TemplateTierPlayer | null;
}

const POS_BADGE_CONFIG: Record<number, { short: string; color: string }> = {
    1: { short: "GKP", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    2: { short: "DEF", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    3: { short: "MID", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    4: { short: "FWD", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
};

// Tooltip metric descriptions and tactical interpretation tips for Transfer Picks table
const transferMetricDescriptions: Record<string, {
    label: (lang: Language) => string;
    abbr: string;
    description: (lang: Language) => string;
    tip?: (lang: Language) => string;
}> = {
    rank: {
        label: (lang) => lang === 'sk' ? 'Algoritmické poradie' : 'Rank',
        abbr: '#',
        description: (lang) => lang === 'sk'
            ? 'Poradie hráča v odporúčacom algoritme na prestup pre zvolený horizont.'
            : 'Algorithmic rank based on transfer recommendation index for the selected horizon.',
        tip: (lang) => lang === 'sk'
            ? 'Hráči na čele rebríčka predstavujú najefektívnejšiu kombináciu formy, priaznivého kalendára a trhových kurzov.'
            : 'Top-ranked players represent the optimal blend of form, favorable fixtures, and market odds.'
    },
    web_name: {
        label: (lang) => lang === 'sk' ? 'Hráč & Klub' : 'Player & Club',
        abbr: 'PLAYER',
        description: (lang) => lang === 'sk'
            ? 'Meno hráča, klub a pozícia (GKP, DEF, MID, FWD). Odznak Top 100 zobrazuje percento vlastníctva medzi elitou sveta a čisté zmeny v kádroch (+/-) za aktuálne kolo.'
            : 'Player name, club, and position. Top 100 badge displays ownership % among the world elite managers and net transfers (+/-).',
        tip: (lang) => lang === 'sk'
            ? 'Kliknutím na meno hráča kdekoľvek v tabuľke otvoríte podrobný profil s kompletnou históriou, grafom vývoja bodov a stávkovými kurzami.'
            : 'Click any player name to open the detailed modal with points evolution, full match log, and betting odds.'
    },
    transferIndex: {
        label: (lang) => lang === 'sk' ? 'Index prestupu (Algoritmus)' : 'Transfer Index',
        abbr: 'INDEX',
        description: (lang) => lang === 'sk'
            ? 'Kompozitné skóre odporúčania (0–100). Zohľadňuje formu hráča, očakávané body, pravdepodobnosť štartu, FDR náročnosť kalendára na 5 kôl a nákupy elity Top 100.'
            : 'Composite transfer recommendation score (0–100) weighing form, projected points, start probability, 5-GW fixture difficulty, and Top 100 elite transfers.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: 80+ = prémiová voľba na okamžitý nákup, 65–79 = silný a stabilný prestup, pod 50 = špekulácia alebo vyššie riziko.'
            : 'How to read: 80+ = prime buy candidate, 65–79 = solid transfer target, below 50 = speculative or higher risk.'
    },
    now_cost: {
        label: (lang) => lang === 'sk' ? 'Cena v FPL' : 'Price',
        abbr: 'PRICE',
        description: (lang) => lang === 'sk'
            ? 'Aktuálna trhová hodnota hráča v oficiálnej hre Fantasy Premier League.'
            : 'Current player market value in Fantasy Premier League.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Lacnejší hráči s vysokým indexom (napr. obrancovia za £4.5m–£5.0m) sú kľúčoví pre uvoľnenie rozpočtu na prémiové hviezdy.'
            : 'How to read: Budget players with high index scores free up crucial bank value for premium picks.'
    },
    selected_by_percent: {
        label: (lang) => lang === 'sk' ? 'Celosvetové vlastníctvo' : 'Ownership (TSB%)',
        abbr: 'OWNERSHIP',
        description: (lang) => lang === 'sk'
            ? 'Percento všetkých manažérov na svete, ktorí majú hráča vo svojom tíme (Teams Selected By).'
            : 'Percentage of all active FPL managers worldwide who own this player (Teams Selected By).',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Vysoké vlastníctvo (30%+) chráni váš rank (tzv. template). Nízke vlastníctvo (<10%) slúži ako diferenciál – ak zaboduje, katapultuje vás v rebríčku vpred!'
            : 'How to read: High ownership (30%+) protects your rank (template). Low ownership (<10%) acts as a powerful differential to climb leagues.'
    },
    form: {
        label: (lang) => lang === 'sk' ? 'Forma (FPL body/zápas)' : 'Form',
        abbr: 'FORM',
        description: (lang) => lang === 'sk'
            ? 'Priemerný bodový zisk hráča za jeden zápas za posledných 30 dní v oficiálnom FPL.'
            : 'Average points scored per match over the last 30 days in official FPL.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: 7.0+ = elitná strelecká/bodová forma. Pozor: vysoká forma pri náročnom kalendári (FDR 4–5) môže rýchlo klesnúť, preto sledujte aj stĺpec DIFF.'
            : 'How to read: 7.0+ = elite form. Note: strong form with upcoming tough fixtures (FDR 4–5) may regress, so always check DIFF too.'
    },
    startProbability: {
        label: (lang) => lang === 'sk' ? 'Pravdepodobnosť štartu' : 'Start Probability',
        abbr: 'START %',
        description: (lang) => lang === 'sk'
            ? 'Odhadovaná šanca na štart v základnej zostave na najbližšie ligové kolo na základe zdravotného stavu a rotácie.'
            : 'Estimated probability of starting in the upcoming fixture based on injury news and rotation risk.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: 100% = plná pripravenosť, 75% = otáznik alebo drobné zranenie, 50% a menej = vysoké riziko neúčasti alebo lavičky.'
            : 'How to read: 100% = fully fit, 75% = doubt/knock, 50% or less = high bench or absence risk.'
    },
    goalProb: {
        label: (lang) => lang === 'sk' ? 'Stávkové kurzy Fortuna' : 'Fortuna Live Odds',
        abbr: 'ODDS',
        description: (lang) => lang === 'sk'
            ? 'Reálne stávkové kurzy z Fortuna.sk prepočítané na percentuálnu pravdepodobnosť na najbližšie ligové kolo (Čisté konto pre DEF/GKP, Gól/Asistencia pre MID/FWD).'
            : 'Real betting odds from Fortuna.sk converted into win/clean sheet/goal probability for the next gameweek.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Objektívne ocenenie trhu stávkových kancelárií. Šanca nad 35% na čisté konto alebo nad 45% na gól/asistenciu signalizuje vysoko priaznivý zápas.'
            : 'How to read: Market-based valuation. Clean sheet chance >35% or G+A >45% indicates prime point potential.'
    },
    upcomingGw: {
        label: (lang) => lang === 'sk' ? 'Ligové kolo a súper' : 'Gameweek Fixture',
        abbr: 'FIXTURE',
        description: (lang) => lang === 'sk'
            ? 'Súper v danom kole s označením domáceho (H) alebo vonkajšieho (A) zápasu a FDR náročnosťou.'
            : 'Opponent team for that gameweek, venue (Home/Away), and FDR difficulty rating.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Zelená (FDR 1–2) = veľmi priaznivý súper na body, Sivá (3) = vyrovnaný duel, Oranžová/Červená (4–5) = náročný gigant.'
            : 'How to read: Green (1–2) = favorable scoring matchup, Grey (3) = balanced, Orange/Red (4–5) = tough elite team.'
    },
    fixtureDifficultySum: {
        label: (lang) => lang === 'sk' ? 'Súčet obtiažnosti (5 kôl)' : 'Difficulty Sum (DIFF)',
        abbr: 'DIFF',
        description: (lang) => lang === 'sk'
            ? 'Súčet FDR koeficientov (1–5) súperov v najbližších 5 ligových kolách. Čím nižšie číslo, tým priaznivejší kalendár.'
            : 'Sum of FDR ratings across the next 5 fixtures. Lower total means a much easier run of games.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Hodnota 8–12 znamená mimoriadne ľahký žreb a ideálny čas na kúpu. Hodnota 17+ varuje pred ťažkou sériou zápasov.'
            : 'How to read: Score 8–12 = dream fixture run, prime time to transfer in. Score 17+ warns of grueling schedule.'
    },
    top100Own: {
        label: (lang) => lang === 'sk' ? 'Vlastníctvo v Top 100' : 'Top 100 Ownership',
        abbr: 'TOP 100 %',
        description: (lang) => lang === 'sk'
            ? 'Percentuálne zastúpenie hráča v tímoch 100 celosvetovo najlepších manažérov Fantasy Premier League.'
            : 'Percentage of the top 100 worldwide FPL managers who currently hold this player in their squad.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Ak má hráč u elity 70%+ vlastníctvo, je to základný pilier ("Core Template"). Ak ho elita nakupuje skôr než bežný trh, ide o silný prediktívny signál.'
            : 'How to read: 70%+ elite ownership denotes a core template player. Early adoption by top 100 signals an impending market trend.'
    },
    top100Net: {
        label: (lang) => lang === 'sk' ? 'Net prestupy v Top 100' : 'Top 100 Net Transfers',
        abbr: 'T100 NET',
        description: (lang) => lang === 'sk'
            ? 'Čistá bilancia prestupov (nákupy mínus predaje) tohto hráča medzi manažérmi Top 100 za aktuálne kolo.'
            : 'Net transfers (in minus out) for this player among top 100 elite managers in the current gameweek.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Kladné číslo (napr. +8) značí masívny záujem elity ešte pred rastom celosvetovej ceny. Záporné číslo varuje pred výpredajom.'
            : 'How to read: Positive values (e.g. +8) indicate heavy elite buying before global price rises. Negative values warn of sell-offs.'
    },
    horizon_next: {
        label: (lang) => lang === 'sk' ? 'Horizont: Najbližšie kolo' : 'Horizon: Next GW',
        abbr: 'NEXT GW',
        description: (lang) => lang === 'sk'
            ? 'Prepne prestupový algoritmus na okamžitý transfer pre najbližšie jedno herné kolo (bodová projekcia xP pre daný zápas).'
            : 'Switches transfer algorithm to immediate single-match horizon (xP projection for the upcoming fixture).',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Vhodné pri použití Free Hit čipu, alebo ak potrebujete vyriešiť akútny problém a získať maximum bodov ihneď v tomto kole.'
            : 'How to read: Ideal for Free Hit chip or when targeting a short-term 1-week captain/punt.'
    },
    horizon_next5: {
        label: (lang) => lang === 'sk' ? 'Horizont: Najbližších 5 kôl' : 'Horizon: Next 5 GWs',
        abbr: 'NEXT 5 GWs',
        description: (lang) => lang === 'sk'
            ? 'Strednodobý plánovací horizont. Algoritmus hodnotí sériu 5 zápasov (FDR obtiažnosť), udržateľnosť formy a prestupové trendy elity Top 100.'
            : 'Medium-term planning horizon evaluating 5-fixture FDR run, underlying form sustainability, and Top 100 elite transfers.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Najlepšia voľba pre štandardné ligové prestupy. Zabezpečí, že hráča nekúpite len na jeden zápas, ale na stabilné bodovanie v ďalších týždňoch.'
            : 'How to read: Best choice for regular league transfers to ensure sustained points over the coming weeks.'
    },
    odds_cs: {
        label: (lang) => lang === 'sk' ? 'Kurzy na čisté konto' : 'Clean Sheet Odds',
        abbr: 'CLEAN SHEET',
        description: (lang) => lang === 'sk'
            ? 'Zobrazuje reálne stávkové kurzy a prepočítanú pravdepodobnosť, že tím v najbližšom kole neinkasuje gól (kľúčové pre DEF a GKP).'
            : 'Displays betting odds and probability of keeping a clean sheet in the upcoming match (essential for DEF and GKP).',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Čisté konto prináša brankárom a obrancom až 4 body (záložníkom 1 bod). Šanca nad 35% signalizuje špičkový defenzívny transfer.'
            : 'How to read: Clean sheets award 4 pts to defenders and goalkeepers. 35%+ probability represents prime defensive potential.'
    },
    odds_goal: {
        label: (lang) => lang === 'sk' ? 'Kurzy na strelenie gólu' : 'Anytime Goalscorer Odds',
        abbr: 'GOAL ODDS',
        description: (lang) => lang === 'sk'
            ? 'Pravdepodobnosť a kurz, že hráč strelí gól v najbližšom zápase podľa stávkovej ponuky Fortuna.sk.'
            : 'Probability and odds of player scoring a goal in the upcoming match according to Fortuna.sk.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Útočníci (FWD) získavajú za gól 4 body, záložníci (MID) 5 bodov. Pravdepodobnosť nad 40% značí elitného kanoniera s vysokým bodovým stropom.'
            : 'How to read: FWDs earn 4 pts per goal, MIDs earn 5 pts. 40%+ probability indicates a premium goal-threat captain candidate.'
    },
    odds_assist: {
        label: (lang) => lang === 'sk' ? 'Kurzy na asistenciu' : 'Assist Odds',
        abbr: 'ASSIST ODDS',
        description: (lang) => lang === 'sk'
            ? 'Pravdepodobnosť, že hráč zaznamená gólovú asistenciu v najbližšom ligovom zápase.'
            : 'Probability of player registering a goal assist in the upcoming match.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Každá asistencia v FPL prináša 3 body. Vynikajú v nej tvorcovia hry (kreatívni záložníci a ofenzívni krajní obrancovia zahrávajúci štandardky).'
            : 'How to read: Each assist awards 3 pts. Creative playmakers and set-piece taking wing-backs excel in this metric.'
    },
    odds_ga: {
        label: (lang) => lang === 'sk' ? 'Kurzy na gól alebo asistenciu' : 'Goal or Assist (G+A) Odds',
        abbr: 'G+A ODDS',
        description: (lang) => lang === 'sk'
            ? 'Kombinovaná pravdepodobnosť priamej gólovej účasti (Goal Involvement) hráča v najbližšom ligovom kole.'
            : 'Combined probability of direct Goal Involvement (Goal or Assist) in the upcoming match.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Najkomplexnejší ofenzívny ukazovateľ. Hráč so šancou 50%+ má viac než polovičnú pravdepodobnosť priviezť útočné body v danom kole.'
            : 'How to read: The most complete attacking metric. Players with 50%+ odds have a better-than-even chance of returning attacking points.'
    },
    refresh_odds: {
        label: (lang) => lang === 'sk' ? 'Aktualizácia kurzov Fortuna' : 'Refresh Fortuna Odds',
        abbr: 'FORTUNA SYNC',
        description: (lang) => lang === 'sk'
            ? 'Stiahne a prepočíta najčerstvejšie stávkové kurzy a pravdepodobnosti priamo z ponuky Fortuna.sk.'
            : 'Fetches and recalculates the freshest betting odds and probabilities directly from Fortuna.sk.',
        tip: (lang) => lang === 'sk'
            ? 'Ako chápať: Kurzy sa na trhu menia podľa zranení hráčov a potvrdených zostáv. Kliknutím získate najaktuálnejšie matematické ocenenie zápasov.'
            : 'How to read: Market odds shift based on team news and betting action. Click to update all probabilities.'
    }
};

const TransferPicks: React.FC<TransferPicksProps> = ({ players, teams, fixtures, events }) => {
    const [lang] = useLanguage();
    const [activePos, setActivePos] = useState<number | 'all'>('all'); // Default All
    const [horizon, setHorizon] = useState<'next' | 'next5'>('next5');
    const [showInfo, setShowInfo] = useState(false);
    const [hoveredCol, setHoveredCol] = useState<{
        label: string;
        abbr: string;
        description: string;
        tip?: string;
        rect: DOMRect;
    } | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'transferIndex',
        direction: 'desc'
    });
    const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);
    const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<FPLPlayer | null>(null);
    const [mobileTab, setMobileTab] = useState<'overview' | 'fixtures' | 'intel'>('overview');

    // Fortuna odds states
    const [oddsData, setOddsData] = useState<FortunaMatch[] | null>(null);
    const [oddsLastUpdated, setOddsLastUpdated] = useState<string | null>(null);
    const [isRefreshingOdds, setIsRefreshingOdds] = useState(false);
    const showOdds = true; // odds columns always on; cells render nothing when Fortuna data is missing
    const [oddsMetric, setOddsMetric] = useState<'cs' | 'goal' | 'assist' | 'ga'>('ga');
    const isOddsEligible = true;
    const effectiveOddsMetric = activePos === 1 ? 'cs' : oddsMetric;

    // Top 100 Manager signals state
    const [top100Data, setTop100Data] = useState<Top100Snapshot | null>(null);

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

        fetch('/api/top100')
            .then(res => res.json())
            .then(data => {
                if (data.available) {
                    setTop100Data(data);
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
        try {
            const res = await fetch('/api/odds', { method: 'POST' });
            const data = await res.json();
            if (data.success && Array.isArray(data.matches)) {
                setOddsData(data.matches);
                if (data.fetchedAt) setOddsLastUpdated(data.fetchedAt);
            }
        } catch {
        } finally {
            setIsRefreshingOdds(false);
        }
    };

    const handleButtonMouseEnter = (key: string) => (e: React.MouseEvent<HTMLElement>) => {
        const info = transferMetricDescriptions[key];
        if (!info) return;
        const rect = e.currentTarget.getBoundingClientRect();
        let desc = info.description(lang);
        if (key === 'refresh_odds' && oddsLastUpdated) {
            desc += ` (${lang === 'sk' ? 'Naposledy: ' : 'Last: '}${formatLastUpdated(oddsLastUpdated)})`;
        }
        setHoveredCol({
            label: info.label(lang),
            abbr: info.abbr,
            description: desc,
            tip: info.tip?.(lang),
            rect
        });
    };

    const nextEvent = events.find(e => e.is_next) || events.find(e => e.is_current) || events[0];
    const nextEventId = nextEvent ? nextEvent.id : 1;

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

    // 2. Process Players & Calculate Index + Goalscorer Odds + Top 100 Signals
    const processedPlayers = useMemo(() => {
        return computeTransferIndexForPlayers({
            players,
            fixtures,
            teams,
            events,
            lookahead: horizon === 'next' ? 1 : 5,
            horizon: horizon
        }).map(player => {
            const projected = projectPlayer(player, teams.find(team => team.id === player.team));
            const goalscorer = getGoalscorerOdds(player, teams, fixtures, nextEventId, oddsData);
            const top100Signal = findTop100Signal(player, top100Data);
            const top100Template = findTop100TemplateTier(player, top100Data);
            return {
                ...player,
                ...projected,
                goalscorer,
                top100Signal,
                top100Template,
            };
        });
    }, [players, fixtures, teams, events, horizon, nextEventId, oddsData, top100Data]);

    const getLiveOddsMetric = (p: PlayerTransferStats) => {
        if (!p.goalscorer) return null;
        const m =
            effectiveOddsMetric === 'cs'
                ? p.goalscorer.cleanSheet
                : effectiveOddsMetric === 'assist'
                ? p.goalscorer.assist
                : effectiveOddsMetric === 'ga'
                ? p.goalscorer.goalOrAssist
                : p.goalscorer.goal;
        if (!m || m.source !== 'fortuna_live') return null;
        return m;
    };

    // 3. Sorting & Filtering
    const displayPlayers = useMemo(() => {
        let filtered = activePos === 'all'
            ? processedPlayers
            : processedPlayers.filter(p => p.element_type === activePos);

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
            if (sortConfig.key === 'goalProb') {
                valA = getLiveOddsMetric(a)?.prob ?? -1;
                valB = getLiveOddsMetric(b)?.prob ?? -1;
            }
            if (sortConfig.key === 'goalOdds') {
                valA = getLiveOddsMetric(a)?.odds ?? 999;
                valB = getLiveOddsMetric(b)?.odds ?? 999;
            }
            if (sortConfig.key === 'top100Own') {
                valA = a.top100Template?.top100Own ?? -1;
                valB = b.top100Template?.top100Own ?? -1;
            }
            if (sortConfig.key === 'top100Net') {
                valA = a.top100Signal?.net ?? -999;
                valB = b.top100Signal?.net ?? -999;
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
    }, [processedPlayers, activePos, sortConfig, oddsMetric]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Get next GW headers (always 5 slots so the table layout never shifts on toggle)
    const upcomingGwHeaders = Array.from({ length: 5 }, (_, i) => (nextEvent?.id || 1) + i).filter(id => id <= 38);

    // Sorting Header Component with Explainer Tooltip
    const SortHeader: React.FC<{
        label: string;
        sortKey: string;
        tooltipKey?: string;
        align?: "left" | "right" | "center";
        className?: string;
    }> = ({ label, sortKey, tooltipKey, align = "left", className = "" }) => {
        const isActive = sortConfig.key === sortKey;
        const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
        const pxClass = className.split(' ').some(c => c.startsWith('px-')) ? '' : 'px-3';
        const pyClass = className.split(' ').some(c => c.startsWith('py-')) ? '' : 'py-3';
        const effectiveTooltipKey = tooltipKey || (sortKey.startsWith('GW') ? 'upcomingGw' : sortKey);
        const metricInfo = transferMetricDescriptions[effectiveTooltipKey];

        const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
            if (!metricInfo) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setHoveredCol({
                label: metricInfo.label(lang),
                abbr: metricInfo.abbr,
                description: metricInfo.description(lang),
                tip: metricInfo.tip?.(lang),
                rect
            });
        };

        return (
            <th
                className={`${pyClass} ${pxClass} cursor-pointer hover:text-white transition-colors group select-none ${alignClass} ${className}`.trim()}
                onClick={() => handleSort(sortKey)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setHoveredCol(null)}
            >
                {align === "center" ? (
                    <div className="w-full flex items-center justify-center">
                        <div className="relative inline-flex items-center justify-center">
                            <span className="border-b border-dotted border-slate-600/70 group-hover:border-blue-400 transition-colors">
                                {label}
                            </span>
                            <span className="absolute left-full ml-1 flex items-center">
                                {isActive ? (
                                    sortConfig.direction === 'asc' ? <ChevronUp size={13} className="text-blue-400 shrink-0" /> : <ChevronDown size={13} className="text-blue-400 shrink-0" />
                                ) : (
                                    <ArrowUpDown size={13} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                )}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
                        <span className="border-b border-dotted border-slate-600/70 group-hover:border-blue-400 transition-colors">
                            {label}
                        </span>
                        {isActive ? (
                            sortConfig.direction === 'asc' ? <ChevronUp size={13} className="text-blue-400 shrink-0" /> : <ChevronDown size={13} className="text-blue-400 shrink-0" />
                        ) : (
                            <ArrowUpDown size={13} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                    </div>
                )}
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
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                                <ArrowLeftRight className="text-blue-400 shrink-0" /> {horizon === 'next' ? t('tp_next_gw_rankings', lang) : t('tp_algo_picks', lang)}
                            </h2>
                        </div>
                        <div className="shrink-0 bg-slate-700/50 p-1.5 rounded-lg group-hover:bg-slate-700 transition-colors">
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
                                    {t('tp_the_algo', lang)}
                                </h4>
                                {horizon === 'next' ? (
                                    <>
                                        <p className="text-slate-300 leading-relaxed text-[11px]">
                                            {t('tp_algo_expl_next', lang)}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
                                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-blue-400 whitespace-nowrap">50% Next Fixture</span>
                                            <span className="flex items-center">+</span>
                                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-purple-400 whitespace-nowrap">30% Minutes</span>
                                            <span className="flex items-center">+</span>
                                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-green-400 whitespace-nowrap">20% Form</span>
                                        </div>
                                        <div className="space-y-1.5 pt-1">
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                Fixture mapping: Easy/Good 0.85 • Moderate 0.65 • Hard 0.40 • Very Hard/Blank 0.25
                                            </p>
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
                                                Home bonus: +0.05 (max 1.0)
                                            </p>
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                Minutes: chance_of_playing_next_round (null =&gt; 100%)
                                            </p>
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                Form: form/8 (clamped 0..1)
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-300 leading-relaxed text-[11px]">
                                            Transfer Index (0–100) planning for the mid-term (5 GWs). Equal weight on form and fixture run.
                                        </p>
                                        <div className="flex gap-2 text-[10px] text-slate-400">
                                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">50% Form</span>
                                            <span className="flex items-center">+</span>
                                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">50% Fixtures</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                                            Dynamic FDR adjusts based on opponent key-player form and league position.
                                        </p>
                                    </>
                                )}
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
                                        <p className="text-slate-300 font-medium">{horizon === 'next' ? 'Minutes / Availability' : 'Diff Score'}</p>
                                        <p className="text-slate-500">
                                            {horizon === 'next'
                                                ? 'Minutes uses FPL chance_of_playing_next_round (null treated as 100%).'
                                                : 'Upcoming fixture difficulty sum. Blanks are penalised as 6 points.'}
                                        </p>
                                    </div>
                                    {isOddsEligible && (
                                        <div className="space-y-1">
                                            <p className="text-amber-400 font-medium flex items-center gap-1">
                                                <Coins size={12} /> {lang === 'sk' ? 'Stávkové kurzy (Fortuna)' : 'Bookmaker Odds (Fortuna)'}
                                            </p>
                                            <p className="text-slate-500">
                                                {lang === 'sk'
                                                    ? 'Kurzy a pravdepodobnosti na gól, asistenciu a celkový kanadský bod (G+A) v najbližšom kole z live kurzov Fortuny alebo z tímového xG modelu.'
                                                    : 'Odds and probabilities for anytime goalscorer, assists, and total goal involvement (G+A) in the upcoming gameweek derived from Fortuna live lines or team xG expectation.'}
                                            </p>
                                        </div>
                                    )}
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


            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                {/* Position Tabs */}
                <div className="grid grid-cols-5 md:flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 self-start">
                    {(['all', 1, 2, 3, 4] as const).map(pos => (
                        <button
                            key={pos}
                            onClick={() => {
                                setActivePos(pos);
                                setExpandedPlayerId(null);
                                if (pos === 1 || pos === 2) {
                                    setOddsMetric('cs');
                                } else if (oddsMetric === 'cs') {
                                    setOddsMetric('ga');
                                }
                                const posLabels: Record<number | string, string> = { all: "ALL", 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
                                track("transfer_picks_interaction", { action: "select_position", position: posLabels[pos] });
                            }}
                            className={`px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition-all ${activePos === pos ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        >
                            {pos === 'all' && (lang === 'sk' ? 'Všetci' : 'All')}
                            {pos === 1 && t('tp_pos_gkp', lang)}
                            {pos === 2 && t('tp_pos_def', lang)}
                            {pos === 3 && t('tp_pos_mid', lang)}
                            {pos === 4 && t('tp_pos_fwd', lang)}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                    {/* Horizon Toggle */}
                    <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
                        <button
                            onClick={() => setHorizon('next')}
                            onMouseEnter={handleButtonMouseEnter('horizon_next')}
                            onMouseLeave={() => setHoveredCol(null)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${horizon === 'next' ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        >
                            {t('tp_horizon_next', lang)}
                        </button>
                        <button
                            onClick={() => setHorizon('next5')}
                            onMouseEnter={handleButtonMouseEnter('horizon_next5')}
                            onMouseLeave={() => setHoveredCol(null)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${horizon === 'next5' ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        >
                            {t('tp_horizon_next5', lang)}
                        </button>
                    </div>

                    {/* Odds Toggle & Metric Selector for DEF, MID and FWD */}
                    {isOddsEligible && (
                        <div className="flex items-center gap-1.5 flex-wrap">

                            {showOdds && (
                                <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
                                    {(activePos === 'all' || activePos === 1 || activePos === 2) && (
                                        <button
                                            onClick={() => setOddsMetric('cs')}
                                            onMouseEnter={handleButtonMouseEnter('odds_cs')}
                                            onMouseLeave={() => setHoveredCol(null)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                effectiveOddsMetric === 'cs'
                                                    ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {t('tp_odds_mode_cs', lang)}
                                        </button>
                                    )}
                                    {activePos !== 1 && (
                                        <>
                                            <button
                                                onClick={() => setOddsMetric('goal')}
                                                onMouseEnter={handleButtonMouseEnter('odds_goal')}
                                                onMouseLeave={() => setHoveredCol(null)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    effectiveOddsMetric === 'goal'
                                                        ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {t('tp_odds_mode_goal', lang)}
                                            </button>
                                            <button
                                                onClick={() => setOddsMetric('assist')}
                                                onMouseEnter={handleButtonMouseEnter('odds_assist')}
                                                onMouseLeave={() => setHoveredCol(null)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    effectiveOddsMetric === 'assist'
                                                        ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {t('tp_odds_mode_assist', lang)}
                                            </button>
                                            <button
                                                onClick={() => setOddsMetric('ga')}
                                                onMouseEnter={handleButtonMouseEnter('odds_ga')}
                                                onMouseLeave={() => setHoveredCol(null)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    effectiveOddsMetric === 'ga'
                                                        ? 'bg-slate-600/50 text-slate-100 border-slate-500/60 shadow-sm'
                                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {t('tp_odds_mode_ga', lang)}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleRefreshOdds}
                                disabled={isRefreshingOdds}
                                onMouseEnter={handleButtonMouseEnter('refresh_odds')}
                                onMouseLeave={() => setHoveredCol(null)}
                                className="p-2 bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-300 hover:text-white transition-all disabled:opacity-50"
                                aria-label={oddsLastUpdated ? `Aktualizovať kurzy (naposledy: ${formatLastUpdated(oddsLastUpdated)})` : 'Aktualizovať kurzy z Fortuny'}
                            >
                                <RefreshCw size={13} className={isRefreshingOdds ? 'animate-spin text-amber-400' : 'text-slate-400'} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile View (Tabbed Table with Sticky Player Column) */}
            <div className="md:hidden space-y-2.5">
                {/* Mobile Column Category Tabs */}
                <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
                    <button
                        type="button"
                        onClick={() => setMobileTab('overview')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                            mobileTab === 'overview'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Activity size={13} className="shrink-0" />
                        <span className="truncate">{lang === 'sk' ? 'Prehľad' : 'Overview'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('fixtures')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                            mobileTab === 'fixtures'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Calendar size={13} className="shrink-0" />
                        <span className="truncate">{lang === 'sk' ? 'Zápasy / FDR' : 'Fixtures'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('intel')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                            mobileTab === 'intel'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Coins size={13} className="shrink-0" />
                        <span className="truncate">{lang === 'sk' ? 'Kurzy & Top 100' : 'Odds & Top 100'}</span>
                    </button>
                </div>

                {/* Mobile Table Container */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900/90 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-700">
                                    {/* Sticky Player Header */}
                                    <th
                                        onClick={() => handleSort('web_name')}
                                        onMouseEnter={(e) => {
                                            const info = transferMetricDescriptions.web_name;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredCol({
                                                label: info.label(lang),
                                                abbr: info.abbr,
                                                description: info.description(lang),
                                                tip: info.tip?.(lang),
                                                rect
                                            });
                                        }}
                                        onMouseLeave={() => setHoveredCol(null)}
                                        className="sticky left-0 z-20 bg-slate-900 py-2.5 px-2.5 min-w-[142px] max-w-[155px] border-r border-slate-700/80 shadow-[4px_0_8px_rgba(0,0,0,0.25)] cursor-pointer select-none group"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500 font-mono mr-1">#</span>
                                            <span className="border-b border-dotted border-slate-600/70 group-hover:border-blue-400 transition-colors">{t('tp_th_player', lang)}</span>
                                            {sortConfig.key === 'web_name' && (
                                                sortConfig.direction === 'asc'
                                                    ? <ChevronUp size={12} className="text-blue-400 shrink-0" />
                                                    : <ChevronDown size={12} className="text-blue-400 shrink-0" />
                                            )}
                                        </div>
                                    </th>

                                    {/* Always show Index column first so user has main ranking metric across tabs */}
                                    <SortHeader
                                        label={horizon === 'next' ? 'GW' : 'IDX'}
                                        sortKey="transferIndex"
                                        align="center"
                                        className="py-2.5 px-2 min-w-[54px]"
                                    />

                                    {mobileTab === 'overview' && (
                                        <>
                                            <SortHeader label={t('tp_th_price', lang)} sortKey="now_cost" align="center" className="py-2.5 px-2 min-w-[56px]" />
                                            <SortHeader label={t('tp_th_form', lang)} sortKey="form" align="center" className="py-2.5 px-2 min-w-[54px]" />
                                            <SortHeader label={lang === 'sk' ? 'Vlast.' : 'Own'} sortKey="selected_by_percent" align="center" className="py-2.5 px-2 min-w-[60px]" />
                                            <SortHeader label={t('tp_th_start', lang)} sortKey="startProbability" align="center" className="py-2.5 px-2 min-w-[56px]" />
                                        </>
                                    )}

                                    {mobileTab === 'fixtures' && (
                                        <>
                                            {(horizon === 'next' ? upcomingGwHeaders.slice(0, 1) : upcomingGwHeaders).map((gw) => (
                                                <SortHeader
                                                    key={gw}
                                                    label={`GW${gw}`}
                                                    sortKey={`GW${gw}`}
                                                    align="center"
                                                    className="py-2.5 px-1 min-w-[52px]"
                                                />
                                            ))}
                                            {horizon === 'next5' ? (
                                                <SortHeader
                                                    label={t('tp_th_diff', lang)}
                                                    sortKey="fixtureDifficultySum"
                                                    align="center"
                                                    className="py-2.5 px-2 min-w-[52px]"
                                                />
                                            ) : (
                                                <>
                                                    <SortHeader label={t('tp_th_start', lang)} sortKey="startProbability" align="center" className="py-2.5 px-2 min-w-[58px]" />
                                                    <SortHeader label={t('tp_th_form', lang)} sortKey="form" align="center" className="py-2.5 px-2 min-w-[54px]" />
                                                </>
                                            )}
                                        </>
                                    )}

                                    {mobileTab === 'intel' && (
                                        <>
                                            {isOddsEligible && showOdds && (
                                                <SortHeader
                                                    label={
                                                        effectiveOddsMetric === 'cs'
                                                            ? (lang === 'sk' ? 'Č. konto' : 'CS Odds')
                                                            : effectiveOddsMetric === 'assist'
                                                            ? (lang === 'sk' ? 'Asist %' : 'Ast Odds')
                                                            : effectiveOddsMetric === 'ga'
                                                            ? (lang === 'sk' ? 'G+A %' : 'G+A Odds')
                                                            : (lang === 'sk' ? 'Gól %' : 'Goal Odds')
                                                    }
                                                    sortKey="goalProb"
                                                    align="center"
                                                    className="py-2.5 px-2 min-w-[82px] text-amber-400"
                                                />
                                            )}
                                            <SortHeader
                                                label="Top 100 %"
                                                sortKey="top100Own"
                                                align="center"
                                                className="py-2.5 px-2 min-w-[74px]"
                                            />
                                            <SortHeader
                                                label="Top 100 Net"
                                                sortKey="top100Net"
                                                align="center"
                                                className="py-2.5 px-2 min-w-[78px]"
                                            />
                                        </>
                                    )}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-700/50 text-xs">
                                {displayPlayers.map((p, idx) => {
                                    return (
                                        <tr
                                            key={p.id}
                                            className="active:bg-slate-700/40 transition-colors"
                                        >
                                            {/* Sticky Left Column: Rank + Player Name + Team */}
                                            <td
                                                onClick={() => setSelectedPlayerForDetail(p)}
                                                className="sticky left-0 z-10 bg-slate-800 py-2.5 px-2.5 min-w-[142px] max-w-[155px] border-r border-slate-700/80 shadow-[4px_0_8px_rgba(0,0,0,0.25)] cursor-pointer"
                                            >
                                                <div className="flex items-start gap-1.5">
                                                    <span className="text-[10px] font-mono text-slate-500 font-bold w-4 shrink-0 pt-0.5">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-white text-xs truncate">
                                                                {p.web_name}
                                                            </span>
                                                            {p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 75 && (
                                                                <AlertTriangle size={10} className="text-red-500 shrink-0" />
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 leading-tight mt-0.5">
                                                            <span className="font-mono">{getTeamShort(p.team)}</span>
                                                            {activePos === 'all' && POS_BADGE_CONFIG[p.element_type] && (
                                                                <span className={`font-mono text-[9px] font-bold px-1 rounded border ${POS_BADGE_CONFIG[p.element_type].color}`}>
                                                                    {POS_BADGE_CONFIG[p.element_type].short}
                                                                </span>
                                                            )}
                                                            {mobileTab !== 'overview' && (
                                                                <>
                                                                    <span className="text-slate-600">•</span>
                                                                    <span className="font-mono text-blue-300">£{p.now_cost / 10}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Index Cell (Always visible across tabs) */}
                                            <td className="py-2.5 px-2 text-center">
                                                <div className="inline-flex flex-col items-center gap-0.5 min-w-[36px]">
                                                    <span
                                                        className={`font-black font-mono text-xs leading-none ${
                                                            p.transferIndex > 0.7
                                                                ? 'text-green-400'
                                                                : p.transferIndex > 0.5
                                                                ? 'text-blue-400'
                                                                : 'text-slate-300'
                                                        }`}
                                                    >
                                                        {Math.round(p.transferIndex * 100)}
                                                    </span>
                                                    <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${p.transferIndex > 0.7 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${p.transferIndex * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* TAB 1: OVERVIEW */}
                                            {mobileTab === 'overview' && (
                                                <>
                                                    <td className="py-2.5 px-2 text-center font-mono text-blue-300 text-xs font-semibold">
                                                        £{p.now_cost / 10}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-white text-xs">
                                                        <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                                                            {p.form}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-2 text-center font-mono text-slate-300 text-xs">
                                                        {p.selected_by_percent}%
                                                    </td>
                                                    <td className="py-2.5 px-2 text-center font-mono text-slate-300 text-xs">
                                                        {Math.round(p.startProbability * 100)}%
                                                    </td>
                                                </>
                                            )}

                                            {/* TAB 2: FIXTURES / FDR */}
                                            {mobileTab === 'fixtures' && (
                                                <>
                                                    {(horizon === 'next' ? upcomingGwHeaders.slice(0, 1) : upcomingGwHeaders).map((gw) => {
                                                        const fix = p.nextFixtures.find(f => f.event === gw);
                                                        if (!fix || fix.opponent === 0) {
                                                            return (
                                                                <td key={gw} className="py-1.5 px-1 text-center min-w-[52px]">
                                                                    <div className="w-full h-7 bg-slate-900 rounded flex items-center justify-center text-[10px] text-slate-600">
                                                                        -
                                                                    </div>
                                                                </td>
                                                            );
                                                        }
                                                        const oppShort = getTeamShort(fix.opponent);
                                                        const colorClass = getDifficultyColor(fix.difficulty);
                                                        return (
                                                            <td key={gw} className="py-1.5 px-1 text-center min-w-[52px]">
                                                                <div className={`w-full h-7 rounded flex flex-col items-center justify-center shadow-sm ${colorClass}`}>
                                                                    <span className="text-[10px] font-bold leading-none">{oppShort}</span>
                                                                    <span className="text-[8px] opacity-85 leading-none mt-0.5">
                                                                        ({fix.isHome ? (lang === 'sk' ? 'D' : 'H') : (lang === 'sk' ? 'V' : 'A')})
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    {horizon === 'next5' ? (
                                                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300 text-xs">
                                                            {p.fixtureDifficultySum}
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="py-2.5 px-2 text-center font-mono text-slate-300 text-xs">
                                                                {Math.round(p.startProbability * 100)}%
                                                            </td>
                                                            <td className="py-2.5 px-2 text-center font-mono font-bold text-green-400 text-xs">
                                                                {p.form}
                                                            </td>
                                                        </>
                                                    )}
                                                </>
                                            )}

                                            {/* TAB 3: ODDS & TOP 100 */}
                                            {mobileTab === 'intel' && (
                                                <>
                                                    {isOddsEligible && showOdds && (
                                                        <td className="py-2 px-2 text-center">
                                                            {(() => {
                                                                const metric = getLiveOddsMetric(p);
                                                                if (!metric || !p.goalscorer) {
                                                                    return <span className="text-slate-600 font-mono text-xs">-</span>;
                                                                }
                                                                const metricOdds = metric.odds;
                                                                const metricProb = metric.prob;
                                                                return (
                                                                    <div className="flex flex-col items-center justify-center leading-tight">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-mono font-bold text-white text-[11px]">
                                                                                {metricOdds.toFixed(2)}
                                                                            </span>
                                                                            <span
                                                                                className={`text-[9px] font-bold px-1 py-0.2 rounded font-mono ${
                                                                                    metricProb >= 0.40
                                                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                                                        : metricProb >= 0.25
                                                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                                                }`}
                                                                            >
                                                                                {Math.round(metricProb * 100)}%
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[9px] text-slate-400 mt-0.5">
                                                                            vs {metric.opponentShort || p.goalscorer.opponentShort} ({(metric.isHome ?? p.goalscorer.isHome) ? (lang === 'sk' ? 'D' : 'H') : (lang === 'sk' ? 'V' : 'A')})
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}

                                                    {/* Top 100 Ownership */}
                                                    <td className="py-2.5 px-2 text-center font-mono text-xs">
                                                        {p.top100Template?.top100Own != null ? (
                                                            <span
                                                                className={`px-1.5 py-0.5 rounded font-bold ${
                                                                    p.top100Template.top100Own >= 40
                                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                                        : 'bg-slate-700/60 text-slate-200 border border-slate-600/50'
                                                                }`}
                                                            >
                                                                {p.top100Template.top100Own}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600">-</span>
                                                        )}
                                                    </td>

                                                    {/* Top 100 Net Transfers */}
                                                    <td className="py-2.5 px-2 text-center font-mono text-xs">
                                                        {p.top100Signal?.net != null && p.top100Signal.net !== 0 ? (
                                                            <div className="flex flex-col items-center leading-tight">
                                                                <span
                                                                    className={`font-bold ${
                                                                        p.top100Signal.net > 0 ? 'text-emerald-400' : 'text-rose-400'
                                                                    }`}
                                                                >
                                                                    {p.top100Signal.net > 0 ? `+${p.top100Signal.net}` : p.top100Signal.net}
                                                                </span>
                                                                <span className="text-[9px] text-slate-500">
                                                                    +{p.top100Signal.in}/-{p.top100Signal.out}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600">-</span>
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-700/60 text-[10px] text-slate-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                            <Info size={11} className="text-blue-400 shrink-0" />
                            {lang === 'sk' ? 'Ťukni na meno hráča pre detail a históriu' : 'Tap player name for full details'}
                        </span>
                        <span className="font-mono text-slate-500">Top {displayPlayers.length}</span>
                    </div>
                </div>
            </div>

            {/* Main Table (Desktop Only) */}
            <div className="hidden md:block bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                                <th
                                    onMouseEnter={(e) => {
                                        const info = transferMetricDescriptions.rank;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredCol({
                                            label: info.label(lang),
                                            abbr: info.abbr,
                                            description: info.description(lang),
                                            tip: info.tip?.(lang),
                                            rect
                                        });
                                    }}
                                    onMouseLeave={() => setHoveredCol(null)}
                                    className="py-3 px-2 w-10 text-center text-xs cursor-help select-none"
                                >
                                    <span className="border-b border-dotted border-slate-600/70 hover:border-blue-400 transition-colors">#</span>
                                </th>
                                <SortHeader label={t('tp_th_player', lang)} sortKey="web_name" align="left" className="w-64 min-w-[190px]" />
                                <SortHeader
                                    label={horizon === 'next' ? t('tp_th_gw_score', lang) : t('tp_th_index', lang)}
                                    sortKey="transferIndex"
                                    align="left"
                                    className="w-36 min-w-[120px]"
                                />
                                <SortHeader label={t('tp_th_price', lang)} sortKey="now_cost" align="center" className="w-20" />
                                <SortHeader label={t('tp_th_ownership', lang)} sortKey="selected_by_percent" align="center" className="w-24" />
                                <SortHeader label={t('tp_th_form', lang)} sortKey="form" align="center" className="w-20" />
                                <SortHeader label={t('tp_th_start', lang)} sortKey="startProbability" align="center" className="w-20" />

                                {isOddsEligible && showOdds && (
                                    <SortHeader
                                        label={
                                            effectiveOddsMetric === 'cs'
                                                ? t('tp_th_cs_odds', lang)
                                                : effectiveOddsMetric === 'assist'
                                                ? t('tp_th_assist_odds', lang)
                                                : effectiveOddsMetric === 'ga'
                                                ? t('tp_th_ga_odds', lang)
                                                : t('tp_th_goal_odds', lang)
                                        }
                                        sortKey="goalProb"
                                        align="center"
                                        className="w-28 text-amber-400"
                                    />
                                )}

                                {upcomingGwHeaders.map((gw, idx) => {
                                    if (horizon === 'next' && idx > 0) {
                                        return <th key={gw} className="w-14 min-w-[50px] px-0.5" aria-hidden="true" />;
                                    }
                                    return (
                                        <SortHeader key={gw} label={`GW${gw}`} sortKey={`GW${gw}`} align="center" className="w-14 min-w-[50px] px-0.5" />
                                    );
                                })}

                                {horizon === 'next5' ? (
                                    <SortHeader label={t('tp_th_diff', lang)} sortKey="fixtureDifficultySum" align="center" className="w-16" />
                                ) : (
                                    <th className="w-16" aria-hidden="true" />
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-sm">
                            {displayPlayers.map((p, idx) => {
                                return (
                                    <tr
                                        key={p.id}
                                        className="hover:bg-slate-700/30 transition-all group relative"
                                    >
                                        <td className="py-3 px-2 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                                        <td className="py-3 px-3 text-left">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    onClick={() => setSelectedPlayerForDetail(p)}
                                                    className="text-left font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-1.5 group/p cursor-pointer"
                                                    title={t('tp_click_detail', lang)}
                                                >
                                                    <span className="group-hover/p:underline underline-offset-2">{p.web_name}</span>
                                                    <Info size={13} className="text-slate-500 group-hover/p:text-blue-400 opacity-60 group-hover/p:opacity-100 transition-all shrink-0" />
                                                </button>
                                                {(p.top100Template || p.top100Signal) && (() => {
                                                    const top100Own = p.top100Template?.top100Own;
                                                    const net = p.top100Signal?.net;
                                                    let text = '';
                                                    const ownWord = t('tp_top100_own', lang);
                                                    if (top100Own != null && net != null && net !== 0) {
                                                        text = `Top 100: ${top100Own}% ${ownWord} (${net > 0 ? `+${net}` : net})`;
                                                    } else if (top100Own != null) {
                                                        text = `Top 100: ${top100Own}% ${ownWord}`;
                                                    } else if (net != null) {
                                                        text = `Top 100: ${net > 0 ? `+${net}` : net} (GW${top100Data?.closedDeadlineGw || 8})`;
                                                    }
                                                    if (!text) return null;
                                                    const isPositive = (net != null && net > 0) || (top100Own != null && top100Own >= 40);
                                                    const isNegative = net != null && net < 0;
                                                    return (
                                                        <span
                                                            className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                                                isPositive
                                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                                                                    : isNegative
                                                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                                                                    : 'bg-slate-700/60 text-slate-300 border border-slate-600/50'
                                                            }`}
                                                            title={lang === 'sk' 
                                                                ? `Top 100 manažéri: ${top100Own != null ? `Vlastnené ${top100Own}% tímov` : ''}${net != null ? ` (Zmena v uzávierke: ${net > 0 ? `+${net}` : net})` : ''}`
                                                                : `Top 100 managers: ${top100Own != null ? `Owned by ${top100Own}% of teams` : ''}${net != null ? ` (Deadline change: ${net > 0 ? `+${net}` : net})` : ''}`
                                                            }
                                                        >
                                                            {text}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                                {getTeamShort(p.team)}
                                                {activePos === 'all' && POS_BADGE_CONFIG[p.element_type] && (
                                                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${POS_BADGE_CONFIG[p.element_type].color}`}>
                                                        {POS_BADGE_CONFIG[p.element_type].short}
                                                    </span>
                                                )}
                                                {horizon === 'next' && (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 75) && (
                                                    <span className="text-red-500 flex items-center gap-0.5 font-bold" title={`${p.chance_of_playing_next_round}% chance of playing`}>
                                                        <AlertTriangle size={10} /> {p.chance_of_playing_next_round}%
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-left">
                                            <div className="flex flex-col gap-1">
                                                <span
                                                    className={`font-bold font-mono text-sm leading-none ${p.transferIndex > 0.7 ? 'text-green-400' : p.transferIndex > 0.5 ? 'text-blue-400' : 'text-slate-400'}`}
                                                    title={t('tp_index_tooltip', lang)}
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
                                        <td className="py-3 px-3 text-center font-mono text-blue-300 text-sm">£{p.now_cost / 10}</td>
                                        <td className="py-3 px-3 text-center font-mono text-slate-300 text-sm">{p.selected_by_percent}%</td>
                                        <td className="py-3 px-3 text-center font-bold text-white text-sm">{p.form}</td>
                                        <td className="py-3 px-3 text-center font-mono text-slate-300 text-sm" title={lang === 'sk' ? `Istota štartu hráča: ${Math.round(p.startProbability * 100)}%` : `Starting probability: ${Math.round(p.startProbability * 100)}%`}>
                                            {Math.round(p.startProbability * 100)}%
                                        </td>

                                        {/* Odds for GKP, DEF, MID and FWD */}
                                        {isOddsEligible && showOdds && (
                                            <td className="py-2 px-2 text-center">
                                                {(() => {
                                                    const metric = getLiveOddsMetric(p);
                                                    if (!metric || !p.goalscorer) {
                                                        return <span className="text-slate-600 font-mono text-xs">-</span>;
                                                    }
                                                    const metricOdds = metric.odds;
                                                    const metricProb = metric.prob;

                                                    return (
                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-mono font-bold text-white text-xs">
                                                                    {metricOdds.toFixed(2)}
                                                                </span>
                                                                <span
                                                                    className={`text-[9px] font-bold px-1 py-0.2 rounded font-mono ${
                                                                        metricProb >= 0.40
                                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                                                                            : metricProb >= 0.25
                                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                                                                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                                    }`}
                                                                    title={
                                                                        lang === 'sk'
                                                                            ? `${effectiveOddsMetric === 'cs' ? 'Šanca na čisté konto' : effectiveOddsMetric === 'assist' ? 'Šanca na asistenciu' : effectiveOddsMetric === 'ga' ? 'Šanca na gól alebo asistenciu' : 'Šanca na gól'}: ${Math.round(metricProb * 100)}% (Fortuna Live kurz)`
                                                                            : `${effectiveOddsMetric === 'cs' ? 'Clean sheet probability' : effectiveOddsMetric === 'assist' ? 'Assist probability' : effectiveOddsMetric === 'ga' ? 'Goal or Assist probability' : 'Goal probability'}: ${Math.round(metricProb * 100)}% (Fortuna Live)`
                                                                    }
                                                                >
                                                                    {Math.round(metricProb * 100)}%
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] text-slate-400">
                                                                vs {metric.opponentShort || p.goalscorer.opponentShort} ({(metric.isHome ?? p.goalscorer.isHome) ? (lang === 'sk' ? 'D' : 'H') : (lang === 'sk' ? 'V' : 'A')})
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                        )}

                                        {/* Fixture Cells */}
                                        {upcomingGwHeaders.map((gw, idx) => {
                                            if (horizon === 'next' && idx > 0) {
                                                return <td key={gw} className="py-2 px-0.5 w-14 min-w-[50px]" aria-hidden="true" />;
                                            }

                                            const fix = p.nextFixtures.find(f => f.event === gw);
                                            if (!fix || fix.opponent === 0) {
                                                return (
                                                    <td key={gw} className="py-2 px-0.5 text-center w-14 min-w-[50px]">
                                                        <div className="w-full h-[1.95rem] bg-slate-800 rounded flex items-center justify-center text-[10px] text-slate-600">-</div>
                                                    </td>
                                                );
                                            }

                                            const oppShort = getTeamShort(fix.opponent);
                                            const colorClass = getDifficultyColor(fix.difficulty);

                                            return (
                                                <td key={gw} className="py-2 px-0.5 text-center w-14 min-w-[50px]">
                                                    <div className={`w-full h-[1.95rem] rounded flex flex-col items-center justify-center shadow-sm ${colorClass}`}>
                                                        <span className="text-[10px] font-bold leading-tight">{oppShort}</span>
                                                        <span className="text-[8px] opacity-80 leading-tight">({fix.isHome ? (lang === 'sk' ? 'D' : 'H') : (lang === 'sk' ? 'V' : 'A')})</span>
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        {horizon === 'next5' ? (
                                            <td className="py-3 px-2 text-center font-mono text-slate-400 text-sm">
                                                {p.fixtureDifficultySum}
                                            </td>
                                        ) : (
                                            <td className="py-3 px-2 w-16" aria-hidden="true" />
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DIFF SCORE Legend */}
            {
                horizon === 'next5' && (
                    <div className="mt-4 px-2">
                        <p className="text-xs text-slate-400 italic">
                            <span className="font-bold text-slate-300">Diff Score</span> = sum of Dynamic FDR (1–5) for the next 5 Gameweeks. Lower is better. Blank GWs count as 6 (worse than Very Hard).
                        </p>
                    </div>
                )
            }

            {/* Player Detail Modal */}
            {selectedPlayerForDetail && (
                <PlayerDetailModal
                    player={selectedPlayerForDetail}
                    isOpen={Boolean(selectedPlayerForDetail)}
                    onClose={() => setSelectedPlayerForDetail(null)}
                    teams={teams}
                    allPlayers={players}
                    top100Snapshot={top100Data}
                    fixtures={fixtures}
                    oddsData={oddsData}
                />
            )}

            {/* Column Explainer Tooltip */}
            {hoveredCol && (() => {
                const isNearTop = hoveredCol.rect.top < 240;
                const leftPos = Math.max(
                    160,
                    Math.min(
                        (typeof window !== 'undefined' ? window.innerWidth : 1000) - 160,
                        hoveredCol.rect.left + hoveredCol.rect.width / 2
                    )
                );

                return (
                    <div
                        style={{
                            position: 'fixed',
                            left: leftPos,
                            top: isNearTop ? hoveredCol.rect.bottom + 10 : hoveredCol.rect.top - 10,
                            transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
                        }}
                        className="z-[9999] pointer-events-none w-72 sm:w-80 p-3.5 bg-slate-900/98 backdrop-blur-md text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 text-left normal-case font-normal select-none transition-all duration-150 animate-in fade-in"
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                            <span className="font-bold text-white text-xs">{hoveredCol.label}</span>
                            <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {hoveredCol.abbr}
                            </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-300 whitespace-normal">
                            {hoveredCol.description}
                        </p>
                        {hoveredCol.tip && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 bg-slate-950/50 -mx-1 p-2 rounded-lg border border-slate-800/60">
                                <div className="flex items-start gap-1.5 text-[10.5px] leading-snug text-amber-200/90 font-medium">
                                    <Sparkles size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                    <span>{hoveredCol.tip}</span>
                                </div>
                            </div>
                        )}
                        {/* Arrow pointing to column header */}
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 border-slate-700 rotate-45 ${
                                isNearTop ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r'
                            }`}
                        />
                    </div>
                );
            })()}

        </div >
    );
};

export default TransferPicks;
