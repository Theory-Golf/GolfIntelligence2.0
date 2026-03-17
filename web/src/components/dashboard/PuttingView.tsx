'use client';

/**
 * Putting View - Hero cards, putting by distance table, lag putting section, and all putts table
 */

import { useState } from 'react';
import type { PuttingMetrics, LagPuttingMetrics, ProcessedShot } from '@/lib/golf/types';
import { getStrokeGainedColor, formatStrokesGained, getShotSGColor, chartColors } from '@/lib/golf/tokens';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function PuttingView({ metrics, lagMetrics, filteredShots }: { metrics: PuttingMetrics; lagMetrics: LagPuttingMetrics; filteredShots: ProcessedShot[] }) {
  const {
    totalSGPutting,
    avgSGPutting,
    totalPutts,
    makePct0to4Ft,
    made0to4Ft,
    total0to4Ft,
    totalSG5to12Ft,
    avgSG5to12Ft,
    total5to12Ft,
    poorLagCount,
    totalLagPutts,
    speedRating,
    longPutts,
    totalLongPutts,
    puttingByDistance,
  } = metrics;

  // Helper function for make % color (higher is better)
  const getMakePctColor = (pct: number): string => {
    if (pct >= 90) return 'var(--under)';     // Green - excellent
    if (pct >= 80) return 'var(--bogey)';     // Yellow - average
    return 'var(--double)';                    // Red - needs work
  };

  // Helper for speed rating color (lower is better for speed rating = less long putts)
  const getSpeedRatingColor = (pct: number): string => {
    if (pct <= 10) return 'var(--under)';    // Green - rarely goes long
    if (pct <= 20) return 'var(--bogey)';     // Yellow - sometimes goes long
    return 'var(--double)';                    // Red - too often goes long
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
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Putting Performance</h4>

      {/* Hero Cards - 5 metrics in a grid */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>

        {/* Card 1: Total SG Putting */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG Putting</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(totalSGPutting) }}>
            {formatStrokesGained(totalSGPutting)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Putt</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgSGPutting), fontSize: '12px' }}>
                {formatStrokesGained(avgSGPutting)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Total Putts</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{totalPutts}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Make % 0-4 ft */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Make % 0-4 ft</div>
          </div>
          <div className="value-hero" style={{ color: getMakePctColor(makePct0to4Ft) }}>
            {makePct0to4Ft.toFixed(1)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Made</div>
            <div className="value-stat">
              {made0to4Ft} / {total0to4Ft}
            </div>
          </div>
        </div>

        {/* Card 3: Total SG 5-12 ft */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>SG 5-12 ft</div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(totalSG5to12Ft) }}>
            {formatStrokesGained(totalSG5to12Ft)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Putt</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgSG5to12Ft), fontSize: '12px' }}>
                {formatStrokesGained(avgSG5to12Ft)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Putts</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{total5to12Ft}</div>
            </div>
          </div>
        </div>

        {/* Card 4: Poor Lag */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Poor Lag</div>
          </div>
          <div className="value-hero" style={{ color: poorLagCount > 0 ? 'var(--double)' : 'var(--under)' }}>
            {poorLagCount}
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Total Lag Putts</div>
            <div className="value-stat">
              {totalLagPutts}
            </div>
          </div>
        </div>

        {/* Card 5: Speed Rating */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Speed Rating</div>
          </div>
          <div className="value-hero" style={{ color: getSpeedRatingColor(speedRating) }}>
            {speedRating.toFixed(1)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Long</div>
            <div className="value-stat">
              {longPutts} / {totalLongPutts}
            </div>
          </div>
        </div>

      </div>

      {/* Legend for metrics */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '32px', fontSize: '12px', color: 'var(--ash)' }}>
        <div>
          <strong>Make %:</strong> Higher is better (90%+ = green, 80-90% = yellow, &lt;80% = red)
        </div>
        <div>
          <strong>Speed Rating:</strong> Lower is better (% of lag putts going long)
        </div>
        <div>
          <strong>Poor Lag:</strong> First putts &gt;20ft ending &ge;5ft from hole
        </div>
      </div>

      {/* Putting By Distance Table */}
      {puttingByDistance.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Putting by Distance</h4>
          <div style={{ background: 'var(--charcoal)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', width: '140px' }}>
                      Distance (ft)
                    </th>
                    {puttingByDistance.map(bucket => (
                      <th key={bucket.label} style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', minWidth: '70px' }}>
                        {bucket.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: # of Putts */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      # of Putts
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.totalPutts > 0 ? bucket.totalPutts : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 2: Total Strokes Gained */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Total SG
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: getStrokeGainedColor(bucket.totalStrokesGained), fontFamily: 'var(--font-mono)' }}>
                        {bucket.totalPutts > 0 ? formatStrokesGained(bucket.totalStrokesGained) : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 3: Make % */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Make %
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: bucket.totalPutts > 0 ? getMakePctColor(bucket.makePct) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.totalPutts > 0 ? `${bucket.makePct.toFixed(1)}%` : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 4: # of 3 Putts */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      # of 3 Putts
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: bucket.threePutts > 0 ? 'var(--double)' : 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.threePutts > 0 ? bucket.threePutts : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 5: Speed Ratio (% Long) */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Speed Ratio (% Long)
                    </td>
                    {puttingByDistance.map(bucket => (
                      <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: bucket.totalPutts > 0 ? getSpeedRatingColor(bucket.speedRatio) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                        {bucket.totalPutts > 0 ? `${bucket.speedRatio.toFixed(1)}%` : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Row 6: Proximity of Missed Putts - only for 13-60 ft buckets */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Proximity of Missed Putts
                    </td>
                    {puttingByDistance.map(bucket => {
                      const isLagBucket = bucket.minDistance >= 13;
                      return (
                        <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: isLagBucket && bucket.proximityMissed > 0 ? 'var(--chalk)' : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                          {isLagBucket && bucket.proximityMissed > 0 ? `${bucket.proximityMissed.toFixed(1)} ft` : ''}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row 7: Good Lag % - only for 13-60 ft buckets */}
                  <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Good Lag %
                    </td>
                    {puttingByDistance.map(bucket => {
                      const isLagBucket = bucket.minDistance >= 13;
                      return (
                        <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: isLagBucket && bucket.goodLagPct > 0 ? getGoodLagColor(bucket.goodLagPct) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                          {isLagBucket && bucket.goodLagPct > 0 ? `${bucket.goodLagPct.toFixed(1)}%` : ''}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row 8: Poor Lag % - only for 13-60 ft buckets */}
                  <tr>
                    <td style={{ padding: '8px 12px', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)' }}>
                      Poor Lag %
                    </td>
                    {puttingByDistance.map(bucket => {
                      const isLagBucket = bucket.minDistance >= 13;
                      return (
                        <td key={bucket.label} style={{ padding: '8px 8px', textAlign: 'center', color: isLagBucket && bucket.poorLagPct > 0 ? getPoorLagColor(bucket.poorLagPct) : 'var(--ash)', fontFamily: 'var(--font-mono)' }}>
                          {isLagBucket && bucket.poorLagPct > 0 ? `${bucket.poorLagPct.toFixed(1)}%` : ''}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend for lag metrics */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '32px', fontSize: '11px', color: 'var(--ash)' }}>
            <div>
              <strong>Good Lag %:</strong> Higher is better (% of putts &le;3ft)
            </div>
            <div>
              <strong>Poor Lag %:</strong> Lower is better (% of putts &ge;5ft)
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
      <div style={{
        background: 'var(--obsidian)',
        border: '1px solid var(--pitch)',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600 }}>{data.name} ft</div>
        <div style={{ color: 'var(--ash)' }}>
          {data.value} putts ({data.percentage.toFixed(1)}%)
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
    <div style={{ marginTop: '40px' }}>
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Lag Putting</h4>

      {/* Card and First Chart Row */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>

        {/* Card: Avg. Leave Distance */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Avg. Leave Distance</div>
          </div>
          <div className="value-hero" style={{ color: avgLeaveDistance <= 4 ? 'var(--under)' : avgLeaveDistance <= 8 ? 'var(--bogey)' : 'var(--double)' }}>
            {totalLagPutts > 0 ? `${avgLeaveDistance.toFixed(1)} ft` : '-'}
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Total Lag Putts</div>
            <div className="value-stat">
              {totalLagPutts}
            </div>
          </div>
        </div>

        {/* Chart 1: # 3 Putts - First Putt Starting Distance */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}># 3 Putts: First Putt Starting Distance</div>
          </div>
          {threePuttsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={threePuttsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
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
                  formatter={(value) => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>{value} ft</span>}
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
      <div style={{ marginTop: '16px' }}>
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Leave Distance Distribution - Lag Putts</div>
          </div>
          {leaveDistanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={leaveDistanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
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
                  formatter={(value) => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>{value}</span>}
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
      <div style={{ marginTop: '16px', display: 'flex', gap: '32px', fontSize: '11px', color: 'var(--ash)' }}>
        <div>
          <strong>Leave Distance:</strong> Lower is better (0-4 ft = green, 5-8 ft = yellow, 9-12 ft = red, 13+ ft = scarlet)
        </div>
      </div>
    </div>
  );
}

/**
 * Putts Table Section - Collapsible table showing all putts
 * Columns: Hole, Starting Distance, Ending Distance, Putt Result, SG
 * Grouped by round (date + course), sorted by hole within each round
 */
function PuttsTableSection({ shots }: { shots: ProcessedShot[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter for putts only
  const putts = shots.filter(shot => shot.shotType === 'Putt');

  // Group putts by round (date + course)
  const puttsByRound = putts.reduce((acc, putt) => {
    const key = `${putt.Date}|${putt.Course}`;
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
    <div style={{ marginTop: '32px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'var(--charcoal)',
          border: '1px solid var(--ash)',
          borderRadius: '4px',
          color: 'var(--chalk)',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <span style={{ fontWeight: 600 }}>All Putts</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
          {putts.length} putts • {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {sortedRounds.map(([roundKey, roundPutts]) => {
            const [dateStr, courseStr] = roundKey.split('|');

            return (
              <div key={roundKey} style={{ marginBottom: '16px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: 'var(--chalk)' }}>
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Putts:</strong> {roundPutts.length}</span>
                </div>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Hole</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '14%' }}>Start Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '14%' }}>End Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '14%' }}>Result</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '14%' }}>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundPutts
                      .sort((a, b) => a.Hole - b.Hole)
                      .map((putt, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{putt.Hole}</td>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                            {putt['Starting Distance']}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                            {putt['Ending Distance']}
                          </td>
                          <td style={{
                            padding: '6px',
                            textAlign: 'center',
                            color: putt['Putt Result'] === 'Made' ? 'var(--under)' : putt['Putt Result'] === 'Long' ? 'var(--double)' : 'var(--chalk)',
                            fontWeight: putt['Putt Result'] === 'Made' ? 600 : 400
                          }}>
                            {putt['Putt Result'] || '-'}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', color: getShotSGColor(putt.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>
                            {formatStrokesGained(putt.calculatedStrokesGained)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
