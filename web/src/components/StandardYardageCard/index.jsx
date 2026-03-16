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
import './StandardYardageCard.css';

const LS_CLUBS  = 'yc4_clubs';
const LS_WEDGES = 'yc4_wedges';

function todayStr() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function defaultWedges() {
  return Object.fromEntries(
    WEDGE_DEFS.map((w) => [w.id, { half: w.halfDef, three: w.threeDef, full: w.fullDef }])
  );
}

function loadLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

// Signed format: +5, −3, 0
function fmtDelta(n) {
  const v = Math.round(n);
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return '0';
}

// ── Card HTML generator (returns JSX-ready data structures) ──────────────────
function computeCardData(state) {
  const { clubs, wedges, altitude, homeAlt, humidity } = state;

  // Active clubs sorted by distance desc
  const active = clubs
    .filter((c) => c.id !== '' && c.dist > 0)
    .map((c) => {
      const opt = CLUB_OPTIONS.find((o) => o.id === c.id);
      const adj = roundToFive(
        c.dist +
        altitudeAdjustment(altitude, homeAlt, c.dist) +
        humidityAdjustment(humidity)
      );
      return { name: opt?.name ?? c.id, std: c.dist, adj };
    })
    .sort((a, b) => b.adj - a.adj);

  if (!active.length) return null;

  // Distance buckets (pairs)
  const buckets = [];
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
  const pills = [
    { text: 'Std = 70°F baseline' },
    { text: `${altitude >= 1000 ? (altitude / 1000).toFixed(1) + 'k' : altitude} ft alt` },
    altDelta !== 0 ? { text: `${altDelta > 0 ? '+' : ''}${altPct}% alt adj` } : null,
    { text: `${humidity}% RH` },
  ].filter(Boolean);

  // Wedge matrix rows
  const wedgeYards = new Set();
  WEDGE_DEFS.forEach((wd) => {
    const v = wedges[wd.id];
    if (!v) return;
    if (v.full)  wedgeYards.add(v.full);
    if (v.three) wedgeYards.add(v.three);
    if (v.half)  wedgeYards.add(v.half);
  });
  const wedgeRows = [...wedgeYards].sort((a, b) => b - a).map((yds) => {
    const cells = WEDGE_DEFS.map((wd) => {
      const v = wedges[wd.id];
      if (!v) return { text: '·', best: false, empty: true };
      const matches = [];
      if (v.full  === yds) matches.push('Full');
      if (v.three === yds) matches.push('¾');
      if (v.half  === yds) matches.push('½');
      if (!matches.length) return { text: '·', best: false, empty: true };
      return { text: matches.join('/'), best: matches.includes('Full'), empty: false };
    });
    return { yds, cells };
  });

  // Temperature columns
  const tempCols = [30, 40, 50, 60, 70, 80, 90, 100];
  const tempRows = buckets.map((bk) => ({
    range: bk.range,
    cells: tempCols.map((t) => {
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
  const WIND_COLS = [
    { mph: 15, head: true },
    { mph: 10, head: true },
    { mph:  5, head: true },
    { mph:  5, head: false },
    { mph: 10, head: false },
    { mph: 15, head: false },
  ];
  const windRows = buckets.map((bk) => ({
    range: bk.range,
    cells: WIND_COLS.map((col) => ({
      ...col,
      delta: Math.round(windAdjustment(bk.mid, col.mph, col.head)),
    })),
  }));

  return { active, buckets, pills, wedgeRows, tempRows, windRows };
}

// ── Rendered card component ──────────────────────────────────────────────────
function YardageCardOutput({ data, courseName, cardDate }) {
  if (!data) return null;
  const { active, wedgeRows, tempRows, windRows, pills } = data;
  const TEMP_COLS = [30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div className="syc-card" id="syc-print-preview">
      {/* Header */}
      <div className="syc-card-header">
        <div>
          <h2 className="syc-card-title">Dynamic <span className="syc-card-title-accent">Yardage</span> Card</h2>
          <div className="syc-card-meta">{courseName || 'Course'}{cardDate ? `  ·  ${cardDate}` : ''}</div>
        </div>
        <div className="syc-pills">
          {pills.map((p, i) => (
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
                {active.map((c, i) => (
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
                {wedgeRows.length > 0 ? wedgeRows.map((row, i) => (
                  <tr key={i}>
                    <td className="syc-td syc-td-yds">{row.yds}</td>
                    {row.cells.map((cell, j) => (
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
                {TEMP_COLS.map((t) => (
                  <th key={t} className={`syc-th${t === 70 ? ' syc-th-anchor' : ' syc-th-temp'}`}>{t}°</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tempRows.map((row, i) => (
                <tr key={i}>
                  <td className="syc-td syc-td-bucket">{row.range}</td>
                  {row.cells.map((cell, j) => (
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
              {windRows.map((row, i) => (
                <tr key={i}>
                  <td className="syc-td syc-td-bucket">{row.range}</td>
                  {row.cells.map((cell, j) => (
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
  const [clubs,      setClubs]      = useState(DEFAULT_CLUBS);
  const [wedges,     setWedges]     = useState(defaultWedges);
  const [altitude,   setAltitude]   = useState(0);
  const [homeAlt,    setHomeAlt]    = useState(0);
  const [humidity,   setHumidity]   = useState(50);
  const [courseName, setCourseName] = useState('');
  const [cardDate,   setCardDate]   = useState(todayStr);
  const [cardData,   setCardData]   = useState(null);
  const [error,      setError]      = useState('');
  const previewRef = useRef(null);

  // Hydrate from shared localStorage on mount
  useEffect(() => {
    setClubs(loadLS(LS_CLUBS, DEFAULT_CLUBS));
    setWedges(loadLS(LS_WEDGES, defaultWedges()));
  }, []);

  // Persist clubs/wedges to shared localStorage whenever they change
  useEffect(() => { localStorage.setItem(LS_CLUBS,  JSON.stringify(clubs));  }, [clubs]);
  useEffect(() => { localStorage.setItem(LS_WEDGES, JSON.stringify(wedges)); }, [wedges]);

  function handleClubChange(idx, field, value) {
    setClubs(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      if (field === 'id') {
        const opt = CLUB_OPTIONS.find((o) => o.id === value);
        return { id: value, dist: opt?.def ?? 0 };
      }
      return { ...c, dist: parseInt(value, 10) || 0 };
    }));
  }

  function handleWedgeChange(id, swing, value) {
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
                    {[
                      { swing: 'half',  label: '½' },
                      { swing: 'three', label: '¾' },
                      { swing: 'full',  label: 'Full' },
                    ].map(({ swing, label }) => (
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
              <input id="syc-course" className="wyc-input" type="text" placeholder="e.g. Pebble Beach" value={courseName}
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
          <button className="wyc-btn-primary" style={{ marginTop: 16, display: 'block' }} onClick={() => window.print()}>
            Print Card
          </button>
        </div>
      )}
    </div>
  );
}
