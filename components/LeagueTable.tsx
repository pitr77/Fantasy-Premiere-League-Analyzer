import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, TrendingUp, Activity, Check, X, Minus, ShieldCheck } from 'lucide-react';
import { FPLTeam, FPLFixture } from '../types';

interface LeagueTableProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

type TableMode = 'basic' | 'adv' | 'form';
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
  const [mode, setMode] = useState<TableMode>('basic');
  const [selectedForm, setSelectedForm] = useState<SelectedForm | null>(null);

  // Sticky columns logic for mobile
  const stickyLeft = !isDesktop && mode !== 'basic';

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
        home.form.push({ result: 'L', opponent: f.team_a, score: `${hScore}-${aScore}`, date: f.kickoff_time });
        away.form.push({ result: 'W', opponent: f.team_h, score: `${aScore}-${hScore}`, date: f.kickoff_time });
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return 'N/A';
    return dt.toLocaleDateString('en-GB');
  };

  const ModePill = ({ value, label, icon: Icon }: { value: TableMode; label: string; icon: any }) => {
    const isActive = mode === value;
    return (
      <button
        type="button"
        onClick={() => {
          setMode(value);
          if (value !== 'form') setSelectedForm(null);
        }}
        className={[
          'px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 flex items-center gap-2',
          isActive
            ? 'bg-white text-slate-900 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]'
            : 'bg-slate-900/30 text-slate-200 border border-slate-700/60 hover:bg-slate-800/40',
        ].join(' ')}
      >
        <Icon size={14} />
        {label}
      </button>
    );
  };

  const selectedTeam = selectedForm ? getTeamName(selectedForm.teamId) : null;
  const selectedOpp = selectedForm ? getTeamName(selectedForm.match.opponent) : null;

  const topCut = 5;
  const bottomCut = 3;
  const showSeparators = mode === 'basic';

  const colSpan = useMemo(() => {
    let count = 3; // #, Team, Pts
    if (mode === 'basic') count += 1; // GD
    else if (mode === 'form') count += 2; // GD + Form
    else if (mode === 'adv') count += 7; // MP, W, D, L, GF, GA, GD
    return count;
  }, [mode]);

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-700/40 shadow-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Trophy className="w-6 h-6 text-yellow-400 flex-shrink-0" />
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words min-w-0">
            Premier League Table
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <ModePill value="basic" label="BASIC" icon={TrendingUp} />
          <ModePill value="adv" label="ADV" icon={Activity} />
          <ModePill value="form" label="FORM" icon={ShieldCheck} />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto max-h-[70vh] isolate rounded-lg border border-slate-700/60 bg-slate-950/20 custom-scrollbar">
        <table className="w-full text-left border-collapse table-auto">
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700 sticky top-0 z-40">
              <th
                className={[
                  'py-2 text-center bg-slate-900',
                  stickyLeft ? 'sticky left-0 z-50' : 'border-r border-slate-700/50',
                ].join(' ')}
                style={stickyLeft ? { width: '32px', minWidth: '32px' } : { width: '40px' }}
              >
                #
              </th>
              <th
                className={[
                  'py-2 px-2 bg-slate-900 text-left',
                  stickyLeft ? 'sticky z-40 shadow-[2px_0_5px_rgba(0,0,0,0.3)]' : 'border-r border-slate-700/50',
                ].join(' ')}
                style={stickyLeft ? { left: '32px', width: '80px', minWidth: '80px' } : undefined}
              >
                Team
              </th>
              <th className="py-2 text-center border-r border-slate-700/50 bg-slate-900">Pts</th>

              {mode === 'adv' && (
                <>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-slate-400 bg-slate-900">MP</th>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-green-400 bg-slate-900">W</th>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-slate-400 bg-slate-900">D</th>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-red-400 bg-slate-900">L</th>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-slate-400 bg-slate-900">GF</th>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-slate-400 bg-slate-900">GA</th>
                  <th className="px-1 py-2 text-center text-xs md:text-sm text-slate-400 bg-slate-900">GD</th>
                </>
              )}

              {(mode === 'basic' || mode === 'form') && (
                <th className="px-2 py-2 text-center bg-slate-900">GD</th>
              )}

              {mode === 'form' && (
                <th className="px-2 md:px-4 py-2 text-center text-xs md:text-sm text-slate-400 bg-slate-900">Form</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-700/50 text-sm">
            {tableData.flatMap((row, index) => {
              const nodes: React.ReactNode[] = [];
              const pos = index + 1;

              if (showSeparators && index === topCut) {
                nodes.push(
                  <tr key="sep-top5">
                    <td
                      colSpan={colSpan}
                      className="px-3 py-2 bg-slate-900/50 text-[10px] md:text-xs uppercase tracking-wider text-emerald-300 border-y border-emerald-500/25"
                    >
                      Top 5 (UCL / Europe)
                    </td>
                  </tr>
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
                  </tr>
                );
              }

              const team = getTeamName(row.id);
              const last5 = row.form.slice(-5);

              const isHighlighted = activeHighlight?.source === row.id || activeHighlight?.target === row.id;
              const isSelectedTeam = selectedForm?.teamId === row.id;
              const isTargetTeam = selectedForm ? selectedForm.match.opponent === row.id : false;

              const isRowActive = isHighlighted || isSelectedTeam || isTargetTeam;
              const isTop5 = pos <= topCut;
              const isRelegation = pos > tableData.length - bottomCut;

              const rowBg = isRowActive ? 'bg-purple-950/60' : 'bg-slate-800 group-hover:bg-slate-700';
              const rowClass = isRowActive
                ? 'bg-purple-900/40 border-l-2 border-l-purple-400'
                : isTop5
                  ? 'hover:bg-slate-700/30 border-l-2 border-l-emerald-400/60'
                  : isRelegation
                    ? 'hover:bg-slate-700/30 border-l-2 border-l-red-400/60'
                    : 'hover:bg-slate-700/30 border-l-2 border-l-transparent';

              nodes.push(
                <tr key={row.id} className={['group transition-all duration-200', rowClass].join(' ')}>
                  <td
                    className={[
                      'py-2 px-1 text-center text-slate-400 font-mono text-[10px] md:text-sm',
                      rowBg,
                      stickyLeft ? 'sticky left-0 z-30' : 'border-r border-slate-700/50',
                    ].join(' ')}
                    style={stickyLeft ? { width: '32px', minWidth: '32px' } : undefined}
                  >
                    {pos}
                  </td>
                  <td
                    className={[
                      'py-2 px-2 font-semibold text-white text-left',
                      rowBg,
                      stickyLeft ? 'sticky z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]' : 'border-r border-slate-700/50',
                    ].join(' ')}
                    style={stickyLeft ? { left: '32px', width: '80px', minWidth: '80px' } : undefined}
                  >
                    <span className="md:hidden truncate block text-[11px]">{team?.short_name || 'N/A'}</span>
                    <span className="hidden md:block truncate">{team?.name || 'N/A'}</span>
                  </td>
                  <td className={['py-2 text-center font-bold text-white border-r border-slate-700/50', rowBg].join(' ')}>
                    {row.pts}
                  </td>

                  {mode === 'adv' && (
                    <>
                      <td className="px-2 md:px-4 py-2 text-center text-slate-200">{row.played}</td>
                      <td className="px-2 md:px-4 py-2 text-center text-green-400 font-semibold">{row.win}</td>
                      <td className="px-2 md:px-4 py-2 text-center text-slate-400">{row.draw}</td>
                      <td className="px-2 md:px-4 py-2 text-center text-red-400">{row.loss}</td>
                      <td className="px-2 md:px-4 py-2 text-center text-slate-200">{row.gf}</td>
                      <td className="px-2 md:px-4 py-2 text-center text-slate-200">{row.ga}</td>
                      <td className="px-2 md:px-4 py-2 text-center">
                        <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                          {row.gf - row.ga >= 0 ? '+' : ''}
                          {row.gf - row.ga}
                        </span>
                      </td>
                    </>
                  )}

                  {(mode === 'basic' || mode === 'form') && (
                    <td className="px-2 py-2 text-center">
                      <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                        {row.gf - row.ga >= 0 ? '+' : ''}
                        {row.gf - row.ga}
                      </span>
                    </td>
                  )}

                  {mode === 'form' && (
                    <td className="px-2 md:px-4 py-2">
                      <div className="flex items-center justify-center gap-1 md:gap-1.5">
                        {last5.length === 0 && <span className="text-slate-500 text-xs">—</span>}
                        {[...last5].reverse().map((match, i) => {
                          const Icon = match.result === 'W' ? Check : match.result === 'L' ? X : Minus;
                          const colorClass =
                            match.result === 'W'
                              ? 'bg-green-500/90 border-green-400/50'
                              : match.result === 'L'
                                ? 'bg-red-500/90 border-red-400/50'
                                : 'bg-slate-600/90 border-slate-500/50';

                          const isSelectedPill = selectedForm?.teamId === row.id && selectedForm?.idx === i;

                          return (
                            <button
                              key={i}
                              type="button"
                              className={[
                                'relative flex items-center justify-center rounded-md text-[10px] md:text-xs font-semibold',
                                'px-1.5 md:px-2.5 py-0.5 border cursor-pointer transition-all',
                                'hover:scale-105 active:scale-95',
                                colorClass,
                                match.result === 'W' ? 'hover:bg-green-400' : match.result === 'L' ? 'hover:bg-red-400' : 'hover:bg-slate-500',
                                isSelectedPill
                                  ? 'ring-1 ring-slate-100/70 ring-offset-[1px] ring-offset-slate-900 z-10 shadow-lg scale-105'
                                  : 'border-transparent',
                              ].join(' ')}
                              onMouseEnter={() => setActiveHighlight({ source: row.id, target: match.opponent })}
                              onMouseLeave={() => setActiveHighlight(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedForm({ teamId: row.id, idx: i, match });
                              }}
                              title={`vs ${getTeamName(match.opponent)?.name || 'Opponent'}`}
                            >
                              <Icon className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
              return nodes;
            })}
          </tbody>
        </table>
      </div>

      {mode === 'form' && selectedForm && (
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-950/30 p-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-slate-200 font-semibold text-base">
                {selectedTeam?.name || 'N/A'} vs {selectedOpp?.name || 'N/A'}
              </div>
              <div className="text-slate-400 text-sm">{formatDate(selectedForm.match.date)}</div>
              <div
                className={[
                  'text-sm font-bold mt-1',
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
              className="text-xs px-3 py-1 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              onClick={() => setSelectedForm(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 gap-4 px-2">
        <div className="flex flex-col">
          <p className="text-slate-400 text-sm font-medium">
            {fixtures.filter((f) => f.finished).length} games played
          </p>
          {mode === 'form' && (
            <p className="mt-1 text-xs text-slate-400/80 italic">
              Tip: Click a form pill to see the match details.
            </p>
          )}
        </div>

        {mode === 'form' && (
          <div className="flex items-center gap-4 text-[10px] md:text-sm">
            <div className="flex items-center gap-1.5 grayscale-[0.3]">
              <div className="flex items-center justify-center rounded-md bg-green-500/90 w-5 h-5 md:w-7 md:h-6 text-white shadow-sm">
                <Check size={14} />
              </div>
              <span className="text-slate-400 font-bold uppercase tracking-wider">Win</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale-[0.3]">
              <div className="flex items-center justify-center rounded-md bg-slate-600/90 w-5 h-5 md:w-7 md:h-6 text-white shadow-sm">
                <Minus size={14} />
              </div>
              <span className="text-slate-400 font-bold uppercase tracking-wider">Draw</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale-[0.3]">
              <div className="flex items-center justify-center rounded-md bg-red-500/90 w-5 h-5 md:w-7 md:h-6 text-white shadow-sm">
                <X size={14} />
              </div>
              <span className="text-slate-400 font-bold uppercase tracking-wider">Loss</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueTable;
