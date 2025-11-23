import { BootstrapStatic, FPLFixture } from '../types';

const BASE_URL = 'https://fantasy.premierleague.com/api';

/**
 * Fetches data using multiple CORS proxies to ensure reliability.
 * FPL API does not support CORS for browser requests, so we must use a proxy.
 */
async function fetchViaProxy(url: string) {
  const encodedUrl = encodeURIComponent(url);
  
  // Strategy 1: corsproxy.io (Preferred - Direct JSON)
  try {
    const proxyUrl = `https://corsproxy.io/?${encodedUrl}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return await response.json();
  } catch (primaryError) {
    console.warn('Primary proxy (corsproxy.io) failed, attempting fallback...', primaryError);
  }

  // Strategy 2: allorigins.win (Fallback - JSONP style)
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodedUrl}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    // allorigins returns the actual response body in 'contents'
    return JSON.parse(data.contents);
  } catch (secondaryError) {
    console.error('All proxy strategies failed:', secondaryError);
    throw new Error('Failed to connect to FPL API via proxies. Please check your internet connection.');
  }
}

export const getBootstrapStatic = async (): Promise<BootstrapStatic> => {
  return fetchViaProxy(`${BASE_URL}/bootstrap-static/`);
};

export const getFixtures = async (): Promise<FPLFixture[]> => {
  return fetchViaProxy(`${BASE_URL}/fixtures/`);
};

export const getUserPicks = async (teamId: number, eventId: number): Promise<{ picks: { element: number, position: number }[] }> => {
  return fetchViaProxy(`${BASE_URL}/entry/${teamId}/event/${eventId}/picks/`);
};

export const getPlayerImageUrl = (photoCode: string) => {
  // Remove .jpg extension from API if present and use the png raw endpoint
  const id = photoCode.replace('.jpg', '');
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${id}.png`;
};

export const getTeamLogoUrl = (teamCode: number) => {
    return null; 
};