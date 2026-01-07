import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Trophy, TrendingUp, ShieldCheck, Activity, Check, X, Minus } from 'lucide-react';
import { FPLFixture, FPLTeam } from '../types';

type TableMode = 'basic' | 'results' | 'advanced' | 'form';
type FormResult = 'W' | 'D' | 'L';

interface FormMatch {
  result: FormResult;
  opponent: number;
}

interface LeagueTableProps {
  teams: FPLTeam[];
  fixtures: FPLFixture[];
}

interface TableRow {
  teamId: number;
  name: string;
  shortName: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  pts: number;
  gd: number;
}

const useIsDesktop = (minWidth = 768) => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);


  return isDesktop;
};

const LeagueTable: React.FC<LeagueTableProps> = ({ teams, fixtures }) => {
  const isDesktop = useIsDesktop(768);

  const [activeHighlight, setActiveHighlight] = useState<{ source: number; target: number } | null>(null);
  const [mode, setMode] = useState<TableMode>('results');
  // Keep original behavior: sticky columns enabled on mobile for all non-basic modes.
  // (We'll force TEAM sticky in RESULTS explicitly below.)
  const stickyLeft = !isDesktop && mode !== 'basic';
  const [selectedForm, setSelectedForm] = useState<number | null>(null);

  // Requirement: in RESULTS on mobile, keep TEAM fixed while horizontally scrolling.
  // (We do this explicitly so focusing on RESULTS won't break other modes.)
  const stickyTeamInResults = !isDesktop && mode === 'results';

  // ref to the scrollable table wrapper so we can reset horizontal scroll on tab change
  const tableWrapRef = useRef<HTMLDivElement | null>(null);

  // column widths (desktop is wider)
  const W_NUM = isDesktop ? 40 : 40; // #
  // TEAM column widths
  // - BASIC: can be wider (usually fewer columns)
  // - RESULTS/ADV/FORM: keep narrower on mobile to fit stats
  const W_TEAM_BASIC = isDesktop ? 260 : 120; // ← tu je šírka TEAM pre BASIC na mobile
  const W_TEAM_RESULTS = isDesktop ? 180 : 100;
  const W_TEAM_ADVANCED = isDesktop ? 260 : 100;
  const W_TEAM_FORM = isDesktop ? 260 : 100;

  const W_TEAM_COL =
    mode === 'basic'
      ? W_TEAM_BASIC
      : mode === 'results'
        ? W_TEAM_RESULTS
        : mode === 'advanced'
          ? W_TEAM_ADVANCED
          : W_TEAM_FORM;
  const W_PTS = isDesktop ? 64 : 56;

  const minWidth = useMemo(() => {
    if (mode === 'basic') return isDesktop ? 540 : 340;
    if (mode === 'form') return isDesktop ? 620 : 420;
    if (mode === 'results') return isDesktop ? 780 : 680;
    return isDesktop ? 860 : 760; // advanced
  }, [mode, isDesktop]);

  // when switching modes, reset horizontal scroll to start so new tab isn't scrolled to the right
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    // only reset horizontal scroll (keep vertical position if desired)
    try {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } catch (e) {
      // fallback for environments that don't support options
      el.scrollLeft = 0;
    }
  }, [mode]);

  const tableRows: TableRow[] = useMemo(() => {
    const rows: Record<number, TableRow> = {};

    teams.forEach((t) => {
      rows[t.id] = {
        teamId: t.id,
        name: t.name,
        shortName: t.short_name,
        played: 0,
        win: 0,
        draw: 0,
        loss: 0,
        gf: 0,
        ga: 0,
        pts: 0,
        gd: 0,
      };
    });

    // use only fixtures with scores (more reliable than finished alone)
    const playedFixtures = fixtures.filter((f) => {
      const hasScore =
        f.team_h_score !== null &&
        f.team_h_score !== undefined &&
        f.team_a_score !== null &&
        f.team_a_score !== undefined;

      return f.finished === true || hasScore;
    });

    playedFixtures.forEach((f) => {
      const h = f.team_h;
      const a = f.team_a;
      const hs = f.team_h_score ?? 0;
      const as = f.team_a_score ?? 0;

      const home = rows[h];
      const away = rows[a];
      if (!home || !away) return;

      home.played++;
      away.played++;

      home.gf += hs;
      home.ga += as;

      away.gf += as;
      away.ga += hs;

      if (hs > as) {
        home.win++;
        away.loss++;
        home.pts += 3;
      } else if (hs < as) {
        away.win++;
        home.loss++;
        away.pts += 3;
      } else {
        home.draw++;
        away.draw++;
        home.pts += 1;
        away.pts += 1;
      }
    });

    Object.values(rows).forEach((r) => {
      r.gd = r.gf - r.ga;
    });

    return Object.values(rows).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  }, [teams, fixtures]);

  // last 5 results per team (for FORM mode)
  const formMap = useMemo(() => {
    const map: Record<number, FormMatch[]> = {};

    teams.forEach((t) => {
      map[t.id] = [];
    });

    const playedFixtures = fixtures
      .filter((f) => {
        const hasScore =
          f.team_h_score !== null &&
          f.team_h_score !== undefined &&
          f.team_a_score !== null &&
          f.team_a_score !== undefined;
        return f.finished === true || hasScore;
      })
      .filter((f) => f.kickoff_time)
      .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime());

    teams.forEach((t) => {
      const list = playedFixtures
        .filter((f) => f.team_h === t.id || f.team_a === t.id)
        .slice(0, 5);

      const results: FormMatch[] = list.map((f) => {
        const isHome = f.team_h === t.id;
        const gf = isHome ? (f.team_h_score ?? 0) : (f.team_a_score ?? 0);
        const ga = isHome ? (f.team_a_score ?? 0) : (f.team_h_score ?? 0);
        const opponent = isHome ? f.team_a : f.team_h;

        let res: FormResult = 'D';
        if (gf > ga) res = 'W';
        if (gf < ga) res = 'L';

        return { result: res, opponent };
      });

      map[t.id] = results;
    });

    return map;
  }, [teams, fixtures]);

  const ModePill = ({
    value,
    label,
    icon: Icon,
  }: {
    value: TableMode;
    label: string;
    icon?: any;
  }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={[
        'px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-100',
        mode === value
          ? 'bg-white text-slate-900 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]'
          : 'text-slate-200 border border-slate-700/60 hover:bg-slate-800/40',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-2">
        {Icon && <Icon size={14} />}
        {label}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-white font-bold text-lg">
          <Trophy className="text-yellow-400" size={18} />
          Premier League Table
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          <ModePill value="basic" label="BASIC" icon={TrendingUp} />
          <ModePill value="results" label="RESULTS" icon={ShieldCheck} />
          <ModePill value="advanced" label="ADV" icon={Activity} />
          <ModePill value="form" label="FORM" icon={TrendingUp} />
        </div>
      </div>

      {/* Table */}
  <div ref={tableWrapRef} className="mt-6 overflow-auto max-h-[70vh] isolate rounded-lg border border-slate-700/60 bg-slate-950/20">
        <table
          className="w-full text-left border-separate border-spacing-0 table-fixed"
          style={{ minWidth }}
        >
          <colgroup>
            <col style={{ width: W_NUM }} />
            <col style={{ width: mode === 'basic' ? W_TEAM_COL : (stickyLeft ? W_TEAM_COL : 'auto') }} />
            <col style={{ width: W_PTS }} />
            {mode === 'results' && (
              <>
                <col style={{ width: 48 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
              </>
            )}
            {mode === 'advanced' && (
              <>
                <col style={{ width: 48 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 48 }} />
              </>
            )}
            {mode === 'basic' && <col style={{ width: 40 }} />}
            {mode === 'form' && <col style={{ width: 112 }} />}
          </colgroup>
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-700 sticky top-0 z-40">
              {/* # */}
              <th
                className={[
                  'py-2 text-center bg-slate-900',
                  stickyLeft
                    ? 'sticky left-0 z-50 bg-slate-900/80 backdrop-blur relative after:content-[""] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-slate-700/50'
                    : 'border-r border-slate-700/50',

                ].join(' ')}
                style={{ width: W_NUM, minWidth: W_NUM }}
              >
                #
              </th>

              {/* TEAM */}
              <th
                className={[
                  'py-0 px-0 border-r border-slate-700/50 bg-slate-900',
                  (stickyLeft || stickyTeamInResults)
                    ? 'sticky z-40 bg-slate-900/80 backdrop-blur relative after:content-[""] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-slate-700/50'
                    : '',
                ].join(' ')}
                style={
                  (stickyLeft || stickyTeamInResults)
                    ? { left: W_NUM, width: W_TEAM_COL, minWidth: W_TEAM_COL, maxWidth: W_TEAM_COL }
                    : undefined
                }
              >
                <div className="py-2 px-2 bg-slate-900/80 backdrop-blur">
                  TEAM
                </div>
              </th>



              {/* PTS */}
              <th
                className="py-2 text-center bg-slate-900 border-r border-slate-700/50 border-l-0"
                style={{
                  width: W_PTS,
                  minWidth: W_PTS,
                }}
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

              {/* BASIC show GD (FORM = no GD) */}
              {mode === 'basic' && (
                <th className="px-2 py-2 text-center w-8 bg-slate-900">GD</th>
              )}

              {/* FORM tab */}
              {mode === 'form' && <th className="px-2 py-2 w-28 text-center bg-slate-900">Form</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-700/50 text-sm">
            {tableRows.map((row, idx) => {
              const pos = idx + 1;

              const isHighlighted =
                activeHighlight?.source === row.teamId || activeHighlight?.target === row.teamId;

              const rowBg = isHighlighted ? 'bg-purple-950' : 'bg-slate-800 group-hover:bg-slate-700';

              const last5 = formMap[row.teamId] ?? [];

              return (
                <React.Fragment key={row.teamId}>
                  {/* separator block for top 5 */}
                  {pos === 6 && (
                    <tr className="bg-slate-950/70">
                      <td colSpan={50} className="px-3 py-2 text-xs text-green-300 border-t border-slate-700/50">
                        TOP 5 (UCL / EUROPE)
                      </td>
                    </tr>
                  )}

                  <tr
                    className={[
                      'group',
                      rowBg,
                      'transition-colors',
                      'cursor-pointer',
                    ].join(' ')}
                    onMouseEnter={() => setActiveHighlight({ source: row.teamId, target: row.teamId })}
                    onMouseLeave={() => setActiveHighlight(null)}
                    onClick={() => setSelectedForm((prev) => (prev === row.teamId ? null : row.teamId))}
                  >
                    {/* # */}
                    <td
                      className={[
                        'py-2 text-center font-bold text-slate-300 text-xs',
                        stickyLeft
                          ? 'sticky left-0 z-40 bg-slate-800 relative after:content-[""] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-slate-700/50'
                          : 'border-r border-slate-700/50',

                      ].join(' ')}
                      style={{ width: W_NUM, minWidth: W_NUM }}
                    >
                      {pos}
                    </td>

                    {/* TEAM */}
                    <td
                      className={[
                        'py-0 px-0 border-r border-slate-700/50',
                        (stickyLeft || stickyTeamInResults)
                          ? 'sticky z-30 bg-slate-800 relative after:content-[""] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-slate-700/50'
                          : '',
                      ].join(' ')}
                      style={
                        (stickyLeft || stickyTeamInResults)
                          ? { left: W_NUM, width: W_TEAM_COL, minWidth: W_TEAM_COL, maxWidth: W_TEAM_COL }
                          : undefined
                      }
                    >
                      <div className="py-2 px-2 font-extrabold text-white bg-slate-800">
                        <span className="block truncate">{row.shortName}</span>
                      </div>
                    </td>




                    {/* PTS */}
                    <td className="py-2 text-center font-bold text-white border-r border-slate-700/50">
                      {row.pts}
                    </td>

                    {/* RESULTS mode */}
                    {mode === 'results' && (
                      <>
                        <td className="px-2 py-2 text-center w-12 text-slate-200">{row.played}</td>
                        <td className="px-2 py-2 text-center w-10 text-green-300">{row.win}</td>
                        <td className="px-2 py-2 text-center w-10 text-slate-300">{row.draw}</td>
                        <td className="px-2 py-2 text-center w-10 text-red-300">{row.loss}</td>
                      </>
                    )}

                    {/* ADVANCED mode */}
                    {mode === 'advanced' && (
                      <>
                        <td className="px-2 py-2 text-center w-12 text-slate-200">{row.played}</td>
                        <td className="px-2 py-2 text-center w-10 text-green-300">{row.win}</td>
                        <td className="px-2 py-2 text-center w-10 text-slate-300">{row.draw}</td>
                        <td className="px-2 py-2 text-center w-10 text-red-300">{row.loss}</td>
                        <td className="px-2 py-2 text-center w-12 text-slate-200">{row.gf}</td>
                        <td className="px-2 py-2 text-center w-12 text-slate-200">{row.ga}</td>
                        <td className="px-2 py-2 text-center w-12">
                          <span className={row.gd >= 0 ? 'text-green-300' : 'text-red-300'}>
                            {row.gd >= 0 ? '+' : ''}
                            {row.gd}
                          </span>
                        </td>
                      </>
                    )}

                    {/* BASIC mode */}
                    {mode === 'basic' && (
                      <td className="px-2 py-2 text-center w-8">
                        <span className={row.gf - row.ga >= 0 ? 'text-green-300' : 'text-red-300'}>
                          {row.gf - row.ga >= 0 ? '+' : ''}
                          {row.gf - row.ga}
                        </span>
                      </td>
                    )}

                    {/* FORM mode (no GD) */}
                    {mode === 'form' && (
                      <>
                        <td className="px-2 py-2 w-28">
                          <div className="flex items-center justify-center gap-1">
                            {last5.length === 0 && <span className="text-slate-500 text-xs">—</span>}

                            {last5.map((match, i) => {
                              const Icon = match.result === 'W' ? Check : match.result === 'L' ? X : Minus;

                              const colorClass =
                                match.result === 'W'
                                  ? 'bg-green-600 border-green-500'
                                  : match.result === 'L'
                                    ? 'bg-red-600 border-red-500'
                                    : 'bg-slate-600 border-slate-500';

                              return (
                                <span
                                  key={i}
                                  className={[
                                    'w-6 h-6 rounded grid place-items-center border',
                                    colorClass,
                                  ].join(' ')}
                                  title={`${match.result} vs ${teams.find((t) => t.id === match.opponent)?.short_name ?? 'UNK'}`}
                                >
                                  <Icon size={14} className="text-white" />
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>

                  {/* expanded row (optional) */}
                  {selectedForm === row.teamId && mode === 'form' && (
                    <tr className="bg-slate-950/60">
                      <td colSpan={50} className="px-3 py-3 text-xs text-slate-300">
                        <span className="text-slate-400">Team:</span> <span className="text-white font-bold">{row.name}</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-3 px-2">
        <p className="text-slate-400 text-sm">{fixtures.filter((f) => f.finished).length} games played</p>
      </div>
    </div>
  );
};

export default LeagueTable;
