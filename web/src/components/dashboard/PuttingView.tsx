'use client';

/**
 * Putting View - Hero cards, putting by distance table, lag putting section, and all putts table
 */

import { useState } from 'react';
import type { PuttingMetrics, LagPuttingMetrics, ProcessedShot } from '@/lib/golf/types';
import { classifyLagOutcome } from '@/lib/golf/calculations';
import { getStrokeGainedColor, formatStrokesGained, getShotSGColor, chartColors } from '@/lib/golf/tokens';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

export function PuttingView({ metrics, lagMetrics, filteredShots }: { metrics: PuttingMetrics; lagMetrics: LagPuttingMetrics; filteredShots: ProcessedShot[] }) {
  const {
    totalSGPutting,
    avgSGPutting,
    totalPutts,
    makePct0to4Ft,
    benchmarkMakePct0to4Ft,
    made0to4Ft,
    total0to4Ft,
    totalSG5to12Ft,
    avgSG5to12Ft,
    total5to12Ft,
    poorLagCount,
    totalLagPutts,
    speedRating,
    longPutts,
    classifiedLongShort,
    puttingByDistance,
  } = metrics;

  // Make % color, judged against the selected benchmark's expected make rate at
  // the distances actually faced rather than one flat scale for every bucket.
  // The yellow band narrows as the benchmark approaches either 0% or 100%, so a
  // 3-point drop matters at 94% but not at 40%.
  const getMakePctColor = (pct: number, benchmarkPct: number): string => {
    // Beyond ~40 ft even Tour makes ~3%; there is no fair verdict to render.
    if (benchmarkPct < 5) return 'var(--ash)';
    if (pct >= benchmarkPct) return 'var(--under)';
    const band = Math.max(3, 0.25 * Math.min(benchmarkPct, 100 - benchmarkPct));
    if (pct >= benchmarkPct - band) return 'var(--bogey)';
    return 'var(--double)';
  };

  // Speed ratio color. The goal is balanced speed - 50% of misses finishing
  // long - so the scale is centered rather than "lower is better".
  const getSpeedRatingColor = (pct: number): string => {
    if (pct >= 40 && pct <= 60) return 'var(--under)';   // Green - balanced
    if (pct >= 30 && pct <= 70) return 'var(--bogey)';   // Yellow - drifting
    return 'var(--double)';                              // Red - consistently short or long
  };

  // Helper for Good Lag % color (higher is better)
  const getGoodLagColor = (pct: number): string => {
    if (pct >= 70) return 'var(--under)';    // Green - excellent
    if (pct >= 50) return 'var(--bogey)';     // Yellow - average
    return 'var(--double)';                    // Red - needs work
  };

  // Helper for Poor Lag % color (lower is better)
  const getPoorLagColor = (pct: number): string => {
    if (pct <= 10) return 'var(--under)';    // Green - excellent
    if (pct <= 25) return 'var(--bogey)';     // Yellow - average
    return 'var(--double)';                    // Red - needs work
  };

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 className="mb-4 text-ash">Putting Performance</h4>

      {/* Hero Cards - 5 metrics in a grid */}
      <div className="grid-cards-5 gap-4" >

        {/* Card 1: Total SG Putting */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG Putting</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(totalSGPutting) }}>
            {formatStrokesGained(totalSGPutting)}
          </div>
          <div className="flex justify-between mt-4 gap-3" >
            <div>
              <div className="label text-ash" >SG / Putt</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgSGPutting), fontSize: 'var(--text-label)' }}>
                {formatStrokesGained(avgSGPutting)}
              </div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >Total Putts</div>
              <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{totalPutts}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Make % 0-4 ft */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >Make % 0-4 ft</div>
          </div>
          <div className="value-hero" style={{ color: getMakePctColor(makePct0to4Ft, benchmarkMakePct0to4Ft) }}>
            {makePct0to4Ft.toFixed(0)}%
          </div>
          <div className="flex justify-between gap-3" style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div>
              <div className="label text-ash" >Made</div>
              <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>
                {made0to4Ft} / {total0to4Ft}
              </div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >Benchmark</div>
              <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>
                {total0to4Ft > 0 ? `${benchmarkMakePct0to4Ft.toFixed(0)}%` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Total SG 5-12 ft */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >SG 5-12 ft</div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(totalSG5to12Ft) }}>
            {formatStrokesGained(totalSG5to12Ft)}
          </div>
          <div className="flex justify-between mt-4 gap-3" >
            <div>
              <div className="label text-ash" >SG / Putt</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgSG5to12Ft), fontSize: 'var(--text-label)' }}>
                {formatStrokesGained(avgSG5to12Ft)}
              </div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >Putts</div>
              <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{total5to12Ft}</div>
            </div>
          </div>
        </div>

        {/* Card 4: Poor Lag */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >Poor Lag</div>
          </div>
          <div className="value-hero" style={{ color: poorLagCount > 0 ? 'var(--double)' : 'var(--under)' }}>
            {poorLagCount}
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >Total Lag Putts</div>
            <div className="value-stat">
              {totalLagPutts}
            </div>
          </div>
        </div>

        {/* Card 5: Speed Rating */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >Speed Rating</div>
          </div>
          <div className="value-hero" style={{ color: speedRating !== null ? getSpeedRatingColor(speedRating) : 'var(--ash)' }}>
            {speedRating !== null ? `${speedRating.toFixed(0)}%` : '-'}
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >Long of misses</div>
            <div className="value-stat">
              {longPutts} / {classifiedLongShort}
            </div>
          </div>
        </div>

      </div>

      {/* Legend for metrics */}
      <div className="mt-6 flex gap-8 text-label text-ash">
        <div>
          <strong>Make %:</strong> Colored against the selected benchmark&rsquo;s expected make rate at each distance
        </div>
        <div>
          <strong>Speed Rating:</strong> % of missed lag putts finishing long &mdash; 50% is the goal (40-60% = green, 30-70% = yellow)
        </div>
        <div>
          <strong>Poor Lag:</strong> First putts &gt;20ft ending &ge;5ft from hole
        </div>
      </div>

      {/* Putting By Distance Table */}
      {puttingByDistance.length > 0 && (
        <div className="mt-8">
          <h4 className="mb-4 text-ash">Putting by Distance</h4>
          <div style={{ background: 'var(--shadow)', borderRadius: '4px', overflow: 'hidden' }}>
            <div className="gi-table-scroll">
              <table style={{ minWidth: '640px', width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <th style={{ padding: 'var(--spacing-2-5) var(--spacing-3)', textAlign: 'left', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', width: '140px' }}>
                      Distance (ft)
                    </th>
                    {puttingByDistance.map(bucket => (
                      <th key={bucket.label} style={{ padding: 'var(--spacing-2-5) var(--spacing-2)', textAlign: 'center', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', minWidth: '70px' }}>
                        {bucket.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: # of Putts */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      # of Putts
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.totalPutts > 0 ? bucket.totalPutts : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 2: Total Strokes Gained */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Total SG
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: getStrokeGainedColor(bucket.totalStrokesGained), fontFamily: 'var(--font-mono)' }}>
                        {bucket.totalPutts > 0 ? formatStrokesGained(bucket.totalStrokesGained) : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 3: Make % */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Make %
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td
 key={bucket.label}
 title={bucket.totalPutts > 0 ? `Benchmark ${bucket.benchmarkMakePct.toFixed(0)}%` : undefined}
 style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: bucket.totalPutts > 0 ? getMakePctColor(bucket.makePct, bucket.benchmarkMakePct) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}
                      >
                        {bucket.totalPutts > 0 ? `${bucket.makePct.toFixed(0)}%` : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 3b: Benchmark Make % */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--ash)', fontWeight: 400, background: 'var(--obsidian)', fontSize: 'var(--text-label)' }}>
                      Benchmark Make %
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: 'var(--ash)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)' }}>
                        {bucket.totalPutts > 0 ? `${bucket.benchmarkMakePct.toFixed(0)}%` : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 4: # of 3 Putts */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      # of 3 Putts
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: bucket.threePutts > 0 ? 'var(--double)' : 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.threePutts > 0 ? bucket.threePutts : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 5: Speed Ratio (% Long) */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Speed Ratio (% Long of misses)
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: bucket.speedRatio !== null ? getSpeedRatingColor(bucket.speedRatio) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.speedRatio !== null ? `${bucket.speedRatio.toFixed(0)}%` : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 6: Proximity of Missed Putts - only for 13-60 ft buckets */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Proximity of Missed Putts
                    </td>
                    {puttingByDistance.map(bucket => {
                      const isLagBucket = bucket.minDistance >= 13;
                      return (
                        <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: isLagBucket && bucket.proximityMissed > 0 ? 'var(--chalk)' : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                          {isLagBucket && bucket.proximityMissed > 0 ? `${bucket.proximityMissed.toFixed(0)} ft` : ''}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row 7: Good Lag % - only for 13-60 ft buckets */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Good Lag % (&le; 3 ft)
                    </td>
                    {puttingByDistance.map(bucket => {
                      const isLagBucket = bucket.minDistance >= 13;
                      return (
                        <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: isLagBucket && bucket.totalPutts > 0 ? getGoodLagColor(bucket.goodLagPct) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                          {isLagBucket && bucket.totalPutts > 0 ? `${bucket.goodLagPct.toFixed(0)}%` : ''}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row 8: Poor Lag % - only for 13-60 ft buckets */}
                  <tr>
                    <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Poor Lag % (&ge; 5 ft)
                    </td>
                    {puttingByDistance.map(bucket => {
                      const isLagBucket = bucket.minDistance >= 13;
                      return (
                        <td key={bucket.label} style={{ padding: 'var(--spacing-2) var(--spacing-2)', textAlign: 'center', color: isLagBucket && bucket.totalPutts > 0 ? getPoorLagColor(bucket.poorLagPct) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                          {isLagBucket && bucket.totalPutts > 0 ? `${bucket.poorLagPct.toFixed(0)}%` : ''}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Lag Putting Section */}
      <LagPuttingSection metrics={lagMetrics} />

      {/* All Putts Table - Collapsible */}
      <PuttsTableSection shots={filteredShots} />
    </div>
  );
}

/**
 * Lag Putting Section - Card and two donut charts for lag putts (>20 ft)
 */
function LagPuttingSection({ metrics }: { metrics: LagPuttingMetrics }) {
  const isNarrow = useMediaQuery(MOBILE_QUERY);
  const { avgLeaveDistance, totalLagPutts, threePuttsByStartDistance, leaveDistanceDistribution } = metrics;

  // Format data for donut charts
  const threePuttsData = threePuttsByStartDistance.map(item => ({
    name: item.label,
    value: item.count,
    percentage: item.percentage,
  }));

  const leaveDistanceData = leaveDistanceDistribution.map(item => ({
    name: item.label,
    value: item.count,
    percentage: item.percentage,
  }));

  // Custom tooltip for donut charts
  const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof threePuttsData[0] }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{ background: 'var(--obsidian)',
        border: '1px solid var(--pitch)',
        padding: 'var(--spacing-2) var(--spacing-3)',
        borderRadius: '4px',
        fontSize: 'var(--text-label)' }}>
        <div className="text-chalk font-semibold">{data.name} ft</div>
        <div className="text-ash">
          {data.value} putts ({data.percentage.toFixed(0)}%)
        </div>
      </div>
    );
  };

  // Helper for leave distance color (lower is better)
  const getLeaveDistanceColor = (label: string): string => {
    if (label === '0-4') return 'var(--under)';
    if (label === '5-8') return 'var(--bogey)';
    if (label === '9-12') return 'var(--double)';
    return 'var(--scarlet)';
  };

  return (
    <div className="mt-10">
      {/* Section Heading */}
      <h4 className="mb-4 text-ash">Lag Putting</h4>

      {/* Card and First Chart Row */}
      <div className="grid-cards-2 gap-4" >

        {/* Card: Avg. Leave Distance */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >Avg. Leave Distance</div>
          </div>
          <div className="value-hero" style={{ color: avgLeaveDistance <= 4 ? 'var(--under)' : avgLeaveDistance <= 8 ? 'var(--bogey)' : 'var(--double)' }}>
            {totalLagPutts > 0 ? `${avgLeaveDistance.toFixed(0)} ft` : '-'}
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >Total Lag Putts</div>
            <div className="value-stat">
              {totalLagPutts}
            </div>
          </div>
        </div>

        {/* Chart 1: # 3 Putts - First Putt Starting Distance */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4" >
            <div className="label text-ash" ># 3 Putts: First Putt Starting Distance</div>
          </div>
          {threePuttsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
 data={threePuttsData}
 cx="50%"
 cy="50%"
 innerRadius="45%"
 outerRadius="72%"
 paddingAngle={2}
 dataKey="value"
 nameKey="name"
                >
                  {threePuttsData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
                <Legend
 verticalAlign="bottom"
 height={36}
 formatter={(value) => <span className="text-ash text-label-sm">{value} ft</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ash)' }}>
              No 3-putt data
            </div>
          )}
        </div>
      </div>

      {/* Chart 2: Leave Distance Distribution */}
      <div className="mt-4">
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4" >
            <div className="label text-ash" >Leave Distance Distribution - Lag Putts</div>
          </div>
          {leaveDistanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
 data={leaveDistanceData}
 cx="50%"
 cy="50%"
 innerRadius="45%"
 outerRadius="72%"
 paddingAngle={2}
 dataKey="value"
 nameKey="name"
                >
                  {leaveDistanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getLeaveDistanceColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
                <Legend
 verticalAlign="bottom"
 height={36}
 formatter={(value) => <span className="text-ash text-label-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ash)' }}>
              No lag putt data
            </div>
          )}
        </div>
      </div>

      {/* Legend for leave distance chart */}
      <div className="mt-4 flex gap-8 text-label-sm text-ash">
        <div>
          <strong>Leave Distance:</strong> Lower is better (0-4 ft = green, 5-8 ft = yellow, 9-12 ft = red, 13+ ft = scarlet)
        </div>
      </div>
    </div>
  );
}

// Lag Outcome display. Putts inside the lag range are left unrated - they are
// judged on make %, not leave distance.
const LAG_OUTCOME_LABELS: Record<'good' | 'fair' | 'poor' | 'none', string> = {
  good: 'Good Lag',
  fair: 'Fair',
  poor: 'Poor Lag',
  none: '\u2014',
};

const LAG_OUTCOME_COLORS: Record<'good' | 'fair' | 'poor' | 'none', string> = {
  good: 'var(--under)',
  fair: 'var(--bogey)',
  poor: 'var(--double)',
  none: 'var(--ash)',
};

/**
 * Putts Table Section - Collapsible table showing all putts
 * Columns: Hole, Starting Distance, Ending Distance, Putt Result, Lag Outcome, SG
 * Grouped by round (date + course), sorted by hole within each round
 */
function PuttsTableSection({ shots }: { shots: ProcessedShot[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter for putts only
  const putts = shots.filter(shot => shot.shotType === 'Putt');

  // Group putts by round (date + course)
  const puttsByRound = putts.reduce((acc, putt) => {
    const key = `${putt.playedOn}|${putt.courseName}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(putt);
    return acc;
  }, {} as Record<string, ProcessedShot[]>);

  // Sort rounds by date (most recent first)
  const sortedRounds = Object.entries(puttsByRound).sort((a, b) => {
    const dateA = a[0].split('|')[0];
    const dateB = b[0].split('|')[0];
    return dateB.localeCompare(dateA);
  });

  if (putts.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <button
 onClick={() => setIsExpanded(!isExpanded)}
 style={{ display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 'var(--spacing-3) var(--spacing-4)',
          background: 'var(--shadow)',
          border: '1px solid var(--ash)',
          borderRadius: '4px',
          color: 'var(--chalk)',
          cursor: 'pointer',
          fontSize: 'var(--text-body-sm)' }}
      >
        <span className="font-semibold">All Putts</span>
        <span className="text-label text-ash">
          {putts.length} putts • {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4">
          {sortedRounds.map(([roundKey, roundPutts]) => {
            const [dateStr, courseStr] = roundKey.split('|');

            return (
              <div key={roundKey} style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-3)', background: 'var(--shadow)', borderRadius: '4px' }}>
                <div className="flex gap-6 mb-3 text-label text-chalk">
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Putts:</strong> {roundPutts.length}</span>
                </div>
                <div className="gi-table-scroll">
                  <table style={{ minWidth: '520px', width: '100%', fontSize: 'var(--text-caption)', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '9%' }}>Hole</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '13%' }}>Start Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '13%' }}>End Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '13%' }}>Result</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '19%' }}>Lag Outcome</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '13%' }}>SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundPutts
                        .sort((a, b) => a.holeNumber - b.holeNumber)
                        .map((putt, idx) => {
                          const lagOutcome = classifyLagOutcome(putt);
                          return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                            <td className="p-1.5 text-center text-chalk">{putt.holeNumber}</td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {putt.startingDistance}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {putt.endingDistance}
                            </td>
                            <td style={{
                              padding: 'var(--spacing-1-5)',
                              textAlign: 'center',
                              color: putt.endingDistance === 0 ? 'var(--under)' : putt.puttLongShort === 'Long' ? 'var(--double)' : 'var(--chalk)',
                              fontWeight: putt.endingDistance === 0 ? 600 : 400
                            }}>
                              {putt.endingDistance === 0 ? 'Made' : (putt.puttLongShort || '-')}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: LAG_OUTCOME_COLORS[lagOutcome ?? 'none'] }}>
                              {LAG_OUTCOME_LABELS[lagOutcome ?? 'none']}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: getShotSGColor(putt.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>
                              {formatStrokesGained(putt.calculatedStrokesGained)}
                            </td>
                          </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
