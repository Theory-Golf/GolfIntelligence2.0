'use client';

/**
 * Golf Intelligence — Strokes Gained Trend Chart Component
 * Visualizes strokes gained by round with moving average overlay
 */

import { useState, useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ProcessedShot, SGShotCategory } from '@/lib/golf/types';
import { calculateMovingAverage, getRoundSGByShotType } from '@/lib/golf/calculations';
import { formatStrokesGained, getStrokeGainedColor } from '@/lib/golf/tokens';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

interface StrokesGainedTrendChartProps {
  filteredShots: ProcessedShot[];
}

const SHOT_CATEGORIES: { value: SGShotCategory; label: string }[] = [
  { value: 'Driving', label: 'Driving' },
  { value: 'Approach', label: 'Approach' },
  { value: 'Short Game', label: 'Short Game' },
  { value: 'Putting', label: 'Putting' },
];

const MOVING_AVERAGE_OPTIONS = [
  { value: 3, label: '3 Rounds' },
  { value: 5, label: '5 Rounds' },
  { value: 10, label: '10 Rounds' },
  { value: 20, label: '20 Rounds' },
];

// Chart colors - matching the app theme
const COLORS = {
  bar: 'var(--c1)',      // Royal Blue
  line: 'var(--c2)',     // Court Purple
  grid: 'var(--ash)',
  text: 'var(--ash)',
  tooltipBg: 'var(--court)',
};

