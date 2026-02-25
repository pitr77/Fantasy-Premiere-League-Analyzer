'use client';

import { useState } from 'react';

export default function HeroImage({ src, alt }: { src: string, alt: string }) {
    const [failed, setFailed] = useState(false);

    if (failed) return null;

    return (
        <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover absolute inset-0 z-0 opacity-80 mix-blend-overlay"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}
