import { GoogleGenAI, Type } from "@google/genai";

const FPL_BASE = 'https://fantasy.premierleague.com/api';

/**
 * Server-side Gemini service for generating Scout articles.
 * Different from client-side geminiService.ts — this runs only on the server.
 */

function getServerApiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set in environment');
    return key;
}

interface FPLBootstrap {
    elements: any[];
    teams: any[];
    events: any[];
}

async function fetchFPLData(): Promise<{ bootstrap: FPLBootstrap; fixtures: any[] }> {
    const [bootstrapRes, fixturesRes] = await Promise.all([
        fetch(`${FPL_BASE}/bootstrap-static/`, { cache: 'no-store' }),
        fetch(`${FPL_BASE}/fixtures/`, { cache: 'no-store' }),
    ]);

    if (!bootstrapRes.ok || !fixturesRes.ok) {
        throw new Error('Failed to fetch FPL data for article generation');
    }

    return {
        bootstrap: await bootstrapRes.json(),
        fixtures: await fixturesRes.json(),
    };
}

function buildArticlePrompt(bootstrap: FPLBootstrap, fixtures: any[]): string {
    const { elements: players, teams, events } = bootstrap;
    const nextEvent = events.find((e: any) => e.is_next);
    if (!nextEvent) throw new Error('No upcoming gameweek found');

    const gwNum = nextEvent.id;
    const deadline = nextEvent.deadline_time;

    // Top form players
    const topForm = players
        .filter((p: any) => parseFloat(p.form) > 3.0)
        .sort((a: any, b: any) => parseFloat(b.form) - parseFloat(a.form))
        .slice(0, 10)
        .map((p: any) => {
            const team = teams.find((t: any) => t.id === p.team)?.short_name || '???';
            return `${p.web_name} (${team}, £${(p.now_cost / 10).toFixed(1)}, Form: ${p.form}, Pts: ${p.total_points}, Ownership: ${p.selected_by_percent}%)`;
        });

    // Hidden gems: high form, low ownership
    const gems = players
        .filter((p: any) => parseFloat(p.form) > 4.0 && parseFloat(p.selected_by_percent) < 10)
        .sort((a: any, b: any) => parseFloat(b.form) - parseFloat(a.form))
        .slice(0, 5)
        .map((p: any) => {
            const team = teams.find((t: any) => t.id === p.team)?.short_name || '???';
            return `${p.web_name} (${team}, £${(p.now_cost / 10).toFixed(1)}, Form: ${p.form}, Own: ${p.selected_by_percent}%)`;
        });

    // Upcoming fixtures for the GW
    const gwFixtures = fixtures
        .filter((f: any) => f.event === gwNum)
        .map((f: any) => {
            const home = teams.find((t: any) => t.id === f.team_h)?.short_name || '???';
            const away = teams.find((t: any) => t.id === f.team_a)?.short_name || '???';
            return `${home} vs ${away} (H difficulty: ${f.team_h_difficulty}, A difficulty: ${f.team_a_difficulty})`;
        });

    // Injury flagged players
    const injured = players
        .filter((p: any) => p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 75 && parseFloat(p.selected_by_percent) > 5)
        .sort((a: any, b: any) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
        .slice(0, 5)
        .map((p: any) => {
            const team = teams.find((t: any) => t.id === p.team)?.short_name || '???';
            return `${p.web_name} (${team}, ${p.chance_of_playing_next_round}% chance, Own: ${p.selected_by_percent}%, Status: ${p.news || 'Unknown'})`;
        });

    return `
You are the FPL Studio Scout — an expert Fantasy Premier League analyst.
Write a comprehensive, engaging Gameweek ${gwNum} preview article.

RULES:
- Write in English, professional but accessible tone
- Use Markdown formatting with ## headers, **bold** for player names, bullet lists
- Include specific stats and numbers from the data
- Structure: Overview → Key Fixtures → Captain Picks → Differential Picks → Who to Avoid → Transfer Targets → Summary
- Each section should be 2-4 paragraphs
- Total length: 400-600 words
- Make it opinionated and actionable — managers should feel confident making decisions after reading

DATA FOR GAMEWEEK ${gwNum}:
Deadline: ${deadline}

FIXTURES:
${gwFixtures.join('\n')}

TOP FORM PLAYERS:
${topForm.join('\n')}

HIDDEN GEMS (Low Ownership, High Form):
${gems.join('\n')}

INJURY/DOUBT FLAGS:
${injured.join('\n')}

Also return structured data:
- captain_pick: Your #1 captain recommendation (just the player name)
- differential_pick: Your top differential pick (just the player name)
- title: A catchy article title (include GW number)
- summary: A 1-2 sentence summary for social sharing
`;
}

export interface ScoutArticleResult {
    title: string;
    summary: string;
    content: string;
    captain_pick: string;
    differential_pick: string;
    gameweek: number;
    slug: string;
}

export async function generateScoutArticle(): Promise<ScoutArticleResult> {
    const ai = new GoogleGenAI({ apiKey: getServerApiKey() });
    const { bootstrap, fixtures } = await fetchFPLData();

    const nextEvent = bootstrap.events.find((e: any) => e.is_next);
    if (!nextEvent) throw new Error('No upcoming gameweek');
    const gwNum = nextEvent.id;

    const prompt = buildArticlePrompt(bootstrap, fixtures);

    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    content: { type: Type.STRING },
                    captain_pick: { type: Type.STRING },
                    differential_pick: { type: Type.STRING },
                },
                required: ['title', 'summary', 'content', 'captain_pick', 'differential_pick'],
            },
        },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(text);
    const slug = `gw${gwNum}-preview-${new Date().getFullYear()}`;

    return {
        title: parsed.title,
        summary: parsed.summary,
        content: parsed.content,
        captain_pick: parsed.captain_pick,
        differential_pick: parsed.differential_pick,
        gameweek: gwNum,
        slug,
    };
}
