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

// ── Card HTML generator (returns JSX-ready data structures) ──────────────────
function computeCardData(state: ComputeInput): CardData | null {
  const { clubs, wedges, altitude, homeAlt, humidity } = state;

  // Active clubs sorted by distance desc
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

  // Distance buckets (pairs)
  const buckets: Bucket[] = [];
  for (let i = 0; i < active.length; i += 2) {
    const a = active[i];
    const b = active[i + 1];
    const hi  = roundToFive(a.adj);
    const lo  = roundToFive(b ? b.adj : Math.max(a.adj - 15, 0));
    const mid = roundToFive((hi + lo) / 2);
    buckets.push({ range: `${lo}–${hi}`, mid });
  }

  // Condition pills
  const altDelta = altitude - homeAlt;
  const altPct   = Math.round(altDelta * 0.116);
  const pills: Pill[] = [
    { text: 'Std = 70°F baseline' },
    { text: `${altitude >= 1000 ? (altitude / 1000).toFixed(1) + 'k' : altitude} ft alt` },
    altDelta !== 0 ? { text: `${altDelta > 0 ? '+' : ''}${altPct}% alt adj` } : null,
    { text: `${humidity}% RH` },
  ].filter((p): p is Pill => p !== null);

  // Wedge matrix rows
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

  // Temperature columns
  const tempCols: number[] = [30, 40, 50, 60, 70, 80, 90, 100];
  const tempRows: TempRow[] = buckets.map((bk: Bucket) => ({
    range: bk.range,
    cells: tempCols.map((t: number) => {
      // tempAdjustment gives how much farther the ball goes at that temp vs 70°F
      // Negate for "plays like" perspective: cold = positive (takes more club)
      const delta = Math.round(-tempAdjustment(t) * (bk.mid / bk.mid)); // scalar per yard then multiply
      // More precisely: total yards delta for this distance
      const totalDelta = Math.round(-tempAdjustment(t) * (bk.mid / 100) * bk.mid / bk.mid);
      // Actually simpler: tempAdjustment returns yards-per-yard * carry
      // tempAdjustment(t) = (t-70)*0.075 yards for a 1-yard shot
      // For mid yards: (t-70)*0.075 total yards delta (positive = farther)
      // "plays like" delta = negate: cold adds yards needed, warm reduces
      const playsDelta = Math.round(-(t - 70) * 0.075);
      return { t, delta: playsDelta, anchor: t === 70 };
    }),
  }));

  // Wind rows
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

// ── Rendered card component ──────────────────────────────────────────────────
interface YardageCardOutputProps {
  data: CardData | null;
  courseName: string;
  cardDate: string;
}

function YardageCardOutput({ data, courseName, cardDate }: YardageCardOutputProps) {
  if (!data) return null;
  const { active, wedgeRows, tempRows, windRows, pills } = data;
  const TEMP_COLS: number[] = [30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div className="syc-card" id="syc-print-preview">
      {/* Header */}
      <div className="syc-card-header">
        <div>
          <h2 className="syc-card-title">Dynamic <span className="syc-card-title-accent">Yardage</span> Card</h2>
          <div className="syc-card-meta">{courseName || 'Course'}{cardDate ? `  ·  ${cardDate}` : ''}</div>
        </div>
        <div className="syc-pills">
          {pills.map((p: Pill, i: number) => (
            <span key={i} className="syc-pill">{p.text}</span>
          ))}
        </div>
      </div>

      <div className="syc-card-body">
        {/* TOP ROW: Bag + Wedges */}
        <div className="syc-card-top">
          {/* Table 1 — My Bag */}
          <div className="syc-col-bag">
            <div className="syc-tbl-head">① My Bag</div>
            <table className="syc-tbl syc-tbl-bag">
              <thead>
                <tr>
                  <th className="syc-th syc-th-left">Club</th>
                  <th className="syc-th">Std</th>
                  <th className="syc-th syc-th-accent">Adj</th>
                </tr>
              </thead>
              <tbody>
                {active.map((c: ActiveClub, i: number) => (
                  <tr key={i}>
                    <td className="syc-td syc-td-club">{c.name}</td>
                    <td className="syc-td syc-td-num">{c.std}</td>
                    <td className="syc-td syc-td-adj">{c.adj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table 2 — Distance Wedges */}
          <div className="syc-col-wedge">
            <div className="syc-tbl-head syc-tbl-head-amber">② Distance Wedges</div>
            <table className="syc-tbl syc-tbl-wedge">
              <thead>
                <tr>
                  <th className="syc-th syc-th-left syc-th-amber">Yds</th>
                  {WEDGE_DEFS.map((w) => (
                    <th key={w.id} className="syc-th syc-th-amber">{w.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wedgeRows.length > 0 ? wedgeRows.map((row: WedgeRow, i: number) => (
                  <tr key={i}>
                    <td className="syc-td syc-td-yds">{row.yds}</td>
                    {row.cells.map((cell: WedgeCell, j: number) => (
                      <td key={j} className={`syc-td syc-td-center${cell.best ? ' syc-td-best' : ''}${cell.empty ? ' syc-td-empty' : ''}`}>
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="syc-td syc-td-empty" style={{ textAlign: 'center', padding: '8px' }}>Enter wedge distances in form above</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 3 — Temperature */}
        <div className="syc-col-full">
          <div className="syc-tbl-divider">③ Temperature <span className="syc-tbl-note">plays like · 70°F = 0 · cold = + · warm = −</span></div>
          <table className="syc-tbl syc-tbl-temp">
            <thead>
              <tr>
                <th className="syc-th syc-th-left syc-th-bucket">Yds</th>
                {TEMP_COLS.map((t: number) => (
                  <th key={t} className={`syc-th${t === 70 ? ' syc-th-anchor' : ' syc-th-temp'}`}>{t}°</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tempRows.map((row: TempRow, i: number) => (
                <tr key={i}>
                  <td className="syc-td syc-td-bucket">{row.range}</td>
                  {row.cells.map((cell: TempCell, j: number) => (
                    <td key={j} className={`syc-td syc-td-center${cell.anchor ? ' syc-td-anchor' : cell.delta > 0 ? ' syc-td-cold' : ' syc-td-warm'}`}>
                      {cell.anchor ? '0' : fmtDelta(cell.delta)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table 4 — Wind */}
        <div className="syc-col-full">
          <div className="syc-tbl-head">④ Wind <span className="syc-tbl-note">+ = take more club · − = take less</span></div>
          <table className="syc-tbl syc-tbl-wind">
            <thead>
              <tr className="syc-tr-group">
                <th className="syc-th syc-th-left syc-th-bucket"></th>
                <th className="syc-th syc-th-head" colSpan={3}>↓ Headwind</th>
                <th className="syc-th syc-th-tail" colSpan={3}>↑ Tailwind</th>
              </tr>
              <tr>
                <th className="syc-th syc-th-left syc-th-bucket">Yds</th>
                {[15, 10, 5, 5, 10, 15].map((mph, i) => (
                  <th key={i} className={`syc-th${i < 3 ? ' syc-th-head-spd' : ' syc-th-tail-spd'}`}>{mph} mph</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {windRows.map((row: WindRow, i: number) => (
                <tr key={i}>
                  <td className="syc-td syc-td-bucket">{row.range}</td>
                  {row.cells.map((cell: WindCell, j: number) => (
                    <td key={j} className={`syc-td syc-td-center${cell.head ? ' syc-td-head' : ' syc-td-tail'}`}>
                      {fmtDelta(cell.delta)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="syc-card-footer">
        <span className="syc-footer-note">All values in yards · Adj = carry at 70°F, no wind · Wind & temp: plays-like adjustment to Adj</span>
        <div className="syc-legend">
          <span className="syc-leg"><span className="syc-leg-dot" style={{ background: '#8B2020' }} />Head = plays longer (+)</span>
          <span className="syc-leg"><span className="syc-leg-dot" style={{ background: '#2A5B9A' }} />Tail = plays shorter (−)</span>
          <span className="syc-leg"><span className="syc-leg-dot" style={{ background: '#1A3B6A' }} />Cold = plays longer (+)</span>
          <span className="syc-leg"><span className="syc-leg-dot" style={{ background: '#7A2A00' }} />Warm = plays shorter (−)</span>
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

  // Hydrate from shared localStorage on mount
  useEffect(() => {
    setClubs(loadLS(LS_CLUBS, DEFAULT_CLUBS));
    setWedges(loadLS(LS_WEDGES, defaultWedges()));
  }, []);

  // Persist clubs/wedges to shared localStorage whenever they change
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

      // Sync wedge Full distance when a wedge club's carry changes
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
      <div className="syc-form">

        {/* Bag */}
        <div className="syc-group">
          <p className="eyebrow" style={{ marginBottom: 14 }}>① My Bag — Standard Carry Distances</p>
          <div className="syc-bag-header">
            <span>Club</span>
            <span>Carry (yds)</span>
          </div>
          <div className="syc-bag-grid">
            {clubs.map((club, idx) => (
              <div key={idx} className="syc-club-row">
                <select
                  className="wyc-input syc-select"
                  value={club.id}
                  onChange={(e) => handleClubChange(idx, 'id', e.target.value)}
                  aria-label={`Club ${idx + 1}`}
                >
                  {CLUB_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
                <input
                  className="wyc-input syc-dist-input"
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

        {/* Wedges */}
        <div className="syc-group">
          <p className="eyebrow" style={{ marginBottom: 6 }}>② Distance Wedges — ½ · ¾ · Full Carry</p>
          <p className="wyc-step-desc" style={{ marginBottom: 16 }}>Enter your actual carry distances for each swing length.</p>
          <div className="syc-wedge-grid">
            {WEDGE_DEFS.map((wd) => {
              const vals = wedges[wd.id] || { half: wd.halfDef, three: wd.threeDef, full: wd.fullDef };
              return (
                <div key={wd.id} className="syc-wedge-block">
                  <div className="syc-wedge-name">{wd.name}</div>
                  <div className="syc-wedge-inputs">
                    {([
                      { swing: 'half' as keyof WedgeSwings,  label: '½' },
                      { swing: 'three' as keyof WedgeSwings, label: '¾' },
                      { swing: 'full' as keyof WedgeSwings,  label: 'Full' },
                    ] as const).map(({ swing, label }) => (
                      <div key={swing} className="wyc-field">
                        <label className="wyc-label" htmlFor={`w_${wd.id}_${swing}`}>{label}</label>
                        <input
                          id={`w_${wd.id}_${swing}`}
                          className="wyc-input"
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
          <p className="eyebrow" style={{ marginBottom: 14 }}>③ Conditions</p>
          <div className="syc-conditions-grid">
            <div className="wyc-field">
              <label className="wyc-label" htmlFor="syc-alt">Altitude <span style={{ opacity: .6, fontWeight: 400 }}>ft</span></label>
              <input id="syc-alt" className="wyc-input" type="number" min={0} max={14000} step={100} value={altitude}
                onChange={(e) => setAltitude(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="wyc-field">
              <label className="wyc-label" htmlFor="syc-homealt">Home Alt. <span style={{ opacity: .6, fontWeight: 400 }}>ft</span></label>
              <input id="syc-homealt" className="wyc-input" type="number" min={0} max={14000} step={100} value={homeAlt}
                onChange={(e) => setHomeAlt(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="wyc-field">
              <label className="wyc-label" htmlFor="syc-humidity">Humidity <span style={{ opacity: .6, fontWeight: 400 }}>%</span></label>
              <input id="syc-humidity" className="wyc-input" type="number" min={0} max={100} step={5} value={humidity}
                onChange={(e) => setHumidity(parseFloat(e.target.value) || 50)} />
            </div>
            <div className="wyc-field">
              <label className="wyc-label" htmlFor="syc-course">Course Name</label>
              <input id="syc-course" className="wyc-input" type="text" placeholder="Theory Golf Links" value={courseName}
                onChange={(e) => setCourseName(e.target.value)} />
            </div>
            <div className="wyc-field">
              <label className="wyc-label" htmlFor="syc-date">Date</label>
              <input id="syc-date" className="wyc-input" type="text" value={cardDate}
                onChange={(e) => setCardDate(e.target.value)} />
            </div>
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
          <p className="wyc-preview-label">Card Preview — Ready to Print</p>
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
