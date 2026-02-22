import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabaseServer';
import ShareButtons from './ShareButtons';

export const dynamic = 'force-dynamic';

interface ArticleData {
    id: string;
    slug: string;
    gameweek: number;
    title: string;
    summary: string;
    content: string;
    captain_pick: string | null;
    differential_pick: string | null;
    generated_at: string;
}

async function getArticle(slug: string): Promise<ArticleData | null> {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
        .from('scout_articles')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();

    if (error || !data) return null;
    return data as ArticleData;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = await getArticle(slug);
    if (!article) return { title: 'Article Not Found | FPL Studio' };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fplstudio.co';

    return {
        title: `${article.title} | FPL Studio`,
        description: article.summary,
        openGraph: {
            title: article.title,
            description: article.summary,
            type: 'article',
            siteName: 'FPL Studio',
            publishedTime: article.generated_at,
            url: `${siteUrl}/scout/${article.slug}`,
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.summary,
        },
        alternates: {
            canonical: `${siteUrl}/scout/${article.slug}`,
        },
    };
}

/**
 * Simple markdown-to-HTML renderer for article content.
 * Handles: ## headings, **bold**, *italic*, - lists, \n paragraphs
 */
function renderMarkdown(md: string): string {
    return md
        .split('\n\n')
        .map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return '';

            // Headings
            if (trimmed.startsWith('## ')) {
                const text = trimmed.slice(3);
                return `<h2 class="text-xl sm:text-2xl font-bold text-white mt-10 mb-4 tracking-tight">${text}</h2>`;
            }
            if (trimmed.startsWith('### ')) {
                const text = trimmed.slice(4);
                return `<h3 class="text-lg font-bold text-white mt-8 mb-3">${text}</h3>`;
            }

            // Bullet lists
            if (trimmed.match(/^[-*] /m)) {
                const items = trimmed
                    .split('\n')
                    .filter((l) => l.trim().match(/^[-*] /))
                    .map((l) => {
                        const content = l.trim().replace(/^[-*] /, '');
                        return `<li class="text-slate-300 leading-relaxed">${inlineFormat(content)}</li>`;
                    })
                    .join('');
                return `<ul class="list-disc list-inside space-y-2 my-4 ml-2">${items}</ul>`;
            }

            // Regular paragraph
            return `<p class="text-slate-300 leading-relaxed my-4">${inlineFormat(trimmed)}</p>`;
        })
        .join('');
}

function inlineFormat(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="text-purple-300 bg-purple-500/10 px-1 rounded text-sm">$1</code>');
}

export default async function ScoutArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const article = await getArticle(slug);

    if (!article) {
        notFound();
    }

    const date = new Date(article.generated_at);
    const formattedDate = date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const htmlContent = renderMarkdown(article.content);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.summary,
        datePublished: article.generated_at,
        author: {
            '@type': 'Organization',
            name: 'FPL Studio',
            url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fplstudio.co'
        }
    };

    return (
        <div className="min-h-screen bg-slate-950">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <Link
                        href="/scout"
                        className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter hover:opacity-80 transition-opacity"
                    >
                        FPL STUDIO
                    </Link>
                    <nav className="flex items-center gap-4">
                        <Link
                            href="/scout"
                            className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                        >
                            <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            All Previews
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Article */}
            <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                {/* Meta */}
                <div className="flex items-center gap-3 mb-6">
                    <span className="inline-flex items-center text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                        GW {article.gameweek}
                    </span>
                    <span className="text-xs text-slate-500">{formattedDate}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                        <svg width="12" height="12" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        AI Generated
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
                    {article.title}
                </h1>

                {/* Summary */}
                <p className="text-lg text-slate-400 leading-relaxed mb-8 border-l-4 border-purple-500 pl-4">
                    {article.summary}
                </p>

                {/* Quick picks cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                    {article.captain_pick && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                            <div className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">
                                👑 Captain Pick
                            </div>
                            <div className="text-xl font-bold text-white">{article.captain_pick}</div>
                        </div>
                    )}
                    {article.differential_pick && (
                        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5">
                            <div className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2">
                                💎 Differential Pick
                            </div>
                            <div className="text-xl font-bold text-white">{article.differential_pick}</div>
                        </div>
                    )}
                </div>

                {/* Article body */}
                <div
                    className="prose-custom"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {/* Share */}
                <div className="mt-16 pt-8 border-t border-slate-800">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Share this preview
                    </h3>
                    <ShareButtons
                        title={article.title}
                        summary={article.summary}
                        slug={article.slug}
                    />
                </div>
            </article>

            {/* More articles CTA */}
            <div className="border-t border-white/5 py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                    <Link
                        href="/scout"
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-purple-600/20"
                    >
                        <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        All Gameweek Previews
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                        FPL Studio · AI-Powered Analysis · Not Premier League Affiliated
                    </p>
                </div>
            </footer>
        </div>
    );
}
