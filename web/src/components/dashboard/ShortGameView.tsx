'use client';

import { useState, useMemo } from 'react';
import type { ShortGameMetrics, ShortGameHeatMapData, ProcessedShot } from '@/lib/golf/types';
import type { Lie } from '@/lib/golf/db/types';
import { getStrokeGainedColor, formatStrokesGained, getShotSGColor } from '@/lib/golf/tokens';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

// Colors for starting lie - shared convention with other lie-based charts in the app
const STARTING_LIE_COLORS: Record<Lie, string> = {
  'Fairway': '#10B981',    // Emerald
  'Rough': '#A855F7',      // Court Purple
  'Sand': '#D4F000',       // Volt
  'Recovery': '#06C8E0',   // Aqua
  'Tee': '#3D8EF0',        // Royal Blue
  'Green': '#F03DAA',      // Magenta
};

// Fixed display order for starting lies (only lies present in the data are shown)
const STARTING_LIE_ORDER: Lie[] = ['Fairway', 'Rough', 'Sand', 'Recovery', 'Tee', 'Green'];

const LEAVE_BUCKET_DEFS: Array<{ key: string; label: string }> = [
  { key: '0-4', label: '0-4 ft' },
  { key: '5-8', label: '5-8 ft' },
  { key: '9-12', label: '9-12 ft' },
  { key: '13-20', label: '13-20 ft' },
  { key: '21+', label: '21+ ft' },
  { key: 'missed', label: 'Missed Green' },
];

function getLeaveBucket(shot: ProcessedShot): string {
  if (shot.endingLie !== 'Green') return 'missed';
  const d = shot.endingDistance;
  if (d <= 4) return '0-4';
  if (d <= 8) return '5-8';
  if (d <= 12) return '9-12';
  if (d <= 20) return '13-20';
  return '21+';
}

/**
 * Short Game Leave Distribution Section - Shows where short game shots finish on the green,
 * stacked by starting lie so it's visible whether a given lie tends to leave shots closer.
 * Buckets: 0-4 ft, 5-8 ft, 9-12 ft, 13-20 ft, 21+ ft, Missed Green
 */
