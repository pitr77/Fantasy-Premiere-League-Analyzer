'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Analytics component to handle client-side page view tracking in Next.js App Router.
 * It listens to pathname and searchParams changes to fire gtag config events.
 */
export default function Analytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const gaId = process.env.NEXT_PUBLIC_GA_ID;

    useEffect(() => {
        if (!gaId || typeof (window as any).gtag !== 'function') return;

        const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

        // Track page view
        (window as any).gtag('config', gaId, {
            page_path: url,
        });

    }, [pathname, searchParams, gaId]);

    return null;
}
