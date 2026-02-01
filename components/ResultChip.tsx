import React, { ReactNode } from 'react';

interface ResultChipProps {
    label: string;
    value: string;
    variant?: 'W' | 'D' | 'L' | 'blank' | 'custom';
    bgClass?: string;
    borderClass?: string;
    textClass?: string;
    title?: string;
    className?: string;
}

const ResultChip: React.FC<ResultChipProps> = ({
    label,
    value,
    variant,
    bgClass = "",
    borderClass = "",
    textClass = "text-white",
    title,
    className = ""
}) => {
    // Map variants to classes if custom classes aren't provided
    let finalBg = bgClass;
    let finalBorder = borderClass;
    let finalText = textClass;

    if (variant === 'W') {
        finalBg = "bg-green-600";
        finalBorder = "border-green-500";
    } else if (variant === 'D') {
        finalBg = "bg-slate-600";
        finalBorder = "border-slate-500";
    } else if (variant === 'L') {
        finalBg = "bg-red-600";
        finalBorder = "border-red-500";
    } else if (variant === 'blank') {
        finalBg = "bg-slate-900/40";
        finalBorder = "border-slate-700/30";
        finalText = "text-slate-500";
    }

    return (
        <div
            title={title}
            className={`
        min-w-[37px] h-[1.8rem] rounded-md flex flex-col items-center justify-center border shadow-sm cursor-help transition-all py-[2px] flex-none
        ${finalBg} ${finalBorder} ${finalText} ${className}
      `}
        >
            <span className="text-[10px] font-bold leading-tight uppercase tracking-tighter">
                {label}
            </span>
            <span className="text-[8px] font-mono opacity-90 leading-none">
                {value}
            </span>
        </div>
    );
};

export default ResultChip;