function ShortGameLeaveDistributionSection({ filteredShots }: { filteredShots: ProcessedShot[] }) {
  const isNarrow = useMediaQuery(MOBILE_QUERY);
  // Filter to short game shots only
  const shortGameShots = useMemo(() => {
    return filteredShots.filter(shot => shot.shotType === 'Short Game');
  }, [filteredShots]);

  // Calculate leave distribution, stacked by starting lie
  const leaveDistribution = useMemo(() => {
    const totalShots = shortGameShots.length;
    if (totalShots === 0) {
      return { buckets: [], lies: [] as Lie[], totalShortGameShots: 0 };
    }

    // Determine which starting lies are actually present, in fixed order
    const liesPresent = new Set(shortGameShots.map(shot => shot.startingLie));
    const lies = STARTING_LIE_ORDER.filter(lie => liesPresent.has(lie));

    // count[bucket][lie] = number of shots
    const counts: Record<string, Record<string, number>> = {};
    LEAVE_BUCKET_DEFS.forEach(({ key }) => {
      counts[key] = {};
      lies.forEach(lie => { counts[key][lie] = 0; });
    });

    shortGameShots.forEach(shot => {
      const bucket = getLeaveBucket(shot);
      counts[bucket][shot.startingLie] = (counts[bucket][shot.startingLie] || 0) + 1;
    });

    const buckets = LEAVE_BUCKET_DEFS.map(({ key, label }) => {
      const bucketCounts = counts[key];
      const bucketTotal = Object.values(bucketCounts).reduce((sum, c) => sum + c, 0);
      const row: Record<string, string | number> = { bucket: key, label, count: bucketTotal, percentage: (bucketTotal / totalShots) * 100 };
      lies.forEach(lie => {
        row[lie] = (bucketCounts[lie] / totalShots) * 100;
        row[`${lie}_count`] = bucketCounts[lie];
      });
      return row;
    });

    return { buckets, lies, totalShortGameShots: totalShots };
  }, [shortGameShots]);

  const LeaveTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Record<string, string | number> }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px', padding: 'var(--spacing-3)' }}>
        <div className="text-chalk font-semibold mb-2">{data.label}</div>
        <div className="text-label text-cement mb-2">Total: <span className="text-chalk">{data.count} shots ({(data.percentage as number).toFixed(0)}%)</span></div>
        {leaveDistribution.lies.map(lie => {
          const lieCount = (data[`${lie}_count`] as number) || 0;
          if (lieCount === 0) return null;
          return (
            <div key={lie} style={{ fontSize: 'var(--text-label)', color: 'var(--cement)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1-5)', marginTop: '2px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: STARTING_LIE_COLORS[lie] }}></div>
              {lie}: <span className="text-chalk">{lieCount} shots ({(data[lie] as number / (data.percentage as number) * 100 || 0).toFixed(0)}% of bucket)</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (leaveDistribution.buckets.length === 0 || leaveDistribution.totalShortGameShots === 0) return null;

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-ash">Leave Distribution by Starting Lie</h4>
      <p className="text-label text-ash mb-4">Where short game shots finish on the green, broken down by starting lie ({leaveDistribution.totalShortGameShots} total shots)</p>
      <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height={isNarrow ? 260 : 340}>
          <BarChart data={leaveDistribution.buckets} margin={isNarrow ? { top: 12, right: 8, left: 0, bottom: 8 } : { top: 20, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} />
            <XAxis dataKey="label" stroke="var(--ash)" tick={{ fill: 'var(--ash)', fontSize: isNarrow ? 9 : 12 }} interval={isNarrow ? 'preserveStartEnd' : 0} minTickGap={isNarrow ? 20 : 0} angle={isNarrow ? 0 : -45} textAnchor={isNarrow ? 'middle' : 'end'} height={isNarrow ? 24 : 60} />
            <YAxis stroke="var(--ash)" tick={{ fill: 'var(--ash)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <Tooltip content={<LeaveTooltip />} />
            <Legend wrapperStyle={{ fontSize: 'var(--text-label-sm)', color: 'var(--ash)' }} />
            {leaveDistribution.lies.map(lie => (
              <Bar key={lie} dataKey={lie} name={lie} stackId="lie" fill={STARTING_LIE_COLORS[lie]} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
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
    const key = `${shot.playedOn}|${shot.courseName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(shot);
    return acc;
  }, {} as Record<string, ProcessedShot[]>);
  const sortedRounds = Object.entries(shortGameByRound).sort((a, b) => b[0].split('|')[0].localeCompare(a[0].split('|')[0]));

  if (shortGameShots.length === 0) return null;

  return (
    <div className="mt-8">
      <button onClick={() => setIsExpanded(!isExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 'var(--spacing-3) var(--spacing-4)', background: 'var(--shadow)', border: '1px solid var(--ash)', borderRadius: '4px', color: 'var(--chalk)', cursor: 'pointer', fontSize: 'var(--text-body-sm)' }}>
        <span className="font-semibold">All Short Game Shots</span>
        <span className="text-label text-ash">{shortGameShots.length} short game shots • {isExpanded ? '▲' : '▼'}</span>
      </button>
      {isExpanded && (
        <div className="mt-4">
          {sortedRounds.map(([roundKey, roundShots]) => {
            const [dateStr, courseStr] = roundKey.split('|');
            return (
              <div key={roundKey} style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-3)', background: 'var(--shadow)', borderRadius: '4px' }}>
                <div className="flex gap-6 mb-3 text-label text-chalk">
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Short Game Shots:</strong> {roundShots.length}</span>
                </div>
                <div className="gi-table-scroll">
                  <table style={{ minWidth: '660px', width: '100%', fontSize: 'var(--text-caption)', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '6%' }}>Shot</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '6%' }}>Hole</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '10%' }}>Start Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '10%' }}>Start Lie</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '10%' }}>End Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '12%' }}>End Lie</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '8%' }}>Penalty</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '10%' }}>SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundShots.sort((a, b) => a.holeNumber - b.holeNumber || a.shotNumber - b.shotNumber).map((shot, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                          <td className="p-1.5 text-center text-chalk">{shot.shotNumber}</td>
                          <td className="p-1.5 text-center text-chalk">{shot.holeNumber}</td>
                          <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>{shot.startingDistance}</td>
                          <td className="p-1.5 text-center text-chalk">{shot.startingLie}</td>
                          <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>{shot.endingDistance}</td>
                          <td className="p-1.5 text-center text-chalk">{shot.endingLie}</td>
                          <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: shot.hasPenalty ? 'var(--scarlet)' : 'transparent' }}>{shot.hasPenalty ? 'Yes' : ''}</td>
                          <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: getShotSGColor(shot.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>{formatStrokesGained(shot.calculatedStrokesGained)}</td>
                        </tr>
                      ))}
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
      <h4 className="mt-8 mb-4 text-ash">Short Game Heat Map</h4>

      <div className="mb-4 flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
 type="radio"
 name="sgDisplayModeShortGame"
 value="total"
 checked={sgDisplayMode === 'total'}
 onChange={() => setSgDisplayMode('total')}
 className="cursor-pointer"
          />
          <span className="text-ash">Total SG</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
 type="radio"
 name="sgDisplayModeShortGame"
 value="perRound"
 checked={sgDisplayMode === 'perRound'}
 onChange={() => setSgDisplayMode('perRound')}
 className="cursor-pointer"
          />
          <span className="text-ash">SG per Round</span>
        </label>
      </div>

      <div className="gi-table-scroll">
        <table className="gi-sticky-col" style={{ minWidth: '640px', width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)' }}>
          <thead>
            <tr>
              <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Starting Lie</th>
              {data.distanceBuckets.map(bucket => (
                <th key={bucket} style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>{bucket}</th>
              ))}
              <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>Total</th>
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
                  <td style={{ padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--scarlet)', borderBottom: '1px solid var(--border)' }}>{lie}</td>
                  {data.distanceBuckets.map(bucket => {
                    const cell = getCellData(lie, bucket);
                    const hasShots = cell && cell.totalShots > 0;
                    const sgValue = getSgValue(cell);

                    return (
                      <td key={`${lie}-${bucket}`} style={{ padding: 'var(--spacing-3) var(--spacing-2)', textAlign: 'center', borderBottom: '1px solid var(--border)', backgroundColor: hasShots ? getHeatMapColor(sgValue) : 'transparent', minWidth: '100px' }}>
                        {hasShots && <div className="font-semibold text-body-sm">{cell.totalShots}</div>}
                        {hasShots && <div style={{ fontSize: 'var(--text-label-sm)', color: getStrokeGainedColor(sgValue), marginTop: '2px' }}>{formatStrokesGained(sgValue)}</div>}
                      </td>
                    );
                  })}
                  <td style={{ padding: 'var(--spacing-3) var(--spacing-2)', textAlign: 'center', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontWeight: '600' }}>
                    {rowTotal.totalShots > 0 && (
                      <>
                        <div className="text-body-sm">{rowTotal.totalShots}</div>
                        <div style={{ fontSize: 'var(--text-label-sm)', color: getStrokeGainedColor(sgDisplayMode === 'total' ? rowTotal.strokesGained : (data.totalRounds > 0 ? rowTotal.strokesGained / data.totalRounds : 0)), marginTop: '2px' }}>
                          {formatStrokesGained(sgDisplayMode === 'total' ? rowTotal.strokesGained : (data.totalRounds > 0 ? rowTotal.strokesGained / data.totalRounds : 0))}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ padding: 'var(--spacing-3)', fontWeight: '700', color: 'var(--ash)', borderBottom: '2px solid var(--border)' }}>Total</td>
              {columnTotals.map(col => {
                const sgValue = sgDisplayMode === 'total' ? col.strokesGained : (data.totalRounds > 0 ? col.strokesGained / data.totalRounds : 0);
                return (
                  <td key={`total-${col.bucket}`} style={{ padding: 'var(--spacing-3) var(--spacing-2)', textAlign: 'center', borderBottom: '2px solid var(--border)', fontWeight: '600' }}>
                    {col.totalShots > 0 && (
                      <>
                        <div className="text-body-sm">{col.totalShots}</div>
                        <div style={{ fontSize: 'var(--text-label-sm)', color: getStrokeGainedColor(sgValue), marginTop: '2px' }}>{formatStrokesGained(sgValue)}</div>
                      </>
                    )}
                  </td>
                );
              })}
              <td style={{ padding: 'var(--spacing-3) var(--spacing-2)', textAlign: 'center', borderBottom: '2px solid var(--border)', backgroundColor: 'var(--bg-tertiary)', fontWeight: '700' }}>
                {grandTotal.totalShots > 0 && (
                  <>
                    <div className="text-body-sm">{grandTotal.totalShots}</div>
                    <div style={{ fontSize: 'var(--text-label-sm)', color: getStrokeGainedColor(sgDisplayMode === 'total' ? grandTotal.strokesGained : (data.totalRounds > 0 ? grandTotal.strokesGained / data.totalRounds : 0)), marginTop: '2px' }}>
                      {formatStrokesGained(sgDisplayMode === 'total' ? grandTotal.strokesGained : (data.totalRounds > 0 ? grandTotal.strokesGained / data.totalRounds : 0))}
                    </div>
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-4 items-center flex-wrap">
        <span className="text-ash text-label">Color scale:</span>
        <div className="flex items-center gap-1">
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(239, 68, 68, 0.7)' }}></div>
          <span className="text-ash text-label-sm">Strong negative</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(254, 226, 226, 0.3)' }}></div>
          <span className="text-ash text-label-sm">Slight negative</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(187, 247, 208, 0.3)' }}></div>
          <span className="text-ash text-label-sm">Slight positive</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(34, 197, 94, 0.7)' }}></div>
          <span className="text-ash text-label-sm">Strong positive</span>
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
      <h4 className="mb-4 text-ash">Short Game Performance</h4>

      {/* Hero Cards - 4 metrics */}
      <div className="grid-cards-4 gap-4" >

        {/* Card 1: Total SG - Short Game */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center mb-4" >
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(shortGameSG) }}>
            {formatStrokesGained(shortGameSG)}
          </div>
          <div className="flex justify-between mt-4" >
            <div>
              <div className="label text-ash" >SG / Shot</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgShortGameSG) }}>
                {formatStrokesGained(avgShortGameSG)}
              </div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >+ Short Game</div>
              <div className="value-stat">{positiveSGPct.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Card 2: <= 8ft from Fairway */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4" >
            <div className="label text-ash" >&lt;= 8ft Fairway</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(within8FeetFairwayPct) }}>
            {within8FeetFairwayPct.toFixed(0)}%
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >
              {within8FeetFairwayCount} / {totalShortGameFairway} shots
            </div>
          </div>
        </div>

        {/* Card 3: <= 8ft from Rough */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4" >
            <div className="label text-ash" >&lt;= 8ft Rough</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(within8FeetRoughPct) }}>
            {within8FeetRoughPct.toFixed(0)}%
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >
              {within8FeetRoughCount} / {totalShortGameRough} shots
            </div>
          </div>
        </div>

        {/* Card 4: <= 8ft from Sand */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4" >
            <div className="label text-ash" >&lt;= 8ft Sand</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(within8FeetSandPct) }}>
            {within8FeetSandPct.toFixed(0)}%
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >
              {within8FeetSandCount} / {totalShortGameSand} shots
            </div>
          </div>
        </div>

      </div>

      {/* Legend for proximity colors */}
      <div className="mt-4 flex gap-6 text-label-sm text-ash">
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'var(--under)', borderRadius: '2px' }}></div>
          <span>50%+ (Good)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'var(--bogey)', borderRadius: '2px' }}></div>
          <span>30-50% (Average)</span>
        </div>
        <div className="flex items-center gap-1.5">
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
