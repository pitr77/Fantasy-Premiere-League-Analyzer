import { FPLPlayer } from '../types';
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
  if (top100Data.playerLookup[full]) return top100Data.playerLookup[full];
  if (top100Data.playerLookup[wn]) return top100Data.playerLookup[wn];

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
