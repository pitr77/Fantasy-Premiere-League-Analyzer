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
// import ScoutChat from './components/ScoutChat'; // Temporarily disabled
import { LayoutDashboard, Calendar, Shirt, BarChart2, BrainCircuit, Menu, X, RefreshCw, Users, Trophy, ArrowLeftRight, Activity, Zap, Search, CalendarRange, Split } from 'lucide-react';

enum View {
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
      onClick={() => {
        const isAuthed = Boolean(userEmail);
        const isPro = tier === 'pro';

        // 1) Not signed in → require login
        if (requiresAuth && !isAuthed) {
          setLockedReason(`Sign in required to access ${label}.`);
          setView(View.LOCKED);
          setIsSidebarOpen(false);
          return;
        }

        // 2) Signed in but not Pro → only when paywall is enabled
        if (requiresAuth && PRO_PAYWALL_ENABLED && !isPro) {
          setLockedReason(`${label} is a PRO feature. Upgrade to access.`);
          setView(View.LOCKED);
          setIsSidebarOpen(false);
          return;
        }

        // Allowed
        setLockedReason(null);
        setView(v);
        setIsSidebarOpen(false);
      }}
      className={`w-full relative flex items-center gap-3 px-4 py-3 pr-14 rounded-lg transition-all min-w-0 ${view === v
        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <Icon size={20} />
      <span className="text-sm font-medium truncate">{label}</span>
      {requiresAuth && tier !== 'pro' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          PRO
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex overflow-hidden">

      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-white shadow-lg">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar - Updated Flex Layout */}
      <aside className={`fixed md:relative z-40 w-72 h-full bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
        <div className="p-6 border-b border-slate-800 shrink-0">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">FPL Master</h1>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          <NavItem v={View.DASHBOARD} label="Dashboard" icon={LayoutDashboard} />
          <NavItem v={View.LEAGUE_TABLE} label="League Table" icon={Trophy} />
          <NavItem v={View.TEAM_ANALYSIS} label="Team Analysis" icon={Search} />
          <NavItem v={View.PERIOD_ANALYSIS} label="Period Analysis" icon={CalendarRange} requiresAuth />
          <NavItem v={View.FIXTURES} label="Fixtures" icon={Calendar} />
          <NavItem v={View.TRANSFER_PICKS} label="Transfer Picks" icon={ArrowLeftRight} />
          <NavItem v={View.OPTIMAL_SQUAD} label="Optimal 11" icon={Zap} />
          <NavItem v={View.TEAM} label="My Team" icon={Shirt} />
          <NavItem v={View.STATS} label="Player Stats" icon={BarChart2} requiresAuth />
          <NavItem v={View.DETAILED_STATS} label="Detailed Analyses" icon={Activity} />
          <NavItem v={View.TOP_MANAGERS} label="Top 100 Managers" icon={Users} />
          <NavItem v={View.COMPARE_MODE} label="Compare Mode" icon={Split} />
          {/* <NavItem v={View.SCOUT} label="AI Scout" icon={BrainCircuit} /> */}
        </nav>

        <div className="p-6 border-t border-slate-800 shrink-0 bg-slate-900">
          <div className="text-xs text-slate-500">
            Data provided by Fantasy Premier League. <br /> Not affiliated with PL.
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 scroll-smooth">
        {/* Account bar */}
        <div className="mb-4 flex items-center justify-end">
          {userEmail ? (
            <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-300">
                Signed in as <span className="font-bold text-white">{userEmail}</span>
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-3 py-1.5"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="text-xs font-bold bg-purple-600 hover:bg-purple-500 rounded px-3 py-2"
              >
                Sign in
              </a>
              <a
                href="/login?mode=signup"
                className="text-xs font-bold bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded px-3 py-2"
              >
                Sign up
              </a>
            </div>
          )}
        </div>

        <div className={`${view === View.COMPARE_MODE ? 'w-full' : 'max-w-7xl'} mx-auto h-full`}>
          {view === View.DASHBOARD && <Dashboard data={data} myTeam={myTeam} fixtures={fixtures} />}

          {view === View.LOCKED && (
            <div className="max-w-xl mx-auto bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-2">Locked</h2>
              <p className="text-slate-300 mb-4">
                {lockedReason ?? (userEmail ? 'This feature is not available on your plan.' : 'Please sign in.')}
              </p>

              {!userEmail ? (
                <div className="flex items-center gap-2">
                  <a
                    href="/login"
                    className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-lg"
                  >
                    Sign in
                  </a>
                  <a
                    href="/login?mode=signup"
                    className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg"
                  >
                    Sign up
                  </a>
                </div>
              ) : (
                <button
                  onClick={() => setView(View.DASHBOARD)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg"
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



          {/* {view === View.SCOUT && (
            <ScoutChat 
              players={data.elements}
              teams={data.teams}
              fixtures={fixtures}
              events={data.events}
              myTeam={myTeam}
            />
          )} */}
        </div>
      </main>


    </div>
  );
}

export default App;