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
import AnalyticsTracker from './components/AnalyticsTracker';
import { initGA } from './lib/analytics';
// import ScoutChat from './components/ScoutChat'; // Temporarily disabled
import { LayoutDashboard, Calendar, Shirt, BarChart2, BrainCircuit, Menu, X, RefreshCw, Users, Trophy, ArrowLeftRight, Activity, Zap, Search, CalendarRange, Split } from 'lucide-react';

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

}

function App() {
  const [view, setView] = useState<View>(View.DASHBOARD);
  // Later: set to true when Stripe/paywall is ready
  const PRO_PAYWALL_ENABLED = false;
  // Feature flag for experimental/unfinished sections
  const ENABLE_EXPERIMENTAL_SECTIONS = false;
  // DEV bypass for local testing (Period Analysis, Player Stats, etc.)
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

  // Scout State - REMOVED OLD STATE as ScoutChat handles it internally
  // const [scoutAdvice, setScoutAdvice] = useState<ScoutAdvice | null>(null);
  // const [scoutLoading, setScoutLoading] = useState(false);

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
      setError("Failed to load FPL Data. This is often due to public proxy limitations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-purple-300 animate-pulse">Connecting to FPL...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-xl max-w-md text-center shadow-2xl">
          <div className="mb-4 flex justify-center text-red-400">
            <X className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // === DEBUG: Compare OLD vs NEW FDR for ARS upcoming fixtures ===
  (() => {
    const teams = data.teams;
    const players = data.elements;
    const arsenalId = teams.find(t => t.name === "Arsenal")?.id;
    if (!arsenalId) return console.warn("Arsenal not found");

    // --- helpers ---
    const teamShort = (id: number) => teams.find(t => t.id === id)?.short_name ?? String(id);

    // your existing logic (OLD)
    const calculateLeaguePositions = () => {
      const stats: Record<number, { pts: number; gd: number; gf: number; id: number }> = {};
      teams.forEach(t => (stats[t.id] = { pts: 0, gd: 0, gf: 0, id: t.id }));

      fixtures
        .filter(f => f.finished && f.team_h_score != null && f.team_a_score != null)
        .forEach(f => {
          const h = f.team_h_score!;
          const a = f.team_a_score!;
          stats[f.team_h].gf += h; stats[f.team_h].gd += (h - a);
          stats[f.team_a].gf += a; stats[f.team_a].gd += (a - h);
          if (h > a) stats[f.team_h].pts += 3;
          else if (h < a) stats[f.team_a].pts += 3;
          else { stats[f.team_h].pts += 1; stats[f.team_a].pts += 1; }
        });

      const sorted = Object.values(stats).sort((x, y) => {
        if (y.pts !== x.pts) return y.pts - x.pts;
        if (y.gd !== x.gd) return y.gd - x.gd;
        if (y.gf !== x.gf) return y.gf - x.gf;
        return x.id - y.id;
      });

      const pos: Record<number, number> = {};
      sorted.forEach((t, i) => (pos[t.id] = i + 1));
      return pos;
    };

    const top12Forms = (teamId: number) => {
      const arr = players
        .filter(p => p.team === teamId)
        .map(p => Number.parseFloat(p.form || "0"))
        .sort((a, b) => b - a)
        .slice(0, 12);

      const sum = arr.reduce((s, v) => s + v, 0);
      const avg = arr.length ? sum / arr.length : 0;
      return { sum, avg, arr };
    };

    const posMap = calculateLeaguePositions();

    // OLD scoring (exactly your current model)
    const oldModel = (opponentId: number) => {
      const { sum } = top12Forms(opponentId);
      const position = posMap[opponentId] || 10;
      const tableStrength = (20 - position) + 1;     // 1..20
      const tableAdj = (tableStrength - 10) * 1.0;   // -9..+10
      const final = sum + tableAdj;

      let score = 1;
      if (final > 55) score = 5;
      else if (final > 45) score = 4;
      else if (final > 35) score = 3;
      else if (final > 25) score = 2;

      return { score, formSum: sum, position, tableAdj, final };
    };

    // NEW scoring (proposal: avg form + gentler table + H/A impact)
    const newModel = (opponentId: number, isAway: boolean) => {
      const { avg } = top12Forms(opponentId);
      const position = posMap[opponentId] || 10;
      const tableStrength = (20 - position) + 1;   // 1..20
      const tableAdj = (tableStrength - 10) * 0.15; // gentle: about -1.35..+1.5
      const haAdj = isAway ? 0.15 : -0.10;          // small bump for away
      const final = avg + tableAdj + haAdj;

      // thresholds tuned for avg-form scale (~2.0–4.5)
      let score = 1;
      if (final > 4.2) score = 5;
      else if (final > 3.7) score = 4;
      else if (final > 3.2) score = 3;
      else if (final > 2.7) score = 2;

      return { score, formAvg: avg, position, tableAdj, haAdj, final };
    };

    // take ARS next fixtures from your earlier table: GW23..26 (not finished)
    const arsFixtures = fixtures
      .filter(f => !f.finished && f.event != null && (f.team_h === arsenalId || f.team_a === arsenalId))
      .sort((a, b) => (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? ""))
      .slice(0, 6); // just in case DGW later

    const rows = arsFixtures.map(f => {
      const isHome = f.team_h === arsenalId;
      const oppId = isHome ? f.team_a : f.team_h;
      const isAway = !isHome;

      const old = oldModel(oppId);
      const neu = newModel(oppId, isAway);

      return {
        GW: f.event,
        Opp: teamShort(oppId),
        H_A: isHome ? "H" : "A",
        KickoffUTC: f.kickoff_time,
        // OLD details
        OLD_score: old.score,
        OLD_formSumTop12: Number(old.formSum.toFixed(2)),
        OLD_pos: old.position,
        OLD_tableAdj: Number(old.tableAdj.toFixed(2)),
        OLD_final: Number(old.final.toFixed(2)),
        // NEW details
        NEW_score: neu.score,
        NEW_formAvgTop12: Number(neu.formAvg.toFixed(2)),
        NEW_pos: neu.position,
        NEW_tableAdj: Number(neu.tableAdj.toFixed(2)),
        NEW_haAdj: Number(neu.haAdj.toFixed(2)),
        NEW_final: Number(neu.final.toFixed(2)),
        // official FPL diff (for reference)
        FPL_diff: isHome ? f.team_h_difficulty : f.team_a_difficulty,
      };
    });

    console.log("=== ARS OLD vs NEW FDR compare ===");
    console.log("=== ARS OLD vs NEW FDR compare ===");
    console.table(rows);
    console.log(rows);

  })();


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

  const AccountBar = () => (
    <div className="flex items-center">
      {userEmail ? (
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <span className="hidden lg:inline text-[11px] text-slate-400">
            Signed in as <span className="text-slate-200 font-semibold">{userEmail}</span>
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-3 py-1.5 transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="text-xs font-bold bg-purple-600 hover:bg-purple-500 rounded px-4 py-2 transition-colors shadow-lg shadow-purple-600/20"
          >
            Log in
          </a>
          <a
            href="/login?mode=signup"
            className="hidden sm:inline-block text-xs font-bold bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded px-4 py-2 transition-colors"
          >
            Create account
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col">
      <AnalyticsTracker currentView={View[view]} />

      {/* Top Header - Desktop only */}
      <header className="hidden md:flex sticky top-0 z-50 h-14 w-full bg-slate-900/80 backdrop-blur-md border-b border-white/5 items-center px-6 justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleNavigate(View.DASHBOARD, 'Dashboard')}
            className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter hover:opacity-80 transition-opacity"
          >
            FPL STUDIO
          </button>

          <nav className="flex items-center gap-1">
            <HeaderNavItem v={View.DASHBOARD} label="Dashboard" />
            <HeaderNavItem v={View.LEAGUE_TABLE} label="League Table" />
            <HeaderNavItem v={View.TEAM_ANALYSIS} label="Team Analysis" />
            <HeaderNavItem v={View.PERIOD_ANALYSIS} label="Period Analysis" requiresAuth />
            <HeaderNavItem v={View.FIXTURES} label="Fixtures" />
            <HeaderNavItem v={View.TRANSFER_PICKS} label="Transfer Picks" />
            {ENABLE_EXPERIMENTAL_SECTIONS && <HeaderNavItem v={View.OPTIMAL_SQUAD} label="Optimal 11" />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <HeaderNavItem v={View.TEAM} label="My Team" />}
            <HeaderNavItem v={View.STATS} label="Player Stats" requiresAuth />
          </nav>
        </div>

        <AccountBar />
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Menu Toggle & Compact Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 z-50 flex items-center justify-between px-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-white shadow-lg transition-transform active:scale-95"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">FPL STUDIO</span>
          <AccountBar />
        </div>

        {/* Sidebar - MOBILE ONLY */}
        <div
          className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>

        <aside className={`fixed top-0 left-0 z-50 w-72 h-full bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden flex flex-col`}>
          <div className="p-6 border-b border-slate-800 shrink-0 flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter">FPL STUDIO</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
            <NavItem v={View.DASHBOARD} label="Dashboard" icon={LayoutDashboard} />
            <NavItem v={View.LEAGUE_TABLE} label="League Table" icon={Trophy} />
            <NavItem v={View.TEAM_ANALYSIS} label="Team Analysis" icon={Search} />
            <NavItem v={View.PERIOD_ANALYSIS} label="Period Analysis" icon={CalendarRange} requiresAuth />
            <NavItem v={View.FIXTURES} label="Fixtures" icon={Calendar} />
            <NavItem v={View.TRANSFER_PICKS} label="Transfer Picks" icon={ArrowLeftRight} />
            <NavItem v={View.STATS} label="Player Stats" icon={BarChart2} requiresAuth />
            <NavItem v={View.DETAILED_STATS} label="Detailed Analyses" icon={Activity} />
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.OPTIMAL_SQUAD} label="Optimal 11" icon={Zap} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.TEAM} label="My Team" icon={Shirt} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.TOP_MANAGERS} label="Top 100 Managers" icon={Users} />}
            {ENABLE_EXPERIMENTAL_SECTIONS && <NavItem v={View.COMPARE_MODE} label="Compare Mode" icon={Split} />}
          </nav>

          <div className="p-6 border-t border-slate-800 shrink-0 bg-slate-900">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Data by FPL API <br /> Not PL Affiliated
            </div>
          </div>
        </aside>

        {/* Main Content */}
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
                    <a
                      href="/login"
                      className="w-full sm:w-auto text-center bg-purple-600 hover:bg-purple-500 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-purple-600/20"
                    >
                      Log in
                    </a>
                    <a
                      href="/login?mode=signup"
                      className="w-full sm:w-auto text-center bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-3 rounded-xl transition-all border border-slate-700"
                    >
                      Create account
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => setView(View.DASHBOARD)}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-3 rounded-xl transition-all border border-slate-700"
                  >
                    Back to Dashboard
                  </button>
                )}
              </div>
            )}

            {view === View.LEAGUE_TABLE && <LeagueTable teams={data.teams} fixtures={fixtures} />}

            {view === View.TEAM_ANALYSIS && <TeamAnalysis teams={data.teams} fixtures={fixtures} />}

            {view === View.PERIOD_ANALYSIS && (
              <PeriodAnalysis players={data.elements} teams={data.teams} events={data.events} />
            )}

            {view === View.FIXTURES && (
              <Fixtures
                fixtures={fixtures}
                teams={data.teams}
                events={data.events}
                players={data.elements}
              />
            )}

            {view === View.TRANSFER_PICKS && (
              <TransferPicks players={data.elements} teams={data.teams} fixtures={fixtures} events={data.events} />
            )}

            {view === View.OPTIMAL_SQUAD && <OptimalSquad players={data.elements} teams={data.teams} />}

            {view === View.TEAM && (
              <TeamBuilder
                allPlayers={data.elements}
                teams={data.teams}
                events={data.events}
                myTeam={myTeam}
                setMyTeam={setMyTeam}
              />
            )}

            {view === View.STATS && <PlayerStats players={data.elements} teams={data.teams} />}

            {view === View.DETAILED_STATS && <DetailedStats players={data.elements} teams={data.teams} />}

            {view === View.TOP_MANAGERS && <TopManagers players={data.elements} teams={data.teams} />}

            {view === View.COMPARE_MODE && <CompareMode data={data} fixtures={fixtures} />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;