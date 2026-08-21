'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { DrivingMetrics, DrivingAnalysis, ProcessedShot, ProblemDriveMetrics } from '@/lib/golf/types';
import { getStrokeGainedColor, formatStrokesGained, getShotSGColor, chartColors } from '@/lib/golf/tokens';
import { calculateProblemDriveMetrics, isOutOfBounds } from '@/lib/golf/calculations';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

/**
 * Get color based on penalty rate (lower is better)
 * <5%: Green (good)
 * 5-10%: Yellow (average)
 * >10%: Red (poor)
 */
function getPenaltyRateColor(penaltyRate: number): string {
  if (penaltyRate < 5) return 'var(--under)';    // Green
  if (penaltyRate <= 10) return 'var(--bogey)';   // Yellow
  return 'var(--double)';                         // Red
}

/**
 * Get color based on fairway percentage (higher is better)
 * >60%: Green (good)
 * 40-60%: Yellow (average)
 * <40%: Red (poor)
 */
function getFairwayPctColor(fairwayPct: number): string {
  if (fairwayPct > 60) return 'var(--under)';     // Green
  if (fairwayPct >= 40) return 'var(--bogey)';    // Yellow
  return 'var(--double)';                         // Red
}

/**
 * Get color based on how far the miss-direction split is from an even 50/50.
 * Target is 50/50 (consistent aim and strike), so smaller deviation is better.
 * <10pts off even: Green | 10-20pts: Yellow | >20pts: Red
 */
function getMissBiasColor(leftPct: number): string {
  const deviation = Math.abs(leftPct - 50);
  if (deviation < 10) return 'var(--under)';      // Green
  if (deviation <= 20) return 'var(--bogey)';     // Yellow
  return 'var(--double)';                         // Red
}

