'use client';

import { useState, useEffect, useRef } from 'react';
import { CLUB_OPTIONS, DEFAULT_CLUBS } from '@/components/WeatherYardageCard/StepMyBag';
import { WEDGE_DEFS } from '@/components/WeatherYardageCard/StepWedges';
import {
  roundToFive,
  altitudeAdjustment,
  humidityAdjustment,
  windAdjustment,
  tempAdjustment,
} from '@/utils/ballistics';
import { LS_CLUBS, LS_WEDGES } from '@/lib/constants';
import './StandardYardageCard.css';

/* ── Shared types ──────────────────────────────────────────────────────────── */

interface Club {
  id: string;
  dist: number;
}

interface WedgeSwings {
  half: number;
  three: number;
  full: number;
}

type WedgeMap = Record<string, WedgeSwings>;

interface ActiveClub {
  name: string;
  std: number;
  adj: number;
}

interface Bucket {
  range: string;
  mid: number;
}

interface WedgeCell {
  text: string;
  best: boolean;
  empty: boolean;
}

interface WedgeRow {
  yds: number;
  cells: WedgeCell[];
}

interface TempCell {
  t: number;
  delta: number;
  anchor: boolean;
}

interface TempRow {
  range: string;
  cells: TempCell[];
}

interface WindCell {
  mph: number;
  head: boolean;
  delta: number;
}

interface WindRow {
  range: string;
  cells: WindCell[];
}

interface Pill {
  text: string;
}

interface CardData {
  active: ActiveClub[];
  buckets: Bucket[];
  pills: Pill[];
  wedgeRows: WedgeRow[];
  tempRows: TempRow[];
  windRows: WindRow[];
}

interface ComputeInput {
  clubs: Club[];
  wedges: WedgeMap;
  altitude: number;
  homeAlt: number;
  humidity: number;
}

function todayStr() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function defaultWedges(): WedgeMap {
  return Object.fromEntries(
    WEDGE_DEFS.map((w) => [w.id, { half: w.halfDef, three: w.threeDef, full: w.fullDef }])
  ) as WedgeMap;
}

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; }
  catch { return fallback; }
}

// Signed format: +5, −3, 0
function fmtDelta(n: number): string {
  const v = Math.round(n);
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return '0';
}

// ── Card data computation ─────────────────────────────────────────────────────
function computeCardData(state: ComputeInput): CardData | null {
  const { clubs, wedges, altitude, homeAlt, humidity } = state;

  const active: ActiveClub[] = clubs
    .filter((c: Club) => c.id !== '' && c.dist > 0)
    .map((c: Club) => {
      const opt = CLUB_OPTIONS.find((o: { id: string }) => o.id === c.id);
      const adj = roundToFive(
        c.dist +
        altitudeAdjustment(altitude, homeAlt, c.dist) +
        humidityAdjustment(humidity)
      );
      return { name: opt?.name ?? c.id, std: c.dist, adj };
    })
    .sort((a: ActiveClub, b: ActiveClub) => b.adj - a.adj);

  if (!active.length) return null;

  const buckets: Bucket[] = [];
  for (let i = 0; i < active.length; i += 2) {
    const a = active[i];
    const b = active[i + 1];
    const hi  = roundToFive(a.adj);
    const lo  = roundToFive(b ? b.adj : Math.max(a.adj - 15, 0));
    const mid = roundToFive((hi + lo) / 2);
    buckets.push({ range: `${lo}–${hi}`, mid });
  }

  const altDelta = altitude - homeAlt;
  const altPct   = Math.round(altDelta * 0.116);
  const pills: Pill[] = [
    { text: 'Std = 70°F baseline' },
    { text: `${altitude >= 1000 ? (altitude / 1000).toFixed(1) + 'k' : altitude} ft alt` },
    altDelta !== 0 ? { text: `${altDelta > 0 ? '+' : ''}${altPct}% alt adj` } : null,
    { text: `${humidity}% RH` },
  ].filter((p): p is Pill => p !== null);

  const wedgeYards = new Set<number>();
  WEDGE_DEFS.forEach((wd) => {
    const v = wedges[wd.id];
    if (!v) return;
    if (v.full)  wedgeYards.add(v.full);
    if (v.three) wedgeYards.add(v.three);
    if (v.half)  wedgeYards.add(v.half);
  });
  const wedgeRows: WedgeRow[] = [...wedgeYards].sort((a: number, b: number) => b - a).map((yds: number) => {
    const cells: WedgeCell[] = WEDGE_DEFS.map((wd) => {
      const v = wedges[wd.id];
      if (!v) return { text: '·', best: false, empty: true };
      const matches: string[] = [];
      if (v.full  === yds) matches.push('Full');
      if (v.three === yds) matches.push('¾');
      if (v.half  === yds) matches.push('½');
      if (!matches.length) return { text: '·', best: false, empty: true };
      return { text: matches.join('/'), best: matches.includes('Full'), empty: false };
    });
    return { yds, cells };
  });

  const tempCols: number[] = [30, 40, 50, 60, 70, 80, 90, 100];
  const tempRows: TempRow[] = buckets.map((bk: Bucket) => ({
    range: bk.range,
    cells: tempCols.map((t: number) => {
      const playsDelta = Math.round(-(t - 70) * 0.075);
      return { t, delta: playsDelta, anchor: t === 70 };
    }),
  }));

  const WIND_COLS: { mph: number; head: boolean }[] = [
    { mph: 15, head: true },
    { mph: 10, head: true },
    { mph:  5, head: true },
    { mph:  5, head: false },
    { mph: 10, head: false },
    { mph: 15, head: false },
  ];
  const windRows: WindRow[] = buckets.map((bk: Bucket) => ({
    range: bk.range,
    cells: WIND_COLS.map((col: { mph: number; head: boolean }) => ({
      ...col,
      delta: Math.round(windAdjustment(bk.mid, col.mph, col.head)),
    })),
  }));

  return { active, buckets, pills, wedgeRows, tempRows, windRows };
}

