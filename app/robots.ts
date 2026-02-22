import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fplstudio.com';

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/login'],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
