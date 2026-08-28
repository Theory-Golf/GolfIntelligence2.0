'use client';

import { useState, useMemo, type CSSProperties } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getStrokeGainedColor, formatStrokesGained, getShotSGColor, chartColors } from '@/lib/golf/tokens';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';
import type { ApproachMetrics, ApproachDistanceBucket, ApproachHeatMapData, ProcessedShot } from '@/lib/golf/types';
import { APPROACH_DISTANCE_BUCKETS, getApproachType, getApproachBucketRange, type ApproachTypeLabel } from '@/lib/golf/approachBuckets';

// Get color for green hit percentage
function getGreenHitPctColor(pct: number): string {
  if (pct >= 50) return 'var(--under)';      // Green
  if (pct >= 35) return 'var(--bogey)';      // Yellow
  return 'var(--double)';                     // Red
}

// Get color for proximity (lower is better)
function getProximityColor(proximity: number): string {
  if (proximity <= 30) return 'var(--under)';  // Green
  if (proximity <= 45) return 'var(--bogey)';  // Yellow
  return 'var(--double)';                       // Red
}

export function ApproachView({ metrics, approachByDistance, approachFromRough, approachHeatMapData, filteredShots }: { metrics: ApproachMetrics; approachByDistance: ApproachDistanceBucket[]; approachFromRough: ApproachDistanceBucket[]; approachHeatMapData: ApproachHeatMapData; filteredShots: ProcessedShot[] }) {
  const {
    totalApproaches: _totalApproaches,
    approachSG,
    avgApproachSG,
    positiveSGPct,
    positiveSGCount: _positiveSGCount,
    greenHitPct,
    greenHits: _greenHits,
    greenHitPctFairway,
    greenHitsFairway: _greenHitsFairway,
    totalApproachesFairway: _totalApproachesFairway,
    greenHitPctRough,
    greenHitsRough: _greenHitsRough,
    totalApproachesRough: _totalApproachesRough,
    proximityUnder150,
    proximityUnder150Count: _proximityUnder150Count,
    proximityUnder150OnGreen,
    proximityUnder150OnGreenCount: _proximityUnder150OnGreenCount,
    within20FeetPct,
    within20FeetCount: _within20FeetCount,
    approachesOver150: _approachesOver150,
    approachesUnder150: _approachesUnder150,
    greenHitPctOver150: _greenHitPctOver150,
    greenHitPctUnder150: _greenHitPctUnder150,
  } = metrics;

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Approach Performance</h4>

      {/* Hero Cards - 3 metrics */}
      <div className="grid-cards-3" style={{ gap: '16px' }}>

        {/* Card 1: Total SG Approach */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG Approach</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(approachSG) }}>
            {formatStrokesGained(approachSG)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Shot</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgApproachSG) }}>
                {formatStrokesGained(avgApproachSG)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>+ Approach</div>
              <div className="value-stat">{positiveSGPct.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Card 2: Green Hit % */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Green Hit %</div>
          </div>
          <div className="value-hero" style={{ color: getGreenHitPctColor(greenHitPct) }}>
            {greenHitPct.toFixed(0)}%
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Fairway</div>
              <div className="value-stat" style={{ color: getGreenHitPctColor(greenHitPctFairway) }}>
                {greenHitPctFairway.toFixed(0)}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Rough</div>
              <div className="value-stat" style={{ color: getGreenHitPctColor(greenHitPctRough) }}>
                {greenHitPctRough.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Proximity < 150 */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Proximity &lt; 150yds</div>
          </div>
          <div className="value-hero" style={{ color: getProximityColor(proximityUnder150) }}>
            {proximityUnder150.toFixed(0)} <span style={{ fontSize: '18px' }}>ft</span>
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Prox. on Green</div>
              <div className="value-stat" style={{ color: getProximityColor(proximityUnder150OnGreen) }}>
                {proximityUnder150OnGreen.toFixed(0)} ft
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Within 20ft</div>
              <div className="value-stat" style={{ color: getGreenHitPctColor(within20FeetPct) }}>
                {within20FeetPct.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Approach by Distance Section - all four buckets always shown */}
      <h4 style={{ marginTop: '32px', marginBottom: '16px', color: 'var(--ash)' }}>Approach (Fairway and Tee): Approach Skill</h4>
      <div className="grid-cards-4" style={{ gap: '16px' }}>
        {approachByDistance.map((bucket) => (
          <ApproachBucketCard key={bucket.label} bucket={bucket} />
        ))}
      </div>

      {/* Approach from Rough Section - all four buckets always shown */}
      <h4 style={{ marginTop: '32px', marginBottom: '16px', color: 'var(--ash)' }}>Approach from Rough: Rough Skill</h4>
      <div className="grid-cards-4" style={{ gap: '16px' }}>
        {approachFromRough.map((bucket) => (
          <ApproachBucketCard key={bucket.label} bucket={bucket} />
        ))}
      </div>

      {/* Approach Heat Map Section */}
      <ApproachHeatMapSection data={approachHeatMapData} />

      {/* Approach Ending Lie Section - Two Bar Charts */}
      <ApproachEndingLieSection filteredShots={filteredShots} />

      {/* All Approach Shots Table - Collapsible */}
      <ApproachTableSection shots={filteredShots} />
    </div>
  );
}

/**
 * Approach Bucket Card - one distance band in the Approach Skill / Rough Skill grids.
 * Buckets with no shots still render so all four distance bands are always visible;
 * their values show as em dashes rather than zeros, which would read as measured
 * neutral performance.
 */
function ApproachBucketCard({ bucket }: { bucket: ApproachDistanceBucket }) {
  const hasShots = bucket.totalShots > 0;

  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div className="label" style={{ color: 'var(--scarlet)' }}>{bucket.label}</div>
      </div>
      <div className="label" style={{ color: 'var(--ash)', fontSize: '11px', marginBottom: '12px' }}>
        {bucket.description}
      </div>

      {/* Main Value: SG */}
      <div
        className="value-hero"
        style={{ color: hasShots ? getStrokeGainedColor(bucket.strokesGained) : 'var(--ash)', fontSize: '28px' }}
      >
        {hasShots ? formatStrokesGained(bucket.strokesGained) : '—'}
      </div>
      <div className="label" style={{ color: 'var(--ash)', fontSize: '11px', marginBottom: '16px' }}>
        SG ({bucket.totalShots} {bucket.totalShots === 1 ? 'shot' : 'shots'})
      </div>

      <div className="flex justify-between">
        <div>
          <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Green %</div>
          <div
            className="value-stat"
            style={{ color: hasShots ? getGreenHitPctColor(bucket.greenHitPct) : 'var(--ash)', fontSize: '14px' }}
          >
            {hasShots ? `${bucket.greenHitPct.toFixed(0)}%` : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Prox</div>
          <div
            className="value-stat"
            style={{ color: hasShots ? getProximityColor(bucket.proximity) : 'var(--ash)', fontSize: '14px' }}
          >
            {hasShots ? `${bucket.proximity.toFixed(0)} ft` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Approach Table Section - Collapsible, filterable table of all approach shots.
 * Rows are grouped by round; columns are Hole, Start Dist, Type, Start Lie,
 * End Dist, End Lie, Penalty, SG.
 */
type SGFilter = 'all' | 'negative' | 'positive';

const FILTER_CONTROL_STYLE: CSSProperties = {
  background: 'var(--charcoal)',
  border: '1px solid var(--ash)',
  borderRadius: '4px',
  color: 'var(--chalk)',
  fontSize: '12px',
  padding: '6px 8px',
};

function ApproachTableSection({ shots }: { shots: ProcessedShot[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | ApproachTypeLabel>('all');
  const [sgFilter, setSgFilter] = useState<SGFilter>('all');
  const [lieFilter, setLieFilter] = useState<string>('all');
  const [penaltyOnly, setPenaltyOnly] = useState(false);

  // Filter for approach shots only
  const approaches = useMemo(
    () => shots.filter(shot => shot.shotType === 'Approach'),
    [shots],
  );

  // Only offer lies that actually appear in the data, so there are no dead options
  const availableLies = useMemo(() => {
    const lies = new Set(approaches.map(shot => shot.startingLie));
    return Array.from(lies).sort();
  }, [approaches]);

  const isFiltered = typeFilter !== 'all' || sgFilter !== 'all' || lieFilter !== 'all' || penaltyOnly;

  const clearFilters = () => {
    setTypeFilter('all');
    setSgFilter('all');
    setLieFilter('all');
    setPenaltyOnly(false);
  };

  const filteredApproaches = useMemo(() => {
    return approaches.filter(shot => {
      if (typeFilter !== 'all' && getApproachType(shot.startingDistance) !== typeFilter) return false;
      if (sgFilter === 'negative' && shot.calculatedStrokesGained >= 0) return false;
      if (sgFilter === 'positive' && shot.calculatedStrokesGained <= 0) return false;
      if (lieFilter !== 'all' && shot.startingLie !== lieFilter) return false;
      if (penaltyOnly && !shot.hasPenalty) return false;
      return true;
    });
  }, [approaches, typeFilter, sgFilter, lieFilter, penaltyOnly]);

  // Group the filtered approaches by round (date + course); rounds left with no
  // matching shots drop out of the listing entirely
  const sortedRounds = useMemo(() => {
    const approachesByRound = filteredApproaches.reduce((acc, approach) => {
      const key = `${approach.playedOn}|${approach.courseName}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(approach);
      return acc;
    }, {} as Record<string, ProcessedShot[]>);

    // Sort rounds by date (most recent first)
    return Object.entries(approachesByRound).sort((a, b) => {
      const dateA = a[0].split('|')[0];
      const dateB = b[0].split('|')[0];
      return dateB.localeCompare(dateA);
    });
  }, [filteredApproaches]);

  if (approaches.length === 0) {
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
        <span style={{ fontWeight: 600 }}>All Approach Shots</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
          {isFiltered
            ? `${filteredApproaches.length} of ${approaches.length} approach ${approaches.length === 1 ? 'shot' : 'shots'}`
            : `${approaches.length} approach ${approaches.length === 1 ? 'shot' : 'shots'}`}
          {' • '}{isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {/* Filters */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: '16px',
              marginBottom: '16px',
              padding: '12px',
              background: 'var(--charcoal)',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="approach-type-filter" style={{ fontSize: '11px', color: 'var(--ash)' }}>
                Approach Type
              </label>
              <select
                id="approach-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | ApproachTypeLabel)}
                style={FILTER_CONTROL_STYLE}
              >
                <option value="all">All types</option>
                {APPROACH_DISTANCE_BUCKETS.map(bucket => (
                  <option key={bucket.label} value={bucket.label}>
                    {bucket.label} ({bucket.shortRange})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="approach-sg-filter" style={{ fontSize: '11px', color: 'var(--ash)' }}>
                Strokes Gained
              </label>
              <select
                id="approach-sg-filter"
                value={sgFilter}
                onChange={(e) => setSgFilter(e.target.value as SGFilter)}
                style={FILTER_CONTROL_STYLE}
              >
                <option value="all">All shots</option>
                <option value="negative">Negative SG only</option>
                <option value="positive">Positive SG only</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="approach-lie-filter" style={{ fontSize: '11px', color: 'var(--ash)' }}>
                Starting Lie
              </label>
              <select
                id="approach-lie-filter"
                value={lieFilter}
                onChange={(e) => setLieFilter(e.target.value)}
                style={FILTER_CONTROL_STYLE}
              >
                <option value="all">All lies</option>
                {availableLies.map(lie => (
                  <option key={lie} value={lie}>{lie}</option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ash)', cursor: 'pointer', paddingBottom: '7px' }}>
              <input
                type="checkbox"
                checked={penaltyOnly}
                onChange={(e) => setPenaltyOnly(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Penalty shots only
            </label>

            {isFiltered && (
              <button
                onClick={clearFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--scarlet)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '6px 0',
                  textDecoration: 'underline',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {sortedRounds.length === 0 ? (
            <div style={{ padding: '16px', background: 'var(--charcoal)', borderRadius: '4px', fontSize: '13px', color: 'var(--ash)' }}>
              No approach shots match these filters.
            </div>
          ) : (
            sortedRounds.map(([roundKey, roundApproaches]) => {
              const [dateStr, courseStr] = roundKey.split('|');

              return (
                <div key={roundKey} style={{ marginBottom: '16px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: 'var(--chalk)' }}>
                    <span><strong>Date:</strong> {dateStr}</span>
                    <span><strong>Course:</strong> {courseStr}</span>
                    <span><strong>Approach Shots:</strong> {roundApproaches.length}</span>
                  </div>
                  <div className="gi-table-scroll">
                    <table style={{ minWidth: '680px', width: '100%', fontSize: '13px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '7%' }}>Hole</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>Start Dist</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '20%' }}>Type</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>Start Lie</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>End Dist</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>End Lie</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '9%' }}>Penalty</th>
                          <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '20%' }}>SG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundApproaches
                          .slice()
                          .sort((a, b) => a.holeNumber - b.holeNumber)
                          .map((approach, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{approach.holeNumber}</td>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                                {approach.startingDistance}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>
                                {getApproachType(approach.startingDistance) ?? '—'}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{approach.startingLie}</td>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                                {approach.endingDistance}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{approach.endingLie}</td>
                              <td style={{ padding: '6px', textAlign: 'center', color: approach.hasPenalty ? 'var(--scarlet)' : 'transparent' }}>
                                {approach.hasPenalty ? 'Yes' : ''}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center', color: getShotSGColor(approach.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>
                                {formatStrokesGained(approach.calculatedStrokesGained)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Approach Ending Lie Section - Shows ending lie distribution and SG by ending lie
 */
function ApproachEndingLieSection({ filteredShots }: { filteredShots: ProcessedShot[] }) {
  const isNarrow = useMediaQuery(MOBILE_QUERY);
  // Filter to approach shots only
  const approachShots = useMemo(() => {
    return filteredShots.filter(shot => shot.shotType === 'Approach');
  }, [filteredShots]);

  // Calculate ending lie data
  const endingLieData = useMemo(() => {
    const totalApproaches = approachShots.length;
    if (totalApproaches === 0) return [];

    const lieMap = new Map<string, { count: number; strokesGained: number }>();

    approachShots.forEach(shot => {
      const lie = shot.endingLie || 'Other';
      const existing = lieMap.get(lie) || { count: 0, strokesGained: 0 };
      existing.count += 1;
      existing.strokesGained += shot.calculatedStrokesGained;
      lieMap.set(lie, existing);
    });

    return Array.from(lieMap.entries())
      .map(([lie, data]) => ({
        lie,
        count: data.count,
        percentage: (data.count / totalApproaches) * 100,
        strokesGained: data.strokesGained,
        avgStrokesGained: data.count > 0 ? data.strokesGained / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [approachShots]);

  // Colors for different ending lies
  const LIE_COLORS: Record<string, string> = {
    'Green': '#3D8EF0',      // Royal Blue
    'Fairway': '#10B981',    // Emerald
    'Rough': '#A855F7',      // Court Purple
    'Sand': '#D4F000',        // Volt
    'Recovery': '#06C8E0',   // Aqua
    'Water': '#3B82F6',      // Blue
    'Out of Bounds': '#EF4444', // Red
    'Other': '#6B7280',       // Gray
  };

  if (endingLieData.length === 0) {
    return null;
  }

  // Custom tooltip for percentage chart
  const PercentageTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof endingLieData[0] }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--court)',
        border: '1px solid var(--scarlet)',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>
          {data.lie}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Count: <span style={{ color: 'var(--chalk)' }}>{data.count}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>
          Percentage: <span style={{ color: 'var(--chalk)' }}>{data.percentage.toFixed(0)}%</span>
        </div>
      </div>
    );
  };

  // Custom tooltip for SG chart
  const SGTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof endingLieData[0] }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--court)',
        border: '1px solid var(--scarlet)',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>
          {data.lie}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Total SG: <span style={{ color: getStrokeGainedColor(data.strokesGained) }}>
            {formatStrokesGained(data.strokesGained)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Avg SG: <span style={{ color: getStrokeGainedColor(data.avgStrokesGained) }}>
            {formatStrokesGained(data.avgStrokesGained)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>
          Count: <span style={{ color: 'var(--chalk)' }}>{data.count}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Approach Ending Lie</h4>

      <div className="grid-pair" style={{ gap: '24px' }}>
        {/* Chart 1: Ending Lie as % of Total Approach Shots */}
        <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
          <h5 style={{ marginBottom: '8px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
            Ending Lie % of Total Shots
          </h5>
          <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
            Distribution of where approach shots end up
          </p>
          <ResponsiveContainer width="100%" height={isNarrow ? 220 : 280}>
            <BarChart
              data={endingLieData}
              margin={{ top: 10, right: 30, left: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} />
              <XAxis
                dataKey="lie"
                stroke="var(--ash)"
                tick={{ fill: 'var(--ash)', fontSize: isNarrow ? 10 : 12 }}
                angle={isNarrow ? 0 : -45}
                textAnchor={isNarrow ? 'middle' : 'end'}
                height={isNarrow ? 24 : 50}
              />
              <YAxis
                stroke="var(--ash)"
                tick={{ fill: 'var(--ash)', fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip content={<PercentageTooltip />} />
              <Bar
                dataKey="percentage"
                name="% of Shots"
                radius={[4, 4, 0, 0]}
              >
                {endingLieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={LIE_COLORS[entry.lie] || chartColors[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Total SG by Ending Lie */}
        <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
          <h5 style={{ marginBottom: '8px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
            Total SG by Ending Lie
          </h5>
          <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
            Strokes Gained performance by ending location
          </p>
          <ResponsiveContainer width="100%" height={isNarrow ? 220 : 280}>
            <BarChart
              data={endingLieData}
              margin={{ top: 10, right: 30, left: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} />
              <XAxis
                dataKey="lie"
                stroke="var(--ash)"
                tick={{ fill: 'var(--ash)', fontSize: isNarrow ? 10 : 12 }}
                angle={isNarrow ? 0 : -45}
                textAnchor={isNarrow ? 'middle' : 'end'}
                height={isNarrow ? 24 : 50}
              />
              <YAxis
                stroke="var(--ash)"
                tick={{ fill: 'var(--ash)', fontSize: 11 }}
                tickFormatter={(value) => formatStrokesGained(value)}
              />
              <Tooltip content={<SGTooltip />} />
              <Bar
                dataKey="strokesGained"
                name="Total SG"
                radius={[4, 4, 0, 0]}
              >
                {endingLieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={LIE_COLORS[entry.lie] || chartColors[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Heat Map Section Component
function ApproachHeatMapSection({ data }: { data: ApproachHeatMapData }) {
  const [sgDisplayMode, setSgDisplayMode] = useState<'total' | 'perRound'>('total');

  // Helper to get color based on SG value
  const getHeatMapColor = (sgValue: number): string => {
    if (sgValue > 0.5) return 'rgba(34, 197, 94, 0.7)';
    if (sgValue > 0.2) return 'rgba(74, 222, 128, 0.5)';
    if (sgValue > 0) return 'rgba(187, 247, 208, 0.3)';
    if (sgValue > -0.2) return 'rgba(254, 226, 226, 0.3)';
    if (sgValue > -0.5) return 'rgba(252, 165, 165, 0.5)';
    return 'rgba(239, 68, 68, 0.7)';
  };

  // Get cell data for a specific lie and distance bucket
  const getCellData = (lie: string, distanceBucket: string) => {
    return data.cells.find(c => c.lie === lie && c.distanceBucket === distanceBucket);
  };

  // Get the SG value to use for coloring based on display mode
  const getSgValue = (cell: typeof data.cells[0] | undefined) => {
    if (!cell) return 0;
    return sgDisplayMode === 'total' ? cell.strokesGained : cell.sgPerRound;
  };

  // Calculate totals for each column
  const columnTotals = data.distanceBuckets.map(bucket => {
    const bucketCells = data.cells.filter(c => c.distanceBucket === bucket);
    return {
      bucket,
      totalShots: bucketCells.reduce((sum, c) => sum + c.totalShots, 0),
      strokesGained: bucketCells.reduce((sum, c) => sum + c.strokesGained, 0),
    };
  });

  // Calculate grand total
  const grandTotal = {
    totalShots: data.cells.reduce((sum, c) => sum + c.totalShots, 0),
    strokesGained: data.cells.reduce((sum, c) => sum + c.strokesGained, 0),
  };

  return (
    <>
      <h4 style={{ marginTop: '32px', marginBottom: '16px', color: 'var(--ash)' }}>Approach Heat Map</h4>

      {/* Radio buttons */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            name="sgDisplayMode"
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
            name="sgDisplayMode"
            value="perRound"
            checked={sgDisplayMode === 'perRound'}
            onChange={() => setSgDisplayMode('perRound')}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--ash)' }}>SG per Round</span>
        </label>
      </div>

      {/* Heat Map Table */}
      <div className="gi-table-scroll">
        <table className="gi-sticky-col" style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>Starting Lie</th>
              {data.distanceBuckets.map(bucket => (
                <th key={bucket} style={{ padding: '12px', textAlign: 'center', color: 'var(--ash)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>
                  <div>{bucket}</div>
                  <div style={{ fontSize: '11px', fontWeight: '400', color: 'var(--ash)', marginTop: '2px' }}>
                    {getApproachBucketRange(bucket)}
                  </div>
                </th>
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
            {/* Grand Total Row */}
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

      {/* Legend */}
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
