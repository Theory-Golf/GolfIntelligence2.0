// @ts-nocheck
'use client';

import { CLUB_OPTIONS } from './StepMyBag';
import { WEDGE_DEFS } from './StepWedges';
import {
  calcAdjustedDistance,
  decadeDispersion,
  buildWindBuckets,
  windAdjustment,
  roundToFive,
} from '@/utils/ballistics';

function buildActiveClubs(clubs, wx) {
  return clubs
    .filter((c) => c.id !== '' && c.dist > 0)
    .map((c) => {
      const opt = CLUB_OPTIONS.find((o) => o.id === c.id);
      const adj = calcAdjustedDistance(c.dist, wx);
      return { name: opt?.name ?? c.id, std: c.dist, adj };
    })
    .sort((a, b) => b.adj - a.adj);
}

function buildWedgeMatrix(wedges) {
  const rows = new Map();
  WEDGE_DEFS.forEach((wd) => {
    const vals = wedges[wd.id];
    if (!vals) return;
    const swings = [
      { yds: vals.full,  label: 'F' },
      { yds: vals.three, label: '¾' },
      { yds: vals.half,  label: '½' },
    ];
    swings.forEach(({ yds, label }) => {
      if (!yds) return;
      if (!rows.has(yds)) rows.set(yds, { pw: '', gw: '', sw: '', lw: '' });
      const existing = rows.get(yds)[wd.id];
      rows.get(yds)[wd.id] = existing ? `${existing}/${label}` : label;
    });
  });
  return [...rows.entries()]
    .map(([yds, cells]) => ({ yds, ...cells }))
    .sort((a, b) => a.yds - b.yds);
}

function buildConditionPills(wx) {
  const altDelta = wx.altFt - wx.homeAltFt;
  const altPct = wx.homeAltFt > 0
    ? Math.abs(Math.round((altDelta / wx.homeAltFt) * 100))
    : 0;
  const pills = [
    { text: `${wx.tempF}°F`, highlight: true },
    { text: `${wx.humidity}% RH` },
    { text: `${wx.windMph} mph ${wx.windDirText}`, highlight: true },
    { text: `${wx.altFt >= 1000 ? (wx.altFt / 1000).toFixed(1) + 'k' : wx.altFt} ft` },
  ];
  if (altDelta !== 0) {
    pills.push({ text: `${altDelta > 0 ? '+' : '−'}${altPct}% alt` });
  }
  return pills;
}

function SingleCard({ active, buckets, wedgeMatrix, pills, wx, courseName, roundDate, teeTime }) {
  const WIND_COLS = [15, 10, 5, 5, 10, 15]; // head: 15,10,5 | tail: 5,10,15

  return (
    <div className="yc-card">
      {/* Header */}
      <div className="yc-header">
        <div className="yc-header-top">
          <span className="yc-title">Dynamic Yardage Card</span>
          <span className="yc-course">{courseName || 'Course'}</span>
        </div>
        <div className="yc-header-meta">
          <span>{roundDate}</span>
          <span>{teeTime}</span>
        </div>
        <div className="yc-pills">
          {pills.map((p, i) => (
            <span key={i} className={`yc-pill${p.highlight ? ' yc-pill-hi' : ''}`}>
              {p.text}
            </span>
          ))}
        </div>
      </div>

      {/* Two-column body */}
      <div className="yc-body">
        {/* My Bag table */}
        <div className="yc-section">
          <div className="yc-section-head">My Bag</div>
          <table className="yc-table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Std</th>
                <th>Adj</th>
                <th>Dsp</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c, i) => (
                <tr key={i}>
                  <td className="yc-club-name">{c.name}</td>
                  <td className="yc-num">{c.std}</td>
                  <td className="yc-num yc-adj">{c.adj}</td>
                  <td className="yc-num yc-dsp">±{decadeDispersion(c.adj)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Wedge matrix */}
        <div className="yc-section">
          <div className="yc-section-head">Wedges</div>
          <table className="yc-table">
            <thead>
              <tr>
                <th>Yds</th>
                {WEDGE_DEFS.map((w) => <th key={w.id}>{w.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {wedgeMatrix.map((row, i) => {
                const isFullRow = WEDGE_DEFS.some((w) => row[w.id] === 'F');
                return (
                  <tr key={i} className={isFullRow ? 'yc-wedge-full' : ''}>
                    <td className="yc-num">{row.yds}</td>
                    {WEDGE_DEFS.map((w) => (
                      <td key={w.id} className="yc-wedge-cell">
                        {row[w.id] || '·'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wind table */}
      <div className="yc-wind-section">
        <div className="yc-section-head">Wind Adjustments</div>
        <table className="yc-wind-table">
          <thead>
            <tr className="yc-wind-group-row">
              <th></th>
              <th colSpan={3} className="yc-wind-head yc-wind-head-red">↓ Headwind</th>
              <th colSpan={3} className="yc-wind-head yc-wind-head-blue">↑ Tailwind</th>
            </tr>
            <tr className="yc-wind-speed-row">
              <th className="yc-wind-range-th">Yds</th>
              {WIND_COLS.map((mph, i) => {
                const isHead = i < 3;
                const isFcst = mph === wx.windColMph;
                return (
                  <th
                    key={i}
                    className={`yc-wind-col${isFcst ? ' yc-wind-fcst' : ''}`}
                  >
                    {mph}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={i}>
                <td className="yc-wind-range">{b.range}</td>
                {/* Headwind cols (15→5) */}
                {[15, 10, 5].map((mph) => {
                  const delta = roundToFive(windAdjustment(b.mid, mph, true));
                  const isFcst = mph === wx.windColMph;
                  return (
                    <td key={`h${mph}`} className={`yc-wind-cell yc-wind-head-cell${isFcst ? ' yc-wind-fcst' : ''}`}>
                      +{delta}
                    </td>
                  );
                })}
                {/* Tailwind cols (5→15) */}
                {[5, 10, 15].map((mph) => {
                  const delta = roundToFive(Math.abs(windAdjustment(b.mid, mph, false)));
                  const isFcst = mph === wx.windColMph;
                  return (
                    <td key={`t${mph}`} className={`yc-wind-cell yc-wind-tail-cell${isFcst ? ' yc-wind-fcst' : ''}`}>
                      −{delta}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="yc-footer">
        <span>Adj @ {wx.tempF}°F · {wx.altFt.toLocaleString()} ft · {wx.humidity}% RH · Dsp = DECADE (yds)</span>
        <span className="yc-footer-legend">
          <span className="yc-legend-dot yc-dot-red" /> Head +
          <span className="yc-legend-dot yc-dot-blue" /> Tail −
          <span className="yc-legend-dot yc-dot-gold" /> Fcst
        </span>
      </div>
    </div>
  );
}

export default function YardageCardPrint({ clubs, wedges, wx, courseName, roundDate, teeTime }) {
  if (!wx) return null;

  const active = buildActiveClubs(clubs, wx);
  const buckets = buildWindBuckets(active);
  const wedgeMatrix = buildWedgeMatrix(wedges);
  const pills = buildConditionPills(wx);

  const cardProps = { active, buckets, wedgeMatrix, pills, wx, courseName, roundDate, teeTime };

  return (
    <div id="wyc-print-preview">
      <p className="wyc-preview-label">Card Preview — Updates as you fill in your bag</p>
      <div className="yc-print-page">
        <SingleCard {...cardProps} />
        <SingleCard {...cardProps} />
      </div>
    </div>
  );
}