export function DrivingView({ metrics, analysis, filteredShots }: { metrics: DrivingMetrics; analysis: DrivingAnalysis; filteredShots: ProcessedShot[] }) {
  const [driveFilter, setDriveFilter] = useState<'all' | 'driver' | 'non-driver'>('all');

  // Filter shots based on drive type
  // Driver = clubCategory is 'Driver' or not recorded; Non Driver = 'Non-driver'
  const filteredDrives = useMemo(() => {
    return filteredShots.filter(shot => {
      if (driveFilter === 'all') return shot.shotType === 'Drive';
      if (driveFilter === 'driver') {
        return shot.shotType === 'Drive' && shot.clubCategory !== 'Non-driver';
      }
      if (driveFilter === 'non-driver') return shot.shotType === 'Drive' && shot.clubCategory === 'Non-driver';
      return false;
    });
  }, [filteredShots, driveFilter]);

  // Recalculate metrics based on filtered drives
  const filteredMetrics = useMemo(() => {
    const drives = filteredDrives;
    const totalDrives = drives.length;

    if (totalDrives === 0) {
      return {
        ...metrics,
        totalDrives: 0,
        fairwayPct: 0,
        drivingSG: 0,
        avgDrivingSG: 0,
        fairwayPctDriver: 0,
        fairwayPctNonDriver: 0,
        drivingDistance75th: 0,
        penaltyRate: 0,
        positiveSGPct: 0,
        totalPenalties: 0,
        obPenalties: 0,
        otherPenalties: 0,
        sgPenalties: 0,
        missLeftCount: 0,
        missRightCount: 0,
        missRecordedCount: 0,
        missLeftPct: 0,
        missRightPct: 0,
      };
    }

    // Calculate fairways
    const fairwaysHit = drives.filter(d => d.endingLie === 'Fairway').length;
    const fairwayPct = (fairwaysHit / totalDrives) * 100;

    // Calculate SG
    const drivingSG = drives.reduce((sum, d) => sum + d.calculatedStrokesGained, 0);
    const avgDrivingSG = drivingSG / totalDrives;

    // Fairway % by driver type
    const driverDrives = drives.filter(d => d.clubCategory !== 'Non-driver');
    const nonDriverDrives = drives.filter(d => d.clubCategory === 'Non-driver');

    const driverFairways = driverDrives.filter(d => d.endingLie === 'Fairway').length;
    const nonDriverFairways = nonDriverDrives.filter(d => d.endingLie === 'Fairway').length;

    // Calculate driving distance (75th percentile)
    const driveDistances = drives.map(d => Math.abs(d.startingDistance - d.endingDistance)).sort((a, b) => a - b);
    const distance75thIndex = Math.floor(driveDistances.length * 0.75);
    const drivingDistance75th = driveDistances[distance75thIndex] || 0;

    // Calculate penalty rate
    const obPenalties = drives.filter(d => isOutOfBounds(d)).length;
    const otherPenalties = drives.filter(d => d.hasPenalty && !isOutOfBounds(d)).length;
    const totalPenalties = obPenalties + otherPenalties;
    const penaltyRate = ((obPenalties * 2 + otherPenalties) / totalDrives) * 100;
    const sgPenalties = drives.filter(d => d.hasPenalty).reduce((sum, d) => sum + d.calculatedStrokesGained, 0);

    // Calculate positive SG percentage
    const positiveDrives = drives.filter(d => d.calculatedStrokesGained > 0).length;
    const positiveSGPct = (positiveDrives / totalDrives) * 100;

    // Miss bias: among drives with a recorded miss direction, the L/R split
    const missLeftCount = drives.filter(d => d.missDirection === 'Left').length;
    const missRightCount = drives.filter(d => d.missDirection === 'Right').length;
    const missRecordedCount = missLeftCount + missRightCount;
    const missLeftPct = missRecordedCount > 0 ? (missLeftCount / missRecordedCount) * 100 : 0;
    const missRightPct = missRecordedCount > 0 ? (missRightCount / missRecordedCount) * 100 : 0;

    return {
      ...metrics,
      totalDrives,
      fairwayPct,
      drivingSG,
      avgDrivingSG,
      fairwayPctDriver: driverDrives.length > 0 ? (driverFairways / driverDrives.length) * 100 : 0,
      fairwayPctNonDriver: nonDriverDrives.length > 0 ? (nonDriverFairways / nonDriverDrives.length) * 100 : 0,
      drivingDistance75th,
      penaltyRate,
      positiveSGPct,
      totalPenalties,
      obPenalties,
      otherPenalties,
      sgPenalties,
      missLeftCount,
      missRightCount,
      missRecordedCount,
      missLeftPct,
      missRightPct,
    };
  }, [filteredDrives, metrics]);

  const {
    totalDrives,
    fairwayPct,
    drivingSG,
    avgDrivingSG,
    drivingDistance75th,
    obPenalties: _obPenalties,
    otherPenalties: _otherPenalties,
    penaltyRate,
    sgPenalties,
    fairwayPctDriver,
    fairwayPctNonDriver,
    positiveSGPct,
    missLeftCount,
    missRightCount,
    missRecordedCount,
    missLeftPct,
    missRightPct,
  } = filteredMetrics;

  // Calculate Problem Drive metrics from filtered drives
  const problemMetrics = useMemo(() => {
    return calculateProblemDriveMetrics(filteredDrives);
  }, [filteredDrives]);

  // Filter analysis data based on drive type - always use actual ending lie (no grouping)
  const filteredAnalysis = useMemo(() => {
    // Recalculate ending locations using actual ending lie
    const endingLocationsMap = new Map<string, { count: number; strokesGained: number }>();

    filteredDrives.forEach(drive => {
      const location = drive.endingLie as string;
      const existing = endingLocationsMap.get(location) || { count: 0, strokesGained: 0 };
      existing.count += 1;
      existing.strokesGained += drive.calculatedStrokesGained;
      endingLocationsMap.set(location, existing);
    });

    const totalDrives = filteredDrives.length;
    const endingLocations = Array.from(endingLocationsMap.entries())
      .map(([location, data]) => ({
        location: location as 'Fairway' | 'Rough' | 'Recovery' | 'Sand' | 'Green' | 'Tee' | 'Out of Bounds' | 'Water' | 'Penalty Area' | 'Other',
        count: data.count,
        percentage: totalDrives > 0 ? (data.count / totalDrives) * 100 : 0,
        strokesGained: data.strokesGained,
        avgStrokesGained: data.count > 0 ? data.strokesGained / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      ...analysis,
      endingLocations,
    };
  }, [analysis, filteredDrives]);

  return (
    <div className="content">
      {/* Section Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ color: 'var(--ash)' }}>Driving Performance</h4>

        {/* Drive Type Filter Radio Buttons */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: driveFilter === 'all' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="driveFilter"
              value="all"
              checked={driveFilter === 'all'}
              onChange={() => setDriveFilter('all')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            All Drives
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: driveFilter === 'driver' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="driveFilter"
              value="driver"
              checked={driveFilter === 'driver'}
              onChange={() => setDriveFilter('driver')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Driver
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: driveFilter === 'non-driver' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="driveFilter"
              value="non-driver"
              checked={driveFilter === 'non-driver'}
              onChange={() => setDriveFilter('non-driver')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Non Driver
          </label>
        </div>
      </div>

      {/* Hero Cards - 5 metrics */}
      <div className="grid-cards-5" style={{ gap: '16px' }}>

        {/* Card 1: Penalty Rate */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>Penalty Rate</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getPenaltyRateColor(penaltyRate) }}>
            {penaltyRate.toFixed(0)}%
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>SG Penalties</div>
            <div className="value-stat" style={{ color: getStrokeGainedColor(sgPenalties) }}>
              {formatStrokesGained(sgPenalties)}
            </div>
          </div>
        </div>

        {/* Card 2: Driving Distance (75th percentile) */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Distance (75th %)</div>
          </div>
          <div className="value-hero" style={{ color: 'var(--chalk)' }}>
            {drivingDistance75th.toFixed(0)} <span style={{ fontSize: '18px' }}>yds</span>
          </div>
          <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
            <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Total Drives</div>
            <div className="value-stat">{totalDrives}</div>
          </div>
        </div>

        {/* Card 3: Total SG - Driving */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>SG - Driving</div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(drivingSG) }}>
            {formatStrokesGained(drivingSG)}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>SG / Drive</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgDrivingSG) }}>
                {formatStrokesGained(avgDrivingSG)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>+ Drives</div>
              <div className="value-stat">{positiveSGPct.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Card 4: Fairway Hit % */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>
              {driveFilter === 'all' ? 'Fairway %' : driveFilter === 'driver' ? 'Fairway % (Driver)' : 'Fairway % (Non Driver)'}
            </div>
          </div>
          <div className="value-hero" style={{ color: getFairwayPctColor(fairwayPct) }}>
            {fairwayPct.toFixed(0)}%
          </div>
          {driveFilter === 'all' && (
            <div className="flex justify-between" style={{ marginTop: '16px' }}>
              <div>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Driver</div>
                <div className="value-stat" style={{ color: getFairwayPctColor(fairwayPctDriver) }}>
                  {fairwayPctDriver.toFixed(0)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Non-Driver</div>
                <div className="value-stat" style={{ color: getFairwayPctColor(fairwayPctNonDriver) }}>
                  {fairwayPctNonDriver.toFixed(0)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 5: Miss Bias */}
        <div className="card-hero">
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--ash)' }}>Miss Bias</div>
          </div>
          <div
            className="value-hero"
            style={{ color: missRecordedCount > 0 ? getMissBiasColor(missLeftPct) : 'var(--chalk)', fontSize: '40px' }}
          >
            {missRecordedCount > 0 ? `${missLeftPct.toFixed(0)}% / ${missRightPct.toFixed(0)}%` : '—'}
          </div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Left / Right</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>Target 50% / 50%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Misses</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{missRecordedCount}</div>
            </div>
          </div>
        </div>

      </div>

      {/* Driving Analysis Section */}
      <DrivingAnalysisSection analysis={filteredAnalysis} totalDrives={totalDrives} />

      {/* Problem Drive Section */}
      <ProblemDriveSection metrics={problemMetrics} />

      {/* All Drives Table - Collapsible */}
      <DrivesTableSection shots={filteredDrives} />
    </div>
  );
}

/**
 * Driving Analysis Section - Donut and Bar charts for drive analysis
 */
function DrivingAnalysisSection({ analysis, totalDrives }: { analysis: DrivingAnalysis; totalDrives: number }) {
  const isNarrow = useMediaQuery(MOBILE_QUERY);
  const { endingLocations } = analysis;

  // Map location types to chart colors - each location has a distinct color
  const LOCATION_COLORS: Record<string, string> = {
    'Fairway': '#3D8EF0',      // Royal Blue
    'Rough': '#A855F7',         // Court Purple
    'Recovery': '#06C8E0',      // Aqua
    'Sand': '#D4F000',          // Volt
    'Green': '#F03DAA',         // Magenta
    'Tee': '#FF8C00',           // Orange
    'Out of Bounds': '#EF4444', // Red
    'Water': '#3D8EF0',         // Royal Blue (same as Fairway for water)
    'Penalty Area': '#A855F7',  // Court Purple (same as Rough)
    'Other': '#6B7280',         // Gray
  };

  // Format data for donut chart
  const donutData = endingLocations.map(loc => ({
    name: loc.location,
    value: loc.count,
    percentage: loc.percentage.toFixed(0),
    strokesGained: loc.strokesGained,
    avgStrokesGained: loc.avgStrokesGained,
  }));

  // Custom tooltip for donut chart
  const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof donutData[0] }> }) => {
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
          {data.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Count: <span style={{ color: 'var(--chalk)' }}>{data.value}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Percentage: <span style={{ color: 'var(--chalk)' }}>{data.percentage}%</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>
          Avg SG: <span style={{ color: getStrokeGainedColor(data.avgStrokesGained) }}>
            {formatStrokesGained(data.avgStrokesGained)}
          </span>
        </div>
      </div>
    );
  };

  // Custom tooltip for SG by location horizontal bar chart
  const LocationSGTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { strokesGained: number; avgStrokesGained: number; count: number; location: string } }> }) => {
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
          {data.location}
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

  if (endingLocations.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Driving Analysis</h4>

      <div className="grid-pair" style={{ gap: '24px' }}>
        {/* Donut Chart - Drive Ending Locations */}
        {endingLocations.length > 0 && (
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
              Drive Ending Locations
            </h5>
            <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
              Percentage breakdown of where drives end up
            </p>
            <ResponsiveContainer width="100%" height={isNarrow ? 220 : 280}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="46%"
                  outerRadius="70%"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {donutData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={LOCATION_COLORS[entry.name] || '#6B7280'}
                      stroke="var(--charcoal)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                {/* Center text showing total drives - separate from data to avoid tooltip issues */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--chalk)"
                  style={{ fontSize: '24px', fontWeight: 'bold' }}
                >
                  {totalDrives}
                </text>
                <Tooltip content={<DonutTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Horizontal Bar Chart - SG by Ending Location */}
        {endingLocations.length > 0 && (
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <h5 style={{ marginBottom: '12px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
              SG by Ending Location
            </h5>
            <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
              Total Strokes Gained by where drives end up
            </p>
            <ResponsiveContainer width="100%" height={isNarrow ? 220 : 280}>
              <BarChart
                data={endingLocations}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ash)" opacity={0.3} horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--ash)"
                  tick={{ fill: 'var(--ash)', fontSize: 11 }}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <YAxis
                  type="category"
                  dataKey="location"
                  stroke="var(--ash)"
                  tick={{ fill: 'var(--ash)', fontSize: 11 }}
                  width={isNarrow ? 56 : 80}
                />
                <Tooltip content={<LocationSGTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={() => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>Total SG</span>}
                />
                <Bar
                  dataKey="strokesGained"
                  name="Total SG"
                  radius={[0, 4, 4, 0]}
                >
                  {endingLocations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={LOCATION_COLORS[entry.location] || chartColors[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Drives Table Section - Collapsible table showing all drives
 * Columns: Course, Hole, Starting Distance, Ending Distance, Ending Lie, Penalty, SG
 */
function DrivesTableSection({ shots }: { shots: ProcessedShot[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter for drives only
  const drives = shots.filter(shot => shot.shotType === 'Drive');

  // Group drives by round (date + course)
  const drivesByRound = drives.reduce((acc, drive) => {
    const key = `${drive.playedOn}|${drive.courseName}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(drive);
    return acc;
  }, {} as Record<string, ProcessedShot[]>);

  // Sort rounds by date (most recent first)
  const sortedRounds = Object.entries(drivesByRound).sort((a, b) => {
    const dateA = a[0].split('|')[0];
    const dateB = b[0].split('|')[0];
    return dateB.localeCompare(dateA);
  });

  if (drives.length === 0) {
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
        <span style={{ fontWeight: 600 }}>All Drives</span>
        <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
          {drives.length} drives • {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {sortedRounds.map(([roundKey, roundDrives]) => {
            const [dateStr, courseStr] = roundKey.split('|');

            return (
              <div key={roundKey} style={{ marginBottom: '16px', padding: '12px', background: 'var(--charcoal)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: 'var(--chalk)' }}>
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Drives:</strong> {roundDrives.length}</span>
                </div>
                <div className="gi-table-scroll">
                  <table style={{ minWidth: '660px', width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '8%' }}>Hole</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Non Driver</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>Start Dist</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>End Dist</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '15%' }}>End Lie</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '10%' }}>Penalty</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '11%' }}>Driver Dist</th>
                        <th style={{ textAlign: 'center', padding: '6px', color: 'var(--ash)', width: '12%' }}>SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundDrives
                        .sort((a, b) => a.holeNumber - b.holeNumber)
                        .map((drive, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                            <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{drive.holeNumber}</td>
                            <td style={{ padding: '6px', textAlign: 'center', color: drive.clubCategory === 'Non-driver' ? 'var(--bogey)' : 'var(--chalk)' }}>
                              {drive.clubCategory === 'Non-driver' ? 'Yes' : ''}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {drive.startingDistance}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {drive.endingDistance}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)' }}>{drive.endingLie}</td>
                            <td style={{ padding: '6px', textAlign: 'center', color: drive.hasPenalty ? 'var(--scarlet)' : 'transparent' }}>
                              {drive.hasPenalty ? 'Yes' : ''}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {drive.startingDistance - drive.endingDistance}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center', color: getShotSGColor(drive.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>
                              {formatStrokesGained(drive.calculatedStrokesGained)}
                            </td>
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

interface ChildStat {
  label: string;
  value: number;
  pct: number;
  sg: number;
  color: string;
}

interface MissDirectionStat {
  leftCount: number;
  rightCount: number;
  recordedCount: number;
  leftPct: number;
  rightPct: number;
  totalCount: number; // total drives in this group (penalties or obstruction)
}

/**
 * A parent hero card spanning the full width, with its child breakdown cards
 * directly beneath it inside the same bordered group — a visual parent/child
 * relationship (e.g. Total Penalties -> OB Penalties + Standard Penalties).
 * Below the group, a miss-direction context row shows which way the ball
 * missed on the drives that make up this group, when that was recorded.
 */
function ProblemDriveGroup({
  title,
  description,
  parentLabel,
  parentValue,
  parentPct,
  parentSG,
  childStats,
  missDirection,
}: {
  title: string;
  description?: string;
  parentLabel: string;
  parentValue: number;
  parentPct: number;
  parentSG: number;
  childStats: ChildStat[];
  missDirection: MissDirectionStat;
}) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h5 style={{ marginBottom: '4px', color: 'var(--chalk)', fontSize: '14px', fontWeight: 600 }}>
        {title}
      </h5>
      {description && (
        <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '12px' }}>
          {description}
        </p>
      )}

      {/* Parent + children group, sharing one border to read as one unit */}
      <div style={{ border: '1px solid var(--pitch)', borderRadius: '4px', overflow: 'hidden' }}>
        {/* Parent - full width hero */}
        <div className="card-hero is-flagship" style={{ borderBottom: '1px solid var(--pitch)' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="label" style={{ color: 'var(--scarlet)' }}>{parentLabel}</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: 'var(--chalk)' }}>{parentValue}</div>
          <div className="flex justify-between" style={{ marginTop: '16px' }}>
            <div>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>% of Drives</div>
              <div className="value-stat" style={{ fontSize: '18px' }}>{parentPct.toFixed(0)}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Total SG</div>
              <div className="value-stat" style={{ fontSize: '18px', color: getStrokeGainedColor(parentSG) }}>
                {formatStrokesGained(parentSG)}
              </div>
            </div>
          </div>
        </div>

        {/* Children - breakdown of the parent, visually nested beneath it */}
        <div className="grid-autofit" style={{ gap: '1px', background: 'var(--pitch)' }}>
          {childStats.map((child) => (
            <div key={child.label} className="card-stat" style={{ borderLeft: `3px solid ${child.color}` }}>
              <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>
                ↳ {child.label}
              </div>
              <div className="value-stat">{child.value}</div>
              <div style={{ marginTop: '8px' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>% of Drives</div>
                <div className="value-stat" style={{ fontSize: '12px' }}>{child.pct.toFixed(0)}%</div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Total SG</div>
                <div className="value-stat" style={{ fontSize: '12px', color: getStrokeGainedColor(child.sg) }}>
                  {formatStrokesGained(child.sg)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Miss direction context - which way the ball missed on these drives */}
      <div style={{ marginTop: '12px' }}>
        <div className="label" style={{ color: 'var(--ash)', fontSize: '10px', marginBottom: '8px' }}>
          Miss Direction
          {missDirection.recordedCount > 0 && (
            <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>
              {' '}&mdash; {missDirection.recordedCount} of {missDirection.totalCount} had a recorded direction
            </span>
          )}
        </div>
        {missDirection.recordedCount > 0 ? (
          <div className="grid-tiles-2" style={{ gap: '12px' }}>
            <div className="card-stat" style={{ borderLeft: '3px solid #3D8EF0' }}>
              <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>Left</div>
              <div className="value-stat" style={{ fontSize: '20px' }}>{missDirection.leftPct.toFixed(0)}%</div>
              <div style={{ marginTop: '8px' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Count</div>
                <div className="value-stat" style={{ fontSize: '12px' }}>{missDirection.leftCount}</div>
              </div>
            </div>
            <div className="card-stat" style={{ borderLeft: '3px solid #F03DAA' }}>
              <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px', fontSize: '11px' }}>Right</div>
              <div className="value-stat" style={{ fontSize: '20px' }}>{missDirection.rightPct.toFixed(0)}%</div>
              <div style={{ marginTop: '8px' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '10px' }}>Count</div>
                <div className="value-stat" style={{ fontSize: '12px' }}>{missDirection.rightCount}</div>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: 'var(--ash)' }}>No drives in this group have a recorded miss direction.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Problem Drive Section - Shows penalties and obstruction breakdown
 * - Penalties: Total (parent) -> OB, Standard (children), + miss direction
 * - Obstruction: Total (parent) -> Sand, Recovery (children), + miss direction
 */
function ProblemDriveSection({ metrics }: { metrics: ProblemDriveMetrics }) {
  // Don't render if no drives
  if (metrics.totalDrives === 0) {
    return null;
  }

  // Chart colors for the breakdown items
  const penaltyColors = ['#A855F7', '#3D8EF0']; // Purple, Blue
  const obstructionColors = ['#D4F000', chartColors[4]]; // Volt, (Recovery accent)

  return (
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Problem Drive Analysis</h4>
      <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '16px' }}>
        Penalties and obstruction breakdown ({metrics.totalDrives} total drives)
      </p>

      <ProblemDriveGroup
        title="Penalties"
        parentLabel="Total Penalties"
        parentValue={metrics.totalPenalties}
        parentPct={metrics.penaltyPct}
        parentSG={metrics.penaltySG}
        childStats={[
          { label: 'OB Penalties', value: metrics.obPenalties, pct: metrics.obPenaltyPct, sg: metrics.obPenaltySG, color: penaltyColors[0] },
          { label: 'Standard Penalties', value: metrics.standardPenalties, pct: metrics.standardPenaltyPct, sg: metrics.standardPenaltySG, color: penaltyColors[1] },
        ]}
        missDirection={{
          leftCount: metrics.penaltyMissLeftCount,
          rightCount: metrics.penaltyMissRightCount,
          recordedCount: metrics.penaltyMissRecordedCount,
          leftPct: metrics.penaltyMissLeftPct,
          rightPct: metrics.penaltyMissRightPct,
          totalCount: metrics.totalPenalties,
        }}
      />

      <ProblemDriveGroup
        title="Obstruction Rate"
        description="Drives ending in Sand or Recovery lie"
        parentLabel="Total Obstruction"
        parentValue={metrics.obstructionCount}
        parentPct={metrics.obstructionPct}
        parentSG={metrics.obstructionSG}
        childStats={[
          { label: 'Sand', value: metrics.sandCount, pct: metrics.sandPct, sg: metrics.sandSG, color: obstructionColors[0] },
          { label: 'Recovery', value: metrics.recoveryCount, pct: metrics.recoveryPct, sg: metrics.recoverySG, color: obstructionColors[1] },
        ]}
        missDirection={{
          leftCount: metrics.obstructionMissLeftCount,
          rightCount: metrics.obstructionMissRightCount,
          recordedCount: metrics.obstructionMissRecordedCount,
          leftPct: metrics.obstructionMissLeftPct,
          rightPct: metrics.obstructionMissRightPct,
          totalCount: metrics.obstructionCount,
        }}
      />
    </div>
  );
}