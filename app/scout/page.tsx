import { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabaseServer';
import ScoutAdminPanel from './ScoutAdminPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'FPL Scout — AI-Powered Gameweek Previews | FPL Studio',
    description:
        'Get AI-generated Fantasy Premier League gameweek previews with captain picks, differentials, and transfer targets. Updated weekly with live FPL data.',
    alternates: {
        canonical: 'https://www.fplstudio.com/scout',
    },
    openGraph: {
        title: 'FPL Scout — AI-Powered Gameweek Previews',
        description:
            'AI-generated FPL analysis with captain picks, differentials, and transfer targets.',
        type: 'website',
        siteName: 'FPL Studio',
        url: 'https://www.fplstudio.com/scout',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'FPL Scout — AI-Powered Gameweek Previews',
        description:
            'AI-generated FPL analysis with captain picks, differentials, and transfer targets.',
    },
};

interface ScoutArticle {
    id: string;
    slug: string;
    gameweek: number;
    title: string;
    summary: string;
    captain_pick: string | null;
    differential_pick: string | null;
    generated_at: string;
}

export default async function ScoutPage() {
    const supabase = createServerSupabase();

    const { data: articles, error } = await supabase
        .from('scout_articles')
        .select('id, slug, gameweek, title, summary, captain_pick, differential_pick, generated_at')
        .eq('published', true)
        .order('generated_at', { ascending: false })
        .limit(20);

    const articleList: ScoutArticle[] = articles ?? [];

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <Link
                        href="/"
                        className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter hover:opacity-80 transition-opacity"
                    >
                        FPL STUDIO
                    </Link>
                    <nav className="flex items-center gap-4">
                        <Link
                            href="/scout"
                            className="text-sm font-medium text-white bg-purple-600/20 px-3 py-1.5 rounded-lg shadow-[0_0_0_1px_rgba(168,85,247,0.4)]"
                        >
                            Scout
                        </Link>
                        <Link
                            href="/"
                            className="text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 px-3 py-1.5 rounded-lg transition-all"
                        >
                            Dashboard
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-emerald-900/10" />
                <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                            <svg width="12" height="12" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                            AI-Powered
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
                        FPL Scout
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
                        AI-generated gameweek previews with captain picks, differential recommendations, and data-driven transfer targets. Updated before every deadline.
                    </p>
                </div>
            </section>

            {/* Articles Grid */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
                {/* Admin Generation Panel */}
                <ScoutAdminPanel />

                {error && (
                    <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-6 mb-8">
                        <p className="text-red-400 text-sm">Failed to load articles. Please try again later.</p>
                    </div>
                )}

                {articleList.length === 0 && !error && (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg width="32" height="32" className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">No articles yet</h2>
                        <p className="text-slate-400 text-sm">The first AI Scout preview will appear before the next gameweek deadline.</p>
                    </div>
                )}

                <div className="grid gap-6">
                    {articleList.map((article) => {
                        const date = new Date(article.generated_at);
                        const formattedDate = date.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        });

                        return (
                            <Link key={article.id} href={`/scout/${article.slug}`}>
                                <article className="group relative bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 hover:border-purple-500/30 rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5">
                                    {/* GW Badge */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="inline-flex items-center text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                            GW {article.gameweek}
                                        </span>
                                        <span className="text-xs text-slate-500">{formattedDate}</span>
                                    </div>

                                    {/* Title */}
                                    <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-purple-300 transition-colors mb-3 tracking-tight">
                                        {article.title}
                                    </h2>

                                    {/* Summary */}
                                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-5 line-clamp-2">
                                        {article.summary}
                                    </p>

                                    {/* Quick picks */}
                                    <div className="flex flex-wrap gap-3">
                                        {article.captain_pick && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                                                👑 Captain: {article.captain_pick}
                                            </span>
                                        )}
                                        {article.differential_pick && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg">
                                                💎 Differential: {article.differential_pick}
                                            </span>
                                        )}
                                    </div>

                                    {/* Arrow */}
                                    <div className="absolute top-1/2 right-6 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg width="20" height="20" className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </article>
                            </Link>
                        );
                    })}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                        FPL Studio · Data by FPL API · Not Premier League Affiliated
                    </p>
                </div>
            </footer>
        </div>
    );
}
