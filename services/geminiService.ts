import { GoogleGenAI, Type } from "@google/genai";
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';

// Helper to securely get the API Key from various environment configurations
const getApiKey = () => {
  // Check standard process.env (Node/Next.js)
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  }
  // Check Vite specific env or Next.js public env
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    // @ts-ignore
    return import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY;
  }
  return undefined;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to format player list for prompt to save tokens
const formatPlayersForPrompt = (players: FPLPlayer[], teams: FPLTeam[]) => {
  return players.map(p => {
    const teamName = teams.find(t => t.id === p.team)?.short_name || "UNK";
    return `${p.web_name} (${teamName}, £${p.now_cost / 10}, Form: ${p.form})`;
  }).join("; ");
};

export async function createScoutChatSession(
  players: FPLPlayer[],
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  userTeam: FPLPlayer[]
) {
  if (!ai) {
    throw new Error("API Key missing. Please set API_KEY (or VITE_API_KEY) in your Vercel Environment Variables.");
  }

  // 1. Prepare Context Data
  const nextEvent = events.find(e => e.is_next);
  const gameweekInfo = nextEvent ? `Next GW: ${nextEvent.id} (Deadline: ${nextEvent.deadline_time})` : "Season Finished";

  // Top Players (High Form or High Ownership)
  const topPlayers = players
    .filter(p => parseFloat(p.form) > 4.0 || parseFloat(p.selected_by_percent) > 15.0)
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 50);

  const topPlayersText = formatPlayersForPrompt(topPlayers, teams);

  // User Team
  const myTeamText = userTeam.length > 0
    ? formatPlayersForPrompt(userTeam, teams)
    : "User has no team selected yet.";

  // Upcoming Fixtures (Next GW only)
  const nextGwFixtures = fixtures
    .filter(f => f.event === nextEvent?.id)
    .map(f => {
      const h = teams.find(t => t.id === f.team_h)?.short_name;
      const a = teams.find(t => t.id === f.team_a)?.short_name;
      return `${h} vs ${a}`;
    })
    .join(", ");

  const systemInstruction = `
    You are an expert Fantasy Premier League (FPL) Scout and Assistant.
    
    CURRENT CONTEXT:
    - Status: ${gameweekInfo}
    - Upcoming Fixtures: ${nextGwFixtures}
    
    USER'S TEAM:
    ${myTeamText}

    MARKET DATA (Top Form/Ownership):
    ${topPlayersText}

    ROLE:
    - Answer questions about transfers, captaincy, and strategy.
    - If the user asks about a specific player not in the list, make a general assessment based on their team/price if you know it, or ask for details.
    - Be concise, data-driven, and strategic.
    - Use Markdown for bolding key player names.
    - If the user's team is empty, guide them to build a team first or suggest a template.
  `;

  return ai.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: systemInstruction,
    }
  });
}

// Keep the old function for backward compatibility if needed, or remove if unused.
export async function getScoutAdvice(
  players: FPLPlayer[],
  teams: FPLTeam[],
  nextGameweek: FPLEvent | undefined,
  userTeam: FPLPlayer[]
): Promise<{ analysis: string; captain: string; differential: string }> {

  if (!ai) {
    return {
      analysis: "API Key missing. Cannot generate advice.",
      captain: "N/A",
      differential: "N/A"
    };
  }

  const topPlayers = players
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 30)
    .map(p => `${p.web_name} (Price: ${p.now_cost / 10}, Form: ${p.form}, Total: ${p.total_points})`)
    .join(", ");

  const myTeamNames = userTeam.length > 0
    ? userTeam.map(p => p.web_name).join(", ")
    : "No team selected yet.";

  const gameweekInfo = nextGameweek ? `Gameweek ${nextGameweek.id} - Deadline: ${nextGameweek.deadline_time}` : "Season Finished";

  const prompt = `
    Role: You are an expert Fantasy Premier League (FPL) scout.
    Context:
    Current Gameweek: ${gameweekInfo}
    User's Current Team: ${myTeamNames}
    
    Top Form Players available in the league:
    ${topPlayers}

    Task:
    1. Analyze the user's team (if any) or general market trends.
    2. Suggest a Captain choice based on form.
    3. Suggest a "Differential" player (good form but low ownership/hidden gem).
    
    Return the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            captain: { type: Type.STRING },
            differential: { type: Type.STRING },
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      analysis: "The scout is currently unavailable due to technical difficulties.",
      captain: "Unknown",
      differential: "Unknown"
    };
  }
}