'use client';

import { useState } from 'react';
import type { ScoringMetrics, HoleOutcome, MentalMetrics, BirdieAndBogeyMetrics, ScoringRootCause } from '@/lib/golf/types';
import { getStrokeGainedColor, getRateColor, formatStrokesGained } from '@/lib/golf/tokens';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

// Root cause categories, in a fixed display order shared by both charts.
const ROOT_CAUSE_CATEGORIES: Array<{ name: string; key: keyof ScoringRootCause }> = [
  { name: 'Penalties', key: 'penalties' },
  { name: 'Driving', key: 'driving' },
  { name: 'Approach', key: 'approach' },
  { name: 'Lag Putts', key: 'lagPutts' },
  { name: 'Makeable Putts', key: 'makeablePutts' },
  { name: 'Short Game', key: 'shortGame' },
  { name: 'Recovery', key: 'recovery' },
];

function RootCauseChart({ title, rootCause, fill, isNarrow }: {
  title: string;
  rootCause: ScoringRootCause;
  fill: string;
  isNarrow: boolean;
}) {
  const data = ROOT_CAUSE_CATEGORIES.map(({ name, key }) => ({ name, count: rootCause[key] }));

  return (
    <div>
      <h5 className="mb-3 text-ash text-body-sm">{title}</h5>
      <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
        {/* 7 categories need ~40px each, or recharts drops ticks to fit */}
        <ResponsiveContainer width="100%" height={isNarrow ? 280 : 320}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--dark)" />
            <XAxis type="number" stroke="var(--ash)" fontSize={12} allowDecimals={false} />
            <YAxis
 dataKey="name"
 type="category"
 stroke="var(--ash)"
 fontSize={isNarrow ? 10 : 12}
 width={isNarrow ? 70 : 100}
 interval={0}
            />
            <Tooltip
 contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px' }}
 labelStyle={{ color: 'var(--chalk)' }}
            />
            <Bar dataKey="count" fill={fill} name="Count" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ScoringView({ metrics, birdieAndBogeyMetrics, mentalMetrics }: { metrics: ScoringMetrics; birdieAndBogeyMetrics: BirdieAndBogeyMetrics; mentalMetrics: MentalMetrics }) {
  const isNarrow = useMediaQuery(MOBILE_QUERY);
  const { holeOutcomes, totalHoles, par3, par4, par5 } = metrics;
  const { bogeyRates, birdieOpportunities, bogeyRootCause, doubleBogeyPlusRootCause, totalBogeys, totalDoubleBogeyPlus } = birdieAndBogeyMetrics;

  // Mental resilience metrics - destructured for use in ScoringView
  const {
    bounceBackPct,
    bounceBackCount,
    bounceBackTotal,
    dropOffPct,
    dropOffCount,
    dropOffTotal,
    gasPedalPct,
    gasPedalCount,
    gasPedalTotal,
    bogeyTrainPct,
    bogeyTrainCount,
    bogeyTrainTotal,
    driveAfterT5FailSG,
    driveAfterT5FailCount,
    driveAfterT5FailVsBenchmark,
  } = mentalMetrics;

  // Colors for hole outcomes - using semantic scoring colors
  const OUTCOME_COLORS: Record<HoleOutcome, string> = {
    'Eagle': '#00C07A',       // Green/Under par
    'Birdie': '#52D9A0',      // Mint/Gain
    'Par': '#8A8580',         // Gray/Even
    'Bogey': '#F59520',        // Amber/Bogey
    'Double Bogey+': '#E8202A', // Red/Over par
  };

  // Format data for donut chart
  const donutData = holeOutcomes.map(outcome => ({
    name: outcome.outcome,
    value: outcome.count,
    percentage: outcome.percentage.toFixed(0),
    scoreToPar: outcome.scoreToPar,
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
        <div className="text-label text-cement">
          Percentage: <span className="text-chalk">{data.percentage}%</span>
        </div>
      </div>
    );
  };

  // Mental resilience rate cards. Thresholds are per metric — a single generic
  // band would leave Gas Pedal (birdie+ after birdie+) permanently red.
  // A card with no opportunities scores 0/0, which is not a result: show it ash.
  const resilienceCards = [
    { label: 'Bounce Back %', pct: bounceBackPct, count: bounceBackCount, total: bounceBackTotal, good: 65, ok: 50, higherIsBetter: true },
    { label: 'Drop Off %', pct: dropOffPct, count: dropOffCount, total: dropOffTotal, good: 20, ok: 30, higherIsBetter: false },
    { label: 'Gas Pedal %', pct: gasPedalPct, count: gasPedalCount, total: gasPedalTotal, good: 25, ok: 15, higherIsBetter: true },
    { label: 'Bogey Train %', pct: bogeyTrainPct, count: bogeyTrainCount, total: bogeyTrainTotal, good: 25, ok: 35, higherIsBetter: false },
  ].map(card => ({
    ...card,
    color: card.total > 0
      ? getRateColor(card.pct, card.good, card.ok, card.higherIsBetter)
      : 'var(--ash)',
  }));

  // Par card data
  const parCards = [
    { label: 'Par 3', data: par3, color: '#3D8EF0' },
    { label: 'Par 4', data: par4, color: '#A855F7' },
    { label: 'Par 5', data: par5, color: '#06C8E0' },
  ];

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 className="mb-4 text-ash">Scoring by Par</h4>

      {/* Hero Cards - Par 3, Par 4, Par 5 */}
      <div className="grid-cards-3 gap-4 mb-6" >
        {parCards.map((card) => (
          <div
 key={card.label}
 className="card-hero"
 style={{ borderLeft: `4px solid ${card.color}` }}
          >
            <div className="flex justify-between items-center mb-4" >
              <div className="label text-ash text-body-sm" >{card.label}</div>
              <div className="text-label text-ash">{card.data.totalHoles} holes</div>
            </div>

            {/* Main Value: Avg Score */}
            <div className="value-hero" style={{ color: 'var(--chalk)', fontSize: '36px' }}>
              {card.data.totalHoles > 0 ? card.data.avgScore.toFixed(1) : '-'}
            </div>

            {/* Bottom row: Total SG and Avg vs Par */}
            <div className="flex justify-between mt-4" >
              <div>
                <div className="label text-ash" >Total SG</div>
                <div className="value-stat" style={{ color: getStrokeGainedColor(card.data.totalStrokesGained) }}>
                  {card.data.totalHoles > 0 ? formatStrokesGained(card.data.totalStrokesGained) : '-'}
                </div>
              </div>
              <div className="text-right">
                <div className="label text-ash" >Avg vs Par</div>
                <div className="value-stat" style={{
                  color: card.data.totalHoles > 0
                    ? (card.data.avgScoreVsPar < 0 ? 'var(--under)' : card.data.avgScoreVsPar > 0 ? 'var(--double)' : 'var(--ash)')
                    : 'var(--ash)'
                }}>
                  {card.data.totalHoles > 0
                    ? (card.data.avgScoreVsPar > 0 ? '+' : '') + card.data.avgScoreVsPar.toFixed(1)
                    : '-'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mental Resilience Section - Moved from Mental tab */}
      <div className="mt-6">
        <h4 className="mb-4 text-ash">Mental Resilience</h4>

        {/* Five Cards */}
        <div className="grid-tiles-5 gap-3" >
          {/* Cards 1-4: rate metrics, colored against their own thresholds */}
          {resilienceCards.map((card) => (
            <div key={card.label} className="card-stat" style={{ borderLeft: `3px solid ${card.color}` }}>
              <div className="label text-ash mb-2" >{card.label}</div>
              <div className="value-stat" style={{ color: card.color }}>
                {card.total > 0 ? `${card.pct.toFixed(0)}%` : '-'}
              </div>
              <div className="mt-2">
                <div className="label text-ash" >Count</div>
                <div className="value-stat text-label" >{card.count} / {card.total}</div>
              </div>
              <div className="label mt-2 text-ash" >
                {card.higherIsBetter ? 'Higher is better' : 'Lower is better'}
              </div>
            </div>
          ))}

          {/* Card 5: Drive after Tiger 5 Fail */}
          <div className="card-stat" style={{ borderLeft: '3px solid var(--pitch)' }}>
            <div className="label text-ash mb-2" >Drive after T5 Fail</div>
            <div className="value-stat" style={{ color: getStrokeGainedColor(driveAfterT5FailSG) }}>
              {formatStrokesGained(driveAfterT5FailSG)}
            </div>
            <div className="mt-2">
              <div className="label text-ash" >Drives</div>
              <div className="value-stat text-label" >{driveAfterT5FailCount}</div>
            </div>
            <div className="label mt-2 text-ash" >
              vs Avg: <span style={{ color: driveAfterT5FailVsBenchmark >= 0 ? 'var(--under)' : 'var(--scarlet)' }}>
                {driveAfterT5FailVsBenchmark >= 0 ? '+' : ''}{formatStrokesGained(driveAfterT5FailVsBenchmark)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Donut Chart and Bogey Rate on Same Row */}
      {holeOutcomes.length > 0 && (
        <div className="grid-pair gap-6 mb-6" >
          {/* Donut Chart - Hole Outcome Distribution */}
          <div>
            <h5 className="mb-3 text-ash text-body-sm">Outcome Distribution</h5>
            <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
              <p className="text-label-sm text-ash mb-4">
                Distribution of scores vs par across {totalHoles} holes
              </p>
              <ResponsiveContainer width="100%" height={isNarrow ? 220 : 280}>
                <PieChart>
                  <Pie
 data={donutData}
 cx="50%"
 cy="50%"
 innerRadius="42%"
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
 fill={OUTCOME_COLORS[entry.name as HoleOutcome] || '#6B7280'}
 stroke="var(--shadow)"
 strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  {/* Center text showing total holes */}
                  <text
 x="50%"
 y="46%"
 textAnchor="middle"
 dominantBaseline="middle"
 fill="var(--chalk)"
 style={{ fontSize: '24px', fontWeight: 'bold' }}
                  >
                    {totalHoles}
                  </text>
                  <text
 x="50%"
 y="58%"
 textAnchor="middle"
 dominantBaseline="middle"
 fill="var(--ash)"
 className="text-label-sm"
                  >
                    holes
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
          </div>

          {/* Bogey Rate Stacked Bar Chart */}
          <div>
            <h5 className="mb-3 text-ash text-body-sm">Bogey & Double Bogey+ Rate by Par</h5>
            <div style={{ background: 'var(--shadow)', padding: 'var(--spacing-4)', borderRadius: '4px' }}>
              <ResponsiveContainer width="100%" height={isNarrow ? 220 : 280}>
                <BarChart data={bogeyRates} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dark)" />
                  <XAxis dataKey="label" stroke="var(--ash)" fontSize={12} />
                  <YAxis stroke="var(--ash)" fontSize={12} unit="%" />
                  <Tooltip
 contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px' }}
 labelStyle={{ color: 'var(--chalk)' }}
 formatter={((value: number, name: string) => [`${value.toFixed(0)}%`, name === 'bogeyRate' ? 'Bogey' : 'Double Bogey+']) as never}
                  />
                  <Bar dataKey="bogeyRate" stackId="a" fill="#F59520" name="Bogey" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="doubleBogeyPlusRate" stackId="a" fill="#E8202A" name="Double Bogey+" radius={[0, 4, 4, 0]} />
                  <Legend
 formatter={(value) => <span className="text-ash text-label-sm">{value}</span>}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-label-sm text-ash mt-2">
                {totalBogeys} total bogeys, {totalDoubleBogeyPlus} double bogey+ across {bogeyRates[0]?.totalHoles} holes
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Bogey and Double Bogey+ Root Cause Charts - Side by Side */}
      <div className="grid-pair gap-6 mb-6" >
        <RootCauseChart
 title={`Bogey Root Cause (${totalBogeys} holes)`}
 rootCause={bogeyRootCause}
 fill="#F59520"
 isNarrow={isNarrow}
        />
        <RootCauseChart
 title={`Double Bogey+ Root Cause (${totalDoubleBogeyPlus} holes)`}
 rootCause={doubleBogeyPlusRootCause}
 fill="#E8202A"
 isNarrow={isNarrow}
        />
      </div>

      {/* Birdie Opportunities - Prominent Hero Cards */}
      <div className="mb-6 mt-8">
        <h4 className="mb-4 text-ash">Birdie Opportunities</h4>

        {/* Three Hero Cards for Birdie Opportunities */}
        <div className="grid-cards-3 gap-4" >
          {/* Card 1: Opportunities */}
          <div
 className="card-hero"
 style={{ borderLeft: '4px solid #3D8EF0' }}
          >
            <div className="flex justify-between items-center mb-4" >
              <div className="label text-ash text-body-sm" >Opportunities</div>
            </div>

            {/* Main Value */}
            <div className="value-hero" style={{ color: 'var(--chalk)', fontSize: '42px' }}>
              {birdieOpportunities.opportunities}
            </div>

            {/* Bottom Info */}
            <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
              <div className="label text-ash" >GIR with putt ≤ 20 ft</div>
            </div>
          </div>

          {/* Card 2: Conversions */}
          <div
 className="card-hero"
 style={{ borderLeft: '4px solid #52D9A0' }}
          >
            <div className="flex justify-between items-center mb-4" >
              <div className="label text-ash text-body-sm" >Conversions</div>
            </div>

            {/* Main Value */}
            <div className="value-hero" style={{ color: 'var(--under)', fontSize: '42px' }}>
              {birdieOpportunities.conversions}
            </div>

            {/* Bottom Info */}
            <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
              <div className="label text-ash" >Birdies made</div>
            </div>
          </div>

          {/* Card 3: Conversion % */}
          <div
 className="card-hero"
 style={{ borderLeft: '4px solid #F59520' }}
          >
            <div className="flex justify-between items-center mb-4" >
              <div className="label text-ash text-body-sm" >Conversion %</div>
            </div>

            {/* Main Value */}
            <div className="value-hero" style={{ color: birdieOpportunities.conversionPct >= 50 ? 'var(--under)' : 'var(--bogey)', fontSize: '42px' }}>
              {birdieOpportunities.conversionPct.toFixed(0)}%
            </div>

            {/* Bottom Info */}
            <div className="flex justify-between" style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-2) 0', borderTop: '1px solid var(--shadow)' }}>
              <div>
                <div className="label text-ash" >Made</div>
                <div className="value-stat">{birdieOpportunities.conversions}</div>
              </div>
              <div className="text-right">
                <div className="label text-ash" >Opportunities</div>
                <div className="value-stat">{birdieOpportunities.opportunities}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
