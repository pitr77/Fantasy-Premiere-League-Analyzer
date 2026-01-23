// lib/analytics.ts

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Tracks a page view
 * @param path The URL path to track
 */
export const trackPageView = (path: string) => {
    if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
    const g = (window as any).gtag;
    if (typeof g === 'function') {
        g('config', GA_MEASUREMENT_ID, {
            page_path: path,
            anonymize_ip: true
        });
    }
};

export const initGA = () => {
    // Logic moved to components/GoogleAnalytics.tsx for cleaner Next.js App Router support
};
