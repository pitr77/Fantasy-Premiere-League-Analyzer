import React, { ReactNode } from 'react';

interface TwoPanelTableRow {
    key: string | number;
    left: ReactNode;
    right: ReactNode;
}

interface TwoPanelTableProps {
    leftHeader: ReactNode;
    rightHeader: ReactNode;
    rows: TwoPanelTableRow[];
    rowHeightClass?: string;
    leftWidthClass?: string;
    className?: string;
}

const TwoPanelTable: React.FC<TwoPanelTableProps> = ({
    leftHeader,
    rightHeader,
    rows,
    rowHeightClass = "h-[56px] md:h-[64px]",
    leftWidthClass = "w-[110px] sm:w-[140px] md:w-64",
    className = ""
}) => {
    return (
        <div className={`flex bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden ${className}`}>
            {/* Left Fixed Panel */}
            <div className={`flex-none ${leftWidthClass} border-r border-slate-700 bg-slate-800 z-20 shadow-[4px_0_8px_rgba(0,0,0,0.3)]`}>
                <div className="h-12 bg-slate-900 border-b border-slate-700 flex items-center px-3 sm:px-4 text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold">
                    {leftHeader}
                </div>
                {rows.map((row) => (
                    <div
                        key={row.key}
                        className={`${rowHeightClass} flex items-center px-3 sm:px-4 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors group`}
                    >
                        {row.left}
                    </div>
                ))}
            </div>

            {/* Right Scrollable Panel */}
            <div className="flex-1 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="min-w-max">
                    <div className="h-12 bg-slate-900 border-b border-slate-700 flex items-center px-6 text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold">
                        {rightHeader}
                    </div>
                    {rows.map((row) => (
                        <div
                            key={row.key}
                            className={`${rowHeightClass} flex items-center px-6 border-b border-slate-700/50 hover:bg-slate-700/10 transition-colors`}
                        >
                            {row.right}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TwoPanelTable;
