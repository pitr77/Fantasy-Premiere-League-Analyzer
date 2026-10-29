import React, { useState, useEffect, useMemo } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import { getUserPicks, getTeamEntry, getPlayerImageUrl, getTeamShirtUrl } from '../services/fplService';
import { PlayerDetailModal } from './PlayerDetailModal';
import {
  Users,
  ArrowLeftRight,
  TrendingUp,
  DownloadCloud,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  Filter,
  X,
  Coins,
  Shield,
  Zap,
  ChevronDown,
  Copy,
  Check,
  Crown,
  Share2,
  Calendar,
  Sparkles,
  Award,
  HelpCircle,
  Flame,
  Activity,
  Layers,
  Edit3
} from 'lucide-react';

interface SquadSimulatorProps {
  allPlayers: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
  fixtures: FPLFixture[];
}

interface SquadSlot {
  id: number; // player id
  position: number; // 1-15 (1-11 starting, 12-15 bench)
  isCaptain: boolean;
  isViceCaptain: boolean;
  isTransferredIn?: boolean;
  originalPlayerId?: number;
}

interface SquadPlan {
  id: string; // 'plan_a' | 'plan_b' | 'plan_c'
  label: string; // 'Plan A'
  name: string; // e.g. "Plan A", "Wildcard Draft"
  slots: SquadSlot[];
  freeTransfers: number;
}

const PLAN_DEFINITIONS = [
  { id: 'plan_a', label: 'Plan A' },
  { id: 'plan_b', label: 'Plan B' },
  { id: 'plan_c', label: 'Plan C' }
];

interface TransferAction {
  outPlayer: FPLPlayer;
  inPlayer: FPLPlayer;
  costDiff: number;
}

const POSITION_NAMES: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD'
};

const POSITION_COLORS: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  2: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  3: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  4: { text: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' }
};

