import React, { useMemo, useState } from 'react';
import { FPLTeam, FPLFixture } from '../types';
import { Trophy, Minus, Check, X } from 'lucide-react';

interface LeagueTableProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

interface TeamStats {
  id: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  pts: number;
  form: { result: 'W' | 'D' | 'L'; opponent: number; score: string; date: string }[];
}

type TableMode = 'basic' | 'results' | 'advanced';

const LeagueTable: React.FC<LeagueTableProps> = ({ teams, fixtures }) => {
  const [activeHighlight, setActiveHighlight] = useState<{ source: number; target: number } | null>(null);
  const [mode, setMode] = useState<TableMode>('results');

  const tableData = useMemo(() => {
    const stats: Record<number, TeamStats> = {};

    teams.forEach((t) => {
      stats[t.id] = { id: t.id, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0, form: [] };
    });

    const finishedFixtures = fixtures
      .filter((f) => f.finished)
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

    finishedFixtures.forEach((f) => {
      const hScore = f.team_h_score ?? 0;
      const aScore = f.team_a_score ?? 0;

      const home = stats[f.team_h];
      const away = stats[f.team_a];

      if (!home || !away) return;

      home.played++;
      away.played++;

      home.gf += hScore;
      home.ga += aScore;
      away.gf += aScore;
      away.ga += hScore;

      if (hScore > aScore) {
        home.win++;
        home.pts += 3;
        away.loss++;
        home.form.push({ result: 'W', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
        away.form.push({ result: 'L', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
      } else if (hScore < aScore) {
        away.win++;
        away.pts += 3;
        home.loss++;
        away.form.push({ result: 'W', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
        home.form.push({ result: 'L', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
      } else {
        home.draw++;
        away.draw++;
        home.pts += 1;
        away.pts += 1;
        home.form.push({ result: 'D', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
        away.form.push({ result: 'D', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  }, [teams, fixtures]);

  const getTeamName = (id: number) => teams.find((t) => t.id === id);

  // sticky offsets: # (40px) + Team (64px on <md, 224px on md+)
  // left for PTS: 40 + 64 = 104; md: 40 + 224 = 264
  const minWidth = mode === 'basic' ? 760 : mode === 'results' ? 920 : 1040;

  const ModePill = ({ value, label }: { value: TableMode; label: string }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={[
        'px-2.5 py-1 rounded-md text-xs font-semibold border transition',
        mode === value
          ? 'bg-slate-700 text-white border-slate-500'
          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 px-2">
            <Trophy className="text-yellow-400 w-5 h-5" /> Premier League Table
          </h2>

          {/* Mode toggles */}
          <div className="flex gap-2 px-2">
            <ModePill value="basic" label="BASIC" />
            <ModePill value="results" label="RESULTS" />
            <ModePill value="advanced" label="ADV" />
          </div>
        </div>

        {/* Both-direction scroll like 3.5 */}
        <div className="overflow-auto pt-6 max-h-[70vh] isolate rounded-lg border border-slate-700/60 bg-slate-950/20">
          <table className="w-full text-left border-collapse" style={{ minWidth }}>
            <thead>
              {/* Solid header bg (no transparency) -> prevents bleed under sticky cols */}
              <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700 sticky top-0 z-40">
                <th className="px-2 py-2 w-10 min-w-[40px] text-center sticky left-0 top-0 z-[90] bg-slate-900 border-r border-slate-700/50">
                  #
                </th>

                {/* TEAM narrower on mobile, wider on md */}
                <th className="px-3 py-2 w-16 md:w-56 min-w-[64px] sticky left-[40px] top-0 z-[90] bg-slate-900 border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.35)]">
                  Team
                </th>

                {/* PTS frozen always */}
                <th className="px-2 py-2 w-12 min-w-[48px] text-center font-bold text-white sticky left-[104px] md:left-[264px] top-0 z-[90] bg-slate-900 border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.25)]">
                  Pts
                </th>

                {/* NON-sticky header cells */}
                {mode !== 'basic' && <th className="px-3 py-2 text-center w-8 bg-slate-900">MP</th>}

                {mode === 'results' && (
                  <>
                    <th className="px-3 py-2 text-center w-8 text-green-400 bg-slate-900">W</th>
                    <th className="px-3 py-2 text-center w-8 text-slate-400 bg-slate-900">D</th>
                    <th className="px-3 py-2 text-center w-8 text-red-400 bg-slate-900">L</th>
                  </>
                )}

                {mode === 'advanced' && (
                  <>
                    <th className="px-3 py-2 text-center w-8 text-green-400 bg-slate-900">W</th>
                    <th className="px-3 py-2 text-center w-8 text-slate-400 bg-slate-900">D</th>
                    <th className="px-3 py-2 text-center w-8 text-red-400 bg-slate-900">L</th>
                    <th className="px-3 py-2 text-center w-12 bg-slate-900">GF</th>
                    <th className="px-3 py-2 text-center w-12 bg-slate-900">GA</th>
                  </>
                )}

                <th className="px-3 py-2 text-center w-12 bg-slate-900">GD</th>

                {/* Form in BASIC + RESULTS (hide in ADV to avoid huge width) */}
                {mode !== 'advanced' && <th className="px-2 py-2 w-24 text-center bg-slate-900">Form</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-700/50 text-sm">
              {tableData.map((row, index) => {
                const team = getTeamName(row.id);
                const last5 = row.form.slice(-5);

                const isSource = activeHighlight?.source === row.id;
                const isTarget = activeHighlight?.target === row.id;
                const isHighlighted = isSource || isTarget;

                // Sticky cells must stay SOLID to avoid seeing columns underneath.
                const stickyBg = isHighlighted ? 'bg-purple-950' : 'bg-slate-800 group-hover:bg-slate-700';

                return (
                  <tr
                    key={row.id}
                    className={[
                      'group transition-all duration-200',
                      isHighlighted
                        ? 'bg-purple-900/40 border-l-2 border-l-purple-400'
                        : 'hover:bg-slate-700/30 border-l-2 border-l-transparent',
                    ].join(' ')}
                  >
                    {/* # sticky */}
                    <td
                      className={[
                        'px-2 py-2 w-10 min-w-[40px] text-center font-bold text-slate-400 border-r border-slate-700/50 text-xs sticky left-0 z-30',
                        stickyBg,
                      ].join(' ')}
                    >
                      {index + 1}
                    </td>

                    {/* Team sticky */}
                    <td
                      className={[
                        'px-3 py-2 w-16 md:w-56 min-w-[64px] font-semibold text-white border-r border-slate-700/50 sticky left-[40px] z-30',
                        stickyBg,
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">{team?.short_name || 'N/A'}</span>
                        {isSource && (
                          <span className="text-[10px] text-purple-200 border border-purple-500/40 px-1.5 py-0.5 bg-purple-900/50 rounded-full hidden md:inline">
                            Current
                          </span>
                        )}
                        {isTarget && (
                          <span className="text-[10px] text-purple-200 border border-purple-500/40 px-1.5 py-0.5 bg-purple-900/50 rounded-full hidden md:inline">
                            Opponent
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Pts sticky (ALWAYS) */}
                    <td
                      className={[
                        'px-2 py-2 w-12 min-w-[48px] text-center font-bold text-white border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.35)] sticky left-[104px] md:left-[264px] z-30',
                        stickyBg,
                      ].join(' ')}
                    >
                      {row.pts}
                    </td>

                    {/* non-sticky cells by mode */}
                    {mode !== 'basic' && <td className="px-3 py-2 text-center text-slate-300">{row.played}</td>}

                    {mode === 'results' && (
                      <>
                        <td className="px-3 py-2 text-center text-slate-300">{row.win}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{row.draw}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{row.loss}</td>
                      </>
                    )}

                    {mode === 'advanced' && (
                      <>
                        <td className="px-3 py-2 text-center text-slate-300">{row.win}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{row.draw}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{row.loss}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{row.gf}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{row.ga}</td>
                      </>
                    )}

                    <td className="px-3 py-2 text-center text-slate-300 font-mono">
                      {row.gf - row.ga > 0 ? `+${row.gf - row.ga}` : row.gf - row.ga}
                    </td>

                    {/* Form in BASIC + RESULTS */}
                    {mode !== 'advanced' && (
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-0.5">
                          {last5.map((match, i) => {
                            let colorClass = 'bg-slate-600 border-slate-500';
                            let Icon = Minus;
                            if (match.result === 'W') {
                              colorClass = 'bg-green-500 border-green-400';
                              Icon = Check;
                            } else if (match.result === 'L') {
                              colorClass = 'bg-red-500 border-red-400';
                              Icon = X;
                            }

                            return (
                              <div
                                key={i}
                                className={`relative group/match w-5 h-5 rounded-sm border ${colorClass} flex items-center justify-center cursor-pointer transition-transform hover:scale-110`}
                                onMouseEnter={() => setActiveHighlight({ source: row.id, target: match.opponent })}
                                onMouseLeave={() => setActiveHighlight(null)}
                              >
                                <Icon className="w-3 h-3 text-white" />
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/match:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                                  <div className="bg-slate-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap shadow-lg border border-slate-700">
                                    <div className="font-semibold">
                                      vs {getTeamName(match.opponent)?.short_name || 'N/A'}
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <span className="text-slate-300">{new Date(match.date).toLocaleDateString()}</span>
                                      <span
                                        className={`font-bold ${
                                          match.result === 'W'
                                            ? 'text-green-400'
                                            : match.result === 'L'
                                            ? 'text-red-400'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        Result: {match.score}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-3 px-2">
          <p className="text-slate-400 text-sm">
            {fixtures.filter((f) => f.finished).length} games played
          </p>

          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div> Win
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-slate-600 rounded-sm"></div> Draw
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div> Loss
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueTable;
