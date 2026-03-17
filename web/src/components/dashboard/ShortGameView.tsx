'use client';

import { useState, useMemo } from 'react';
import type { ShortGameMetrics, ShortGameHeatMapData, ProcessedShot } from '@/lib/golf/types';
import { getStrokeGainedColor, formatStrokesGained, getShotSGColor, chartColors } from '@/lib/golf/tokens';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

/**
 * Short Game Leave Distribution Section - Shows where short game shots finish on the green
 * Buckets: 0-4 ft, 5-8 ft, 9-12 ft, 13-20 ft, 21+ ft, Missed Green
 */
function ShortGameLeaveDistributionSection({ filteredShots }: { filteredShots: ProcessedShot[] }) {
  // Filter to short game shots only
  const shortGameShots = useMemo(() => {
    return filteredShots.filter(shot => shot.shotType === 'Short Game');
  }, [filteredShots]);

  // Calculate leave distribution
  const leaveDistribution = useMemo(() => {
    const totalShots = shortGameShots.length;
    if (totalShots === 0) {
      return {
        buckets: [],
        totalShortGameShots: 0,
      };
    }

    // Initialize bucket counts
    const bucketCounts = {
      '0-4': 0,
      '5-8': 0,
      '9-12': 0,
      '13-20': 0,
      '21+': 0,
      'missed': 0,
    };

    // Categorize each shot
    shortGameShots.forEach(shot => {
      const endingLie = shot['Ending Lie'];
      const endingDistance = shot['Ending Distance'];

      // Check if shot missed the green
      if (endingLie !== 'Green') {
        bucketCounts['missed']++;
        return;
      }

      // Shot is on the green - categorize by distance
      if (endingDistance <= 4) {
        bucketCounts['0-4']++;
      } else if (endingDistance <= 8) {
        bucketCounts['5-8']++;
      } else if (endingDistance <= 12) {
        bucketCounts['9-12']++;
      } else if (endingDistance <= 20) {
        bucketCounts['13-20']++;
      } else {
        bucketCounts['21+']++;
      }
    });

    // Convert to bucket objects with percentages
    const buckets = [
      { label: '0-4 ft', bucket: '0-4', count: bucketCounts['0-4'], percentage: (bucketCounts['0-4'] / totalShots) * 100 },
      { label: '5-8 ft', bucket: '5-8', count: bucketCounts['5-8'], percentage: (bucketCounts['5-8'] / totalShots) * 100 },
      { label: '9-12 ft', bucket: '9-12', count: bucketCounts['9-12'], percentage: (bucketCounts['9-12'] / totalShots) * 100 },
      { label: '13-20 ft', bucket: '13-20', count: bucketCounts['13-20'], percentage: (bucketCounts['13-20'] / totalShots) * 100 },
      { label: '21+ ft', bucket: '21+', count: bucketCounts['21+'], percentage: (bucketCounts['21+'] / totalShots) * 100 },
      { label: 'Missed Green', bucket: 'missed', count: bucketCounts['missed'], percentage: (bucketCounts['missed'] / totalShots) * 100 },
    ];

    return { buckets, totalShortGameShots: totalShots };
  }, [shortGameShots]);

  // Colors for each bucket
  const BUCKET_COLORS: Record<string, string> = {
    '0-4': '#22C55E', '5-8': '#4ADE80', '9-12': '#FACC15', '13-20': '#FB923C', '21+': '#F87171', 'missed': '#EF4444',
  };

  const LeaveTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof leaveDistribution.buckets[0] }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px', padding: '12px' }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>{data.label}</div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>Count: <span style={{ color: 'var(--chalk)' }}>{data.count}</span></div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>Percentage: <span style={{ color: 'var(--chalk)' }}>{data.percentage.toFixed(1)}%</span></div>
      </div>
    );
  };

  if (leaveDistribution.buckets.length === 0 || leaveDistribution.totalShortGameShots === 0) return null;

  return (
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Leave Distribution</h4>
      <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '16px' }}>Where short game shots finish on the green ({leaveDistribution.totalShortGameShots} total shots)</p>
      <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={leaveDistribution.buckets} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} />
            <XAxis dataKey="label" stroke="var(--ash)" tick={{ fill: 'var(--ash)', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
            <YAxis stroke="var(--ash)" tick={{ fill: 'var(--ash)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <Tooltip content={<LeaveTooltip />} />
            <Bar dataKey="percentage" name="% of Shots" radius={[4, 4, 0, 0]}>
              {leaveDistribution.buckets.map((entry) => (
                <Cell key={`cell-${entry.bucket}`} fill={BUCKET_COLORS[entry.bucket] || chartColors[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--ash)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#22C55E', borderRadius: '2px' }}></div><span>0-4 ft (Best)</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#4ADE80', borderRadius: '2px' }}></div><span>5-8 ft</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#FACC15', borderRadius: '2px' }}></div><span>9-12 ft</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#FB923C', borderRadius: '2px' }}></div><span>13-20 ft</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#F87171', borderRadius: '2px' }}></div><span>21+ ft</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#EF4444', borderRadius: '2px' }}></div><span>Missed Green</span></div>
      </div>
    </div>
  );
}

/**
 * Short Game Table Section - Collapsible table showing all short game shots
 */
function ShortGameTableSection({ filteredShots }: { filteredShots: ProcessedShot[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shortGameShots = useMemo(() => filteredShots.filter(shot => shot.shotType === 'Short Game'), [filteredShots]);
  const shortGameByRound = shortGameShots.reduce((acc, shot) => {
    const key = `${shot.Date}|${shot.Course}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(shot);
    return acc;
  }, {} as Record<string, ProcessedShot[]>);
  const sortedRounds = Object.entries(shortGameByRound).sort((a, b) => b[0].split('|')[0].localeCompare(a[0].split('|')[0]));

  if (shortGameShots.length === 0) return null;

  return (
    <div style={{ marginTop: '32px' }}>
      <button onClick={() => setIsExpanded(!isExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--charcoal)', border: '1px solid var(--ash)', borderRadius: '4px', color: 'var(--chalk)', cursor: 'pointer', fontSize: '14px' }}>
        <span style={{ fontWeight: 600 }}>All Short Game Shots</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>{shortGameShots.length} short game shots • {isExpanded ? '▲' : '▼'}</span>
      </button>
      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {sortedRounds.map(([roundKey, roundShots]) => {
            const [dateStr, courseStr] = roundKey.split('|');
            return (
              <div key={roundKey} style={{ marginBottom: '16px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: 'var(--chalk)' }}>
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Short Game Shots:</strong> {roundShots.length}</span>
                </div>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '6%' }}>Shot</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '6%' }}>Hole</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Start Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Start Lie</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>End Dist</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '12%' }}>End Lie</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '8%' }}>Penalty</th>
                      <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundShots.sort((a, b) => a.Hole - b.Hole || a.Shot - b.Shot).map((shot, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                        <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{shot.Shot}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{shot.Hole}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>{shot['Starting Distance']}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{shot['Starting Lie']}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>{shot['Ending Distance']}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{shot['Ending Lie']}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: shot.Penalty === 'Yes' ? 'var(--scarlet)' : 'transparent' }}>{shot.Penalty === 'Yes' ? 'Yes' : ''}</td>
                        <td style={{ padding: '6px', textAlign: 'center', color: getShotSGColor(shot.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>{formatStrokesGained(shot.calculatedStrokesGained)}</td>
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

// Short Game Heat Map Section Component
function ShortGameHeatMapSection({ data }: { data: ShortGameHeatMapData }) {
  const [sgDisplayMode, setSgDisplayMode] = useState<'total' | 'perRound'>('total');

  const getHeatMapColor = (sgValue: number): string => {
    if (sgValue > 0.5) return 'rgba(34, 197, 94, 0.7)';
    if (sgValue > 0.2) return 'rgba(74, 222, 128, 0.5)';
    if (sgValue > 0) return 'rgba(187, 247, 208, 0.3)';
    if (sgValue > -0.2) return 'rgba(254, 226, 226, 0.3)';
    if (sgValue > -0.5) return 'rgba(252, 165, 165, 0.5)';
    return 'rgba(239, 68, 68, 0.7)';
  };

  const getCellData = (lie: string, distanceBucket: string) => {
    return data.cells.find(c => c.lie === lie && c.distanceBucket === distanceBucket);
  };

  const getSgValue = (cell: typeof data.cells[0] | undefined) => {
    if (!cell) return 0;
    return sgDisplayMode === 'total' ? cell.strokesGained : cell.sgPerRound;
  };

  const columnTotals = data.distanceBuckets.map(bucket => {
    const bucketCells = data.cells.filter(c => c.distanceBucket === bucket);
    return {
      bucket,
      totalShots: bucketCells.reduce((sum, c) => sum + c.totalShots, 0),
      strokesGained: bucketCells.reduce((sum, c) => sum + c.strokesGained, 0),
    };
  });

  const grandTotal = {
    totalShots: data.cells.reduce((sum, c) => sum + c.totalShots, 0),
    strokesGained: data.cells.reduce((sum, c) => sum + c.strokesGained, 0),
  };

  return (
    <>
      <h4 style={{ marginTop: '32px', marginBottom: '16px', color: 'var(--ash)' }}>Short Game Heat Map</h4>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            name="sgDisplayModeShortGame"
            value="total"
            checked={sgDisplayMode === 'total'}
            onChange={() => setSgDisplayMode('total')}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--ash)' }}>Total SG</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            name="sgDisplayModeShortGame"
            value="perRound"
            checked={sgDisplayMode === 'perRound'}
            onChange={() => setSgDisplayMode('perRound')}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--ash)' }}>SG per Round</span>
        </label>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Starting Lie</th>
              {data.distanceBuckets.map(bucket => (
                <th key={bucket} style={{ padding: '12px', textAlign: 'center', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>{bucket}</th>
              ))}
              <th style={{ padding: '12px', textAlign: 'center', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lies.map(lie => {
              const rowCells = data.cells.filter(c => c.lie === lie);
              const rowTotal = {
                totalShots: rowCells.reduce((sum, c) => sum + c.totalShots, 0),
                strokesGained: rowCells.reduce((sum, c) => sum + c.strokesGained, 0),
              };

              return (
                <tr key={lie}>
                  <td style={{ padding: '12px', fontWeight: '600', color: 'var(--scarlet)', borderBottom: '1px solid var(--border)' }}>{lie}</td>
                  {data.distanceBuckets.map(bucket => {
                    const cell = getCellData(lie, bucket);
                    const hasShots = cell && cell.totalShots > 0;
                    const sgValue = getSgValue(cell);

                    return (
                      <td key={`${lie}-${bucket}`} style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)', backgroundColor: hasShots ? getHeatMapColor(sgValue) : 'transparent', minWidth: '100px' }}>
                        {hasShots && <div style={{ fontWeight: '600', fontSize: '14px' }}>{cell.totalShots}</div>}
                        {hasShots && <div style={{ fontSize: '11px', color: getStrokeGainedColor(sgValue), marginTop: '2px' }}>{formatStrokesGained(sgValue)}</div>}
                      </td>
                    );
                  })}
                  <td style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontWeight: '600' }}>
                    {rowTotal.totalShots > 0 && (
                      <>
                        <div style={{ fontSize: '14px' }}>{rowTotal.totalShots}</div>
                        <div style={{ fontSize: '11px', color: getStrokeGainedColor(sgDisplayMode === 'total' ? rowTotal.strokesGained : (data.totalRounds > 0 ? rowTotal.strokesGained / data.totalRounds : 0)), marginTop: '2px' }}>
                          {formatStrokesGained(sgDisplayMode === 'total' ? rowTotal.strokesGained : (data.totalRounds > 0 ? rowTotal.strokesGained / data.totalRounds : 0))}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ padding: '12px', fontWeight: '700', color: 'var(--ash)', borderBottom: '2px solid var(--border)' }}>Total</td>
              {columnTotals.map(col => {
                const sgValue = sgDisplayMode === 'total' ? col.strokesGained : (data.totalRounds > 0 ? col.strokesGained / data.totalRounds : 0);
                return (
                  <td key={`total-${col.bucket}`} style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '2px solid var(--border)', fontWeight: '600' }}>
                    {col.totalShots > 0 && (
                      <>
                        <div style={{ fontSize: '14px' }}>{col.totalShots}</div>
                        <div style={{ fontSize: '11px', color: getStrokeGainedColor(sgValue), marginTop: '2px' }}>{formatStrokesGained(sgValue)}</div>
                      </>
                    )}
                  </td>
                );
              })}
              <td style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '2px solid var(--border)', backgroundColor: 'var(--bg-tertiary)', fontWeight: '700' }}>
                {grandTotal.totalShots > 0 && (
                  <>
                    <div style={{ fontSize: '14px' }}>{grandTotal.totalShots}</div>
                    <div style={{ fontSize: '11px', color: getStrokeGainedColor(sgDisplayMode === 'total' ? grandTotal.strokesGained : (data.totalRounds > 0 ? grandTotal.strokesGained / data.totalRounds : 0)), marginTop: '2px' }}>
                      {formatStrokesGained(sgDisplayMode === 'total' ? grandTotal.strokesGained : (data.totalRounds > 0 ? grandTotal.strokesGained / data.totalRounds : 0))}
                    </div>
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ash)', fontSize: '12px' }}>Color scale:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(239, 68, 68, 0.7)' }}></div>
          <span style={{ color: 'var(--ash)', fontSize: '11px' }}>Strong negative</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(254, 226, 226, 0.3)' }}></div>
          <span style={{ color: 'var(--ash)', fontSize: '11px' }}>Slight negative</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(187, 247, 208, 0.3)' }}></div>
          <span style={{ color: 'var(--ash)', fontSize: '11px' }}>Slight positive</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(34, 197, 94, 0.7)' }}></div>
          <span style={{ color: 'var(--ash)', fontSize: '11px' }}>Strong positive</span>
        </div>
      </div>
    </>
  );
}

/**
 * Short Game View - Hero cards for short game metrics
 * - Total SG Short Game
 * - <= 8ft from Fairway - % of short game shots from Fairway that end on green within 8 feet
 * - <= 8ft from Rough - % of short game shots from Rough that end on green within 8 feet
 * - <= 8ft from Sand - % of short game shots from Sand that end on green within 8 feet
 */
export function ShortGameView({ metrics, shortGameHeatMapData, filteredShots }: { metrics: ShortGameMetrics; shortGameHeatMapData: ShortGameHeatMapData; filteredShots: ProcessedShot[] }) {
  const {
    shortGameSG,
    avgShortGameSG,
    positiveSGPct,
    within8FeetFairwayPct,
    within8FeetFairwayCount,
    totalShortGameFairway,
    within8FeetRoughPct,
    within8FeetRoughCount,
    totalShortGameRough,
    within8FeetSandPct,
    within8FeetSandCount,
    totalShortGameSand,
  } = metrics;

  // Get color for proximity percentage (higher is better)
  // Using a simple threshold: >50% green, 30-50% yellow, <30% red
  const getProximityColor = (pct: number): string => {
    if (pct >= 50) return 'var(--under)';    // Green
    if (pct >= 30) return 'var(--bogey)';    // Yellow
    return 'var(--double)';                   // Red
  };

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Short Game Performance</h4>

      {/* Hero Cards - 4 metrics */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>

        {/* Card 1: Total SG - Short Game */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(shortGameSG) }}>
            {formatStrokesGained(shortGameSG)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Shot</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgShortGameSG) }}>
                {formatStrokesGained(avgShortGameSG)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>+ Short Game</div>
              <div className="value-stat">{positiveSGPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Card 2: <= 8ft from Fairway */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>&lt;= 8ft Fairway</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(within8FeetFairwayPct) }}>
            {within8FeetFairwayPct.toFixed(1)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>
              {within8FeetFairwayCount} / {totalShortGameFairway} shots
            </div>
          </div>
        </div>

        {/* Card 3: <= 8ft from Rough */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>&lt;= 8ft Rough</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(within8FeetRoughPct) }}>
            {within8FeetRoughPct.toFixed(1)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>
              {within8FeetRoughCount} / {totalShortGameRough} shots
            </div>
          </div>
        </div>

        {/* Card 4: <= 8ft from Sand */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>&lt;= 8ft Sand</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(within8FeetSandPct) }}>
            {within8FeetSandPct.toFixed(1)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>
              {within8FeetSandCount} / {totalShortGameSand} shots
            </div>
          </div>
        </div>

      </div>

      {/* Legend for proximity colors */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '11px', color: 'var(--ash)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--under)', borderRadius: '2px' }}></div>
          <span>50%+ (Good)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--bogey)', borderRadius: '2px' }}></div>
          <span>30-50% (Average)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--double)', borderRadius: '2px' }}></div>
          <span>&lt;30% (Needs Work)</span>
        </div>
      </div>

      {/* Short Game Heat Map Section */}
      <ShortGameHeatMapSection data={shortGameHeatMapData} />

      {/* Short Game Leave Distribution Section */}
      <ShortGameLeaveDistributionSection filteredShots={filteredShots} />

      {/* Short Game Table Section */}
      <ShortGameTableSection filteredShots={filteredShots} />
    </div>
  );
}
