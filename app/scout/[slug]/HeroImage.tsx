'use client';

import { useState } from 'react';

export default function HeroImage({ src, alt }: { src: string, alt: string }) {
    const [failed, setFailed] = useState(false);

    // Completely omit rendering the huge gradient block if image doesn't exist
    if (failed) return null;

    return (
        <div className="w-full aspect-video sm:aspect-[21/9] rounded-2xl overflow-hidden mb-10 relative shadow-2xl shadow-purple-900/10 border border-slate-800 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <img
                src={src}
                alt={alt}
                className="w-full h-full object-cover absolute inset-0 z-0 opacity-80 mix-blend-overlay"
                loading="lazy"
                onError={() => setFailed(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent z-10"></div>
        </div>
    );
}