// ── Card output component (Tailwind-styled, matches website theme) ─────────────
interface YardageCardOutputProps {
  data: CardData | null;
  courseName: string;
  cardDate: string;
}

function YardageCardOutput({ data, courseName, cardDate }: YardageCardOutputProps) {
  if (!data) return null;
  const { active, wedgeRows, tempRows, windRows, pills } = data;
  const TEMP_COLS: number[] = [30, 40, 50, 60, 70, 80, 90, 100];

  // Shared cell/header classes
  const sectionHead = 'font-mono text-[7.5px] uppercase tracking-[0.18em] px-[8px] py-[4px] border-b border-pitch print:border-gray-200 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]';
  const th = 'font-mono text-[7px] uppercase tracking-[0.08em] px-[5px] py-[3px]';
  const td = 'font-mono text-[8px] px-[5px] py-[2px] border-t border-pitch/40 print:border-gray-100';

  return (
    <div
      className="flex flex-col bg-obsidian text-foreground border border-pitch overflow-hidden font-body [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:bg-white print:text-black print:border-gray-300"
      style={{ width: '4.5in', minHeight: '6in' }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-court border-b-2 border-primary px-[10px] py-[8px] flex items-start justify-between gap-2 [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:bg-gray-100 print:border-primary">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-[14px] uppercase tracking-wide text-chalk leading-tight print:text-black">
            Dynamic <span className="text-primary">Yardage</span> Card
          </h2>
          <div className="font-mono text-[7.5px] text-cement mt-[2px] leading-tight print:text-gray-500">
            {courseName || 'Course'}{cardDate ? ` · ${cardDate}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-[3px] justify-end shrink-0">
          {pills.map((p: Pill, i: number) => (
            <span
              key={i}
              className="font-mono text-[6.5px] uppercase tracking-[0.08em] border border-cement/30 px-[4px] py-[1px] text-cement whitespace-nowrap print:border-gray-400 print:text-gray-600"
            >
              {p.text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1">

        {/* Top row: My Bag | Distance Wedges */}
        <div className="flex border-b border-pitch print:border-gray-200" style={{ minHeight: 0 }}>

          {/* My Bag */}
          <div className="flex flex-col border-r border-pitch print:border-gray-200" style={{ width: '45%' }}>
            <div className={`${sectionHead} bg-shadow text-primary print:bg-gray-50 print:text-gray-700`}>
              ① My Bag
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-shadow/60 print:bg-gray-50">
                  <th className={`${th} text-left text-muted-foreground print:text-gray-500`}>Club</th>
                  <th className={`${th} text-right text-muted-foreground print:text-gray-500`}>Std</th>
                  <th className={`${th} text-right text-primary`}>Adj</th>
                </tr>
              </thead>
              <tbody>
                {active.map((c: ActiveClub, i: number) => (
                  <tr key={i}>
                    <td className={`${td} text-left font-body text-foreground print:text-black`}>{c.name}</td>
                    <td className={`${td} text-right text-muted-foreground print:text-gray-500`}>{c.std}</td>
                    <td className={`${td} text-right text-primary font-bold`}>{c.adj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Distance Wedges */}
          <div className="flex flex-col flex-1">
            <div className={`${sectionHead} bg-shadow text-bogey print:bg-amber-50 print:text-amber-800`}>
              ② Distance Wedges
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-shadow/60 print:bg-gray-50">
                  <th className={`${th} text-left text-bogey print:text-amber-700`}>Yds</th>
                  {WEDGE_DEFS.map((w) => (
                    <th key={w.id} className={`${th} text-center text-bogey print:text-amber-700`}>{w.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wedgeRows.length > 0 ? wedgeRows.map((row: WedgeRow, i: number) => (
                  <tr key={i}>
                    <td className={`${td} text-left text-bogey font-bold print:text-amber-700`}>{row.yds}</td>
                    {row.cells.map((cell: WedgeCell, j: number) => (
                      <td
                        key={j}
                        className={`${td} text-center ${
                          cell.best
                            ? 'text-foreground font-bold print:text-black'
                            : cell.empty
                              ? 'text-pitch print:text-gray-200'
                              : 'text-muted-foreground print:text-gray-400'
                        }`}
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="font-mono text-[7px] text-muted-foreground text-center px-2 py-3 print:text-gray-400">
                      Enter wedge distances above
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Temperature table */}
        <div className="border-b border-pitch print:border-gray-200">
          <div className={`${sectionHead} bg-shadow text-c1 flex items-center gap-2 print:bg-blue-50 print:text-blue-700`}>
            ③ Temperature
            <span className="text-muted-foreground normal-case tracking-normal text-[6.5px] print:text-gray-400">
              plays-like · 70°F = 0 · cold = + · warm = −
            </span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-shadow/60 print:bg-gray-50">
                <th className={`${th} text-left text-muted-foreground print:text-gray-500`}>Yds</th>
                {TEMP_COLS.map((t: number) => (
                  <th
                    key={t}
                    className={`${th} text-center print:text-gray-600 ${
                      t === 70 ? 'text-muted-foreground' : t < 70 ? 'text-c1' : 'text-bogey'
                    }`}
                  >
                    {t}°
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tempRows.map((row: TempRow, i: number) => (
                <tr key={i}>
                  <td className={`${td} text-left text-muted-foreground print:text-gray-500`}>{row.range}</td>
                  {row.cells.map((cell: TempCell, j: number) => (
                    <td
                      key={j}
                      className={`${td} text-center font-bold print:text-gray-800 ${
                        cell.anchor ? 'text-muted-foreground print:text-gray-400' : cell.delta > 0 ? 'text-c1' : 'text-bogey'
                      }`}
                    >
                      {cell.anchor ? '0' : fmtDelta(cell.delta)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Wind table */}
        <div className="flex-1">
          <div className={`${sectionHead} bg-shadow text-muted-foreground flex items-center gap-2 print:bg-gray-50 print:text-gray-500`}>
            ④ Wind
            <span className="normal-case tracking-normal text-[6.5px]">+ = more club · − = less</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} text-left`}></th>
                <th colSpan={3} className={`${th} text-center text-scarlet print:text-red-700`}>↓ Headwind</th>
                <th colSpan={3} className={`${th} text-center text-c1 print:text-blue-700`}>↑ Tailwind</th>
              </tr>
              <tr className="bg-shadow/60 print:bg-gray-50">
                <th className={`${th} text-left text-muted-foreground print:text-gray-500`}>Yds</th>
                {[15, 10, 5, 5, 10, 15].map((mph, i) => (
                  <th
                    key={i}
                    className={`${th} text-center ${i < 3 ? 'text-scarlet print:text-red-600' : 'text-c1 print:text-blue-600'}`}
                  >
                    {mph}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {windRows.map((row: WindRow, i: number) => (
                <tr key={i}>
                  <td className={`${td} text-left text-muted-foreground print:text-gray-500`}>{row.range}</td>
                  {row.cells.map((cell: WindCell, j: number) => (
                    <td
                      key={j}
                      className={`${td} text-center font-bold ${cell.head ? 'text-scarlet print:text-red-700' : 'text-c1 print:text-blue-700'}`}
                    >
                      {fmtDelta(cell.delta)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="bg-court border-t border-pitch/60 px-[8px] py-[5px] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:bg-gray-50 print:border-gray-200">
        <p className="font-mono text-[6px] text-cement leading-[1.5] print:text-gray-500">
          All values in yards · Adj = carry at 70°F, no wind · Wind &amp; Temp show plays-like adjustment to Adj
        </p>
        <div className="flex gap-[10px] mt-[2px] flex-wrap">
          {[
            { color: 'bg-scarlet', label: 'Head = longer (+)' },
            { color: 'bg-c1',     label: 'Tail = shorter (−)' },
            { color: 'bg-c1',     label: 'Cold = longer (+)' },
            { color: 'bg-bogey',  label: 'Warm = shorter (−)' },
          ].map((item, i) => (
            <span key={i} className="font-mono text-[6px] text-cement print:text-gray-500 flex items-center gap-[3px]">
              <span className={`inline-block w-[5px] h-[5px] rounded-sm ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function StandardYardageCard() {
  const [clubs,      setClubs]      = useState<Club[]>(DEFAULT_CLUBS);
  const [wedges,     setWedges]     = useState<WedgeMap>(defaultWedges);
  const [altitude,   setAltitude]   = useState(0);
  const [homeAlt,    setHomeAlt]    = useState(0);
  const [humidity,   setHumidity]   = useState(50);
  const [courseName, setCourseName] = useState('');
  const [cardDate,   setCardDate]   = useState(todayStr);
  const [cardData,   setCardData]   = useState<CardData | null>(null);
  const [error,      setError]      = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClubs(loadLS(LS_CLUBS, DEFAULT_CLUBS));
    setWedges(loadLS(LS_WEDGES, defaultWedges()));
  }, []);

  useEffect(() => { localStorage.setItem(LS_CLUBS,  JSON.stringify(clubs));  }, [clubs]);
  useEffect(() => { localStorage.setItem(LS_WEDGES, JSON.stringify(wedges)); }, [wedges]);

  const WEDGE_IDS = ['pw', 'gw', 'sw', 'lw'];

  function handleClubChange(idx: number, field: string, value: string) {
    setClubs(prev => {
      const updated = prev.map((c, i) => {
        if (i !== idx) return c;
        if (field === 'id') {
          const opt = CLUB_OPTIONS.find((o) => o.id === value);
          return { id: value, dist: opt?.def ?? 0 };
        }
        return { ...c, dist: parseInt(value, 10) || 0 };
      });

      const changed = updated[idx];
      if (WEDGE_IDS.includes(changed.id)) {
        const newDist = changed.dist;
        if (newDist > 0) {
          setWedges(prev => ({
            ...prev,
            [changed.id]: { ...prev[changed.id], full: newDist },
          }));
        }
      }

      return updated;
    });
  }

  function handleWedgeChange(id: string, swing: keyof WedgeSwings, value: string) {
    setWedges(prev => ({
      ...prev,
      [id]: { ...prev[id], [swing]: parseInt(value, 10) || 0 },
    }));
  }

  function generate() {
    const data = computeCardData({ clubs, wedges, altitude, homeAlt, humidity });
    if (!data) { setError('Enter at least one club distance.'); return; }
    setError('');
    setCardData(data);
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  return (
    <div className="syc-wrap">

      {/* ── FORM ── */}
      <div>

        {/* Bag */}
        <div className="syc-group">
          <div className="syc-group-header">① My Bag — Standard Carry Distances</div>
          <div style={{ padding: '12px 16px' }}>
            <div className="syc-bag-header">
              <span>Club</span>
              <span>Carry (yds)</span>
            </div>
            <div className="syc-bag-grid">
              {clubs.map((club, idx) => (
                <div key={idx} className="syc-club-row">
                  <select
                    className="syc-club-select"
                    value={club.id}
                    onChange={(e) => handleClubChange(idx, 'id', e.target.value)}
                    aria-label={`Club ${idx + 1}`}
                  >
                    {CLUB_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <input
                    className="syc-dist-input"
                    type="number" min={0} max={400}
                    value={club.id === '' ? '' : club.dist}
                    disabled={club.id === ''}
                    onChange={(e) => handleClubChange(idx, 'dist', e.target.value)}
                    aria-label={`Distance for club ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wedges */}
        <div className="syc-group">
          <div className="syc-group-header">② Distance Wedges — ½ · ¾ · Full Carry</div>
          <div className="syc-wedge-grid">
            {WEDGE_DEFS.map((wd) => {
              const vals = wedges[wd.id] || { half: wd.halfDef, three: wd.threeDef, full: wd.fullDef };
              return (
                <div key={wd.id} className="syc-wedge-block">
                  <div className="syc-wedge-name">{wd.name}</div>
                  <div className="syc-wedge-rows">
                    {([
                      { swing: 'half' as keyof WedgeSwings,  label: '½ Swing' },
                      { swing: 'three' as keyof WedgeSwings, label: '¾ Swing' },
                      { swing: 'full' as keyof WedgeSwings,  label: 'Full' },
                    ] as const).map(({ swing, label }) => (
                      <div key={swing} className="syc-wedge-row">
                        <span className="syc-wedge-shot-label">{label}</span>
                        <input
                          id={`w_${wd.id}_${swing}`}
                          className="syc-wedge-dist-input"
                          type="number" min={0} max={200}
                          value={vals[swing]}
                          onChange={(e) => handleWedgeChange(wd.id, swing, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conditions */}
        <div className="syc-group">
          <div className="syc-group-header">③ Conditions</div>
          <div className="syc-conditions-grid">
            {[
              { id: 'syc-alt',      label: 'Altitude',    unit: 'ft',  value: altitude,   onChange: (v: string) => setAltitude(parseFloat(v) || 0),   type: 'number', min: 0,   max: 14000, step: 100 },
              { id: 'syc-homealt',  label: 'Home Alt.',   unit: 'ft',  value: homeAlt,    onChange: (v: string) => setHomeAlt(parseFloat(v) || 0),    type: 'number', min: 0,   max: 14000, step: 100 },
              { id: 'syc-humidity', label: 'Humidity',    unit: '%',   value: humidity,   onChange: (v: string) => setHumidity(parseFloat(v) || 50),  type: 'number', min: 0,   max: 100,   step: 5   },
              { id: 'syc-course',   label: 'Course Name', unit: '',    value: courseName, onChange: (v: string) => setCourseName(v),                  type: 'text'   },
              { id: 'syc-date',     label: 'Date',        unit: '',    value: cardDate,   onChange: (v: string) => setCardDate(v),                    type: 'text'   },
            ].map(({ id, label, unit, value, onChange, type, ...rest }) => (
              <div key={id} className="syc-cond-item">
                <div className="syc-cond-label">
                  {label}{unit ? <span style={{ opacity: .6 }}> {unit}</span> : null}
                </div>
                <input
                  id={id}
                  className="syc-cond-input"
                  type={type}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  {...rest}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="wyc-error">{error}</p>}

        <button className="wyc-btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={generate}>
          Generate Yardage Card →
        </button>
      </div>

      {/* ── PREVIEW ── */}
      {cardData && (
        <div ref={previewRef} style={{ marginTop: 48 }}>
          <p className="syc-preview-label">Card Preview — Ready to Print</p>
          <div className="syc-preview-scroll">
            <YardageCardOutput data={cardData} courseName={courseName} cardDate={cardDate} />
          </div>
          {/* Print page: two cards side-by-side — hidden on screen, visible when printing */}
          <div id="syc-print-page" aria-hidden="true">
            <YardageCardOutput data={cardData} courseName={courseName} cardDate={cardDate} />
            <YardageCardOutput data={cardData} courseName={courseName} cardDate={cardDate} />
          </div>
          <button className="wyc-btn-primary" style={{ marginTop: 16, display: 'block' }} onClick={() => window.print()}>
            Print Card
          </button>
        </div>
      )}
    </div>
  );
}
