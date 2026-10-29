import { FPLPlayer, FPLTeam } from '../types';
import { Top100Snapshot, Top100PlayerSignal } from '../services/top100Service';

function cleanStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function findTop100Signal(
  player: FPLPlayer,
  top100Data: Top100Snapshot | null
): Top100PlayerSignal | null {
  if (!top100Data) return null;

  const fn = cleanStr(player.first_name);
  const sn = cleanStr(player.second_name);
  const wn = cleanStr(player.web_name);
  const full = cleanStr(`${player.first_name}${player.second_name}`);

  // 1. Direct key match in playerLookup
  if (top100Data.playerLookup?.[full]) return top100Data.playerLookup[full];
  if (top100Data.playerLookup?.[wn]) return top100Data.playerLookup[wn];

  // 2. Iterate all signals and fuzzy match names
  const allSignals = [
    ...(top100Data.netBuys || []),
    ...(top100Data.netSells || []),
    ...(top100Data.dividedOpinion || []),
  ];

  for (const s of allSignals) {
    const sName = cleanStr(s.player);
    // Exact or contains check
    if (sName === full || sName === wn) return s;
    if (wn.length >= 4 && sName.includes(wn)) return s;
    if (sn.length >= 4 && sName.includes(sn)) return s;
    if (sName.length >= 5 && full.includes(sName)) return s;
  }

  return null;
}

export function findFplPlayerFromTop100(
  playerName: string,
  players: FPLPlayer[],
  teams?: FPLTeam[],
  teamHint?: string
): FPLPlayer | null {
  if (!playerName || !players?.length) return null;
  const target = cleanStr(playerName);
  if (!target) return null;

  // Find team if hint is provided
  let candidatePlayers = players;
  if (teamHint && teams?.length) {
    const cleanHint = cleanStr(teamHint);
    const matchedTeam = teams.find(
      t =>
        cleanStr(t.name) === cleanHint ||
        cleanStr(t.short_name) === cleanHint ||
        cleanHint.includes(cleanStr(t.short_name)) ||
        cleanHint.includes(cleanStr(t.name))
    );
    if (matchedTeam) {
      const teamPlayers = players.filter(p => p.team === matchedTeam.id);
      if (teamPlayers.length > 0) {
        candidatePlayers = teamPlayers;
      }
    }
  }

  // 1. Exact match on web_name
  let match = candidatePlayers.find(p => cleanStr(p.web_name) === target);
  if (match) return match;

  // 2. Exact match on full name (first_name + second_name)
  match = candidatePlayers.find(p => cleanStr(`${p.first_name}${p.second_name}`) === target);
  if (match) return match;

  // 3. Exact match on second_name
  const secondMatches = candidatePlayers.filter(p => cleanStr(p.second_name) === target);
  if (secondMatches.length === 1) return secondMatches[0];

  // 4. Substring / contains in candidates
  const subMatches = candidatePlayers.filter(p => {
    const full = cleanStr(`${p.first_name}${p.second_name}`);
    const web = cleanStr(p.web_name);
    const second = cleanStr(p.second_name);
    return (
      (full.length >= 4 && target.includes(full)) ||
      (target.length >= 4 && full.includes(target)) ||
      (web.length >= 4 && target.includes(web)) ||
      (target.length >= 4 && web.includes(target)) ||
      (second.length >= 4 && target.includes(second)) ||
      (target.length >= 4 && second.includes(target))
    );
  });
  if (subMatches.length >= 1) return subMatches[0];

  // If candidatePlayers was restricted by team and didn't find anything, search all players
  if (candidatePlayers !== players) {
    return findFplPlayerFromTop100(playerName, players);
  }

  return null;
}
