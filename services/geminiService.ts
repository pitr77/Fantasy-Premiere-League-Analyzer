import { GoogleGenAI, Type } from "@google/genai";
import { FPLPlayer, FPLTeam, FPLEvent } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getScoutAdvice(
  players: FPLPlayer[],
  teams: FPLTeam[],
  nextGameweek: FPLEvent | undefined,
  userTeam: FPLPlayer[]
): Promise<{ analysis: string; captain: string; differential: string }> {
  
  if (!process.env.API_KEY) {
    return {
        analysis: "API Key missing. Cannot generate advice.",
        captain: "N/A",
        differential: "N/A"
    };
  }

  // Filter top performing players to reduce token count
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
      model: 'gemini-2.5-flash',
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
