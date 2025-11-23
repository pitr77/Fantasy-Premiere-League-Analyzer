import React, { useEffect, useState } from 'react';
import { getBootstrapStatic, getFixtures } from './services/fplService';
import { getScoutAdvice } from './services/geminiService';
import { BootstrapStatic, FPLFixture, FPLPlayer, ScoutAdvice } from './types';
import Dashboard from './components/Dashboard';
import Fixtures from './components/Fixtures';
import TeamBuilder from './components/TeamBuilder';
import PlayerStats from './components/PlayerStats';
import TopManagers from './components/TopManagers';
import LeagueTable from './components/LeagueTable';
import { LayoutDashboard, Calendar, Shirt, BarChart2, BrainCircuit, Menu, X, RefreshCw, Users, Trophy } from 'lucide-react';

enum View {
  DASHBOARD,
  FIXTURES,
  TEAM,
  STATS,
  TOP_MANAGERS,
  LEAGUE_TABLE,
  SCOUT
}

function App() {
  const [view, setView] = useState<View>(View.DASHBOARD);
  const [data, setData] = useState<BootstrapStatic | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<FPLPlayer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Scout State
  const [scoutAdvice, setScoutAdvice] = useState<ScoutAdvice | null>(null);
  const [scoutLoading, setScoutLoading] = useState(false);

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

  const handleScoutAsk = async () => {
    if (!data) return;
    setScoutLoading(true);
    const nextEvent = data.events.find(e => e.is_next);
    const advice = await getScoutAdvice(data.elements, data.teams, nextEvent, myTeam);
    setScoutAdvice({
        analysis: advice.analysis,
        recommendedTransfers: [],
        captaincyPick: advice.captain
    });
    setScoutLoading(false);
  };

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

  const NavItem = ({ v, label, icon: Icon }: { v: View, label: string, icon: any }) => (
    <button 
      onClick={() => { setView(v); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${view === v ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
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

      {/* Sidebar */}
      <aside className={`fixed md:relative z-40 w-64 h-full bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
         <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">FPL Master</h1>
         </div>
         <nav className="p-4 space-y-2">
            <NavItem v={View.DASHBOARD} label="Dashboard" icon={LayoutDashboard} />
            <NavItem v={View.LEAGUE_TABLE} label="League Table" icon={Trophy} />
            <NavItem v={View.FIXTURES} label="Fixtures" icon={Calendar} />
            <NavItem v={View.TEAM} label="My Team" icon={Shirt} />
            <NavItem v={View.STATS} label="Statistics" icon={BarChart2} />
            <NavItem v={View.TOP_MANAGERS} label="Top 100 Managers" icon={Users} />
            <NavItem v={View.SCOUT} label="AI Scout" icon={BrainCircuit} />
         </nav>
         
         <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-800">
           <div className="text-xs text-slate-500">
             Data provided by Fantasy Premier League. <br/> Not affiliated with PL.
           </div>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 scroll-smooth">
         <div className="max-w-7xl mx-auto h-full">
           
           {view === View.DASHBOARD && <Dashboard data={data} myTeam={myTeam} />}
           
           {view === View.LEAGUE_TABLE && <LeagueTable teams={data.teams} fixtures={fixtures} />}
           
           {/* Passed data.elements to Fixtures */}
           {view === View.FIXTURES && <Fixtures fixtures={fixtures} teams={data.teams} events={data.events} players={data.elements} />}
           
           {view === View.TEAM && <TeamBuilder allPlayers={data.elements} teams={data.teams} events={data.events} myTeam={myTeam} setMyTeam={setMyTeam} />}
           
           {view === View.STATS && <PlayerStats players={data.elements} teams={data.teams} />}

           {view === View.TOP_MANAGERS && <TopManagers players={data.elements} teams={data.teams} />}

           {view === View.SCOUT && (
             <div className="max-w-3xl mx-auto">
               <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-8 shadow-2xl border border-purple-500/30 text-center">
                  <BrainCircuit className="w-16 h-16 mx-auto text-purple-300 mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-4">Gemini AI Scout</h2>
                  <p className="text-purple-200 mb-8">
                    Ask our AI model to analyze the current market, your team selection, and predict the best moves for the upcoming Gameweek.
                  </p>
                  
                  {!scoutAdvice && !scoutLoading && (
                    <button 
                      onClick={handleScoutAsk}
                      className="bg-white text-purple-900 px-8 py-3 rounded-full font-bold hover:bg-purple-100 transition-colors shadow-lg transform hover:scale-105"
                    >
                      Generate Scouting Report
                    </button>
                  )}

                  {scoutLoading && (
                    <div className="flex justify-center items-center space-x-2 text-purple-200">
                       <span className="animate-bounce">Thinking...</span>
                    </div>
                  )}

                  {scoutAdvice && (
                    <div className="mt-8 text-left bg-slate-900/50 rounded-xl p-6 border border-purple-400/30 backdrop-blur-sm">
                       <h3 className="text-xl font-bold text-green-400 mb-2">Analysis</h3>
                       <p className="text-slate-200 mb-4 leading-relaxed">{scoutAdvice.analysis}</p>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                         <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
                           <span className="block text-xs text-purple-300 uppercase font-bold">Captain Pick</span>
                           <span className="text-lg font-bold text-white">{scoutAdvice.captaincyPick}</span>
                         </div>
                         <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/30">
                            <span className="block text-xs text-blue-300 uppercase font-bold">Recommended</span>
                            <span className="text-lg font-bold text-white">Check Transfers</span>
                         </div>
                       </div>
                       
                       <button onClick={() => setScoutAdvice(null)} className="mt-6 text-sm text-slate-400 hover:text-white underline">Clear & Ask Again</button>
                    </div>
                  )}
               </div>
             </div>
           )}

         </div>
      </main>
    </div>
  );
}

export default App;