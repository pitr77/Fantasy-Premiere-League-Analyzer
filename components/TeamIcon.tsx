import React, { useState } from 'react';
import Image from "next/image";
import { TEAM_ICONS } from "../lib/teamIcons";

interface TeamIconProps {
    code: string; // e.g. "ARS"
    alt: string;
    size?: number;
}

export const TeamIcon: React.FC<TeamIconProps> = ({ code, alt, size = 22 }) => {
    const [hasError, setHasError] = useState(false);
    const src = TEAM_ICONS[code];

    if (!src || hasError) {
        return (
            <div
                style={{ width: size, height: size, fontSize: Math.max(9, Math.floor(size * 0.4)) }}
                className="rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-200 uppercase shrink-0 shadow-sm leading-none"
                title={alt}
            >
                {code?.slice(0, 3) || 'PL'}
            </div>
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            onError={() => setHasError(true)}
            className="rounded-full shadow-[0_0_0_1px_rgba(15,23,42,0.85)] shrink-0 object-contain"
        />
    );
};
