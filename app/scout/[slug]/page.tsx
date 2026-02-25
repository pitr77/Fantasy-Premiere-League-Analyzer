import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabaseServer';
import ShareButtons from './ShareButtons';
import DeleteArticleButton from './DeleteArticleButton';

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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fplstudio.com';

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
    // First, handle headers that might not have double newlines
    const lines = md.split('\n');
    const result: string[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            const text = currentParagraph.join(' ').trim();
            if (text) {
                result.push(`<p class="text-slate-400 text-sm sm:text-base leading-relaxed mb-6">${inlineFormat(text)}</p>`);
            }
            currentParagraph = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            flushParagraph();
            continue;
        }

        if (line.startsWith('## ')) {
            flushParagraph();
            const text = line.slice(3);
            result.push(`<h2 class="text-lg sm:text-xl font-bold text-white mt-10 mb-4 tracking-tight border-b border-white/5 pb-2">${inlineFormat(text)}</h2>`);
        } else if (line.startsWith('### ')) {
            flushParagraph();
            const text = line.slice(4);
            result.push(`<h3 class="text-base font-bold text-white mt-8 mb-3">${inlineFormat(text)}</h3>`);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            flushParagraph();
            // Basic list handling
            let listItems = '';
            while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
                const itemText = lines[i].trim().replace(/^[-*] /, '');
                listItems += `<li class="text-slate-400 text-sm leading-relaxed mb-2 ml-4 relative pl-5 before:content-[''] before:absolute before:left-0 before:top-2.5 before:w-1.5 before:h-1.5 before:bg-purple-500 before:rounded-full">${inlineFormat(itemText)}</li>`;
                i++;
            }
            i--; // Step back for loop increment
            result.push(`<ul class="my-6 space-y-1">${listItems}</ul>`);
        } else if (line.startsWith('|')) {
            flushParagraph();
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            i--; // Step back

            let tableHtml = '<div class="overflow-x-auto my-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg"><table class="w-full text-left border-collapse text-sm whitespace-nowrap">';
            tableLines.forEach((tLine, idx) => {
                const cells = tLine.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
                if (idx === 1 && tLine.includes('---')) return; // skip divider

                if (idx === 0) {
                    tableHtml += '<thead><tr class="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider font-bold">';
                    cells.forEach(c => tableHtml += `<th class="p-4 border-b border-slate-700">${inlineFormat(c)}</th>`);
                    tableHtml += '</tr></thead><tbody class="divide-y divide-slate-800/50">';
                } else {
                    tableHtml += '<tr class="hover:bg-slate-800/30 transition-colors">';
                    cells.forEach((c, cIdx) => tableHtml += `<td class="p-4 text-slate-200 ${cIdx === 0 ? 'font-medium text-white' : ''}">${inlineFormat(c)}</td>`);
                    tableHtml += '</tr>';
                }
            });
            tableHtml += '</tbody></table></div>';
            result.push(tableHtml);
        } else {
            currentParagraph.push(line);
        }
    }
    flushParagraph();
    return result.join('');
}

function inlineFormat(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<span class="text-white font-medium">$1</span>')
        .replace(/\*([^*]+)\*/g, '<em class="text-slate-300">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
}

function getHeroImage(slug: string): string {
    if (slug.includes('period_analysis')) {
        return 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?auto=format&fit=crop&q=80&w=1600'; // tactics board
    }
    if (slug.includes('transfer')) {
        return 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600'; // football gear / grass
    }
    if (slug.includes('team_analysis') || slug.includes('fdr_matrix')) {
        return 'https://images.unsplash.com/photo-1508344928928-7137b29de216?auto=format&fit=crop&q=80&w=1600'; // stunning stadium overview
    }

    // Generic default for general preview
    return 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=1600'; // classic sunset stadium
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
            url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fplstudio.com'
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
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="inline-flex items-center text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                        GW {article.gameweek}
                    </span>
                    <span className="text-xs text-slate-500">{formattedDate}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                        <svg width="12" height="12" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        AI Generated
                    </span>

                    <DeleteArticleButton articleId={article.id} />
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-8 leading-tight">
                    {article.title}
                </h1>

                {/* Hero Image Cover */}
                <div className="w-full aspect-video sm:aspect-[21/9] rounded-2xl overflow-hidden mb-10 relative shadow-2xl shadow-purple-900/10 border border-slate-800">
                    <img
                        src={getHeroImage(article.slug)}
                        alt={article.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                </div>

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
