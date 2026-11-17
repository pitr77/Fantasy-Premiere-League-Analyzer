"use client";

import { supabase } from './lib/supabaseClient';
import React, { useEffect, useState } from 'react';
import { getBootstrapStatic, getFixtures } from './services/fplService';
import { BootstrapStatic, FPLFixture, FPLPlayer } from './types';
import Dashboard from './components/Dashboard';
import Fixtures from './components/Fixtures';
import TeamBuilder from './components/TeamBuilder';
import PlayerStats from './components/PlayerStats';
import TopManagers from './components/TopManagers';
import LeagueTable from './components/LeagueTable';
import TransferPicks from './components/TransferPicks';
import DetailedStats from './components/DetailedStats';
import OptimalSquad from './components/OptimalSquad';
import TeamAnalysis from './components/TeamAnalysis';
import PeriodAnalysis from './components/PeriodAnalysis';
import CompareMode from './components/CompareMode';
import MiniChallenge from './components/MiniChallenge';
import SquadSimulator from './components/SquadSimulator';
import LeagueOwnership from './components/LeagueOwnership';
import AnalyticsTracker from './components/AnalyticsTracker';
import { initGA } from './lib/analytics';
import { useLanguage } from './lib/language';
import { t } from './lib/translations';
import {
  LayoutDashboard,
  Calendar,
  Shirt,
  BarChart2,
  BrainCircuit,
  Menu,
  X,
  RefreshCw,
  Users,
  Trophy,
  ArrowLeftRight,
  Activity,
  Zap,
  Search,
  Split,
  TriangleAlert
} from 'lucide-react';

export enum View {
  DASHBOARD,
  FIXTURES,
  TEAM,
  STATS,
  DETAILED_STATS,
  TOP_MANAGERS,
  LEAGUE_TABLE,
  TRANSFER_PICKS,
  OPTIMAL_SQUAD,
  TEAM_ANALYSIS,
  PERIOD_ANALYSIS,
  COMPARE_MODE,
  LOCKED,
  SCOUT,
  CHALLENGE,
  SQUAD_SIMULATOR,
  LEAGUE_OWNERSHIP
}

