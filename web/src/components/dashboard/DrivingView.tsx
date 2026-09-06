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
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-ash">Driving Performance</h4>

        {/* Drive Type Filter Radio Buttons */}
        <div className="flex gap-5">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1-5)', cursor: 'pointer', color: driveFilter === 'all' ? 'var(--chalk)' : 'var(--ash)', fontSize: 'var(--text-caption)' }}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1-5)', cursor: 'pointer', color: driveFilter === 'driver' ? 'var(--chalk)' : 'var(--ash)', fontSize: 'var(--text-caption)' }}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1-5)', cursor: 'pointer', color: driveFilter === 'non-driver' ? 'var(--chalk)' : 'var(--ash)', fontSize: 'var(--text-caption)' }}>
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
      <div className="grid-cards-5 gap-4" >

        {/* Card 1: Penalty Rate */}
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label" style={{ color: 'var(--scarlet)' }}>Penalty Rate</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getPenaltyRateColor(penaltyRate) }}>
            {penaltyRate.toFixed(0)}%
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >SG Penalties</div>
            <div className="value-stat" style={{ color: getStrokeGainedColor(sgPenalties) }}>
              {formatStrokesGained(sgPenalties)}
            </div>
          </div>
        </div>

        {/* Card 2: Driving Distance (75th percentile) */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >Distance (75th %)</div>
          </div>
          <div className="value-hero" >
            {drivingDistance75th.toFixed(0)} <span style={{ fontSize: '18px' }}>yds</span>
          </div>
          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
            <div className="label text-ash" >Total Drives</div>
            <div className="value-stat">{totalDrives}</div>
          </div>
        </div>

        {/* Card 3: Total SG - Driving */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >SG - Driving</div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(drivingSG) }}>
            {formatStrokesGained(drivingSG)}
          </div>
          <div className="flex justify-between mt-4 gap-3" >
            <div>
              <div className="label text-ash" >SG / Drive</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(avgDrivingSG) }}>
                {formatStrokesGained(avgDrivingSG)}
              </div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >+ Drives</div>
              <div className="value-stat">{positiveSGPct.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Card 4: Fairway Hit % */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >
              {driveFilter === 'all' ? 'Fairway %' : driveFilter === 'driver' ? 'Fairway % (Driver)' : 'Fairway % (Non Driver)'}
            </div>
          </div>
          <div className="value-hero" style={{ color: getFairwayPctColor(fairwayPct) }}>
            {fairwayPct.toFixed(0)}%
          </div>
          {driveFilter === 'all' && (
            <div className="flex justify-between mt-4 gap-3" >
              <div>
                <div className="label text-ash" >Driver</div>
                <div className="value-stat" style={{ color: getFairwayPctColor(fairwayPctDriver) }}>
                  {fairwayPctDriver.toFixed(0)}%
                </div>
              </div>
              <div className="text-right">
                <div className="label text-ash" >Non-Driver</div>
                <div className="value-stat" style={{ color: getFairwayPctColor(fairwayPctNonDriver) }}>
                  {fairwayPctNonDriver.toFixed(0)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 5: Miss Bias */}
        <div className="card-hero">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label text-ash" >Miss Bias</div>
          </div>
          <div
 className="value-hero"
 style={{ color: missRecordedCount > 0 ? getMissBiasColor(missLeftPct) : 'var(--chalk)', fontSize: '40px' }}
          >
            {missRecordedCount > 0 ? `${missLeftPct.toFixed(0)}% / ${missRightPct.toFixed(0)}%` : '—'}
          </div>
          <div className="flex justify-between mt-4 gap-3" >
            <div>
              <div className="label text-ash" >Left / Right</div>
              <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>Target 50% / 50%</div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >Misses</div>
              <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{missRecordedCount}</div>
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
    'Fairway': 'var(--c1)',      // Royal Blue
    'Rough': 'var(--c2)',         // Court Purple
    'Recovery': 'var(--c3)',      // Aqua
    'Sand': 'var(--c4)',          // Volt
    'Green': 'var(--c5)',         // Magenta
    'Tee': 'var(--bogey)',           // Orange
    'Out of Bounds': 'var(--double)', // Red
    'Water': 'var(--c1)',         // Royal Blue (same as Fairway for water)
    'Penalty Area': 'var(--c2)',  // Court Purple (same as Rough)
    'Other': 'var(--ash)',         // Gray
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
        padding: 'var(--spacing-3)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div className="text-chalk font-semibold mb-2">
          {data.name}
        </div>
        <div className="text-label text-cement mb-1">
          Count: <span className="text-chalk">{data.value}</span>
        </div>
        <div className="text-label text-cement mb-1">
          Percentage: <span className="text-chalk">{data.percentage}%</span>
        </div>
        <div className="text-label text-cement">
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
        padding: 'var(--spacing-3)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div className="text-chalk font-semibold mb-2">
          {data.location}
        </div>
        <div className="text-label text-cement mb-1">
          Total SG: <span style={{ color: getStrokeGainedColor(data.strokesGained) }}>
            {formatStrokesGained(data.strokesGained)}
          </span>
        </div>
        <div className="text-label text-cement mb-1">
          Avg SG: <span style={{ color: getStrokeGainedColor(data.avgStrokesGained) }}>
            {formatStrokesGained(data.avgStrokesGained)}
          </span>
        </div>
        <div className="text-label text-cement">
          Count: <span className="text-chalk">{data.count}</span>
        </div>
      </div>
    );
  };

  if (endingLocations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-ash">Driving Analysis</h4>

      <div className="grid-pair gap-6" >
        {/* Donut Chart - Drive Ending Locations */}
        {endingLocations.length > 0 && (
          <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
            <h5 className="mb-3 text-chalk text-body-sm font-semibold">
              Drive Ending Locations
            </h5>
            <p className="text-label-sm text-ash mb-4">
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
 fill={LOCATION_COLORS[entry.name] || 'var(--ash)'}
 stroke="var(--shadow)"
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
 formatter={(value) => <span className="text-ash text-label-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Horizontal Bar Chart - SG by Ending Location */}
        {endingLocations.length > 0 && (
          <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
            <h5 className="mb-3 text-chalk text-body-sm font-semibold">
              SG by Ending Location
            </h5>
            <p className="text-label-sm text-ash mb-4">
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
 wrapperStyle={{ paddingTop: 'var(--spacing-2-5)' }}
 formatter={() => <span className="text-ash text-label-sm">Total SG</span>}
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
        <span className="font-semibold">All Drives</span>
        <span className="text-label text-ash">
          {drives.length} drives • {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4">
          {sortedRounds.map(([roundKey, roundDrives]) => {
            const [dateStr, courseStr] = roundKey.split('|');

            return (
              <div key={roundKey} style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-3)', background: 'var(--shadow)', borderRadius: '4px' }}>
                <div className="flex gap-6 mb-3 text-label text-chalk">
                  <span><strong>Date:</strong> {dateStr}</span>
                  <span><strong>Course:</strong> {courseStr}</span>
                  <span><strong>Drives:</strong> {roundDrives.length}</span>
                </div>
                <div className="gi-table-scroll">
                  <table style={{ minWidth: '660px', width: '100%', fontSize: 'var(--text-caption)', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '8%' }}>Hole</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '10%' }}>Non Driver</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '11%' }}>Start Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '11%' }}>End Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '15%' }}>End Lie</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '10%' }}>Penalty</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '11%' }}>Driver Dist</th>
                        <th style={{ textAlign: 'center', padding: 'var(--spacing-1-5)', color: 'var(--ash)', width: '12%' }}>SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundDrives
                        .sort((a, b) => a.holeNumber - b.holeNumber)
                        .map((drive, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                            <td className="p-1.5 text-center text-chalk">{drive.holeNumber}</td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: drive.clubCategory === 'Non-driver' ? 'var(--bogey)' : 'var(--chalk)' }}>
                              {drive.clubCategory === 'Non-driver' ? 'Yes' : ''}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {drive.startingDistance}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {drive.endingDistance}
                            </td>
                            <td className="p-1.5 text-center text-chalk">{drive.endingLie}</td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: drive.hasPenalty ? 'var(--scarlet)' : 'transparent' }}>
                              {drive.hasPenalty ? 'Yes' : ''}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: 'var(--chalk)', fontFamily: 'var(--font-mono)' }}>
                              {drive.startingDistance - drive.endingDistance}
                            </td>
                            <td style={{ padding: 'var(--spacing-1-5)', textAlign: 'center', color: getShotSGColor(drive.calculatedStrokesGained), fontFamily: 'var(--font-mono)' }}>
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
    <div className="mb-6">
      <h5 className="mb-1 text-chalk text-body-sm font-semibold">
        {title}
      </h5>
      {description && (
        <p className="text-label-sm text-ash mb-3">
          {description}
        </p>
      )}

      {/* Parent + children group, sharing one border to read as one unit */}
      <div style={{ border: '1px solid var(--pitch)', borderRadius: '4px', overflow: 'hidden' }}>
        {/* Parent - full width hero */}
        <div className="card-hero is-flagship" style={{ borderBottom: '1px solid var(--pitch)' }}>
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label" style={{ color: 'var(--scarlet)' }}>{parentLabel}</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" >{parentValue}</div>
          <div className="flex justify-between mt-4 gap-3" >
            <div>
              <div className="label text-ash" >% of Drives</div>
              <div className="value-stat" style={{ fontSize: '18px' }}>{parentPct.toFixed(0)}%</div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >Total SG</div>
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
              <div className="label text-ash mb-2" >
                ↳ {child.label}
              </div>
              <div className="value-stat">{child.value}</div>
              <div className="mt-2">
                <div className="label text-ash" >% of Drives</div>
                <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{child.pct.toFixed(0)}%</div>
              </div>
              <div className="mt-2">
                <div className="label text-ash" >Total SG</div>
                <div className="value-stat" style={{ fontSize: 'var(--text-label)', color: getStrokeGainedColor(child.sg) }}>
                  {formatStrokesGained(child.sg)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Miss direction context - which way the ball missed on these drives */}
      <div className="mt-3">
        <div className="label text-ash mb-2" >
          Miss Direction
          {missDirection.recordedCount > 0 && (
            <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>
              {' '}&mdash; {missDirection.recordedCount} of {missDirection.totalCount} had a recorded direction
            </span>
          )}
        </div>
        {missDirection.recordedCount > 0 ? (
          <div className="grid-tiles-2 gap-3" >
            <div className="card-stat" style={{ borderLeft: '3px solid var(--c1)' }}>
              <div className="label text-ash mb-2" >Left</div>
              <div className="value-stat" style={{ fontSize: '20px' }}>{missDirection.leftPct.toFixed(0)}%</div>
              <div className="mt-2">
                <div className="label text-ash" >Count</div>
                <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{missDirection.leftCount}</div>
              </div>
            </div>
            <div className="card-stat" style={{ borderLeft: '3px solid var(--c5)' }}>
              <div className="label text-ash mb-2" >Right</div>
              <div className="value-stat" style={{ fontSize: '20px' }}>{missDirection.rightPct.toFixed(0)}%</div>
              <div className="mt-2">
                <div className="label text-ash" >Count</div>
                <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{missDirection.rightCount}</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-label-sm text-ash">No drives in this group have a recorded miss direction.</p>
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
  const penaltyColors = ['var(--c2)', 'var(--c1)']; // Purple, Blue
  const obstructionColors = ['var(--c4)', chartColors[4]]; // Volt, (Recovery accent)

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-ash">Problem Drive Analysis</h4>
      <p className="text-label text-ash mb-4">
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