export function StrokesGainedTrendChart({ filteredShots }: StrokesGainedTrendChartProps) {
  const isNarrow = useMediaQuery(MOBILE_QUERY);
  const [selectedCategory, setSelectedCategory] = useState<SGShotCategory>('Driving');
  const [movingAverageWindow, setMovingAverageWindow] = useState<number>(5);

  // Get round data for selected category
  const roundData = useMemo(() => {
    return getRoundSGByShotType(filteredShots, selectedCategory);
  }, [filteredShots, selectedCategory]);

  // Calculate moving average
  const chartData = useMemo(() => {
    const sgValues = roundData.map(r => r.strokesGained);
    const movingAvg = calculateMovingAverage(sgValues, movingAverageWindow);

    return roundData.map((round, index) => ({
      ...round,
      label: `R${round.roundNumber}`,
      fullLabel: `${round.date.substring(5)} - ${round.course}`,
      movingAverage: movingAvg[index],
    }));
  }, [roundData, movingAverageWindow]);

  // Calculate domain for y-axis with padding
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [-2, 2];

    const sgValues = chartData.map(d => d.strokesGained);
    const maValues = chartData.map(d => d.movingAverage).filter((v): v is number => v !== null);

    const allValues = [...sgValues, ...maValues];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    const padding = range * 0.2 || 1;

    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (!active || !payload || !payload.length) return null;

    const data = chartData.find(d => d.label === label);
    if (!data) return null;

    return (
      <div style={{
        background: COLORS.tooltipBg,
        border: '1px solid var(--scarlet)',
        borderRadius: '4px',
        padding: 'var(--spacing-3)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div className="text-chalk font-semibold mb-2">
          {data.fullLabel}
        </div>
        <div className="text-label text-cement mb-1">
          Round {data.roundNumber} • {data.shotCount} shots
        </div>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--spacing-4)',
            fontSize: 'var(--text-label)', color: entry.color,
            marginTop: 'var(--spacing-1)' }}>
            <span>{entry.dataKey === 'strokesGained' ? 'Strokes Gained' : 'Moving Average'}:</span>
            <span style={{ fontWeight: 600, color: entry.dataKey === 'strokesGained' ? getStrokeGainedColor(entry.value) : entry.color }}>
              {entry.dataKey === 'movingAverage' && entry.value === null
                ? 'N/A'
                : formatStrokesGained(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (roundData.length === 0) {
    return (
      <div className="mt-8">
        <h4 className="mb-4 text-ash">Strokes Gained Trend</h4>
        <div style={{
          background: 'var(--shadow)',
          padding: 'var(--spacing-8)',
          borderRadius: '4px',
          textAlign: 'center',
          color: 'var(--ash)'
        }}>
          No data available for the selected shot type
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-ash">Strokes Gained Trend</h4>

      {/* Controls */}
      <div className="flex gap-6 mb-5 flex-wrap items-center">
        {/* Shot Type Selector */}
        <div className="flex items-center gap-2">
          <label className="text-ash text-label font-medium">
            Shot Type:
          </label>
          <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value as SGShotCategory)}
 style={{ background: 'var(--shadow)',
              border: '1px solid var(--ash)',
              borderRadius: '4px',
              color: 'var(--chalk)',
              padding: 'var(--spacing-1-5) var(--spacing-3)',
              fontSize: 'var(--text-label)', cursor: 'pointer',
              minWidth: '120px' }}
          >
            {SHOT_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Moving Average Window Selector */}
        <div className="flex items-center gap-2">
          <label className="text-ash text-label font-medium">
            Moving Average:
          </label>
          <select
 value={movingAverageWindow}
 onChange={(e) => setMovingAverageWindow(Number(e.target.value))}
 style={{ background: 'var(--shadow)',
              border: '1px solid var(--ash)',
              borderRadius: '4px',
              color: 'var(--chalk)',
              padding: 'var(--spacing-1-5) var(--spacing-3)',
              fontSize: 'var(--text-label)', cursor: 'pointer',
              minWidth: '100px' }}
          >
            {MOVING_AVERAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Stats */}
        <div style={{ marginLeft: isNarrow ? 0 : 'auto', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2) var(--spacing-6)', fontSize: 'var(--text-label)' }}>
          <div>
            <span className="text-ash">Total Rounds: </span>
            <span className="text-chalk font-semibold">{roundData.length}</span>
          </div>
          <div>
            <span className="text-ash">Avg SG/Round: </span>
            <span style={{ color: getStrokeGainedColor(roundData.reduce((sum, r) => sum + r.strokesGained, 0) / roundData.length), fontWeight: 600 }}>
              {formatStrokesGained(roundData.reduce((sum, r) => sum + r.strokesGained, 0) / roundData.length)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height={isNarrow ? 260 : 350}>
          <ComposedChart data={chartData} margin={isNarrow ? { top: 12, right: 8, left: 0, bottom: 8 } : { top: 20, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.3} />
            <XAxis
 dataKey="label"
 stroke={COLORS.text}
 tick={{ fill: COLORS.text, fontSize: isNarrow ? 9 : 12 }}
 interval={isNarrow ? 'preserveStartEnd' : 0}
 minTickGap={isNarrow ? 24 : 0}
 angle={isNarrow ? 0 : -45}
 textAnchor={isNarrow ? 'middle' : 'end'}
 height={isNarrow ? 24 : 60}
            />
            <YAxis
 stroke={COLORS.text}
 tick={{ fill: COLORS.text, fontSize: isNarrow ? 9 : 12 }}
 width={isNarrow ? 34 : undefined}
 domain={yAxisDomain}
 tickFormatter={(value) => value.toFixed(1)}
 label={isNarrow ? undefined : {
                value: 'Strokes Gained',
                angle: -90,
                position: 'insideLeft',
                fill: COLORS.text,
                fontSize: 12,
                offset: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
 wrapperStyle={{ paddingTop: 'var(--spacing-2-5)' }}
 formatter={(value) => {
                if (value === 'strokesGained') return 'Strokes Gained';
                if (value === 'movingAverage') return `${movingAverageWindow}-Round Moving Avg`;
                return value;
              }}
            />
            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="var(--ash)" strokeOpacity={0.5} />
            {/* Bar for actual SG values */}
            <Bar
 dataKey="strokesGained"
 name="Strokes Gained"
 fill={COLORS.bar}
 maxBarSize={20}
 radius={[2, 2, 0, 0]}
            />
            {/* Line for moving average */}
            <Line
 type="monotone"
 dataKey="movingAverage"
 name={`${movingAverageWindow}-Round Moving Avg`}
 stroke={COLORS.line}
 strokeWidth={3}
 dot={{ fill: COLORS.line, r: 4 }}
 activeDot={{ r: 6, fill: COLORS.line }}
 connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div style={{ marginTop: 'var(--spacing-3)', fontSize: 'var(--text-label-sm)', color: 'var(--ash)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2) var(--spacing-6)' }}>
        <div className="flex items-center gap-1.5">
          <div style={{ width: '12px', height: '12px', background: COLORS.bar, borderRadius: '2px' }}></div>
          <span>Actual SG per round</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: '12px', height: '3px', background: COLORS.line, borderRadius: '1px' }}></div>
          <span>{movingAverageWindow}-round moving average trend</span>
        </div>
      </div>
    </div>
  );
}
