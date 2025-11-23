import React from 'react';
import { BootstrapStatic, FPLPlayer } from '../types';
import { TrendingUp, User, Shield, Award } from 'lucide-react';

interface DashboardProps {
  data: BootstrapStatic;
  myTeam: FPLPlayer[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, myTeam }) => {
  
  // Quick insights
  const mostSelected = [...data.elements].sort((a,b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))[0];
  const highestForm = [...data.elements].sort((a,b) => parseFloat(b.form) - parseFloat(a.form))[0];
  const topPoints = [...data.elements].sort((a,b) => b.total_points - a.total_points)[0];

  const nextEvent = data.events.find(e => e.is_next);

  return (
    <div className="space-y-6">
       
       {/* Hero Banner */}
       <div className="bg-gradient-to-r from-purple-900 to-slate-900 p-8 rounded-2xl shadow-2xl border border-purple-500/20 relative overflow-hidden">
          <div className="relative z-10">
             <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Welcome to FPL Mastermind</h1>
             <p className="text-purple-200 text-lg max-w-2xl">
               The ultimate portal for Fantasy Premier League statistics, team planning, and AI-powered scouting.
             </p>
             
             {nextEvent && (
               <div className="mt-6 inline-flex items-center bg-slate-800/80 backdrop-blur px-4 py-2 rounded-lg border border-purple-500/50">
                  <span className="text-green-400 font-bold mr-2">NEXT DEADLINE:</span>
                  <span className="text-white">{nextEvent.name} - {new Date(nextEvent.deadline_time).toLocaleString()}</span>
               </div>
             )}
          </div>
          {/* Decorative background elements */}
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-20 w-32 h-32 bg-green-500/10 rounded-full blur-2xl"></div>
       </div>

       {/* Quick Stats Grid */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex items-start gap-4">
             <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400"><User size={24} /></div>
             <div>
                <h3 className="text-slate-400 text-sm uppercase font-bold">Most Selected</h3>
                <p className="text-xl font-bold text-white">{mostSelected?.web_name}</p>
                <p className="text-sm text-blue-400">{mostSelected?.selected_by_percent}% Ownership</p>
             </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex items-start gap-4">
             <div className="p-3 bg-green-500/20 rounded-lg text-green-400"><TrendingUp size={24} /></div>
             <div>
                <h3 className="text-slate-400 text-sm uppercase font-bold">In Form</h3>
                <p className="text-xl font-bold text-white">{highestForm?.web_name}</p>
                <p className="text-sm text-green-400">{highestForm?.form} pts/match (last 30d)</p>
             </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex items-start gap-4">
             <div className="p-3 bg-yellow-500/20 rounded-lg text-yellow-400"><Award size={24} /></div>
             <div>
                <h3 className="text-slate-400 text-sm uppercase font-bold">Top Scorer</h3>
                <p className="text-xl font-bold text-white">{topPoints?.web_name}</p>
                <p className="text-sm text-yellow-400">{topPoints?.total_points} total points</p>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* League Table Preview (Mock visual since full table data is complex) */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Shield className="w-5 h-5" /> Current Team Status</h3>
              {myTeam.length === 0 ? (
                 <div className="text-center py-10 text-slate-500 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                    <p>No team built yet.</p>
                    <p className="text-sm mt-2">Go to the "Team" tab to start building.</p>
                 </div>
              ) : (
                 <div className="space-y-3">
                    {myTeam.slice(0, 5).map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-700/30 p-3 rounded">
                            <span className="font-medium">{p.web_name}</span>
                            <span className="text-green-400 font-mono">{p.total_points} pts</span>
                        </div>
                    ))}
                    {myTeam.length > 5 && <div className="text-center text-xs text-slate-500">And {myTeam.length - 5} more...</div>}
                 </div>
              )}
          </div>

          {/* Info Box */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
             <h3 className="text-xl font-bold mb-4 text-white">How to use</h3>
             <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-2">
                   <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                   <span>Navigate to <strong>Fixtures</strong> to see the upcoming schedule.</span>
                </li>
                <li className="flex items-start gap-2">
                   <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                   <span>Use <strong>Stats</strong> to analyze player value and performance data.</span>
                </li>
                <li className="flex items-start gap-2">
                   <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                   <span>Build your dream squad in the <strong>Team</strong> tab.</span>
                </li>
                <li className="flex items-start gap-2">
                   <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                   <span>Ask the <strong>AI Scout</strong> for personalized transfer advice.</span>
                </li>
             </ul>
          </div>
       </div>

    </div>
  );
};

export default Dashboard;
