import React, { useState } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent } from '../types';
import { getPlayerImageUrl, getUserPicks } from '../services/fplService';
import { User, Plus, X, DownloadCloud, AlertCircle, LogIn, Lock } from 'lucide-react';

interface TeamBuilderProps {
  allPlayers: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
  myTeam: FPLPlayer[];
  setMyTeam: (players: FPLPlayer[]) => void;
}

const POSITION_MAP: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

const TeamBuilder: React.FC<TeamBuilderProps> = ({ allPlayers, teams, events, myTeam, setMyTeam }) => {
  const [selectedPos, setSelectedPos] = useState<number | null>(null); // 1, 2, 3, 4
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teamIdInput, setTeamIdInput] = useState("3236951");
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Login/Restriction UI State
  const [showLoginModal, setShowLoginModal] = useState(false);

  const budget = 100.0;
  const currentCost = myTeam.reduce((acc, p) => acc + (p.now_cost / 10), 0);
  const bank = budget - currentCost;

  const handleAddPlayer = (player: FPLPlayer) => {
    // Check if player already in team
    if (myTeam.find(p => p.id === player.id)) return;
    // Check max 3 per team
    const teamCount = myTeam.filter(p => p.team === player.team).length;
    if (teamCount >= 3) {
      alert("Max 3 players from same team!");
      return;
    }
    
    setMyTeam([...myTeam, player]);
    setIsModalOpen(false);
  };

  const handleRemovePlayer = (playerId: number) => {
    setMyTeam(myTeam.filter(p => p.id !== playerId));
  };

  const openPlayerSelect = (type: number) => {
    setSelectedPos(type);
    setSearchTerm("");
    setIsModalOpen(true);
  };

  const getPlayerInSlot = (type: number, index: number) => {
    const playersOfType = myTeam.filter(p => p.element_type === type);
    return playersOfType[index] || null;
  };

  const handleImportTeam = async () => {
      if (!teamIdInput) return;
      setIsLoadingTeam(true);
      setImportError(null);

      // 1. Find Current or Previous Event
      const currentEvent = events.find(e => e.is_current) || events.find(e => e.is_next);
      const eventId = currentEvent ? (currentEvent.is_next ? Math.max(1, currentEvent.id - 1) : currentEvent.id) : 38;

      try {
          const data = await getUserPicks(parseInt(teamIdInput), eventId);
          if (data && data.picks) {
              const importedPlayers: FPLPlayer[] = [];
              data.picks.forEach(pick => {
                  const player = allPlayers.find(p => p.id === pick.element);
                  if (player) importedPlayers.push(player);
              });
              setMyTeam(importedPlayers);
          } else {
              setImportError("Could not find picks for this ID.");
          }
      } catch (err) {
          console.error(err);
          setImportError("Failed to fetch team. Check ID or try later.");
      } finally {
          setIsLoadingTeam(false);
      }
  };

  const renderPlayerCard = (player: FPLPlayer | null, type: number) => {
    if (!player) {
      return (
        <button 
          onClick={() => openPlayerSelect(type)}
          className="w-20 h-24 md:w-24 md:h-32 bg-slate-800/50 hover:bg-slate-800/80 border-2 border-dashed border-slate-500 rounded flex flex-col items-center justify-center transition-all group"
        >
          <Plus className="w-8 h-8 text-slate-400 group-hover:text-green-400" />
          <span className="text-xs font-bold text-slate-400 mt-1">{POSITION_MAP[type]}</span>
        </button>
      );
    }

    const teamObj = teams.find(t => t.id === player.team);

    return (
      <div className="relative w-20 h-28 md:w-24 md:h-36 flex flex-col items-center group">
        <button 
          onClick={() => handleRemovePlayer(player.id)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg scale-75 md:scale-100"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-full h-full bg-slate-800 rounded-lg overflow-hidden shadow-lg border border-green-500/30 flex flex-col hover:border-green-400 transition-colors cursor-pointer">
           <div className="h-2/3 bg-gradient-to-b from-slate-700 to-slate-800 flex items-end justify-center overflow-hidden relative">
              <img 
                src={getPlayerImageUrl(player.photo)} 
                alt={player.web_name} 
                className="h-full object-cover translate-y-2"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-66.png'; }} 
              />
              <div className="absolute top-1 right-1 bg-slate-900/80 text-[10px] text-green-400 font-mono px-1 rounded">
                {player.total_points}
              </div>
           </div>
           <div className="h-1/3 bg-slate-900 p-1 text-center">
              <div className="text-xs font-bold text-white truncate">{player.web_name}</div>
              <div className="flex justify-between items-center px-1">
                 <div className="text-[10px] text-slate-400 uppercase">{teamObj?.short_name}</div>
                 <div className="text-[10px] font-mono text-green-400">£{player.now_cost / 10}</div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const filteredPlayers = allPlayers
    .filter(p => selectedPos ? p.element_type === selectedPos : true)
    .filter(p => !myTeam.find(m => m.id === p.id))
    .filter(p => p.web_name.toLowerCase().includes(searchTerm.toLowerCase()) || p.second_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 50);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Pitch Area */}
      <div className="flex-1 relative">
        
        {/* Controls Bar */}
        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            {/* Import Section */}
            <div className="flex flex-col gap-1 w-full md:w-auto">
                <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                    <DownloadCloud size={12} /> Import Team by ID
                </h3>
                <div className="flex gap-2 w-full">
                    <input 
                        type="text" 
                        value={teamIdInput}
                        onChange={(e) => setTeamIdInput(e.target.value)}
                        placeholder="ID"
                        className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none w-32"
                    />
                    <button 
                        onClick={handleImportTeam}
                        disabled={isLoadingTeam}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isLoadingTeam ? '...' : 'Load'}
                    </button>
                </div>
                {importError && <span className="text-red-400 text-[10px]">{importError}</span>}
            </div>

            {/* Login Stub */}
            <button 
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-all transform hover:scale-105"
            >
                <LogIn size={16} />
                Connect FPL Account
            </button>
        </div>

        {/* Stats Bar */}
        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-4 flex justify-between items-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
           <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase">Bank</h3>
             <div className={`text-2xl font-mono font-bold ${bank < 0 ? 'text-red-500' : 'text-green-400'}`}>
                £{bank.toFixed(1)}m
             </div>
           </div>
           
           <div className="flex flex-col items-center hidden sm:flex">
             <span className="text-xs text-slate-500 uppercase">Team Value</span>
             <span className="text-lg font-bold text-white">£{currentCost.toFixed(1)}m</span>
           </div>

           <div className="text-right">
             <div className="text-xs font-bold text-slate-400 uppercase">Selected</div>
             <div className={`text-xl font-bold ${myTeam.length === 11 ? 'text-green-400' : 'text-white'}`}>
                {myTeam.length} / 11
             </div>
           </div>
        </div>

        {/* The Pitch */}
        <div className="relative bg-gradient-to-b from-green-800 to-green-700 rounded-xl border-4 border-green-900 shadow-2xl overflow-hidden p-4 md:p-8 min-h-[650px] select-none">
          {/* Pitch Markings */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="w-full h-full border-2 border-white m-4 rounded-sm"></div>
             <div className="absolute top-0 left-1/4 right-1/4 h-16 border-2 border-t-0 border-white"></div>
             <div className="absolute bottom-0 left-1/4 right-1/4 h-16 border-2 border-b-0 border-white"></div>
             <div className="absolute top-1/2 left-0 right-0 h-px bg-white"></div>
             <div className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full"></div>
          </div>

          {/* Formation Grid */}
          <div className="relative z-10 flex flex-col h-full justify-between gap-2 py-2">
            
            {/* GKP */}
            <div className="flex justify-center">
               {renderPlayerCard(getPlayerInSlot(1, 0), 1)}
            </div>

            {/* DEF */}
            <div className="flex justify-center gap-2 md:gap-6">
              {[0, 1, 2, 3].map(i => (
                 <div key={`def-${i}`}>{renderPlayerCard(getPlayerInSlot(2, i), 2)}</div>
              ))}
            </div>

             {/* MID */}
             <div className="flex justify-center gap-2 md:gap-6">
              {[0, 1, 2, 3].map(i => (
                 <div key={`mid-${i}`}>{renderPlayerCard(getPlayerInSlot(3, i), 3)}</div>
              ))}
            </div>

             {/* FWD */}
             <div className="flex justify-center gap-2 md:gap-6">
              {[0, 1].map(i => (
                 <div key={`fwd-${i}`}>{renderPlayerCard(getPlayerInSlot(4, i), 4)}</div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Player Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-700 max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <Plus className="text-green-400" />
                 Add {selectedPos ? POSITION_MAP[selectedPos] : 'Player'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X /></button>
            </div>
            
            <div className="p-4 bg-slate-800">
              <input 
                type="text" 
                placeholder="Search player name..." 
                className="w-full bg-slate-900 text-white border border-slate-600 rounded p-3 focus:ring-2 focus:ring-green-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredPlayers.map(player => (
                <div key={player.id} onClick={() => handleAddPlayer(player)} className="flex items-center justify-between bg-slate-800 p-3 rounded hover:bg-slate-700 cursor-pointer transition-colors border border-transparent hover:border-green-500 group">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                        <img src={getPlayerImageUrl(player.photo)} alt="" className="w-full h-full object-cover" />
                     </div>
                     <div>
                       <div className="font-bold text-white group-hover:text-green-400 transition-colors">{player.web_name}</div>
                       <div className="text-xs text-slate-400">{teams.find(t => t.id === player.team)?.name} • {player.form} Form</div>
                     </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">£{player.now_cost / 10}</div>
                    <div className="text-xs text-green-400 font-bold">{player.total_points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Info Modal for Login */}
      {showLoginModal && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-xl shadow-2xl border border-purple-500/50 p-6 animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-center mb-4 text-purple-400">
                      <Lock size={48} />
                  </div>
                  <h2 className="text-xl font-bold text-white text-center mb-2">Direct Login Not Supported</h2>
                  <p className="text-slate-300 text-sm text-center mb-6 leading-relaxed">
                      Due to strict security protocols (CORS) and to protect your account credentials, 
                      web applications cannot log directly into the Official FPL API without a dedicated backend server.
                  </p>
                  
                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-6">
                      <h3 className="text-sm font-bold text-green-400 mb-2 flex items-center gap-2">
                          <DownloadCloud size={16}/> Alternative: Transfer Planner
                      </h3>
                      <p className="text-xs text-slate-400">
                          We have enabled <strong>Planner Mode</strong> for you. 
                          1. <strong>Import</strong> your team using your ID.
                          2. <strong>Remove</strong> players to free up funds.
                          3. <strong>Add</strong> new players to check budget fit.
                          <br/><br/>
                          <em>Note: Changes made here are simulated and will not save to the official game.</em>
                      </p>
                  </div>

                  <button 
                    onClick={() => setShowLoginModal(false)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                      Understood, Use Planner Mode
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};

export default TeamBuilder;