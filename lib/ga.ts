// lib/ga.ts
export type GaParams = Record<string, string | number | boolean | null | undefined>;

declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
    }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function track(event: string, params: GaParams = {}) {
    if (typeof window === "undefined") return;
    if (!GA_ID) return;
    if (typeof window.gtag !== "function") return;

    // GA4 expects plain objects
    window.gtag("event", event, params);
}
