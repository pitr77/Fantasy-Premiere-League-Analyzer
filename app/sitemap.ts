import { createServerSupabase } from '@/lib/supabaseServer';
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fplstudio.com';
    const supabase = createServerSupabase();

    // Fetch all published articles
    const { data: articles } = await supabase
        .from('scout_articles')
        .select('slug, generated_at')
        .eq('published', true)
        .order('generated_at', { ascending: false });

    const articleEntries: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
        url: `${siteUrl}/scout/${a.slug}`,
        lastModified: new Date(a.generated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }));

    return [
        {
            url: siteUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${siteUrl}/scout`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        ...articleEntries,
    ];
}
