import { GoogleGenAI, Type } from "@google/genai";

const FPL_BASE = 'https://fantasy.premierleague.com/api';

/**
 * Server-side Gemini service for generating Scout articles.
 * Different from client-side geminiService.ts — this runs only on the server.
 */

function getServerApiKey(): string {
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not set in environment');
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

function buildArticlePrompt(bootstrap: FPLBootstrap, fixtures: any[], topic: string): string {
    const { elements: players, teams, events } = bootstrap;
    const nextEvent = events.find((e: any) => e.is_next);
    if (!nextEvent) throw new Error('No upcoming gameweek found');

    const gwNum = nextEvent.id;
    const deadline = nextEvent.deadline_time;

    // Default overview logic
    if (topic === 'general') {
        const topForm = players.filter((p: any) => parseFloat(p.form) > 3.0).sort((a: any, b: any) => parseFloat(b.form) - parseFloat(a.form)).slice(0, 10).map((p: any) => `${p.web_name} (${teams.find((t: any) => t.id === p.team)?.short_name}, Form: ${p.form}, Own: ${p.selected_by_percent}%)`);
        const gems = players.filter((p: any) => parseFloat(p.form) > 4.0 && parseFloat(p.selected_by_percent) < 10).sort((a: any, b: any) => parseFloat(b.form) - parseFloat(a.form)).slice(0, 5).map((p: any) => `${p.web_name} (${teams.find((t: any) => t.id === p.team)?.short_name}, Form: ${p.form}, Own: ${p.selected_by_percent}%)`);
        const gwFixtures = fixtures.filter((f: any) => f.event === gwNum).map((f: any) => `${teams.find((t: any) => t.id === f.team_h)?.short_name} vs ${teams.find((t: any) => t.id === f.team_a)?.short_name} (H: ${f.team_h_difficulty}, A: ${f.team_a_difficulty})`);

        return `You are the FPL Studio Scout. Write a GW${gwNum} preview... (General Overview).
DATA:
Fixtures: ${gwFixtures.join(', ')}
Top Form: ${topForm.join(', ')}
Hidden Gems: ${gems.join(', ')}

Structure: Overview, Key Fixtures, Captains, Differentials, Summar. 400-600 words. Keep it actionable. Also return structured JSON data with: title, summary, content, captain_pick, differential_pick.`;
    }

    if (topic === 'fdr_matrix') {
        return `You are the FPL Studio Scout. Write an analysis based on the FDR Matrix for the next 5 GWs starting from GW${gwNum}. Focus on teams with the best and worst upcoming fixture runs. Tell managers who to target and who to avoid. Provide actionable transfer advice. Also return structured JSON data with: title, summary, content, captain_pick, differential_pick.`;
    }

    if (topic === 'team_analysis') {
        return `You are the FPL Studio Scout. Write a detailed Team Analysis article for GW${gwNum}. Focus on attacking and defensive form over the last 5 matches. Highlight teams overperforming or underperforming their stats. Advise on defensive double-ups or attacking targets. Also return structured JSON data with: title, summary, content, captain_pick, differential_pick.`;
    }

    if (topic === 'period_analysis') {
        return `You are the FPL Studio Scout. Write a Period Analysis article for GW${gwNum} focusing on recent player form (last 5 GWs). Compare top performers across all positions (GKP, DEF, MID, FWD). Who is genuinely essential right now based on recent output? Return structured JSON data with: title, summary, content, captain_pick, differential_pick.`;
    }

    if (topic === 'fixtures_next') {
        return `You are the FPL Studio Scout. Write an article focused EXCLUSIVELY on the next gameweek (GW${gwNum}) fixtures. Highlight key matchups, potential high-scoring games, and clean sheet probabilities. Who are the best one-week punts? Return structured JSON data with: title, summary, content, captain_pick, differential_pick.`;
    }

    if (topic === 'transfer_picks' || topic === 'transfer_picks_next') {
        return `You are the FPL Studio Scout. Write a Transfer Picks article for GW${gwNum} (Focus: ${topic === 'transfer_picks_next' ? 'Next GW Only' : 'Next 5 GWs'}). Analyze top targets by position using our Transfer Algorithm (which balances Form and Fixtures). Discuss whether current highly-rated picks are sustainable or potential traps. Return structured JSON data: title, summary, content, captain_pick, differential_pick.`;
    }

    // Fallback
    return `You are the FPL Studio Scout. Write a preview for Gameweek ${gwNum}. Topic: ${topic}. Return JSON: title, summary, content, captain_pick, differential_pick.`;
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

export async function generateScoutArticle({ isMock = false, topic = 'general' }: { isMock?: boolean, topic?: string } = {}): Promise<ScoutArticleResult> {
    const { bootstrap, fixtures } = await fetchFPLData();

    const nextEvent = bootstrap.events.find((e: any) => e.is_next);
    if (!nextEvent) throw new Error('No upcoming gameweek');
    const gwNum = nextEvent.id;
    const slugBase = `gw${gwNum}-preview`;
    const topicSlug = topic !== 'general' ? `-${topic}` : '';
    const slug = `${slugBase}${topicSlug}-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;

    if (isMock) {
        console.log('🧪 Mock Mode: Generating fake scout article data.');
        return {
            title: `[MOCK] FPL Gameweek ${gwNum} Preview: ${topic}`,
            summary: "This is a mock scout article for development and testing purposes. No AI tokens were consumed.",
            content: `## GW${gwNum} Overview\nThis is a mock article content for testing the UI and Supabase integration. Topic: ${topic}\n\n## Captain Picks\n- **Haaland** (MCI)\n- **Salah** (LIV)\n\n## Differential Picks\n- **Mitoma** (BHA)\n\n## Summary\nGood luck with your GW${gwNum} team!`,
            captain_pick: "Haaland (MOCK)",
            differential_pick: "Mitoma (MOCK)",
            gameweek: gwNum,
            slug,
        };
    }

    const ai = new GoogleGenAI({ apiKey: getServerApiKey() });
    const prompt = buildArticlePrompt(bootstrap, fixtures, topic);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
