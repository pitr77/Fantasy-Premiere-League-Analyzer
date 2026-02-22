import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import GoogleAnalytics from "@/components/GoogleAnalytics";
import ModuleViewTracker from "@/components/ModuleViewTracker";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fplstudio.co';

export const metadata: Metadata = {
  title: {
    default: 'FPL Studio — AI-Powered Fantasy Premier League Analytics',
    template: '%s | FPL Studio',
  },
  description:
    'Free AI-powered FPL analytics: gameweek previews, captain picks, transfer targets, fixture analysis, and league tables. Make smarter Fantasy Premier League decisions.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'FPL Studio — AI-Powered FPL Analytics',
    description:
      'Free AI-powered FPL analytics with captain picks, transfer targets, and gameweek previews.',
    siteName: 'FPL Studio',
    type: 'website',
    locale: 'en_GB',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FPL Studio — AI-Powered FPL Analytics',
    description:
      'Free AI-powered FPL analytics with captain picks, transfer targets, and gameweek previews.',
  },
  robots: {
    index: true,
    follow: true,
  },
  applicationName: 'FPL Studio',
  keywords: [
    'FPL', 'Fantasy Premier League', 'FPL analytics', 'FPL captain picks',
    'FPL transfer targets', 'FPL scout', 'FPL gameweek preview', 'FPL AI',
    'fantasy football', 'Premier League fantasy', 'FPL tips',
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleAnalytics />
        {/* Tailwind via CDN (kept to avoid a full styling migration today). */}
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />

        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          // Keep existing global styles (font + scrollbar) from the old index.html.
          dangerouslySetInnerHTML={{
            __html: `
              html { background-color: #0f172a; visibility: hidden; }
              html.tw-ready { visibility: visible; }
              body { font-family: 'Inter', sans-serif; background-color: #0f172a; margin: 0; }
              ::-webkit-scrollbar { width: 8px; height: 8px; }
              ::-webkit-scrollbar-track { background: #1f2937; }
              ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
              ::-webkit-scrollbar-thumb:hover { background: #4b5563; }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
               (function() {
                 const check = () => {
                   if (window.tailwind) {
                     document.documentElement.classList.add('tw-ready');
                   } else {
                     setTimeout(check, 10);
                   }
                 };
                 check();
                 // Fallback to show items anyway if CDN fails after 2s
                 setTimeout(() => document.documentElement.classList.add('tw-ready'), 2000);
               })();
             `
          }}
        />
      </head>
      <body className="bg-slate-900 text-gray-100" suppressHydrationWarning>
        <ModuleViewTracker />
        {children}
      </body>
    </html>
  );
}

