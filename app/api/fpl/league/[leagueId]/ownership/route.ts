import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

// In-memory cache to prevent spamming FPL upstream
interface CacheEntry {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export async function GET(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const league = Number(leagueId);

  if (!Number.isFinite(league) || league <= 0) {
    return NextResponse.json({ error: 'Invalid leagueId' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const eventParam = searchParams.get('event');
  const cacheKey = `${league}_${eventParam || 'latest'}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    // 1. Fetch league standings
    const standingsRes = await fetch(`${FPL_BASE}/leagues-classic/${league}/standings/`, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (!standingsRes.ok) {
      return NextResponse.json(
        { error: `Upstream FPL error fetching league standings: ${standingsRes.status}` },
        { status: standingsRes.status }
      );
    }

    const standingsData = await standingsRes.json();
    const entries = standingsData?.standings?.results || [];

    if (!entries.length) {
      return NextResponse.json({
        league: standingsData?.league,
        managersCount: 0,
        players: [],
        captains: [],
        managers: [],
      });
    }

    // 2. Determine target Gameweek / Event
    let eventId = Number(eventParam);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      // Find active or latest event from bootstrap-static
      try {
        const bootRes = await fetch(`${FPL_BASE}/bootstrap-static/`, { cache: 'no-store' });
        if (bootRes.ok) {
          const boot = await bootRes.json();
          const cur = boot.events?.find((e: any) => e.is_current) || boot.events?.find((e: any) => e.is_next) || boot.events?.[0];
          if (cur?.id) {
            eventId = cur.id;
          }
        }
      } catch {
        eventId = 1;
      }
    }

    // 3. Fetch each manager's picks for this event (concurrently with batching)
    const BATCH_SIZE = 8;
    const managersPicks: Array<{
      entry: any;
      picks: any[];
      activeChip: string | null;
      captainId: number | null;
      viceCaptainId: number | null;
    }> = [];

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (m: any) => {
          try {
            const pRes = await fetch(`${FPL_BASE}/entry/${m.entry}/event/${eventId}/picks/`, {
              cache: 'no-store',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
              },
            });
            if (pRes.ok) {
              const pData = await pRes.json();
              const picksList = pData.picks || [];
              const cap = picksList.find((p: any) => p.is_captain)?.element || null;
              const vice = picksList.find((p: any) => p.is_vice_captain)?.element || null;
              return {
                entry: m,
                picks: picksList,
                activeChip: pData.active_chip || null,
                captainId: cap,
                viceCaptainId: vice,
              };
            }
          } catch (e) {
            console.warn(`Failed to fetch picks for entry ${m.entry}:`, e);
          }
          return {
            entry: m,
            picks: [],
            activeChip: null,
            captainId: null,
            viceCaptainId: null,
          };
        })
      );
      managersPicks.push(...batchResults);
    }

    // 4. Calculate Player Ownership & Captaincy Stats
    const totalManagers = managersPicks.length;
    const playerStatsMap = new Map<
      number,
      {
        elementId: number;
        ownedCount: number;
        startingCount: number; // 1-11
        benchCount: number; // 12-15
        captainCount: number;
        effectiveOwnership: number; // Sum of multiplier (captain counts as 2, vice/normal as 1, bench as 0)
        managers: Array<{
          entry: number;
          entryName: string;
          playerName: string;
          rank: number;
          totalPoints: number;
          isCaptain: boolean;
          isViceCaptain: boolean;
          isStarting: boolean;
          position: number;
          multiplier: number;
        }>;
      }
    >();

    for (const mp of managersPicks) {
      for (const p of mp.picks) {
        let stat = playerStatsMap.get(p.element);
        if (!stat) {
          stat = {
            elementId: p.element,
            ownedCount: 0,
            startingCount: 0,
            benchCount: 0,
            captainCount: 0,
            effectiveOwnership: 0,
            managers: [],
          };
          playerStatsMap.set(p.element, stat);
        }

        const isStarting = p.position <= 11;
        const isCaptain = Boolean(p.is_captain);
        const isViceCaptain = Boolean(p.is_vice_captain);
        const multiplier = isStarting ? (p.multiplier ?? (isCaptain ? 2 : 1)) : 0;

        stat.ownedCount += 1;
        stat.managers.push({
          entry: mp.entry.entry,
          entryName: mp.entry.entry_name,
          playerName: mp.entry.player_name,
          rank: mp.entry.rank,
          totalPoints: mp.entry.total,
          isCaptain,
          isViceCaptain,
          isStarting,
          position: p.position,
          multiplier,
        });

        if (isStarting) {
          stat.startingCount += 1;
        } else {
          stat.benchCount += 1;
        }

        if (isCaptain) {
          stat.captainCount += 1;
        }

        stat.effectiveOwnership += multiplier;
      }
    }

    const ownershipList = Array.from(playerStatsMap.values()).map(s => {
      // Sort managers owning this player by current league rank ascending (1st place first)
      const sortedManagers = [...s.managers].sort((a, b) => a.rank - b.rank);
      return {
        elementId: s.elementId,
        ownedCount: s.ownedCount,
        ownershipPercent: Number(((s.ownedCount / totalManagers) * 100).toFixed(1)),
        startingCount: s.startingCount,
        startingPercent: Number(((s.startingCount / totalManagers) * 100).toFixed(1)),
        benchCount: s.benchCount,
        captainCount: s.captainCount,
        captainPercent: Number(((s.captainCount / totalManagers) * 100).toFixed(1)),
        effectiveOwnershipPercent: Number(((s.effectiveOwnership / totalManagers) * 100).toFixed(1)),
        managers: sortedManagers,
      };
    });

    // Sort by ownership percentage descending
    ownershipList.sort((a, b) => b.ownedCount - a.ownedCount || b.captainCount - a.captainCount);

    const responsePayload = {
      league: standingsData.league,
      event: eventId,
      totalManagers,
      ownership: ownershipList,
      managers: managersPicks.map(m => ({
        entry: m.entry.entry,
        entryName: m.entry.entry_name,
        playerName: m.entry.player_name,
        rank: m.entry.rank,
        lastRank: m.entry.last_rank,
        totalPoints: m.entry.total,
        eventPoints: m.entry.event_total,
        activeChip: m.activeChip,
        captainId: m.captainId,
        viceCaptainId: m.viceCaptainId,
      })),
      fetchedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err: any) {
    console.error('Error computing league ownership:', err);
    return NextResponse.json(
      { error: 'Failed to compute league ownership', details: err?.message },
      { status: 500 }
    );
  }
}

