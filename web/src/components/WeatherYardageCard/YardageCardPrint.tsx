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
    .sort((a, b) => b.yds - a.yds);
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

/**
 * Temperature adjustment relative to forecast temp.
 * Returns yards to add/subtract from card yardages.
 * Cold → add (plays longer). Warm → subtract (plays shorter).
 */
function tempAdjYds(delta: number): string {
  if (delta === 0) return '—';
  const rounded = delta > 0
    ? -Math.round(delta * 0.075)   // warmer → subtract
    : Math.round(-delta * 0.075);  // colder → add
  if (rounded === 0) return '—';
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function SingleCard({ active, buckets, wedgeMatrix, pills, wx, courseName, roundDate, teeTime }) {
  const WIND_COLS = [15, 10, 5, 5, 10, 15];
  const TEMP_DELTAS = [-30, -20, -10, 0, 10, 20, 30];

  // Shared class fragments
  const sectionHead = 'font-mono text-[7px] uppercase tracking-[0.16em] px-[7px] py-[3px] border-b border-pitch [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:border-gray-200';
  const th = 'font-mono text-[6.5px] uppercase tracking-[0.06em] px-[4px] py-[2px]';
  const td = 'font-mono text-[7.5px] px-[4px] py-[2px] border-t border-pitch/40 print:border-gray-100';

  return (
    <div
      className="flex flex-col bg-obsidian text-foreground border border-pitch overflow-hidden font-body [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:bg-white print:text-black print:border-gray-300"
      style={{ width: '4.5in', minHeight: '6in' }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bg-court border-b-2 border-primary px-[10px] py-[7px] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:bg-gray-100 print:border-primary">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-[13px] uppercase tracking-wide text-chalk leading-tight print:text-black">
              Round Specific <span className="text-primary">Yardage</span> Card
            </h2>
            <div className="font-mono text-[7px] text-cement mt-[1px] leading-tight print:text-gray-500">
              {courseName || 'Course'} · {roundDate}{teeTime ? ` · ${teeTime}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-[3px] justify-end shrink-0">
            {pills.map((p, i) => (
              <span
                key={i}
                className={`font-mono text-[6.5px] uppercase tracking-[0.06em] px-[4px] py-[1px] whitespace-nowrap border ${
                  p.highlight
                    ? 'border-primary/60 text-primary bg-primary/10 print:border-red-400 print:text-red-700 print:bg-red-50'
                    : 'border-cement/30 text-cement print:border-gray-400 print:text-gray-600'
                }`}
              >
                {p.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1">

        {/* Two-column: My Bag | Distance Wedges */}
        <div className="flex border-b border-pitch print:border-gray-200">

          {/* My Bag */}
          <div className="flex flex-col border-r border-pitch print:border-gray-200" style={{ width: '44%' }}>
            <div className={`${sectionHead} bg-shadow text-primary print:bg-gray-50 print:text-gray-700`}>
              ① My Bag
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-shadow/60 print:bg-gray-50">
                  <th className={`${th} text-left text-muted-foreground print:text-gray-500`}>Club</th>
                  <th className={`${th} text-right text-muted-foreground print:text-gray-500`}>Std</th>
                  <th className={`${th} text-right text-primary`}>Adj</th>
                  <th className={`${th} text-right text-muted-foreground print:text-gray-500`}>Dsp</th>
                </tr>
              </thead>
              <tbody>
                {active.map((c, i) => (
                  <tr key={i}>
                    <td className={`${td} text-left font-body text-foreground print:text-black`}>{c.name}</td>
                    <td className={`${td} text-right text-muted-foreground print:text-gray-500`}>{c.std}</td>
                    <td className={`${td} text-right text-primary font-bold`}>{c.adj}</td>
                    <td className={`${td} text-right text-muted-foreground text-[6.5px] print:text-gray-400`}>±{decadeDispersion(c.adj)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Distance Wedges */}
          <div className="flex flex-col flex-1">
            <div className={`${sectionHead} bg-shadow text-bogey print:bg-amber-50 print:text-amber-800`}>
              ② Wedges
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
                {wedgeMatrix.map((row, i) => {
                  const isFullRow = WEDGE_DEFS.some((w) => row[w.id] === 'F');
                  return (
                    <tr key={i}>
                      <td className={`${td} text-left text-bogey font-bold print:text-amber-700`}>{row.yds}</td>
                      {WEDGE_DEFS.map((w) => (
                        <td
                          key={w.id}
                          className={`${td} text-center ${
                            row[w.id] === 'F'
                              ? 'text-foreground font-bold print:text-black'
                              : row[w.id]
                                ? 'text-muted-foreground print:text-gray-500'
                                : 'text-pitch print:text-gray-200'
                          }`}
                        >
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
        <div className="border-b border-pitch print:border-gray-200">
          <div className={`${sectionHead} bg-shadow text-muted-foreground flex items-center gap-1 print:bg-gray-50 print:text-gray-500`}>
            ③ Wind Adjustments
            <span className="normal-case tracking-normal text-[6px]">+ = more club · − = less</span>
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
                {WIND_COLS.map((mph, i) => {
                  const isHead = i < 3;
                  const isFcst = mph === wx.windColMph;
                  return (
                    <th
                      key={i}
                      className={`${th} text-center ${
                        isFcst
                          ? 'bg-primary/20 text-primary font-bold print:bg-red-100 print:text-red-800'
                          : isHead
                            ? 'text-scarlet print:text-red-600'
                            : 'text-c1 print:text-blue-600'
                      }`}
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
                  <td className={`${td} text-left text-muted-foreground print:text-gray-500`}>{b.range}</td>
                  {[15, 10, 5].map((mph) => {
                    const delta = roundToFive(windAdjustment(b.mid, mph, true));
                    const isFcst = mph === wx.windColMph;
                    return (
                      <td
                        key={`h${mph}`}
                        className={`${td} text-center font-bold ${
                          isFcst
                            ? 'bg-primary/10 text-primary print:bg-red-50 print:text-red-700'
                            : 'text-scarlet print:text-red-700'
                        }`}
                      >
                        +{delta}
                      </td>
                    );
                  })}
                  {[5, 10, 15].map((mph) => {
                    const delta = roundToFive(Math.abs(windAdjustment(b.mid, mph, false)));
                    const isFcst = mph === wx.windColMph;
                    return (
                      <td
                        key={`t${mph}`}
                        className={`${td} text-center font-bold ${
                          isFcst
                            ? 'bg-primary/10 text-primary print:bg-red-50 print:text-red-700'
                            : 'text-c1 print:text-blue-700'
                        }`}
                      >
                        −{delta}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ④ Temperature adjustment reference */}
        <div>
          <div className={`${sectionHead} bg-shadow text-c1 flex items-center gap-1 print:bg-blue-50 print:text-blue-700`}>
            ④ Temp Adj from {wx.tempF}°F
            <span className="normal-case tracking-normal text-[6px] text-muted-foreground print:text-gray-400">cold = add · warm = subtract</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-shadow/60 print:bg-gray-50">
                <th className={`${th} text-left text-muted-foreground print:text-gray-500`}>Temp</th>
                {TEMP_DELTAS.map((delta) => (
                  <th
                    key={delta}
                    className={`${th} text-center ${
                      delta === 0
                        ? 'text-muted-foreground print:text-gray-500'
                        : delta < 0
                          ? 'text-c1 print:text-blue-600'
                          : 'text-bogey print:text-amber-600'
                    }`}
                  >
                    {wx.tempF + delta}°
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${td} text-left text-muted-foreground print:text-gray-500`}>Yds adj</td>
                {TEMP_DELTAS.map((delta) => {
                  const adj = tempAdjYds(delta);
                  return (
                    <td
                      key={delta}
                      className={`${td} text-center font-bold ${
                        delta === 0
                          ? 'text-muted-foreground print:text-gray-400'
                          : delta < 0
                            ? 'text-c1 print:text-blue-700'
                            : 'text-bogey print:text-amber-700'
                      }`}
                    >
                      {adj}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="bg-court border-t border-pitch/60 px-[8px] py-[4px] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:bg-gray-50 print:border-gray-200">
        <p className="font-mono text-[6px] text-cement leading-[1.5] print:text-gray-500">
          Adj @ {wx.tempF}°F · {wx.altFt.toLocaleString()} ft · {wx.humidity}% RH · Dsp = DECADE (yds)
        </p>
        <div className="flex gap-[8px] mt-[2px] flex-wrap">
          {[
            { color: 'bg-scarlet',  label: 'Head = longer (+)' },
            { color: 'bg-c1',      label: 'Tail = shorter (−)' },
            { color: 'bg-primary', label: 'Fcst wind col' },
            { color: 'bg-c1',      label: 'Cold = add yds' },
            { color: 'bg-bogey',   label: 'Warm = subtract yds' },
          ].map((item, i) => (
            <span key={i} className="font-mono text-[5.5px] text-cement print:text-gray-500 flex items-center gap-[3px]">
              <span className={`inline-block w-[5px] h-[5px] rounded-sm ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
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
    <>
      {/* Screen preview */}
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mt-12 mb-5">
        Card Preview — Updates as you fill in your bag
      </p>
      <div className="flex flex-row gap-5 p-6 bg-surface border border-border overflow-x-auto justify-center">
        <SingleCard {...cardProps} />
        <SingleCard {...cardProps} />
      </div>

      {/* Print page — single card, hidden on screen, shown when printing */}
      <div id="wyc-print-page" aria-hidden="true">
        <SingleCard {...cardProps} />
      </div>
    </>
  );
}
