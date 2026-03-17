'use client';

import { useState } from 'react';
import type { ScoringMetrics, HoleOutcome, MentalMetrics, BirdieAndBogeyMetrics } from '@/lib/golf/types';
import { getStrokeGainedColor, formatStrokesGained } from '@/lib/golf/tokens';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function ScoringView({ metrics, birdieAndBogeyMetrics, mentalMetrics }: { metrics: ScoringMetrics; birdieAndBogeyMetrics: BirdieAndBogeyMetrics; mentalMetrics: MentalMetrics }) {
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
    percentage: outcome.percentage.toFixed(1),
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
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--chalk)', fontWeight: 600, marginBottom: '8px' }}>
          {data.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)', marginBottom: '4px' }}>
          Count: <span style={{ color: 'var(--chalk)' }}>{data.value}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cement)' }}>
          Percentage: <span style={{ color: 'var(--chalk)' }}>{data.percentage}%</span>
        </div>
      </div>
    );
  };

  // Par card data
  const parCards = [
    { label: 'Par 3', data: par3, color: '#3D8EF0' },
    { label: 'Par 4', data: par4, color: '#A855F7' },
    { label: 'Par 5', data: par5, color: '#06C8E0' },
  ];

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Scoring by Par</h4>

      {/* Hero Cards - Par 3, Par 4, Par 5 */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {parCards.map((card) => (
          <div
            key={card.label}
            className="card-hero"
            style={{ borderLeft: `4px solid ${card.color}` }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '14px' }}>{card.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--ash)' }}>{card.data.totalHoles} holes</div>
            </div>

            {/* Main Value: Avg Score */}
            <div className="value-hero" style={{ color: 'var(--chalk)', fontSize: '36px' }}>
              {card.data.totalHoles > 0 ? card.data.avgScore.toFixed(1) : '-'}
            </div>

            {/* Bottom row: Total SG and Avg vs Par */}
            <div className="flex justify-between" style={{ marginTop: '16px' }}>
              <div>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Total SG</div>
                <div className="value-stat" style={{ color: getStrokeGainedColor(card.data.totalStrokesGained) }}>
                  {card.data.totalHoles > 0 ? formatStrokesGained(card.data.totalStrokesGained) : '-'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Avg vs Par</div>
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
      <div style={{ marginTop: '24px' }}>
        <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Mental Resilience</h4>

        {/* Five Cards */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {/* Card 1: Bounce Back % */}
          <div className="card-stat" style={{ borderLeft: '3px solid var(--under)' }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Bounce Back %</div>
            <div className="value-stat" style={{ color: 'var(--under)' }}>{bounceBackPct.toFixed(1)}%</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>Count</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{bounceBackCount} / {bounceBackTotal}</div>
            </div>
            <div className="label" style={{ fontSize: '10px', marginTop: '8px', color: 'var(--ash)' }}>Higher is better</div>
          </div>

          {/* Card 2: Drop Off % */}
          <div className="card-stat" style={{ borderLeft: '3px solid var(--scarlet)' }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Drop Off %</div>
            <div className="value-stat" style={{ color: 'var(--scarlet)' }}>{dropOffPct.toFixed(1)}%</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>Count</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{dropOffCount} / {dropOffTotal}</div>
            </div>
            <div className="label" style={{ fontSize: '10px', marginTop: '8px', color: 'var(--ash)' }}>Lower is better</div>
          </div>

          {/* Card 3: Gas Pedal % */}
          <div className="card-stat" style={{ borderLeft: '3px solid var(--under)' }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Gas Pedal %</div>
            <div className="value-stat" style={{ color: 'var(--under)' }}>{gasPedalPct.toFixed(1)}%</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>Count</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{gasPedalCount} / {gasPedalTotal}</div>
            </div>
            <div className="label" style={{ fontSize: '10px', marginTop: '8px', color: 'var(--ash)' }}>Higher is better</div>
          </div>

          {/* Card 4: Bogey Train % */}
          <div className="card-stat" style={{ borderLeft: '3px solid var(--scarlet)' }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Bogey Train %</div>
            <div className="value-stat" style={{ color: 'var(--scarlet)' }}>{bogeyTrainPct.toFixed(1)}%</div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>Count</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{bogeyTrainCount} / {bogeyTrainTotal}</div>
            </div>
            <div className="label" style={{ fontSize: '10px', marginTop: '8px', color: 'var(--ash)' }}>Lower is better</div>
          </div>

          {/* Card 5: Drive after Tiger 5 Fail */}
          <div className="card-stat" style={{ borderLeft: '3px solid var(--pitch)' }}>
            <div className="label" style={{ color: 'var(--ash)', marginBottom: '8px' }}>Drive after T5 Fail</div>
            <div className="value-stat" style={{ color: getStrokeGainedColor(driveAfterT5FailSG) }}>
              {formatStrokesGained(driveAfterT5FailSG)}
            </div>
            <div style={{ marginTop: '8px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '9px' }}>Drives</div>
              <div className="value-stat" style={{ fontSize: '12px' }}>{driveAfterT5FailCount}</div>
            </div>
            <div className="label" style={{ fontSize: '10px', marginTop: '8px', color: 'var(--ash)' }}>
              vs Avg: <span style={{ color: driveAfterT5FailVsBenchmark >= 0 ? 'var(--under)' : 'var(--scarlet)' }}>
                {driveAfterT5FailVsBenchmark >= 0 ? '+' : ''}{formatStrokesGained(driveAfterT5FailVsBenchmark)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Heading for Distribution */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Hole Outcome Distribution</h4>

      {/* Donut Chart and Bogey Rate on Same Row */}
      {holeOutcomes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Donut Chart - Hole Outcome Distribution */}
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <p style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '16px' }}>
              Distribution of scores vs par across {totalHoles} holes
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {donutData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={OUTCOME_COLORS[entry.name as HoleOutcome] || '#6B7280'}
                      stroke="var(--charcoal)"
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
                  style={{ fontSize: '11px' }}
                >
                  holes
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

          {/* Bogey Rate Stacked Bar Chart */}
          <div>
            <h5 style={{ marginBottom: '12px', color: 'var(--ash)', fontSize: '14px' }}>Bogey & Double Bogey+ Rate by Par</h5>
            <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bogeyRates} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dark)" />
                  <XAxis dataKey="label" stroke="var(--ash)" fontSize={11} />
                  <YAxis stroke="var(--ash)" fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px' }}
                    labelStyle={{ color: 'var(--chalk)' }}
                    formatter={((value: number, name: string) => [`${value.toFixed(1)}%`, name === 'bogeyRate' ? 'Bogey' : 'Double Bogey+']) as never}
                  />
                  <Bar dataKey="bogeyRate" stackId="a" fill="#F59520" name="Bogey" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="doubleBogeyPlusRate" stackId="a" fill="#E8202A" name="Double Bogey+" radius={[0, 4, 4, 0]} />
                  <Legend
                    formatter={(value) => <span style={{ color: 'var(--ash)', fontSize: '11px' }}>{value}</span>}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: '11px', color: 'var(--ash)', marginTop: '8px' }}>
                {totalBogeys} total bogeys, {totalDoubleBogeyPlus} double bogey+ across {bogeyRates[0]?.totalHoles} holes
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Bogey and Double Bogey+ Root Cause Charts - Side by Side */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {/* Bogey Root Cause Chart */}
        <div style={{ flex: 1 }}>
          <h5 style={{ marginBottom: '12px', color: 'var(--ash)', fontSize: '14px' }}>Bogey Root Cause ({totalBogeys} holes)</h5>
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  { name: 'Penalties', count: bogeyRootCause.penalties },
                  { name: 'Driving', count: bogeyRootCause.driving },
                  { name: 'Approach', count: bogeyRootCause.approach },
                  { name: 'Lag Putts', count: bogeyRootCause.lagPutts },
                  { name: 'Makeable Putts', count: bogeyRootCause.makeablePutts },
                  { name: 'Short Game', count: bogeyRootCause.shortGame },
                  { name: 'Recovery', count: bogeyRootCause.recovery },
                ]}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dark)" />
                <XAxis type="number" stroke="var(--ash)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="var(--ash)" fontSize={10} width={80} />
                <Tooltip
                  contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px' }}
                  labelStyle={{ color: 'var(--chalk)' }}
                />
                <Bar dataKey="count" fill="#F59520" name="Count" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Double Bogey+ Root Cause Chart */}
        <div style={{ flex: 1 }}>
          <h5 style={{ marginBottom: '12px', color: 'var(--ash)', fontSize: '14px' }}>Double Bogey+ Root Cause ({totalDoubleBogeyPlus} holes)</h5>
          <div style={{ background: 'var(--charcoal)', padding: '16px', borderRadius: '4px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  { name: 'Penalties', count: doubleBogeyPlusRootCause.penalties },
                  { name: 'Driving', count: doubleBogeyPlusRootCause.driving },
                  { name: 'Approach', count: doubleBogeyPlusRootCause.approach },
                  { name: 'Lag Putts', count: doubleBogeyPlusRootCause.lagPutts },
                  { name: 'Makeable Putts', count: doubleBogeyPlusRootCause.makeablePutts },
                  { name: 'Short Game', count: doubleBogeyPlusRootCause.shortGame },
                  { name: 'Recovery', count: doubleBogeyPlusRootCause.recovery },
                ]}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dark)" />
                <XAxis type="number" stroke="var(--ash)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="var(--ash)" fontSize={10} width={80} />
                <Tooltip
                  contentStyle={{ background: 'var(--court)', border: '1px solid var(--scarlet)', borderRadius: '4px' }}
                  labelStyle={{ color: 'var(--chalk)' }}
                />
                <Bar dataKey="count" fill="#E8202A" name="Count" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Birdie Opportunities - Prominent Hero Cards */}
      <div style={{ marginBottom: '24px', marginTop: '32px' }}>
        <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Birdie Opportunities</h4>

        {/* Three Hero Cards for Birdie Opportunities */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Card 1: Opportunities */}
          <div
            className="card-hero"
            style={{ borderLeft: '4px solid #3D8EF0' }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '14px' }}>Opportunities</div>
            </div>

            {/* Main Value */}
            <div className="value-hero" style={{ color: 'var(--chalk)', fontSize: '42px' }}>
              {birdieOpportunities.opportunities}
            </div>

            {/* Bottom Info */}
            <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>GIR with putt ≤ 20 ft</div>
            </div>
          </div>

          {/* Card 2: Conversions */}
          <div
            className="card-hero"
            style={{ borderLeft: '4px solid #52D9A0' }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '14px' }}>Conversions</div>
            </div>

            {/* Main Value */}
            <div className="value-hero" style={{ color: 'var(--under)', fontSize: '42px' }}>
              {birdieOpportunities.conversions}
            </div>

            {/* Bottom Info */}
            <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '12px' }}>Birdies made</div>
            </div>
          </div>

          {/* Card 3: Conversion % */}
          <div
            className="card-hero"
            style={{ borderLeft: '4px solid #F59520' }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <div className="label" style={{ color: 'var(--ash)', fontSize: '14px' }}>Conversion %</div>
            </div>

            {/* Main Value */}
            <div className="value-hero" style={{ color: birdieOpportunities.conversionPct >= 50 ? 'var(--under)' : 'var(--bogey)', fontSize: '42px' }}>
              {birdieOpportunities.conversionPct.toFixed(1)}%
            </div>

            {/* Bottom Info */}
            <div className="flex justify-between" style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid var(--charcoal)' }}>
              <div>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Made</div>
                <div className="value-stat">{birdieOpportunities.conversions}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label" style={{ color: 'var(--ash)', fontSize: '11px' }}>Opportunities</div>
                <div className="value-stat">{birdieOpportunities.opportunities}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
