import type { ReactNode } from 'react';
import Script from 'next/script';

export const metadata = {
  title: 'FPL STUDIO',
  description: 'FPL analytics portal',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
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
              body { font-family: 'Inter', sans-serif; }
              ::-webkit-scrollbar { width: 8px; height: 8px; }
              ::-webkit-scrollbar-track { background: #1f2937; }
              ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
              ::-webkit-scrollbar-thumb:hover { background: #4b5563; }
            `,
          }}
        />
      </head>
      <body className="bg-slate-900 text-gray-100">
        {children}
      </body>
    </html>
  );
}

