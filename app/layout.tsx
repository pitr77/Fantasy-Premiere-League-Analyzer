import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import Analytics from "@/components/Analytics";
import ModuleViewTracker from "@/components/ModuleViewTracker";
import { Suspense } from 'react';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fplstudio.com';
const gaId = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: {
    default: 'FPL Studio — AI-Powered Fantasy Premier League Analytics & Tools',
    template: '%s | FPL Studio',
  },
  description:
    'Free AI-powered Fantasy Premier League analytics: Top 100 manager tracker, dynamic FDR fixture difficulty, bookmaker clean sheet & goalscorer odds, transfer planner, and AI gameweek previews.',
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: 'FPL Studio — AI-Powered Fantasy Premier League Analytics',
    description:
      'Free FPL tools: Top 100 manager consensus, dynamic FDR matrix, transfer picks with live bookmaker odds, and AI gameweek previews.',
    siteName: 'FPL Studio',
    type: 'website',
    locale: 'en_GB',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FPL Studio — AI-Powered FPL Analytics',
    description:
      'Free FPL tools: Top 100 manager consensus, dynamic FDR matrix, transfer picks with live bookmaker odds, and AI gameweek previews.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  applicationName: 'FPL Studio',
  verification: {
    google: '0RIP_wCZtvClwTFXGrqwjp1jIOB2EcnfPHzOXEt8M4M',
    other: {
      'msvalidate.01': 'D38361735CA3BFCD9C15DA383FFB20A3',
    },
  },
  keywords: [
    'FPL', 'Fantasy Premier League', 'FPL analytics', 'FPL tools', 'FPL planner',
    'FPL transfer planner', 'FPL captain picks', 'FPL FDR matrix', 'fixture difficulty rating',
    'top 100 FPL managers', 'FPL template', 'FPL odds', 'clean sheet odds', 'anytime goalscorer odds',
    'FPL scout', 'FPL gameweek preview', 'FPL AI', 'FPL expected goals', 'xG xA xGI',
    'FPL squad builder', 'fantasy football tips', 'Premier League fantasy'
  ],
};

const jsonLdData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'FPL Studio',
      description: 'Free AI-powered Fantasy Premier League analytics, Top 100 manager tracking, dynamic FDR, and bookmaker odds.',
      inLanguage: 'en-GB',
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#webapp`,
      name: 'FPL Studio',
      url: siteUrl,
      applicationCategory: 'SportsApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Top 100 FPL Managers Consensus Tracker',
        'Dynamic FDR (Fixture Difficulty Rating)',
        'Transfer Picks with Bookmaker Clean Sheet & Goalscorer Odds',
        'Interactive Gameweek Match Log & Player Detail Drill-down',
        'AI Gameweek Scout Previews & Tactical Analysis',
        'FPL Squad Simulator & Multi-Gameweek Strategy Planner'
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'FPL Studio',
      url: siteUrl,
      logo: `${siteUrl}/icons/icon-512.png`,
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="0RIP_wCZtvClwTFXGrqwjp1jIOB2EcnfPHzOXEt8M4M" />
        <meta name="msvalidate.01" content="D38361735CA3BFCD9C15DA383FFB20A3" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  send_page_view: false
                });
              `}
            </Script>
          </>
        )}
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
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <ModuleViewTracker />
        {children}
      </body>
    </html>
  );
}