function App() {
  const [view, setView] = useState<View>(View.FIXTURES);
  const PRO_PAYWALL_ENABLED = false;
  const ENABLE_EXPERIMENTAL_SECTIONS = false;
  const IS_LOCAL_DEV =
    process.env.NODE_ENV === 'development' ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
  const DEV_AUTH_BYPASS =
    process.env.NODE_ENV === 'development' &&
    (process.env.NEXT_PUBLIC_AUTH_BYPASS === '1' ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost'));
  const [data, setData] = useState<BootstrapStatic | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<FPLPlayer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [lang, setLang] = useLanguage();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bootstrap, fixturesData] = await Promise.all([
        getBootstrapStatic(),
        getFixtures()
      ]);
      setData(bootstrap);
      setFixtures(fixturesData);
    } catch (err) {
      console.error(err);
      setError("FPL Data Sync failed (FPL API might be down or rate-limited). This is NOT an AI token issue. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('v');
      if (v && (View as any)[v] !== undefined && typeof (View as any)[v] === 'number') {
        setView((View as any)[v]);
      }
    }
  }, []);

  const loadProfileTier = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      setTier('free');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', uid)
      .single();
    if (error || !data?.tier) {
      setTier('free');
      return;
    }
    setTier(data.tier === 'pro' ? 'pro' : 'free');
  };

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setUserEmail(null);
        setTier('free');
        return;
      }
      setUserEmail(data.user?.email ?? null);
      loadProfileTier();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      loadProfileTier();
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
        {/* Top Header Shell */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter">
              FPL STUDIO
            </span>
            <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-slate-400 border-l border-slate-700 pl-3 font-semibold">
              Free Fantasy Premier League Analytics
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-lg font-bold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>Syncing live gameweek stats...</span>
          </div>
        </header>

        {/* Substantive Content Shell (Rendered on SSR & while hydrating) */}
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 w-full flex-1 flex flex-col justify-center">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
              Fantasy Premier League Analytics & Tools
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              FPL Studio is a free decision-support suite providing real-time data, Top 100 manager consensus,
              dynamic fixture difficulty ratings (FDR), player performance projections, and AI gameweek previews.
            </p>
          </div>

          {/* Core Analytics Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 font-bold">
                01
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">Top 100 Elite Tracker</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Live consensus transfers in/out, captaincy picks, and squad templates from the world&apos;s top-ranked managers.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 font-bold">
                02
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">Dynamic FDR Matrix</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Matchup difficulty recalibrated after every gameweek based on rolling form, home/away splits, and goal threat.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 font-bold">
                03
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">Transfer Picks & Projections</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Algorithmic transfer recommendations blending expected goals (xG), assists (xA), and modeled clean sheet likelihoods.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 font-bold">
                04
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">AI Scout Previews</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tactical previews, captaincy recommendations, and differential picks generated before every gameweek deadline.
              </p>
            </div>
          </div>
        </main>

        {/* Persistent Non-Gambling Compliance Footer */}
        <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 px-4 text-center text-xs text-slate-500">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <span>FPL Studio</span>
              <span>•</span>
              <span>Free Fantasy Premier League Analytics</span>
              <span>•</span>
              <span>Not Premier League Affiliated</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              FPL Studio is a free decision-support and statistics platform built for Fantasy Premier League managers. 
              FPL Studio is not a gambling operator, does not offer sports betting, does not accept wagers or stakes, 
              and does not offer cash prizes. All statistical projections, player likelihoods, and difficulty ratings 
              are mathematical estimates provided strictly for informational and fantasy entertainment purposes.
            </p>
            <p className="text-[10px] text-slate-600">
              Data sourced from the official Fantasy Premier League API. Premier League and FPL are registered trademarks of The Football Association Premier League Limited.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-900/20 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-8">
          <TriangleAlert className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Sync Failed</h2>
        <p className="text-slate-400 mb-8 max-w-sm mx-auto">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black py-4 px-8 rounded-xl transition-all"
        >
          <RefreshCw className="w-5 h-5" /> Retry Sync
        </button>
      </div>
    );
  }

  if (!data) return null;

  const handleNavigate = (v: View, label: string, requiresAuth = false) => {
    const isAuthed = Boolean(userEmail) || DEV_AUTH_BYPASS;
    const isPro = tier === 'pro';

    if (requiresAuth && !isAuthed) {
      setLockedReason(`Sign in required to access ${label}.`);
      setView(View.LOCKED);
      setIsSidebarOpen(false);
      return;
    }

    if (requiresAuth && PRO_PAYWALL_ENABLED && !isPro) {
      setLockedReason(`${label} is a PRO feature. Upgrade to access.`);
      setView(View.LOCKED);
      setIsSidebarOpen(false);
      return;
    }

    setLockedReason(null);
    setView(v);
    setIsSidebarOpen(false);
  };

  const NavItem = ({
    v,
    label,
    icon: Icon,
    requiresAuth = false,
  }: {
    v: View;
    label: string;
    icon: any;
    requiresAuth?: boolean;
  }) => (
    <button
      onClick={() => handleNavigate(v, label, requiresAuth)}
      className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all min-w-0 ${view === v
        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <Icon size={20} />
      <span className="text-sm font-medium truncate">{label}</span>
      {PRO_PAYWALL_ENABLED && requiresAuth && tier !== 'pro' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          PRO
        </span>
      )}
    </button>
  );

  const HeaderNavItem = ({
    v,
    label,
    requiresAuth = false,
  }: {
    v: View;
    label: string;
    requiresAuth?: boolean;
  }) => (
    <button
      onClick={() => handleNavigate(v, label, requiresAuth)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative ${view === v
        ? 'text-white bg-purple-600/20 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
        }`}
    >
      {label}
      {PRO_PAYWALL_ENABLED && requiresAuth && tier !== 'pro' && (
        <span className="absolute -top-1 -right-2 text-[8px] px-1 rounded-full bg-purple-600 text-white font-bold scale-75">
          PRO
        </span>
      )}
    </button>
  );

  const ScoutLink = ({ mobile = false }: { mobile?: boolean }) => (
    <a
      href="/scout"
      className={mobile
        ? "w-full flex items-center px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-sm font-medium"
        : "px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all"
      }
    >
      <span>{t('nav_scout', lang)}</span>
    </a>
  );

  const AccountBar = () => (
    <div className="flex items-center gap-3">
      {/* Global Language Toggle */}
      <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => setLang('sk')}
          className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${lang === 'sk'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
            }`}
          title="Slovenčina"
        >
          <span className="text-[11px]">🇸🇰</span>
          <span>SK</span>
        </button>
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${lang === 'en'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
            }`}
          title="English"
        >
          <span className="text-[11px]">🇬🇧</span>
          <span>EN</span>
        </button>
      </div>

      {userEmail && (
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <span className="hidden lg:inline text-[11px] text-slate-400">
            Signed in as <span className="text-slate-200 font-semibold">{userEmail}</span>
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-3 py-1.5 transition-colors"
          >
            {t('nav_sign_out', lang)}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col">
      <AnalyticsTracker currentView={View[view]} />

      <header className="hidden md:flex sticky top-0 z-50 h-14 w-full bg-slate-900/80 backdrop-blur-md border-b border-white/5 items-center px-6 justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleNavigate(View.DASHBOARD, 'Dashboard')}
            className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter hover:opacity-80 transition-opacity"
          >
            FPL STUDIO
          </button>

          <nav className="flex items-center gap-1">
            <HeaderNavItem v={View.FIXTURES} label={t('nav_fixtures', lang)} />
            <HeaderNavItem v={View.TRANSFER_PICKS} label={t('nav_transfer_picks', lang)} />
            <HeaderNavItem v={View.STATS} label={t('nav_player_stats', lang)} />
            <HeaderNavItem v={View.LEAGUE_TABLE} label={t('nav_league_table', lang)} />
            <HeaderNavItem v={View.TEAM_ANALYSIS} label={t('nav_team_analysis', lang)} />
            <HeaderNavItem v={View.TOP_MANAGERS} label={t('nav_top_managers', lang)} />
            {IS_LOCAL_DEV && <HeaderNavItem v={View.LEAGUE_OWNERSHIP} label={t('nav_league_ownership', lang)} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <HeaderNavItem v={View.OPTIMAL_SQUAD} label={t('nav_optimal_squad', lang)} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <HeaderNavItem v={View.TEAM} label={t('nav_my_team', lang)} />}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ScoutLink />
          <AccountBar />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 z-50 flex items-center justify-between px-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-white shadow-lg transition-transform active:scale-95"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            onClick={() => {
              handleNavigate(View.DASHBOARD, 'Dashboard');
              setIsSidebarOpen(false);
            }}
            className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400"
          >
            FPL STUDIO
          </button>
          <div className="flex items-center gap-2">
            <ScoutLink />
            <AccountBar />
          </div>
        </div>

        <div
          className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>

        <aside className={`fixed top-0 left-0 z-50 w-72 h-full bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden flex flex-col`}>
          <div className="p-6 border-b border-slate-800 shrink-0 flex items-center justify-between">
            <button
              onClick={() => {
                handleNavigate(View.DASHBOARD, 'Dashboard');
                setIsSidebarOpen(false);
              }}
              className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter text-left"
            >
              FPL STUDIO
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
            <NavItem v={View.FIXTURES} label={t('nav_fixtures', lang)} icon={Calendar} />
            <NavItem v={View.TRANSFER_PICKS} label={t('nav_transfer_picks', lang)} icon={ArrowLeftRight} />
            <NavItem v={View.STATS} label={t('nav_player_stats', lang)} icon={BarChart2} />
            <NavItem v={View.LEAGUE_TABLE} label={t('nav_league_table', lang)} icon={Trophy} />
            <NavItem v={View.TEAM_ANALYSIS} label={t('nav_team_analysis', lang)} icon={Search} />
            <NavItem v={View.DETAILED_STATS} label={lang === 'sk' ? 'Detailné analýzy' : 'Detailed Analyses'} icon={Activity} />
            <NavItem v={View.TOP_MANAGERS} label={t('nav_top_managers', lang)} icon={Users} />
            {IS_LOCAL_DEV && <NavItem v={View.LEAGUE_OWNERSHIP} label={t('nav_league_ownership', lang)} icon={Trophy} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.OPTIMAL_SQUAD} label={t('nav_optimal_squad', lang)} icon={Zap} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.TEAM} label={t('nav_my_team', lang)} icon={Shirt} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.COMPARE_MODE} label={lang === 'sk' ? 'Porovnanie' : 'Compare Mode'} icon={Split} />}
            <ScoutLink mobile={true} />
          </nav>

          <div className="p-6 border-t border-slate-800 shrink-0 bg-slate-900">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Data by FPL API <br /> Not PL Affiliated
            </div>
          </div>
        </aside>

        <main className="flex-1 h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 scroll-smooth custom-scrollbar">
          <div className={`${view === View.COMPARE_MODE ? 'w-full' : 'max-w-7xl'} mx-auto h-full`}>
            {view === View.DASHBOARD && (
              <Dashboard
                data={data}
                myTeam={myTeam}
                fixtures={fixtures}
                onNavigate={handleNavigate}
              />
            )}

            {view === View.LOCKED && (
              <div className="max-w-xl mx-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
                <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 mb-6">
                  <Zap size={32} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Access Locked</h2>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  {lockedReason ?? (userEmail ? 'This feature is not available on your plan.' : 'Please sign in to access this premium analysis.')}
                </p>
                {!userEmail ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <a href="/login" className="w-full sm:w-auto text-center bg-purple-600 hover:bg-purple-500 text-white font-black px-8 py-3 rounded-xl transition-all">Log in</a>
                    <a href="/login?mode=signup" className="w-full sm:w-auto text-center bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-3 rounded-xl transition-all border border-slate-700">Create account</a>
                  </div>
                ) : (
                  <button onClick={() => setView(View.DASHBOARD)} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-3 rounded-xl transition-all border border-slate-700">Back to Dashboard</button>
                )}
              </div>
            )}

            {view === View.LEAGUE_TABLE && <LeagueTable teams={data.teams} fixtures={fixtures} />}
            {view === View.TEAM_ANALYSIS && <TeamAnalysis teams={data.teams} fixtures={fixtures} />}
            {view === View.PERIOD_ANALYSIS && <PeriodAnalysis players={data.elements} teams={data.teams} events={data.events} />}
            {view === View.FIXTURES && <Fixtures fixtures={fixtures} teams={data.teams} events={data.events} players={data.elements} />}
            {view === View.TRANSFER_PICKS && <TransferPicks players={data.elements} teams={data.teams} fixtures={fixtures} events={data.events} />}
            {view === View.SQUAD_SIMULATOR && (
              <SquadSimulator
                allPlayers={data.elements}
                teams={data.teams}
                events={data.events}
                fixtures={fixtures}
              />
            )}
            {view === View.OPTIMAL_SQUAD && <OptimalSquad players={data.elements} teams={data.teams} />}
            {view === View.TEAM && <TeamBuilder allPlayers={data.elements} teams={data.teams} events={data.events} myTeam={myTeam} setMyTeam={setMyTeam} />}
            {view === View.STATS && <PlayerStats players={data.elements} teams={data.teams} fixtures={fixtures} />}
            {view === View.DETAILED_STATS && <DetailedStats players={data.elements} teams={data.teams} />}
            {view === View.TOP_MANAGERS && <TopManagers players={data.elements} teams={data.teams} fixtures={fixtures} />}
            {view === View.LEAGUE_OWNERSHIP && (IS_LOCAL_DEV ? (
              <LeagueOwnership
                players={data.elements}
                teams={data.teams}
                events={data.events}
                fixtures={fixtures}
                initialLeagueId={1286619}
              />
            ) : null)}
            {view === View.COMPARE_MODE && <CompareMode data={data} fixtures={fixtures} />}
            {view === View.CHALLENGE && <MiniChallenge players={data.elements} teams={data.teams} fixtures={fixtures} events={data.events} />}

            {/* Persistent Compliance & Trust Footer */}
            <footer className="mt-16 pt-8 pb-12 border-t border-slate-800 text-center text-xs text-slate-500 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <span>FPL Studio</span>
                <span>•</span>
                <span>Free Fantasy Premier League Analytics</span>
                <span>•</span>
                <span>Not Premier League Affiliated</span>
              </div>
              <p className="max-w-3xl mx-auto leading-relaxed text-slate-400 text-[11px]">
                FPL Studio is a free decision-support and statistics platform built for Fantasy Premier League managers. 
                FPL Studio is not a gambling operator, does not offer sports betting, does not accept wagers or stakes, 
                and does not offer cash prizes. All statistical projections, player likelihoods, and difficulty ratings 
                are mathematical estimates provided strictly for informational and fantasy entertainment purposes.
              </p>
              <p className="text-[10px] text-slate-600">
                Data sourced from the official Fantasy Premier League API. Premier League and FPL are registered trademarks of The Football Association Premier League Limited.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
