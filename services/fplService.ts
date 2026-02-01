import { BootstrapStatic, FPLFixture, FPLElementSummary } from '../types';

const BASE_URL = 'https://fantasy.premierleague.com/api';

async function fetchFromBackend(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status}`);
  }
  return await response.json();
}

/**
 * Fetches data using multiple CORS proxies to ensure reliability.
 * FPL API does not support CORS for browser requests, so we must use a proxy.
 */
async function fetchViaProxy(url: string) {
  const encodedUrl = encodeURIComponent(url);

  const fetchWithTimeout = async (proxyUrl: string, timeoutMs: number = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  // Strategy 1: corsproxy.io (Fastest, usually works)
  try {
    return await fetchWithTimeout(`https://corsproxy.io/?${encodedUrl}`);
  } catch (err1) {
    console.warn('Proxy 1 (corsproxy.io) failed, trying fallback...', err1);
  }

  // Strategy 2: allorigins.win (Reliable JSONP-style)
  try {
    const data = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodedUrl}`);
    if (!data.contents) throw new Error("No content in response");
    return JSON.parse(data.contents);
  } catch (err2) {
    console.warn('Proxy 2 (allorigins) failed, trying fallback...', err2);
  }

  // Strategy 3: codetabs (Last resort)
  try {
    return await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`);
  } catch (err3) {
    console.error('All proxy strategies failed:', err3);
    throw new Error('Failed to connect to FPL API via proxies. This may happen on free hosting if proxies rate-limit the domain. Please try refreshing later.');
  }
}

export const getBootstrapStatic = async (): Promise<BootstrapStatic> => {
  try {
    return await fetchFromBackend('/api/fpl/bootstrap-static');
  } catch {
    // Fallback for legacy/static deployments where the backend route is unavailable.
    return fetchViaProxy(`${BASE_URL}/bootstrap-static/`);
  }
};

export const getFixtures = async (): Promise<FPLFixture[]> => {
  try {
    return await fetchFromBackend('/api/fpl/fixtures');
  } catch {
    return fetchViaProxy(`${BASE_URL}/fixtures/`);
  }
};

export const getUserPicks = async (teamId: number, eventId: number): Promise<{ picks: { element: number, position: number }[] }> => {
  try {
    return await fetchFromBackend(`/api/fpl/entry/${teamId}/event/${eventId}/picks`);
  } catch {
    return fetchViaProxy(`${BASE_URL}/entry/${teamId}/event/${eventId}/picks/`);
  }
};

export const getPlayerSummary = async (playerId: number): Promise<FPLElementSummary> => {
  try {
    return await fetchFromBackend(`/api/fpl/element-summary/${playerId}`);
  } catch {
    return fetchViaProxy(`${BASE_URL}/element-summary/${playerId}/`);
  }
};

export const getPlayerImageUrl = (photoCode: string) => {
  // Remove .jpg extension from API if present and use the png raw endpoint
  const id = photoCode.replace('.jpg', '');
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${id}.png`;
};

export const getTeamLogoUrl = (teamCode: number) => {
  return null;
};