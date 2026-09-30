import React, { useState, useMemo } from 'react';
import { FPLPlayer, FPLTeam } from '../types';
import { getPlayerImageUrl } from '../services/fplService';
import { projectPlayer } from '../lib/playerProjection';
import { Zap, DollarSign, Trophy, TrendingUp, RefreshCw, AlertTriangle, Shield, Calculator } from 'lucide-react';

interface OptimalSquadProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
}

type OptimizationMetric = 'total_points' | 'form' | 'expected_points' | 'value';

const POSITION_MAP: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

const OptimalSquad: React.FC<OptimalSquadProps> = ({ players, teams }) => {
  // Config State
  const [budget, setBudget] = useState<number>(83.0); // Realistic budget for starting XI (100 - 17 bench)
  const [metric, setMetric] = useState<OptimizationMetric>('form');
  
  // Result State
  const [generatedTeam, setGeneratedTeam] = useState<FPLPlayer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState({ cost: 0, score: 0 });

  // Helper to get player score based on selected metric
  const getPlayerScore = (p: FPLPlayer, currentMetric: OptimizationMetric): number => {
    switch (currentMetric) {
      case 'total_points': return p.total_points;
            case 'form': return parseFloat(p.form) || 0;
      case 'expected_points': return projectPlayer(p, teams.find(team => team.id === p.team)).expectedPoints;
      case 'value': return p.total_points / (p.now_cost / 10);
      default: return 0;
    }
  };

  const generateTeam = () => {
    setIsGenerating(true);
    
    // Simulate a slight delay for "calculation" effect
    setTimeout(() => {
      // 1. Filter viable players (remove injured/suspended if needed, for now just basic filter)
      const pool = players.filter(p => {
          const status = (p as any).status; // Assuming status exists or we ignore it
          return status !== 'u' && status !== 'i'; // Basic availability check
      });

      // 2. Sort pool by the chosen metric (Desc)
      pool.sort((a, b) => getPlayerScore(b, metric) - getPlayerScore(a, metric));

      // 3. Define Valid Formations
      // We will try to fill the most offensive formation possible first (3-4-3 or 3-5-2)
      // For simplicity in this greedy approach, we will enforce a balanced structure
      // that maximizes the metric.
      // Limits: GKP=1, DEF=3-5, MID=2-5, FWD=1-3. Total=11.
      
      let bestTeam: FPLPlayer[] = [];
      let bestScore = -1;

      // We will try a "Greedy Swap" approach.
      // Step A: Pick the absolute best players for a standard 3-4-3 formation regardless of budget first.
      // Formation: 1 GK, 3 DEF, 4 MID, 3 FWD (Total 11) - heavily weighted to attackers usually.
      
      const targetFormation = { 1: 1, 2: 3, 3: 4, 4: 3 }; 
      let currentSquad: FPLPlayer[] = [];
      const teamCounts: Record<number, number> = {};

      const addPlayer = (p: FPLPlayer) => {
        currentSquad.push(p);
        teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
      };

      // Initial Fill
      for (const p of pool) {
        if (currentSquad.length >= 11) break;
        
        const pos = p.element_type;
        const currentCountPos = currentSquad.filter(x => x.element_type === pos).length;
        
        // check constraints
        if (currentCountPos < targetFormation[pos as 1|2|3|4] && (teamCounts[p.team] || 0) < 3) {
            addPlayer(p);
        }
      }

      // If we couldn't fill 3-4-3 (maybe not enough FWDs?), fill with best available regardless of formation (respecting rules)
      if (currentSquad.length < 11) {
          for (const p of pool) {
              if (currentSquad.length >= 11) break;
              if (currentSquad.find(x => x.id === p.id)) continue;
              
              const pos = p.element_type;
              const currentCountPos = currentSquad.filter(x => x.element_type === pos).length;
              const teamCount = teamCounts[p.team] || 0;

              // Max limits
              if (pos === 1 && currentCountPos >= 1) continue;
              if (pos === 2 && currentCountPos >= 5) continue;
              if (pos === 3 && currentCountPos >= 5) continue;
              if (pos === 4 && currentCountPos >= 3) continue;
              if (teamCount >= 3) continue;

              addPlayer(p);
          }
      }

      // Step B: Budget Optimization (The "Squeeze")
      // While Cost > Budget, swap the player with the worst (Metric/Price) ratio 
      // for the best available player who is cheaper.
      
      let iterations = 0;
      let currentCost = currentSquad.reduce((acc, p) => acc + p.now_cost/10, 0);

      while (currentCost > budget && iterations < 1000) {
        iterations++;
        
        // Find worst efficiency player in current squad
        // Efficiency = Score / Cost. We want to remove Low Score/High Cost.
        // Actually, we want to remove the player who provides the least Metric per Million.
        let worstPlayerIdx = -1;
        let worstEfficiency = Infinity;

        currentSquad.forEach((p, idx) => {
             const score = getPlayerScore(p, metric);
             const cost = p.now_cost / 10;
             // Protect Goalkeepers from being swapped out too easily if they are cheap
             const efficiency = score / Math.pow(cost, 1.5); // Weight cost slightly higher to punish expensive players
             
             if (efficiency < worstEfficiency) {
                 worstEfficiency = efficiency;
                 worstPlayerIdx = idx;
             }
        });

        if (worstPlayerIdx === -1) break; // Should not happen

        const playerToRemove = currentSquad[worstPlayerIdx];
        const neededPos = playerToRemove.element_type;

        // Remove
        currentSquad.splice(worstPlayerIdx, 1);
        teamCounts[playerToRemove.team]--;

        // Find best replacement
        // Must be: Same Position, Cheaper, Not in team, Valid Team Count
        const replacement = pool.find(p => {
             if (p.element_type !== neededPos) return false;
             if (p.now_cost < playerToRemove.now_cost) { // Must be cheaper
                 if (currentSquad.find(x => x.id === p.id)) return false;
                 if ((teamCounts[p.team] || 0) >= 3) return false;
                 return true;
             }
             return false;
        });

        if (replacement) {
            addPlayer(replacement);
        } else {
            // If no replacement found (rare), put original back and force break or try removing second worst.
            // For simplicity, we break to avoid infinite loops in this demo logic.
            addPlayer(playerToRemove); 
            break;
        }

        currentCost = currentSquad.reduce((acc, p) => acc + p.now_cost/10, 0);
      }

      // Final Calculation
      const finalCost = currentSquad.reduce((acc, p) => acc + p.now_cost/10, 0);
      const finalScore = currentSquad.reduce((acc, p) => acc + getPlayerScore(p, metric), 0);

      setGeneratedTeam(currentSquad);
      setStats({ cost: finalCost, score: finalScore });
      setIsGenerating(false);

    }, 800);
  };

  const getPlayerInSlot = (type: number, index: number) => {
    const playersOfType = generatedTeam.filter(p => p.element_type === type);
    return playersOfType[index] || null;
  };

  const renderPlayerCard = (player: FPLPlayer | null) => {
    if (!player) return null;

    const teamObj = teams.find(t => t.id === player.team);
    const score = getPlayerScore(player, metric);
    const scoreLabel = metric === 'form' ? 'Form' : metric === 'total_points' ? 'Pts' : metric === 'expected_points' ? 'xPts' : 'Val';

    return (
      <div className="relative w-14 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 flex flex-col items-center group animate-in zoom-in duration-300">
        <div className="w-full h-full bg-slate-800 rounded-lg overflow-hidden shadow-lg border border-purple-500/30 flex flex-col hover:border-purple-400 transition-colors cursor-pointer">
           <div className="h-2/3 bg-gradient-to-b from-slate-700 to-slate-800 flex items-end justify-center overflow-hidden relative">
              <img 
                src={getPlayerImageUrl(player.photo)} 
                alt={player.web_name} 
                className="h-full object-cover translate-y-2"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-66.png'; }} 
              />
              <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-slate-900/90 text-[8px] sm:text-[10px] text-purple-400 font-mono px-1 rounded border border-purple-500/30 z-10">
                {score.toFixed(1)} <span className="text-[6px] sm:text-[8px] uppercase opacity-70 hidden sm:inline">{scoreLabel}</span>
              </div>
           </div>
           <div className="h-1/3 bg-slate-900 p-0.5 sm:p-1 text-center border-t border-slate-700 flex flex-col justify-center">
              <div className="text-[9px] sm:text-xs font-bold text-white truncate px-0.5">{player.web_name}</div>
              <div className="flex justify-between items-center px-0.5 sm:px-1 gap-1">
                 <div className="text-[8px] sm:text-[10px] text-slate-400 uppercase truncate max-w-[50%]">{teamObj?.short_name}</div>
                 <div className="text-[8px] sm:text-[10px] font-mono text-green-400">£{player.now_cost / 10}</div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in duration-500">
      
      {/* Sidebar Controls */}
      <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
         <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
             <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                 <Calculator className="text-purple-400" /> Auto-Solver
             </h2>
             <p className="text-sm text-slate-400 mb-6">
                 Set your parameters and let our algorithm calculate the statistically best Starting XI.
             </p>

             {/* Metric Selector */}
             <div className="space-y-3 mb-6">
                 <label className="text-xs font-bold text-slate-400 uppercase">Optimization Goal</label>
                 <div className="grid grid-cols-1 gap-2">
                     <button 
                        onClick={() => setMetric('form')}
                        className={`p-3 rounded-lg border flex items-center justify-between transition-all ${metric === 'form' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                         <span className="flex items-center gap-2"><TrendingUp size={16}/> Maximize Form</span>
                         {metric === 'form' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                     </button>
                     <button 
                        onClick={() => setMetric('total_points')}
                        className={`p-3 rounded-lg border flex items-center justify-between transition-all ${metric === 'total_points' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                         <span className="flex items-center gap-2"><Trophy size={16}/> Maximize Points</span>
                         {metric === 'total_points' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                     </button>
                     <button 
                        onClick={() => setMetric('expected_points')}
                        className={`p-3 rounded-lg border flex items-center justify-between transition-all ${metric === 'expected_points' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                         <span className="flex items-center gap-2"><Calculator size={16}/> Projected GW Points</span>
                         {metric === 'expected_points' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                     </button>
                     <button  
                        onClick={() => setMetric('value')}
                        className={`p-3 rounded-lg border flex items-center justify-between transition-all ${metric === 'value' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                         <span className="flex items-center gap-2"><DollarSign size={16}/> Maximize Value</span>
                         {metric === 'value' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                     </button>
                 </div>
             </div>

             {/* Budget Slider */}
             <div className="space-y-3 mb-8">
                 <div className="flex justify-between">
                     <label className="text-xs font-bold text-slate-400 uppercase">Starting XI Budget</label>
                     <span className="text-green-400 font-mono font-bold">£{budget.toFixed(1)}m</span>
                 </div>
                 <input 
                    type="range" 
                    min="60" 
                    max="100" 
                    step="0.5" 
                    value={budget}
                    onChange={(e) => setBudget(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
                 <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                     <span>£60m</span>
                     <span>£100m</span>
                 </div>
             </div>

             <button 
                onClick={generateTeam}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
             >
                 {isGenerating ? (
                     <RefreshCw className="animate-spin" /> 
                 ) : (
                     <Zap className="fill-white" />
                 )}
                 {isGenerating ? 'Calculating...' : 'Generate Optimal 11'}
             </button>
         </div>

         {/* Stats Panel */}
         {generatedTeam.length > 0 && (
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg animate-in slide-in-from-bottom-4">
                 <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Projected Stats</h3>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                         <div className="text-xs text-slate-500 mb-1">Total Cost</div>
                         <div className={`text-xl font-bold font-mono ${stats.cost > budget ? 'text-red-500' : 'text-green-400'}`}>
                             £{stats.cost.toFixed(1)}m
                         </div>
                     </div>
                     <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                         <div className="text-xs text-slate-500 mb-1">Total {metric === 'form' ? 'Form' : metric === 'expected_points' ? 'xPts' : 'Points'}</div>
                         <div className="text-xl font-bold font-mono text-purple-400">
                             {stats.score.toFixed(1)}
                         </div>
                     </div>
                 </div>
                 {stats.cost > budget && (
                     <div className="mt-3 text-xs text-red-400 flex items-center gap-2">
                         <AlertTriangle size={12} /> Budget exceeded slightly.
                     </div>
                 )}
             </div>
         )}
      </div>

      {/* Pitch Area */}
      <div className="flex-1">
         <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden min-h-[600px] md:min-h-[700px] flex flex-col">
             
             {generatedTeam.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                     <Shield size={64} className="mb-4 opacity-20" />
                     <p>Ready to generate.</p>
                     <p className="text-sm">Select parameters and click Generate.</p>
                 </div>
             ) : (
                <div className="relative flex-1 p-2 md:p-8 flex flex-col justify-between select-none py-6">
                     {/* Pitch Graphic Background */}
                     <div className="absolute inset-4 rounded border-2 border-slate-600/30 pointer-events-none">
                         <div className="absolute top-0 left-1/4 right-1/4 h-16 border-b-2 border-x-2 border-slate-600/30"></div>
                         <div className="absolute bottom-0 left-1/4 right-1/4 h-16 border-t-2 border-x-2 border-slate-600/30"></div>
                         <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-600/30"></div>
                         <div className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 border-2 border-slate-600/30 rounded-full"></div>
                     </div>

                     {/* GKP */}
                    <div className="flex justify-center relative z-10">
                        {renderPlayerCard(getPlayerInSlot(1, 0))}
                    </div>

                    {/* DEF */}
                    <div className="flex justify-center gap-1 md:gap-6 relative z-10">
                        {generatedTeam.filter(p=>p.element_type===2).map(p => (
                            <div key={p.id}>{renderPlayerCard(p)}</div>
                        ))}
                    </div>

                    {/* MID */}
                    <div className="flex justify-center gap-1 md:gap-6 relative z-10">
                        {generatedTeam.filter(p=>p.element_type===3).map(p => (
                            <div key={p.id}>{renderPlayerCard(p)}</div>
                        ))}
                    </div>

                    {/* FWD */}
                    <div className="flex justify-center gap-1 md:gap-6 relative z-10">
                        {generatedTeam.filter(p=>p.element_type===4).map(p => (
                            <div key={p.id}>{renderPlayerCard(p)}</div>
                        ))}
                    </div>
                </div>
             )}
         </div>
      </div>

    </div>
  );
};

export default OptimalSquad;