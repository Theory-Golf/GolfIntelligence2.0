'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EthosChartSpec } from './chartSpec';

const SERIES_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

export default function EthosLineChart({ spec }: { spec: EthosChartSpec }) {
  return (
    <div className="my-8 border border-border bg-card p-5">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={spec.data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--ash)" strokeOpacity={0.15} vertical={false} />
          <XAxis
            dataKey={spec.xKey}
            stroke="var(--ash)"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--ash)' }}
            label={
              spec.xLabel
                ? { value: spec.xLabel, position: 'insideBottom', offset: -4, fill: 'var(--ash)', fontSize: 11 }
                : undefined
            }
          />
          <YAxis
            stroke="var(--ash)"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--ash)' }}
            label={
              spec.yLabel
                ? { value: spec.yLabel, angle: -90, position: 'insideLeft', fill: 'var(--ash)', fontSize: 11 }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border-color)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--foreground)' }}
          />
          <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' }} />
          {spec.series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
