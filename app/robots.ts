import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fplstudio.com';

    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/scout', '/scout/*'],
                disallow: ['/api/', '/login', '/auth/'],
            },
            {
                // Explicitly allow AI search crawlers to access public site, scout articles and LLM documentation
                userAgent: [
                    'GPTBot',
                    'ChatGPT-User',
                    'PerplexityBot',
                    'ClaudeBot',
                    'Claude-Web',
                    'Google-Extended',
                    'Applebot',
                    'Bingbot'
                ],
                allow: ['/', '/scout', '/scout/*', '/llms.txt'],
                disallow: ['/api/', '/login', '/auth/'],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
