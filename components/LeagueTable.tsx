import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Minus, Check, X } from 'lucide-react';
import { FPLTeam, FPLFixture } from '../types';

interface LeagueTableProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

type TableMode = 'basic' | 'results' | 'advanced' | 'form';
type FormResult = 'W' | 'D' | 'L';

interface FormMatch {
  result: FormResult;
  opponent: number;
  score: string;
  date?: string | null;
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
  form: FormMatch[];
}

type SelectedForm = { teamId: number; idx: number; match: FormMatch };

function useIsDesktop(breakpointPx = 768) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${breakpointPx}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [breakpointPx]);

  return isDesktop;
}

const LeagueTable: React.FC<LeagueTableProps> = ({ teams, fixtures }) => {
  const isDesktop = useIsDesktop(768);

  const [activeHighlight, setActiveHighlight] = useState<{ source: number; target: number } | null>(null);
  const [mode, setMode] = useState<TableMode>('results');
  const [selectedForm, setSelectedForm] = useState<SelectedForm | null>(null);

  const tableData = useMemo<TeamStats[]>(() => {
    const stats: Record<number, TeamStats> = {};
    teams.forEach((t) => {
      stats[t.id] = {
        id: t.id,
        played: 0,
        win: 0,
        draw: 0,
        loss: 0,
        gf: 0,
        ga: 0,
        pts: 0,
        form: [],
      };
    });

    // CRITICAL: Sort fixtures by date to ensure form is chronological
    const finishedFixtures = fixtures
      .filter((f) => f.finished && f.team_h_score != null && f.team_a_score != null)
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

    finishedFixtures.forEach((f) => {
      const home = stats[f.team_h];
      const away = stats[f.team_a];
      if (!home || !away) return;

      const hScore = f.team_h_score!;
      const aScore = f.team_a_score!;

      home.played++;
      away.played++;

      home.gf += hScore;
      home.ga += aScore;

      away.gf += aScore;
      away.ga += hScore;

      if (hScore > aScore) {
        home.win++;
        away.loss++;
        home.pts += 3;

        home.form.push({ result: 'W', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
        away.form.push({ result: 'L', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
      } else if (hScore < aScore) {
        away.win++;
        home.loss++;
        away.pts += 3;

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

    const arr = Object.values(stats);
    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdB = b.gf - b.ga;
      const gdA = a.gf - a.ga;
      if (gdB !== gdA) return gdB - gdA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.id - b.id;
    });

    return arr;
  }, [teams, fixtures]);

  const getTeamName = (id: number) => teams.find((t) => t.id === id);

  const topCut = 5;
  const bottomCut = 3;
  const showSeparators = tableData.length >= topCut + bottomCut + 1;

  const formatDate = (d?: string | null) => {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return 'N/A';
    return dt.toLocaleDateString('en-GB');
  };

  // ===== Sticky widths (ONE SOURCE OF TRUTH) =====
  const W_NUM = isDesktop ? 48 : 32; // #
  const W_TEAM =
    isDesktop ? 224 :
    mode === 'basic' ? 78 :
    mode === 'results' ? 92 :
    mode === 'form' ? 108 :
    88;

  const W_PTS = isDesktop ? 64 : 56;

  const LEFT_NUM = 0;
  const LEFT_TEAM = W_NUM;
  const LEFT_PTS = W_NUM + W_TEAM;

  // Table min width per tab
  const minWidth =
    mode === 'basic' ? 420 :
    mode === 'results' ? 640 :
    mode === 'form' ? 520 :
    920;

  const ModePill = ({ value, label }: { value: TableMode; label: string }) => {
    const isActive = mode === value;
    return (
      <button
        type="button"
        onClick={() => {
          setMode(value);
          if (value !== 'form') setSelectedForm(null);
        }}
        className={[
          'px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-200',
          isActive
            ? 'bg-slate-100 text-slate-900 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]'
            : 'bg-slate-900/30 text-slate-200 border border-slate-700/60 hover:bg-slate-800/40',
        ].join(' ')}
      >
        {label}
      </button>
    );
  };

  const selectedTeam = selectedForm ? getTeamName(selectedForm.teamId) : null;
  const selectedOpp = selectedForm ? getTeamName(selectedForm.match.opponent) : null;

  // Calculate colspan dynamically based on mode
  const colSpan = useMemo(() => {
    let count = 3; // Always: #, Team, Pts (sticky columns)
    
    if (mode === 'basic') {
      count += 1; // GD
    } else if (mode === 'results') {
      count += 1; // MP
      count += 3; // W, D, L
      if (isDesktop) count += 2; // GF, GA (desktop only)
      count += 1; // GD
    } else if (mode === 'form') {
      count += 1; // GD
      count += 1; // Form
    } else if (mode === 'advanced') {
      count += 1; // MP
      count += 3; // W, D, L
      count += 2; // GF, GA
      count += 1; // GD
    }
    
    return count;
  }, [mode, isDesktop]);

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-700/40 shadow-xl p-5">
      {/* Header: mobile wraps, so it never makes page wider */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Trophy className="w-6 h-6 text-yellow-400 flex-shrink-0" />
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words min-w-0">
            Premier League Table
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <ModePill value="basic" label="BASIC" />
          <ModePill value="results" label="RESULTS" />
          <ModePill value="advanced" label="ADV" />
          <ModePill value="form" label="FORM" />
        </div>
      </div>

      <div className="mt-6 overflow-auto max-h-[70vh] isolate rounded-lg border border-slate-700/60 bg-slate-950/20">
        <table className="w-full table-fixed text-left border-collapse" style={{ minWidth }}>
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700 sticky top-0 z-40">
              {/* # */}
              <th
                className="py-2 text-center sticky top-0 bg-slate-900 border-r border-slate-700/50"
                style={{ width: W_NUM, minWidth: W_NUM, left: LEFT_NUM, zIndex: 90 }}
              >
                #
              </th>

              {/* TEAM */}
              <th
                className="py-2 px-2 sticky top-0 bg-slate-900 border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.35)]"
                style={{ width: W_TEAM, minWidth: W_TEAM, left: LEFT_TEAM, zIndex: 80 }}
              >
                Team
              </th>

              {/* PTS */}
              <th
                className="py-2 text-center sticky top-0 bg-slate-900 border-r border-slate-700/50 shadow-[6px_0_10px_rgba(0,0,0,0.25)]"
                style={{ width: W_PTS, minWidth: W_PTS, left: LEFT_PTS, zIndex: 70 }}
              >
                Pts
              </th>

              {/* RESULTS columns */}
              {mode === 'results' && (
                <>
                  <th className="px-2 py-2 text-center w-12 bg-slate-900">MP</th>
                  <th className="px-2 py-2 text-center w-10 text-green-400 bg-slate-900">W</th>
                  <th className="px-2 py-2 text-center w-10 text-slate-400 bg-slate-900">D</th>
                  <th className="px-2 py-2 text-center w-10 text-red-400 bg-slate-900">L</th>
                  {isDesktop && (
                    <>
                      <th className="px-2 py-2 text-center w-12 bg-slate-900">GF</th>
                      <th className="px-2 py-2 text-center w-12 bg-slate-900">GA</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-center w-12 bg-slate-900">GD</th>
                </>
              )}

              {/* ADVANCED columns */}
              {mode === 'advanced' && (
                <>
                  <th className="px-2 py-2 text-center w-12 bg-slate-900">MP</th>
                  <th className="px-2 py-2 text-center w-10 text-green-400 bg-slate-900">W</th>
                  <th className="px-2 py-2 text-center w-10 text-slate-400 bg-slate-900">D</th>
                  <th className="px-2 py-2 text-center w-10 text-red-400 bg-slate-900">L</th>
                  <th className="px-2 py-2 text-center w-12 bg-slate-900">GF</th>
                  <th className="px-2 py-2 text-center w-12 bg-slate-900">GA</th>
                  <th className="px-2 py-2 text-center w-12 bg-slate-900">GD</th>
                </>
              )}

              {/* BASIC/FORM show GD */}
              {(mode === 'basic' || mode === 'form') && (
                <th className="px-2 py-2 text-center w-12 bg-slate-900">GD</th>
              )}

              {/* FORM tab */}
              {mode === 'form' && <th className="px-2 py-2 w-28 text-center bg-slate-900">Form</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-700/50 text-sm">
            {tableData.flatMap((row, index) => {
              const nodes: React.ReactNode[] = [];

              if (showSeparators && index === topCut) {
                nodes.push(
                  <tr key="sep-top5">
                    <td
                      colSpan={colSpan}
                      className="px-3 py-2 bg-slate-900/50 text-[10px] md:text-xs uppercase tracking-wider text-emerald-300 border-y border-emerald-500/25"
                    >
                      Top 5 (UCL / Europe)
                    </td>
                  </tr>,
                );
              }

              if (showSeparators && index === tableData.length - bottomCut) {
                nodes.push(
                  <tr key="sep-relegation">
                    <td
                      colSpan={colSpan}
                      className="px-3 py-2 bg-slate-900/50 text-[10px] md:text-xs uppercase tracking-wider text-red-300 border-y border-red-500/25"
                    >
                      Relegation zone
                    </td>
                  </tr>,
                );
              }

              const team = getTeamName(row.id);
              const last5 = row.form.slice(-5);
              const pos = index + 1;

              const isSource = activeHighlight?.source === row.id;
              const isTarget = activeHighlight?.target === row.id;
              const isSelectedSource = selectedForm?.teamId === row.id;
              const isSelectedTarget = selectedForm ? selectedForm.match.opponent === row.id : false;
              const isHighlighted = isSource || isTarget || isSelectedSource || isSelectedTarget;

              const isTop5 = pos <= topCut;
              const isRelegation = pos > tableData.length - bottomCut;

              const stickyBg = isHighlighted ? 'bg-purple-950' : 'bg-slate-800 group-hover:bg-slate-700';
              const rowClass = isHighlighted
                ? 'bg-purple-900/40 border-l-2 border-l-purple-400'
                : isTop5
                  ? 'hover:bg-slate-700/30 border-l-2 border-l-emerald-400/60'
                  : isRelegation
                    ? 'hover:bg-slate-700/30 border-l-2 border-l-red-400/60'
                    : 'hover:bg-slate-700/30 border-l-2 border-l-transparent';

              nodes.push(
                <tr key={row.id} className={['group transition-all duration-200', rowClass].join(' ')}>
                  {/* # */}
                  <td
                    className={[
                      'py-2 text-center font-bold text-slate-300 border-r border-slate-700/50 text-xs sticky',
                      stickyBg,
                    ].join(' ')}
                    style={{ width: W_NUM, minWidth: W_NUM, left: LEFT_NUM, zIndex: 60 }}
                  >
                    {pos}
                  </td>

                  {/* TEAM */}
                  <td
                    className={[
                      'py-2 px-2 font-semibold text-white border-r border-slate-700/50 sticky shadow-[6px_0_10px_rgba(0,0,0,0.35)]',
                      stickyBg,
                    ].join(' ')}
                    style={{ width: W_TEAM, minWidth: W_TEAM, left: LEFT_TEAM, zIndex: 50 }}
                  >
                    <span className="block truncate">{team?.short_name || 'N/A'}</span>
                  </td>

                  {/* PTS */}
                  <td
                    className={[
                      'py-2 text-center font-bold text-white border-r border-slate-700/50 sticky shadow-[6px_0_10px_rgba(0,0,0,0.25)]',
                      stickyBg,
                    ].join(' ')}
                    style={{ width: W_PTS, minWidth: W_PTS, left: LEFT_PTS, zIndex: 40 }}
                  >
                    {row.pts}
                  </td>

                  {/* RESULTS mode */}
                  {mode === 'results' && (
                    <>
                      <td className="px-2 py-2 text-center w-12">{row.played}</td>
                      <td className="px-2 py-2 text-center w-10 text-green-400">{row.win}</td>
                      <td className="px-2 py-2 text-center w-10 text-slate-200">{row.draw}</td>
                      <td className="px-2 py-2 text-center w-10 text-red-400">{row.loss}</td>
                      {isDesktop && (
                        <>
                          <td className="px-2 py-2 text-center w-12">{row.gf}</td>
                          <td className="px-2 py-2 text-center w-12">{row.ga}</td>
                        </>
                      )}
                      <td className="px-2 py-2 text-center w-12">
                        <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                          {row.gf - row.ga >= 0 ? '+' : ''}
                          {row.gf - row.ga}
                        </span>
                      </td>
                    </>
                  )}

                  {/* ADVANCED mode */}
                  {mode === 'advanced' && (
                    <>
                      <td className="px-2 py-2 text-center w-12">{row.played}</td>
                      <td className="px-2 py-2 text-center w-10 text-green-400">{row.win}</td>
                      <td className="px-2 py-2 text-center w-10 text-slate-200">{row.draw}</td>
                      <td className="px-2 py-2 text-center w-10 text-red-400">{row.loss}</td>
                      <td className="px-2 py-2 text-center w-12">{row.gf}</td>
                      <td className="px-2 py-2 text-center w-12">{row.ga}</td>
                      <td className="px-2 py-2 text-center w-12">
                        <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                          {row.gf - row.ga >= 0 ? '+' : ''}
                          {row.gf - row.ga}
                        </span>
                      </td>
                    </>
                  )}

                  {/* BASIC mode */}
                  {mode === 'basic' && (
                    <td className="px-2 py-2 text-center w-12">
                      <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                        {row.gf - row.ga >= 0 ? '+' : ''}
                        {row.gf - row.ga}
                      </span>
                    </td>
                  )}

                  {/* FORM mode */}
                  {mode === 'form' && (
                    <>
                      <td className="px-2 py-2 text-center w-12">
                        <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                          {row.gf - row.ga >= 0 ? '+' : ''}
                          {row.gf - row.ga}
                        </span>
                      </td>
                      <td className="px-2 py-2 w-28">
                        <div className="flex items-center justify-center gap-1">
                          {last5.length === 0 && <span className="text-slate-500 text-xs">—</span>}

                          {last5.map((match, i) => {
                            const Icon = match.result === 'W' ? Check : match.result === 'L' ? X : Minus;

                            const colorClass =
                              match.result === 'W'
                                ? 'bg-green-500 border-green-400'
                                : match.result === 'L'
                                  ? 'bg-red-500 border-red-400'
                                  : 'bg-slate-600 border-slate-500';

                            const isSelected = selectedForm?.teamId === row.id && selectedForm?.idx === i;

                            return (
                              <button
                                key={i}
                                type="button"
                                className={[
                                  'relative w-5 h-5 rounded-sm border flex items-center justify-center cursor-pointer',
                                  'transition-transform hover:scale-110',
                                  colorClass,
                                  isSelected ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900' : '',
                                ].join(' ')}
                                onMouseEnter={() => setActiveHighlight({ source: row.id, target: match.opponent })}
                                onMouseLeave={() => setActiveHighlight(null)}
                                onClick={() => setSelectedForm({ teamId: row.id, idx: i, match })}
                              >
                                <Icon className="w-3 h-3 text-white" />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </>
                  )}
                </tr>,
              );

              return nodes;
            })}
          </tbody>
        </table>
      </div>

      {/* FORM details panel */}
      {mode === 'form' && selectedForm && (
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-950/30 p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-slate-200 font-semibold">
                {selectedTeam?.short_name || 'N/A'} vs {selectedOpp?.short_name || 'N/A'}
              </div>
              <div className="text-slate-400 text-sm">{formatDate(selectedForm.match.date)}</div>
              <div
                className={[
                  'text-sm font-semibold',
                  selectedForm.match.result === 'W'
                    ? 'text-green-400'
                    : selectedForm.match.result === 'L'
                      ? 'text-red-400'
                      : 'text-slate-200',
                ].join(' ')}
              >
                Result: {selectedForm.match.score}
              </div>
            </div>

            <button
              type="button"
              className="text-xs px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setSelectedForm(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-3 px-2">
        <p className="text-slate-400 text-sm">{fixtures.filter((f) => f.finished).length} games played</p>
      </div>
    </div>
  );
};

export default LeagueTable;
