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
  bar: '#3D8EF0',      // Royal Blue
  line: '#A855F7',     // Court Purple
  grid: 'var(--ash)',
  text: 'var(--ash)',
  tooltipBg: 'var(--court)',
};

export function StrokesGainedTrendChart({ filteredShots }: StrokesGainedTrendChartProps) {
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
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>
          {data.fullLabel}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Round {data.roundNumber} • {data.shotCount} shots
        </div>
        {payload.map((entry, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            fontSize: '12px',
            color: entry.color,
            marginTop: '4px'
          }}>
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
      <div style={{ marginTop: '32px' }}>
        <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Strokes Gained Trend</h4>
        <div style={{
          background: 'var(--charcoal)',
          padding: '32px',
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
    <div style={{ marginTop: '32px' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Strokes Gained Trend</h4>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Shot Type Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: 'var(--ash)', fontSize: '12px', fontWeight: 500 }}>
            Shot Type:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as SGShotCategory)}
            style={{
              background: 'var(--charcoal)',
              border: '1px solid var(--ash)',
              borderRadius: '4px',
              color: 'var(--chalk)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '120px',
            }}
          >
            {SHOT_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Moving Average Window Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: 'var(--ash)', fontSize: '12px', fontWeight: 500 }}>
            Moving Average:
          </label>
          <select
            value={movingAverageWindow}
            onChange={(e) => setMovingAverageWindow(Number(e.target.value))}
            style={{
              background: 'var(--charcoal)',
              border: '1px solid var(--ash)',
              borderRadius: '4px',
              color: 'var(--chalk)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '100px',
            }}
          >
            {MOVING_AVERAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--ash)' }}>Total Rounds: </span>
            <span style={{ color: 'var(--chalk)', fontWeight: 600 }}>{roundData.length}</span>
          </div>
          <div>
            <span style={{ color: 'var(--ash)' }}>Avg SG/Round: </span>
            <span style={{ color: getStrokeGainedColor(roundData.reduce((sum, r) => sum + r.strokesGained, 0) / roundData.length), fontWeight: 600 }}>
              {formatStrokesGained(roundData.reduce((sum, r) => sum + r.strokesGained, 0) / roundData.length)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.3} />
            <XAxis
              dataKey="label"
              stroke={COLORS.text}
              tick={{ fill: COLORS.text, fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke={COLORS.text}
              tick={{ fill: COLORS.text, fontSize: 11 }}
              domain={yAxisDomain}
              tickFormatter={(value) => value.toFixed(1)}
              label={{
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
              wrapperStyle={{ paddingTop: '10px' }}
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
              barSize={20}
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
      <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--ash)', display: 'flex', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: COLORS.bar, borderRadius: '2px' }}></div>
          <span>Actual SG per round</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '3px', background: COLORS.line, borderRadius: '1px' }}></div>
          <span>{movingAverageWindow}-round moving average trend</span>
        </div>
      </div>
    </div>
  );
}