export const SquadSimulator: React.FC<SquadSimulatorProps> = ({
  allPlayers,
  teams,
  events,
  fixtures
}) => {
  // Team ID State & LocalStorage persistence
  const [teamIdInput, setTeamIdInput] = useState<string>('3236951');
  const [managerInfo, setManagerInfo] = useState<{
    teamName: string;
    managerName: string;
    overallRank: number | null;
    totalPoints: number | null;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Squad State
  const [initialSlots, setInitialSlots] = useState<SquadSlot[]>([]);
  const [currentSlots, setCurrentSlots] = useState<SquadSlot[]>([]);
  const [initialBank, setInitialBank] = useState<number>(1.0); // in millions £
  const [freeTransfers, setFreeTransfers] = useState<number>(1);

  // Multi-Plan State (3 Draft Slots)
  const [activePlanId, setActivePlanId] = useState<string>('plan_a');
  const [plans, setPlans] = useState<Record<string, SquadPlan>>({
    plan_a: { id: 'plan_a', label: 'Plan A', name: 'Plan A', slots: [], freeTransfers: 1 },
    plan_b: { id: 'plan_b', label: 'Plan B', name: 'Plan B', slots: [], freeTransfers: 1 },
    plan_c: { id: 'plan_c', label: 'Plan C', name: 'Plan C', slots: [], freeTransfers: 1 }
  });
  const [isEditingPlanName, setIsEditingPlanName] = useState<boolean>(false);
  const [editingPlanNameValue, setEditingPlanNameValue] = useState<string>('');

  // Helper to persist plans to localStorage
  const savePlansToStorage = (updatedPlans: Record<string, SquadPlan>, idToSave: string) => {
    if (!idToSave) return;
    try {
      localStorage.setItem(`fpl_saved_plans_${idToSave}`, JSON.stringify(updatedPlans));
    } catch (e) {
      console.warn('Failed to save plans to localStorage', e);
    }
  };

  // Centralized updater for current slots that automatically syncs to active plan & storage
  const updateCurrentSlots = (
    updater: SquadSlot[] | ((prev: SquadSlot[]) => SquadSlot[])
  ) => {
    setCurrentSlots(prev => {
      const nextSlots = typeof updater === 'function' ? updater(prev) : updater;
      setPlans(currPlans => {
        const updated = {
          ...currPlans,
          [activePlanId]: {
            ...currPlans[activePlanId],
            slots: nextSlots,
            freeTransfers
          }
        };
        savePlansToStorage(updated, teamIdInput);
        return updated;
      });
      return nextSlots;
    });
  };

  // Helper to change freeTransfers and sync to active plan
  const handleChangeFreeTransfers = (ft: number) => {
    setFreeTransfers(ft);
    setPlans(currPlans => {
      const updated = {
        ...currPlans,
        [activePlanId]: {
          ...currPlans[activePlanId],
          freeTransfers: ft
        }
      };
      savePlansToStorage(updated, teamIdInput);
      return updated;
    });
  };

  // Helper to get transfer count for any plan
  const getPlanTransferCount = (planSlots: SquadSlot[]) => {
    if (!planSlots || planSlots.length === 0) return 0;
    return planSlots.filter(s => {
      const origId = s.originalPlayerId || initialSlots.find(i => i.position === s.position)?.id;
      return origId && s.id !== origId;
    }).length;
  };

  // Switch active plan
  const handleSwitchPlan = (targetPlanId: string) => {
    if (targetPlanId === activePlanId) return;

    // 1. Sync current state into activePlanId in plans
    const updatedPlans = {
      ...plans,
      [activePlanId]: {
        ...plans[activePlanId],
        slots: currentSlots,
        freeTransfers: freeTransfers
      }
    };

    // 2. Load target plan
    const targetPlan = updatedPlans[targetPlanId];
    if (targetPlan) {
      setCurrentSlots(targetPlan.slots.length > 0 ? targetPlan.slots : initialSlots);
      setFreeTransfers(targetPlan.freeTransfers || 1);
    }

    setActivePlanId(targetPlanId);
    setPlans(updatedPlans);
    savePlansToStorage(updatedPlans, teamIdInput);
    setSelectedSlotForSwap(null);
    setSelectedSlotForTransfer(null);
    setIsEditingPlanName(false);
  };

  // Duplicate current plan into another plan slot
  const handleDuplicatePlanTo = (targetPlanId: string) => {
    const currentPlan = plans[activePlanId];
    const targetDef = PLAN_DEFINITIONS.find(p => p.id === targetPlanId);
    const newName = `${currentPlan.name || currentPlan.label} (Copy)`;

    const updatedPlans = {
      ...plans,
      [targetPlanId]: {
        ...plans[targetPlanId],
        name: newName,
        slots: JSON.parse(JSON.stringify(currentSlots)),
        freeTransfers
      }
    };

    setPlans(updatedPlans);
    savePlansToStorage(updatedPlans, teamIdInput);
    alert(`Current squad copied to ${targetDef?.label || targetPlanId}!`);
  };

  // Save renamed plan
  const handleSavePlanName = () => {
    const trimmed = editingPlanNameValue.trim();
    if (!trimmed) {
      setIsEditingPlanName(false);
      return;
    }

    const updatedPlans = {
      ...plans,
      [activePlanId]: {
        ...plans[activePlanId],
        name: trimmed
      }
    };

    setPlans(updatedPlans);
    savePlansToStorage(updatedPlans, teamIdInput);
    setIsEditingPlanName(false);
  };

  // Transfer Modal State
  const [selectedSlotForTransfer, setSelectedSlotForTransfer] = useState<SquadSlot | null>(null);
  const [transferSearchQuery, setTransferSearchQuery] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'form' | 'points' | 'cost_desc' | 'cost_asc' | 'fdr'>('form');
  const [onlyWithinBudget, setOnlyWithinBudget] = useState<boolean>(false);

  // Subs swap state
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<number | null>(null);

  // Player Detail Modal
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<FPLPlayer | null>(null);

  // Copy notification
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Current or Next Gameweek
  const currentEvent = useMemo(() => {
    return events.find(e => e.is_current) || events.find(e => e.is_next) || events[0];
  }, [events]);

  const nextEventId = useMemo(() => {
    const nextEv = events.find(e => e.is_next);
    return nextEv ? nextEv.id : (currentEvent ? currentEvent.id : 1);
  }, [events, currentEvent]);

  // Read saved Team ID on mount
  useEffect(() => {
    const saved = localStorage.getItem('fpl_team_id');
    if (saved) {
      setTeamIdInput(saved);
    }
  }, []);

  // Quick lookup maps
  const playerMap = useMemo(() => {
    const map = new Map<number, FPLPlayer>();
    allPlayers.forEach(p => map.set(p.id, p));
    return map;
  }, [allPlayers]);

  const teamMap = useMemo(() => {
    const map = new Map<number, FPLTeam>();
    teams.forEach(t => map.set(t.id, t));
    return map;
  }, [teams]);

  // Helper to fetch next fixtures for a team
  const getNextTeamFixtures = (teamId: number, count = 3) => {
    const upcoming = fixtures
      .filter(f => !f.finished && f.event >= nextEventId && (f.team_h === teamId || f.team_a === teamId))
      .sort((a, b) => a.event - b.event)
      .slice(0, count);

    return upcoming.map(f => {
      const isHome = f.team_h === teamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const opponent = teamMap.get(opponentId);
      const diff = isHome ? f.team_h_difficulty : f.team_a_difficulty;
      return {
        event: f.event,
        opponentShort: opponent?.short_name || 'TBD',
        isHome,
        difficulty: diff || 3
      };
    });
  };

  // Helper for FDR Badge styling
  const getFdrColor = (diff: number) => {
    switch (diff) {
      case 1:
      case 2:
        return 'bg-emerald-600 text-white border-emerald-500';
      case 3:
        return 'bg-slate-700 text-slate-200 border-slate-600';
      case 4:
        return 'bg-amber-600 text-white border-amber-500';
      case 5:
        return 'bg-rose-600 text-white border-rose-500';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  // Load Team handler
  const handleLoadTeam = async (overrideId?: string) => {
    const idToUse = overrideId || teamIdInput.trim();
    const teamNum = parseInt(idToUse, 10);
    if (!teamNum || teamNum <= 0) {
      setErrorMessage('Please enter a valid numeric FPL Team ID.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch Picks (prioritize previous finished GW or current)
      const eventToFetch = currentEvent?.is_next ? Math.max(1, currentEvent.id - 1) : (currentEvent?.id || 1);
      const picksData = await getUserPicks(teamNum, eventToFetch);

      if (!picksData || !Array.isArray(picksData.picks) || picksData.picks.length === 0) {
        throw new Error('No squad picks found for this Team ID and Gameweek.');
      }

      // 2. Fetch Entry Info (team name, manager)
      try {
        const entryData = await getTeamEntry(teamNum);
        if (entryData) {
          setManagerInfo({
            teamName: entryData.name || `Team ${teamNum}`,
            managerName: `${entryData.player_first_name || ''} ${entryData.player_last_name || ''}`.trim() || 'Manager',
            overallRank: entryData.summary_overall_rank ?? null,
            totalPoints: entryData.summary_overall_points ?? null
          });
        }
      } catch (err) {
        console.warn('Could not fetch entry info', err);
        setManagerInfo({
          teamName: `Team ${teamNum}`,
          managerName: 'FPL Manager',
          overallRank: picksData.entry_history?.overall_rank ?? null,
          totalPoints: picksData.entry_history?.total_points ?? null
        });
      }

      // Bank from entry history (stored in tenths of millions, e.g. 15 = 1.5m)
      const bankVal = picksData.entry_history?.bank != null ? picksData.entry_history.bank / 10 : 1.0;
      setInitialBank(bankVal);

      // Map picks
      const slots: SquadSlot[] = picksData.picks.map(p => ({
        id: p.element,
        position: p.position,
        isCaptain: Boolean(p.is_captain),
        isViceCaptain: Boolean(p.is_vice_captain),
        isTransferredIn: false,
        originalPlayerId: p.element
      }));

      // Sort by position 1-15
      slots.sort((a, b) => a.position - b.position);

      // Load saved plans for this team if any
      let loadedPlans: Record<string, SquadPlan> | null = null;
      try {
        const savedPlansJson = localStorage.getItem(`fpl_saved_plans_${idToUse}`);
        if (savedPlansJson) {
          loadedPlans = JSON.parse(savedPlansJson);
        }
      } catch (e) {
        console.warn('Failed to parse saved plans', e);
      }

      const cleanBaseSlots: SquadSlot[] = slots.map(s => ({
        ...s,
        isTransferredIn: false,
        originalPlayerId: s.id
      }));

      // Set initial slots as the source of truth for the loaded FPL team
      setInitialSlots(cleanBaseSlots);

      // When loading a squad from FPL, Plan A is always initialized with the clean original FPL squad
      const defaultOrLoadedPlans: Record<string, SquadPlan> = {
        plan_a: {
          id: 'plan_a',
          label: 'Plan A',
          name: loadedPlans?.plan_a?.name && loadedPlans.plan_a.name !== 'Plan A' ? loadedPlans.plan_a.name : 'Plan A',
          slots: cleanBaseSlots,
          freeTransfers: 1
        },
        plan_b: loadedPlans?.plan_b?.slots?.length
          ? loadedPlans.plan_b
          : { id: 'plan_b', label: 'Plan B', name: loadedPlans?.plan_b?.name || 'Plan B', slots: cleanBaseSlots, freeTransfers: loadedPlans?.plan_b?.freeTransfers || 1 },
        plan_c: loadedPlans?.plan_c?.slots?.length
          ? loadedPlans.plan_c
          : { id: 'plan_c', label: 'Plan C', name: loadedPlans?.plan_c?.name || 'Plan C', slots: cleanBaseSlots, freeTransfers: loadedPlans?.plan_c?.freeTransfers || 1 }
      };

      setPlans(defaultOrLoadedPlans);
      setActivePlanId('plan_a');
      setCurrentSlots(cleanBaseSlots);
      setFreeTransfers(1);
      setSelectedSlotForSwap(null);
      setSelectedSlotForTransfer(null);

      // Save to localStorage
      savePlansToStorage(defaultOrLoadedPlans, idToUse);
      localStorage.setItem('fpl_team_id', idToUse);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to load squad from FPL. Check ID or try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically attempt load on first mount if not loaded and ID is ready
  useEffect(() => {
    if (initialSlots.length === 0 && teamIdInput) {
      handleLoadTeam(teamIdInput);
    }
  }, []);

  // Compute Financials
  const currentCost = useMemo(() => {
    return currentSlots.reduce((acc, slot) => {
      const p = playerMap.get(slot.id);
      return acc + (p ? p.now_cost / 10 : 0);
    }, 0);
  }, [currentSlots, playerMap]);

  const initialCost = useMemo(() => {
    return initialSlots.reduce((acc, slot) => {
      const p = playerMap.get(slot.id);
      return acc + (p ? p.now_cost / 10 : 0);
    }, 0);
  }, [initialSlots, playerMap]);

  // Available Bank = Initial Bank + (Cost of sold players) - (Cost of bought players)
  const remainingBank = useMemo(() => {
    let soldValue = 0;
    let boughtValue = 0;

    currentSlots.forEach(slot => {
      const origId = slot.originalPlayerId || initialSlots.find(i => i.position === slot.position)?.id;
      if (origId && slot.id !== origId) {
        const origPlayer = playerMap.get(origId);
        const currPlayer = playerMap.get(slot.id);
        if (origPlayer) soldValue += origPlayer.now_cost / 10;
        if (currPlayer) boughtValue += currPlayer.now_cost / 10;
      }
    });

    return Number((initialBank + soldValue - boughtValue).toFixed(1));
  }, [currentSlots, initialBank, initialSlots, playerMap]);

  // List of Transfers Made
  const transfersMade: TransferAction[] = useMemo(() => {
    const list: TransferAction[] = [];
    currentSlots.forEach(slot => {
      const origId = slot.originalPlayerId || initialSlots.find(i => i.position === slot.position)?.id;
      if (origId && slot.id !== origId) {
        const outPlayer = playerMap.get(origId);
        const inPlayer = playerMap.get(slot.id);
        if (outPlayer && inPlayer) {
          const diff = Number(((outPlayer.now_cost - inPlayer.now_cost) / 10).toFixed(1));
          list.push({ outPlayer, inPlayer, costDiff: diff });
        }
      }
    });
    return list;
  }, [currentSlots, initialSlots, playerMap]);

  // Check if current squad differs from the initial FPL squad
  const isSquadModified = useMemo(() => {
    if (initialSlots.length === 0) return false;
    if (transfersMade.length > 0) return true;
    return currentSlots.some((s) => {
      const init = initialSlots.find(i => i.position === s.position);
      return !init || s.id !== init.id;
    });
  }, [currentSlots, initialSlots, transfersMade.length]);

  // Hit Calculation
  const transferHits = useMemo(() => {
    const count = transfersMade.length;
    const excess = Math.max(0, count - freeTransfers);
    return excess * 4;
  }, [transfersMade.length, freeTransfers]);

  // Starting 11 vs Bench 4
  const startingSlots = useMemo(() => {
    return currentSlots.filter(s => s.position <= 11);
  }, [currentSlots]);

  const benchSlots = useMemo(() => {
    return currentSlots.filter(s => s.position > 11).sort((a, b) => a.position - b.position);
  }, [currentSlots]);

  // Group Starting 11 by position for pitch view
  const pitchGK = useMemo(() => startingSlots.filter(s => playerMap.get(s.id)?.element_type === 1), [startingSlots, playerMap]);
  const pitchDEF = useMemo(() => startingSlots.filter(s => playerMap.get(s.id)?.element_type === 2), [startingSlots, playerMap]);
  const pitchMID = useMemo(() => startingSlots.filter(s => playerMap.get(s.id)?.element_type === 3), [startingSlots, playerMap]);
  const pitchFWD = useMemo(() => startingSlots.filter(s => playerMap.get(s.id)?.element_type === 4), [startingSlots, playerMap]);

  // Formation label (e.g. "3-4-3")
  const formationLabel = useMemo(() => {
    return `${pitchDEF.length}-${pitchMID.length}-${pitchFWD.length}`;
  }, [pitchDEF, pitchMID, pitchFWD]);

  // Team counts to enforce max 3 per club
  const teamPlayerCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    currentSlots.forEach(s => {
      const p = playerMap.get(s.id);
      if (p) {
        counts[p.team] = (counts[p.team] || 0) + 1;
      }
    });
    return counts;
  }, [currentSlots, playerMap]);

  // Handle Transfer In
  const handleSelectReplacement = (newPlayer: FPLPlayer) => {
    if (!selectedSlotForTransfer) return;

    // Check if new player already in squad
    const alreadyIn = currentSlots.some(s => s.id === newPlayer.id && s.position !== selectedSlotForTransfer.position);
    if (alreadyIn) {
      alert(`${newPlayer.web_name} is already in your squad!`);
      return;
    }

    // Check 3 per team limit (accounting for selling the player in this slot)
    const currentSlotPlayer = playerMap.get(selectedSlotForTransfer.id);
    const sameTeamCount = currentSlots.filter(s => {
      if (s.position === selectedSlotForTransfer.position) return false;
      const p = playerMap.get(s.id);
      return p?.team === newPlayer.team;
    }).length;

    if (sameTeamCount >= 3) {
      alert(`Max 3 players allowed from ${teamMap.get(newPlayer.team)?.name || 'this team'}!`);
      return;
    }

    // Check budget
    const origPlayer = playerMap.get(selectedSlotForTransfer.originalPlayerId || selectedSlotForTransfer.id);
    const fundsFreed = (currentSlotPlayer?.now_cost || 0) / 10;
    const costNew = newPlayer.now_cost / 10;
    const prospectiveBank = remainingBank + fundsFreed - costNew;

    if (prospectiveBank < -0.001) {
      const confirmExceed = confirm(
        `Adding ${newPlayer.web_name} will exceed your remaining bank by £${Math.abs(prospectiveBank).toFixed(1)}m. Do you want to proceed anyway?`
      );
      if (!confirmExceed) return;
    }

    // Apply transfer
    updateCurrentSlots(prev =>
      prev.map(slot => {
        if (slot.position === selectedSlotForTransfer.position) {
          const isBackToOriginal = slot.originalPlayerId === newPlayer.id;
          return {
            ...slot,
            id: newPlayer.id,
            isTransferredIn: !isBackToOriginal
          };
        }
        return slot;
      })
    );

    setSelectedSlotForTransfer(null);
  };

  // Revert a single transfer
  const handleRevertTransfer = (position: number) => {
    updateCurrentSlots(prev =>
      prev.map(slot => {
        if (slot.position === position && slot.originalPlayerId) {
          return {
            ...slot,
            id: slot.originalPlayerId,
            isTransferredIn: false
          };
        }
        return slot;
      })
    );
  };

  // Reset all transfers for active plan back to original FPL squad
  const handleResetAllTransfers = () => {
    if (initialSlots.length === 0) return;
    const planName = plans[activePlanId]?.name || PLAN_DEFINITIONS.find(p => p.id === activePlanId)?.label || 'current plan';
    if (confirm(`Reset ${planName} back to original squad?`)) {
      updateCurrentSlots(initialSlots.map(s => ({ ...s, isTransferredIn: false, originalPlayerId: s.id })));
      setSelectedSlotForSwap(null);
    }
  };

  // Swap / Sub handling
  const handleSlotClick = (slot: SquadSlot) => {
    if (selectedSlotForSwap === null) {
      // First selection
      setSelectedSlotForSwap(slot.position);
    } else if (selectedSlotForSwap === slot.position) {
      // Deselect
      setSelectedSlotForSwap(null);
    } else {
      // Swap slot A and slot B
      const slotA = currentSlots.find(s => s.position === selectedSlotForSwap);
      const slotB = slot;
      if (!slotA) {
        setSelectedSlotForSwap(null);
        return;
      }

      const pA = playerMap.get(slotA.id);
      const pB = playerMap.get(slotB.id);

      // Validate formation if one is starting and one is bench
      const isAStarting = slotA.position <= 11;
      const isBStarting = slotB.position <= 11;

      if (isAStarting !== isBStarting) {
        // GKP can only swap with GKP
        if (pA?.element_type === 1 || pB?.element_type === 1) {
          if (pA?.element_type !== pB?.element_type) {
            alert('Goalkeepers can only be swapped with the bench goalkeeper!');
            setSelectedSlotForSwap(null);
            return;
          }
        }

        // Outfield validity check: DEF >= 3, MID >= 2, FWD >= 1
        // Create simulated starting line-up
        const simulatedStartingPositions = currentSlots
          .map(s => {
            if (s.position === slotA.position) return slotB.id;
            if (s.position === slotB.position) return slotA.id;
            return s.position <= 11 ? s.id : null;
          })
          .filter(Boolean) as number[];

        let simDef = 0;
        let simMid = 0;
        let simFwd = 0;

        simulatedStartingPositions.forEach(id => {
          const type = playerMap.get(id)?.element_type;
          if (type === 2) simDef++;
          if (type === 3) simMid++;
          if (type === 4) simFwd++;
        });

        if (simDef < 3) {
          alert('Invalid formation! You must have at least 3 defenders on the pitch.');
          setSelectedSlotForSwap(null);
          return;
        }
        if (simMid < 2) {
          alert('Invalid formation! You must have at least 2 midfielders on the pitch.');
          setSelectedSlotForSwap(null);
          return;
        }
        if (simFwd < 1) {
          alert('Invalid formation! You must have at least 1 forward on the pitch.');
          setSelectedSlotForSwap(null);
          return;
        }
      }

      // Execute swap
      updateCurrentSlots(prev =>
        prev.map(s => {
          if (s.position === slotA.position) {
            return {
              ...s,
              id: slotB.id,
              isTransferredIn: slotB.isTransferredIn,
              originalPlayerId: slotB.originalPlayerId
            };
          }
          if (s.position === slotB.position) {
            return {
              ...s,
              id: slotA.id,
              isTransferredIn: slotA.isTransferredIn,
              originalPlayerId: slotA.originalPlayerId
            };
          }
          return s;
        })
      );

      setSelectedSlotForSwap(null);
    }
  };

  // Captain / Vice-Captain toggle
  const handleSetCaptain = (position: number, isVice = false) => {
    updateCurrentSlots(prev =>
      prev.map(s => {
        if (isVice) {
          if (s.position === position) return { ...s, isViceCaptain: true, isCaptain: false };
          if (s.isViceCaptain) return { ...s, isViceCaptain: false };
        } else {
          if (s.position === position) return { ...s, isCaptain: true, isViceCaptain: false };
          if (s.isCaptain) return { ...s, isCaptain: false };
        }
        return s;
      })
    );
  };

  // Copy transfers summary to clipboard
  const handleCopySummary = () => {
    if (transfersMade.length === 0) return;
    const currentPlan = plans[activePlanId];
    const planDisplayName = currentPlan?.name || currentPlan?.label || 'Plan';
    const lines = [
      `🎯 FPL Transfer Plan [${planDisplayName}] for GW${nextEventId}`,
      managerInfo?.teamName ? `👤 ${managerInfo.teamName} (${managerInfo.managerName})` : '',
      `─────────────────────────`,
      ...transfersMade.map(
        t => `🔴 OUT: ${t.outPlayer.web_name} (£${(t.outPlayer.now_cost / 10).toFixed(1)}m)\n🟢 IN:  ${t.inPlayer.web_name} (£${(t.inPlayer.now_cost / 10).toFixed(1)}m) [${t.costDiff >= 0 ? '+' : ''}${t.costDiff}m]`
      ),
      `─────────────────────────`,
      `💰 Remaining Bank: £${remainingBank.toFixed(1)}m`,
      `⚡ Transfers: ${transfersMade.length} (Free: ${freeTransfers})`,
      `📉 Hit: ${transferHits > 0 ? `-${transferHits} pts` : '0 pts (Free)'}`,
      `📐 Formation: ${formationLabel}`,
      `✨ Created via FPL Mastermind Portal`
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Filter & Sort for Replacement candidates
  const candidatePlayers = useMemo(() => {
    if (!selectedSlotForTransfer) return [];

    const slotPlayer = playerMap.get(selectedSlotForTransfer.id);
    const requiredPosition = slotPlayer?.element_type || 1;
    const availableBudget = (slotPlayer ? slotPlayer.now_cost / 10 : 0) + remainingBank;

    // Current squad player ids to exclude
    const currentSquadIds = new Set(
      currentSlots
        .filter(s => s.position !== selectedSlotForTransfer.position)
        .map(s => s.id)
    );

    return allPlayers
      .filter(p => p.element_type === requiredPosition)
      .filter(p => !currentSquadIds.has(p.id))
      .filter(p => {
        if (onlyWithinBudget && (p.now_cost / 10) > availableBudget + 0.001) {
          return false;
        }
        if (filterTeam !== 'all' && p.team !== filterTeam) return false;
        if (transferSearchQuery.trim()) {
          const q = transferSearchQuery.toLowerCase();
          const matchName = p.web_name.toLowerCase().includes(q) || p.second_name.toLowerCase().includes(q);
          if (!matchName) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'form') return parseFloat(b.form) - parseFloat(a.form);
        if (sortBy === 'points') return b.total_points - a.total_points;
        if (sortBy === 'cost_desc') return b.now_cost - a.now_cost;
        if (sortBy === 'cost_asc') return a.now_cost - b.now_cost;
        if (sortBy === 'fdr') {
          const fdrA = getNextTeamFixtures(a.team, 3).reduce((acc, f) => acc + f.difficulty, 0);
          const fdrB = getNextTeamFixtures(b.team, 3).reduce((acc, f) => acc + f.difficulty, 0);
          return fdrA - fdrB;
        }
        return 0;
      })
      .slice(0, 60);
  }, [selectedSlotForTransfer, allPlayers, playerMap, currentSlots, filterTeam, transferSearchQuery, sortBy, onlyWithinBudget, remainingBank]);

  // Render individual player card on the pitch or bench
  const renderPlayerCard = (slot: SquadSlot, isBench = false) => {
    const player = playerMap.get(slot.id);
    if (!player) return null;

    const team = teamMap.get(player.team);
    const nextFix = getNextTeamFixtures(player.team, 1)[0];
    const isSelectedForSwap = selectedSlotForSwap === slot.position;
    const isGK = player.element_type === 1;

    // Has injury / doubt flag
    const hasDoubt = player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round < 100;

    return (
      <div
        key={`slot-${slot.position}`}
        className={`relative flex flex-col items-center transition-all group ${
          isSelectedForSwap ? 'scale-105 z-30' : 'hover:scale-[1.03] z-10'
        }`}
      >
        {/* Swap highlight ring */}
        {isSelectedForSwap && (
          <div className="absolute -inset-1.5 rounded-2xl bg-amber-400/40 animate-pulse blur-[2px] pointer-events-none" />
        )}

        {/* Card Body */}
        <div
          className={`w-[74px] sm:w-24 md:w-28 rounded-xl overflow-hidden shadow-2xl transition-all border flex flex-col cursor-pointer ${
            isSelectedForSwap
              ? 'border-amber-400 bg-slate-900 ring-2 ring-amber-400'
              : slot.isTransferredIn
              ? 'border-emerald-400/80 bg-slate-900 shadow-emerald-500/10'
              : 'border-white/10 bg-slate-900/90 hover:border-purple-400/50'
          }`}
          onClick={() => handleSlotClick(slot)}
        >
          {/* Top badges (C, V, IN) */}
          <div className="absolute top-1 left-1 right-1 flex justify-between items-center z-20 pointer-events-none">
            {slot.isCaptain && (
              <span className="bg-black/90 text-amber-300 border border-amber-400/60 font-black text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-lg">
                C
              </span>
            )}
            {slot.isViceCaptain && !slot.isCaptain && (
              <span className="bg-black/90 text-slate-200 border border-slate-400/60 font-black text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-lg">
                V
              </span>
            )}
            {slot.isTransferredIn && (
              <span className="ml-auto bg-emerald-500 text-slate-950 font-black text-[8px] sm:text-[9px] px-1 py-0.5 rounded uppercase tracking-wider shadow">
                IN
              </span>
            )}
          </div>

          {/* Player Photo Area */}
          <div className="relative h-14 sm:h-20 bg-gradient-to-b from-slate-800 to-slate-900 flex items-end justify-center overflow-hidden pt-1">
            <img
              src={getPlayerImageUrl(player.photo)}
              alt={player.web_name}
              className="h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] translate-y-1"
              onError={e => {
                const target = e.target as HTMLImageElement;
                const shirtUrl = getTeamShirtUrl(team?.code, isGK);
                if (target.src !== shirtUrl) {
                  target.src = shirtUrl;
                } else {
                  target.src = 'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.png';
                }
              }}
            />

            {/* Injury Warning Dot */}
            {hasDoubt && (
              <div
                title={`Chance of playing: ${player.chance_of_playing_next_round}%`}
                className="absolute bottom-1 left-1 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-md flex items-center justify-center"
              >
                <AlertTriangle size={10} className="stroke-[3]" />
              </div>
            )}

            {/* Form badge */}
            <div className="absolute bottom-1 right-1 bg-slate-950/80 text-[8px] sm:text-[10px] font-mono text-purple-300 font-bold px-1 rounded border border-white/5">
              {player.form}🔥
            </div>
          </div>

          {/* Name & Team strip */}
          <div className="bg-slate-950 p-1 text-center border-t border-white/5">
            <div className="text-[10px] sm:text-xs font-bold text-white truncate px-0.5">
              {player.web_name}
            </div>
            <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-400 px-0.5">
              <span className="font-semibold text-slate-300">{team?.short_name}</span>
              <span className="font-mono text-emerald-400 font-bold">£{(player.now_cost / 10).toFixed(1)}</span>
            </div>
          </div>

          {/* Next Fixture Strip */}
          <div className="px-1 py-0.5 bg-slate-900/90 border-t border-white/5 flex items-center justify-between text-[8px] sm:text-[9px]">
            {nextFix ? (
              <>
                <span className="text-slate-300 truncate font-mono">
                  {nextFix.opponentShort} ({nextFix.isHome ? 'H' : 'A'})
                </span>
                <span
                  className={`px-1 rounded text-[8px] font-bold border ${getFdrColor(nextFix.difficulty)}`}
                >
                  {nextFix.difficulty}
                </span>
              </>
            ) : (
              <span className="text-slate-500 text-[8px] w-full text-center">Blank</span>
            )}
          </div>
        </div>

        {/* Hover / Quick Action Bar */}
        <div className="mt-1 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          {/* Transfer button */}
          <button
            title="Transfer Out / Replace player"
            onClick={e => {
              e.stopPropagation();
              setSelectedSlotForTransfer(slot);
              setTransferSearchQuery('');
              setFilterTeam('all');
            }}
            className="p-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all hover:scale-110"
          >
            <ArrowLeftRight size={11} />
          </button>

          {/* Sub / Swap button */}
          <button
            title={isSelectedForSwap ? 'Cancel Swap' : 'Swap / Substitute with bench player'}
            onClick={e => {
              e.stopPropagation();
              handleSlotClick(slot);
            }}
            className={`p-1 rounded-md text-white shadow-lg transition-all hover:scale-110 ${
              isSelectedForSwap ? 'bg-amber-500 hover:bg-amber-400' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <Users size={11} />
          </button>

          {/* Captaincy toggle dropdown */}
          {!isBench && (
            <button
              title="Set as Captain (C)"
              onClick={e => {
                e.stopPropagation();
                handleSetCaptain(slot.position, false);
              }}
              className={`p-1 rounded-md text-white shadow-lg transition-all hover:scale-110 ${
                slot.isCaptain ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <Crown size={11} className={slot.isCaptain ? 'fill-slate-950' : 'text-amber-400'} />
            </button>
          )}

          {/* Revert if transferred */}
          {slot.isTransferredIn && (
            <button
              title="Undo this transfer"
              onClick={e => {
                e.stopPropagation();
                handleRevertTransfer(slot.position);
              }}
              className="p-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all hover:scale-110"
            >
              <RotateCcw size={11} />
            </button>
          )}

          {/* Detail modal button */}
          <button
            title="View Player Stats & Predictions"
            onClick={e => {
              e.stopPropagation();
              setSelectedPlayerForDetail(player);
            }}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all hover:scale-110"
          >
            <Info size={11} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header & Squad Import Controls */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <ArrowLeftRight size={22} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-300 to-green-400 tracking-tight">
                  Transfer Simulator & Squad Planner
                </h1>
                <p className="text-xs text-slate-400">
                  Simulate transfers, calculate budget hits, and test line-ups with live portal analytics
                </p>
              </div>
            </div>
          </div>

          {/* ID Loader input */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                value={teamIdInput}
                onChange={e => setTeamIdInput(e.target.value)}
                placeholder="FPL Team ID"
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 pl-8 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
              <DownloadCloud size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              onClick={() => handleLoadTeam()}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <DownloadCloud size={16} />
                  <span>Load Squad</span>
                </>
              )}
            </button>

            {/* Demo ID button */}
            <button
              onClick={() => {
                setTeamIdInput('3236951');
                handleLoadTeam('3236951');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all border border-slate-700"
            >
              Sample ID
            </button>
          </div>
        </div>

        {/* Manager Banner (if loaded) */}
        {managerInfo && (
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white text-sm">{managerInfo.teamName}</span>
              <span className="text-slate-400">({managerInfo.managerName})</span>
              {managerInfo.overallRank && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono font-bold">
                  OR: #{managerInfo.overallRank.toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-400">
              <span>Formation: <strong className="text-white">{formationLabel}</strong></span>
              <span>•</span>
              <span>Next GW: <strong className="text-purple-400">GW{nextEventId}</strong></span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Main Simulator Dashboard: Pitch on Left/Center, Transfer Management on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pitch & Bench */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Quick Info & Swapping Notice */}
          {selectedSlotForSwap !== null && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-amber-400 animate-pulse" />
                <span>
                  Select another player on the pitch or bench to swap places.
                </span>
              </div>
              <button
                onClick={() => setSelectedSlotForSwap(null)}
                className="text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                Cancel Swap
              </button>
            </div>
          )}

          {/* The Football Pitch (Starting 11) */}
          <div className="relative rounded-2xl border-4 border-emerald-950 bg-gradient-to-b from-emerald-900 via-emerald-800 to-green-900 shadow-2xl overflow-hidden p-3 sm:p-6 min-h-[580px] flex flex-col justify-between select-none">
            {/* Pitch Markings Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute inset-3 border-2 border-white rounded-lg" />
              <div className="absolute top-3 left-1/4 right-1/4 h-24 border-2 border-t-0 border-white rounded-b-lg" />
              <div className="absolute bottom-3 left-1/4 right-1/4 h-24 border-2 border-b-0 border-white rounded-t-lg" />
              <div className="absolute top-1/2 left-3 right-3 h-0.5 bg-white -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full" />
            </div>

            {/* Starting 11 Layout */}
            <div className="relative z-10 flex flex-col h-full justify-between gap-4 py-2">
              {/* Goalkeeper Line */}
              <div className="flex justify-center items-center">
                {pitchGK.map(slot => renderPlayerCard(slot))}
              </div>

              {/* Defender Line */}
              <div className="flex justify-center items-center gap-2 sm:gap-4 md:gap-6 flex-wrap">
                {pitchDEF.map(slot => renderPlayerCard(slot))}
              </div>

              {/* Midfielder Line */}
              <div className="flex justify-center items-center gap-2 sm:gap-4 md:gap-6 flex-wrap">
                {pitchMID.map(slot => renderPlayerCard(slot))}
              </div>

              {/* Forward Line */}
              <div className="flex justify-center items-center gap-2 sm:gap-4 md:gap-6 flex-wrap">
                {pitchFWD.map(slot => renderPlayerCard(slot))}
              </div>
            </div>
          </div>

          {/* Bench Section (4 Players) */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Substitutes Bench (12 - 15)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Click swap icon to move into Starting 11
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-4 justify-items-center">
              {benchSlots.map((slot, index) => (
                <div key={`bench-${slot.position}`} className="flex flex-col items-center">
                  <span className="text-[9px] font-bold text-slate-500 mb-1">
                    {index === 0 ? 'Sub GK' : `Sub ${index}`}
                  </span>
                  {renderPlayerCard(slot, true)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Financials, Transfer Actions, Impact Analysis */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Multi-Plan Drafts Bar (Plan A, Plan B, Plan C) */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-purple-400" />
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                  Squad Drafts & Plans
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">3 Saved Slots</span>
            </div>

            {/* 3 Plan Tabs */}
            <div className="grid grid-cols-3 gap-2">
              {PLAN_DEFINITIONS.map(pDef => {
                const plan = plans[pDef.id];
                const txCount = getPlanTransferCount(plan?.slots || []);
                const isActive = activePlanId === pDef.id;

                return (
                  <button
                    key={pDef.id}
                    onClick={() => handleSwitchPlan(pDef.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all relative ${
                      isActive
                        ? 'bg-gradient-to-b from-purple-600 to-indigo-700 border-purple-400 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400'
                        : 'bg-slate-950/70 hover:bg-slate-800 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-black tracking-tight truncate max-w-full">
                      {plan?.name || pDef.label}
                    </span>
                    <span
                      className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-black/30 text-emerald-300'
                          : txCount > 0
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {txCount > 0 ? `${txCount} ${txCount === 1 ? 'Transfer' : 'Transfers'}` : 'Clean'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Plan Controls: Rename & Duplicate */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
              {isEditingPlanName ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="text"
                    value={editingPlanNameValue}
                    onChange={e => setEditingPlanNameValue(e.target.value)}
                    placeholder="Plan name (e.g. Palmer & Saka)"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-purple-500"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSavePlanName();
                      if (e.key === 'Escape') setIsEditingPlanName(false);
                    }}
                  />
                  <button
                    onClick={handleSavePlanName}
                    className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    title="Save name"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setIsEditingPlanName(false)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="font-bold text-white truncate max-w-[140px]">
                      {plans[activePlanId]?.name || activePlanId.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        setEditingPlanNameValue(plans[activePlanId]?.name || '');
                        setIsEditingPlanName(true);
                      }}
                      className="p-1 rounded-md text-slate-500 hover:text-purple-400 transition-colors"
                      title="Rename this plan"
                    >
                      <Edit3 size={12} />
                    </button>
                  </div>

                  {/* Copy to buttons */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">Copy to:</span>
                    {PLAN_DEFINITIONS.filter(p => p.id !== activePlanId).map(target => (
                      <button
                        key={target.id}
                        onClick={() => handleDuplicatePlanTo(target.id)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        title={`Copy active squad into ${target.label}`}
                      >
                        {target.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financial & Transfer Metrics Bar */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Transfer & Budget Tracker</span>
              <Coins size={16} className="text-amber-400" />
            </h3>

            {/* Bank Card */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  remainingBank < 0
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-slate-950 border-white/5'
                }`}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase">Remaining Bank</span>
                <div
                  className={`text-xl font-mono font-black ${
                    remainingBank < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  £{remainingBank.toFixed(1)}m
                </div>
                {remainingBank < 0 && (
                  <span className="text-[9px] text-rose-400 font-bold mt-1">Exceeded budget!</span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Team Value</span>
                <div className="text-xl font-mono font-black text-white">
                  £{currentCost.toFixed(1)}m
                </div>
                <span className="text-[9px] text-slate-500">Squad 15 players</span>
              </div>
            </div>

            {/* Free Transfers & Hit Calculator */}
            <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Available Free Transfers:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(ft => (
                    <button
                      key={ft}
                      onClick={() => handleChangeFreeTransfers(ft)}
                      className={`w-6 h-6 rounded-lg text-xs font-bold transition-all ${
                        freeTransfers === ft
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                <span className="text-slate-400">Transfers Made:</span>
                <span className="font-bold text-white font-mono">{transfersMade.length}</span>
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-400">Point Deductions (Hit):</span>
                <span
                  className={`font-bold font-mono ${
                    transferHits > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {transferHits > 0 ? `-${transferHits} pts` : '0 pts (Free)'}
                </span>
              </div>
            </div>

            {/* Action Buttons: Reset & Share */}
            <div className="flex gap-2">
              <button
                onClick={handleResetAllTransfers}
                disabled={initialSlots.length === 0 || !isSquadModified}
                title="Reset active plan back to original FPL squad"
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <RotateCcw size={14} />
                <span>Reset Squad</span>
              </button>

              <button
                onClick={handleCopySummary}
                disabled={transfersMade.length === 0}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
              >
                {copiedNotification ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Transfers Summary List */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-purple-400" />
              <span>Simulated Transfers ({transfersMade.length})</span>
            </h3>

            {transfersMade.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <ArrowLeftRight size={24} className="mb-2 opacity-50" />
                <p className="text-xs font-medium">No transfers simulated yet</p>
                <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">
                  Click the 🔄 icon on any player on the pitch to pick a replacement!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
                {transfersMade.map((t, idx) => {
                  const outTeam = teamMap.get(t.outPlayer.team)?.short_name;
                  const inTeam = teamMap.get(t.inPlayer.team)?.short_name;
                  return (
                    <div
                      key={`tx-${idx}`}
                      className="p-3 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-between group hover:border-purple-500/30 transition-all"
                    >
                      <div className="space-y-1.5 flex-1 pr-2">
                        {/* Out */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[9px] font-black">
                            OUT
                          </span>
                          <span className="font-bold text-slate-300">{t.outPlayer.web_name}</span>
                          <span className="text-[10px] text-slate-500">{outTeam}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            £{(t.outPlayer.now_cost / 10).toFixed(1)}m
                          </span>
                        </div>

                        {/* In */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-black">
                            IN
                          </span>
                          <span className="font-bold text-white">{t.inPlayer.web_name}</span>
                          <span className="text-[10px] text-slate-500">{inTeam}</span>
                          <span className="text-[10px] font-mono text-emerald-400">
                            £{(t.inPlayer.now_cost / 10).toFixed(1)}m
                          </span>
                        </div>
                      </div>

                      {/* Financial difference */}
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-mono font-bold ${
                            t.costDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {t.costDiff >= 0 ? `+£${t.costDiff}m` : `-£${Math.abs(t.costDiff)}m`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transfer Selection Modal */}
      {selectedSlotForTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30">
                    TRANSFER HUB
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-white">
                      Select Replacement for {playerMap.get(selectedSlotForTransfer.id)?.web_name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const currentP = playerMap.get(selectedSlotForTransfer.id);
                        if (currentP) setSelectedPlayerForDetail(currentP);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white text-xs font-semibold border border-purple-500/30 transition-all hover:scale-105"
                      title="View current player profile & statistics"
                    >
                      <Info size={12} />
                      <span>Profile</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Position: <strong className="text-white">{POSITION_NAMES[playerMap.get(selectedSlotForTransfer.id)?.element_type || 1]}</strong> • Available to spend: <strong className="text-emerald-400">£{((playerMap.get(selectedSlotForTransfer.id)?.now_cost || 0) / 10 + remainingBank).toFixed(1)}m</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedSlotForTransfer(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-3 sm:p-4 bg-slate-900 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search player name..."
                  value={transferSearchQuery}
                  onChange={e => setTransferSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  autoFocus
                />
              </div>

              {/* Within Budget Toggle Button */}
              <button
                type="button"
                onClick={() => setOnlyWithinBudget(!onlyWithinBudget)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  onlyWithinBudget
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800'
                }`}
                title="Toggle between all players and only those within your available budget"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                    onlyWithinBudget
                      ? 'bg-white text-emerald-700'
                      : 'bg-slate-800 text-slate-500 border border-slate-600'
                  }`}
                >
                  {onlyWithinBudget ? <Check size={10} className="stroke-[3]" /> : null}
                </div>
                <span>Within budget</span>
              </button>

              {/* Team Filter */}
              <select
                value={filterTeam}
                onChange={e => setFilterTeam(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Teams</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {/* Sort by */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 text-purple-400 font-bold text-xs rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="form">Form (Highest)</option>
                  <option value="points">Total Points</option>
                  <option value="cost_desc">Price (High to Low)</option>
                  <option value="cost_asc">Price (Budget First)</option>
                  <option value="fdr">Fixture Ease (Next 3 FDR)</option>
                </select>
              </div>
            </div>

            {/* Candidates Table / List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar">
              {candidatePlayers.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm font-bold">No players found matching your criteria</p>
                  <p className="text-xs text-slate-600 mt-1">Try clearing search filters</p>
                </div>
              ) : (
                candidatePlayers.map(p => {
                  const teamObj = teamMap.get(p.team);
                  const pCost = p.now_cost / 10;
                  const currentSlotPlayer = playerMap.get(selectedSlotForTransfer.id);
                  const fundsAvailable = (currentSlotPlayer?.now_cost || 0) / 10 + remainingBank;
                  const isAffordable = pCost <= fundsAvailable + 0.001;

                  // Check club quota
                  const countInClub = currentSlots.filter(s => {
                    if (s.position === selectedSlotForTransfer.position) return false;
                    const sp = playerMap.get(s.id);
                    return sp?.team === p.team;
                  }).length;
                  const isMaxClub = countInClub >= 3;

                  // Next 3 fixtures
                  const next3 = getNextTeamFixtures(p.team, 3);

                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                        isMaxClub
                          ? 'opacity-40 bg-slate-950 border-slate-800 cursor-not-allowed'
                          : 'bg-slate-950/80 hover:bg-slate-800/90 border-white/5 hover:border-purple-500/50'
                      }`}
                    >
                      {/* Left: Photo, Name, Club - Clicking opens player profile */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlayerForDetail(p);
                        }}
                        className="flex items-center gap-3 cursor-pointer group/player"
                        title={`Click to view profile & analytics for ${p.web_name}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center group-hover/player:border-purple-400 transition-colors">
                          <img
                            src={getPlayerImageUrl(p.photo)}
                            alt=""
                            className="w-full h-full object-contain p-0.5"
                            onError={e => {
                              const target = e.target as HTMLImageElement;
                              const shirtUrl = getTeamShirtUrl(teamObj?.code, p.element_type === 1);
                              if (target.src !== shirtUrl) {
                                target.src = shirtUrl;
                              } else {
                                target.src = 'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.png';
                              }
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white group-hover/player:text-purple-300 transition-colors flex items-center gap-1.5">
                              {p.web_name}
                              <Info size={12} className="text-slate-500 group-hover/player:text-purple-400" />
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                              {teamObj?.short_name}
                            </span>
                            {isMaxClub && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                                Max 3 from club
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            <span>Form: <strong className="text-purple-400">{p.form}</strong></span>
                            <span>•</span>
                            <span>Total Pts: <strong className="text-white">{p.total_points}</strong></span>
                            <span>•</span>
                            <span>TSB: <strong>{p.selected_by_percent}%</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Upcoming Fixtures & Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
                        {/* 3 Fixture chips */}
                        <div className="flex items-center gap-1">
                          {next3.map((fix, idx) => (
                            <div
                              key={idx}
                              title={`GW${fix.event}: ${fix.opponentShort} (${fix.isHome ? 'H' : 'A'}) - FDR ${fix.difficulty}`}
                              className={`px-1.5 py-1 rounded text-[9px] font-mono font-bold border flex flex-col items-center ${getFdrColor(
                                fix.difficulty
                              )}`}
                            >
                              <span>{fix.opponentShort}</span>
                              <span className="text-[8px] opacity-80">{fix.isHome ? 'H' : 'A'}</span>
                            </div>
                          ))}
                        </div>

                        {/* Price & Actions */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-right">
                            <div className="font-mono font-black text-sm text-white">
                              £{pCost.toFixed(1)}m
                            </div>
                            <span
                              className={`text-[9px] font-bold ${
                                isAffordable ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isAffordable ? 'Within budget' : 'Over budget'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedPlayerForDetail(p);
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all hover:scale-105 border border-slate-700"
                            title={`View detailed statistics for ${p.web_name}`}
                          >
                            <Info size={15} />
                          </button>

                          <button
                            disabled={isMaxClub}
                            onClick={e => {
                              e.stopPropagation();
                              handleSelectReplacement(p);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/20 shrink-0"
                          >
                            Transfer In
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player Detail Modal */}
      {selectedPlayerForDetail && (
        <PlayerDetailModal
          player={selectedPlayerForDetail}
          isOpen={Boolean(selectedPlayerForDetail)}
          onClose={() => setSelectedPlayerForDetail(null)}
          teams={teams}
          allPlayers={allPlayers}
          fixtures={fixtures}
        />
      )}
    </div>
  );
};

export default SquadSimulator;
