'use client';

/**
 * Strokes Gained View - Hero card + stat cards for each shot type
 * SG Driving, SG Approach, SG Putting, SG Short Game, SG Recovery + Other
 */

import { useState } from 'react';
import type { Tiger5Metrics, ProcessedShot } from '@/lib/golf/types';
import { getStrokeGainedColor, formatStrokesGained } from '@/lib/golf/tokens';
import { StrokesGainedTrendChart } from './StrokesGainedTrendChart';

export function StrokesGainedView({ metrics, filteredShots }: { metrics: Tiger5Metrics; filteredShots: ProcessedShot[] }) {
  const { totalStrokesGained, byCategory, sgSeparators } = metrics;
  const [sgDisplayMode, setSgDisplayMode] = useState<'total' | 'average'>('total');

  // Calculate total holes played (unique round-hole combinations)
  const uniqueHoles = new Set(filteredShots.map(s => `${s.roundId}-${s.holeNumber}`));
  const totalHoles = uniqueHoles.size;
  const sgPerHole = totalHoles > 0 ? totalStrokesGained / totalHoles : 0;

  // Build SG per hole by shot type data
  const shotTypes = ['Driving', 'Approach', 'Short Game', 'Putting', 'Other'] as const;
  type TableShotType = typeof shotTypes[number];

  // Initialize data structure: shotType -> hole -> { totalSG, shotCount, avgSG }
  const sgByHoleAndType = new Map<TableShotType, Map<number, { totalSG: number; shotCount: number; avgSG: number }>>();

  shotTypes.forEach(st => {
    sgByHoleAndType.set(st, new Map());
  });

  // Process each shot
  filteredShots.forEach(shot => {
    // Map shotType to our table categories
    let tableShotType: TableShotType;
    switch (shot.shotType) {
      case 'Drive':
        tableShotType = 'Driving';
        break;
      case 'Approach':
        tableShotType = 'Approach';
        break;
      case 'Short Game':
        tableShotType = 'Short Game';
        break;
      case 'Putt':
        tableShotType = 'Putting';
        break;
      case 'Recovery':
      default:
        tableShotType = 'Other';
        break;
    }

    const holeMap = sgByHoleAndType.get(tableShotType)!;
    const holeData = holeMap.get(shot.holeNumber) || { totalSG: 0, shotCount: 0, avgSG: 0 };
    holeData.totalSG += shot.calculatedStrokesGained;
    holeData.shotCount += 1;
    holeData.avgSG = holeData.shotCount > 0 ? holeData.totalSG / holeData.shotCount : 0;
    holeMap.set(shot.holeNumber, holeData);
  });

  // Calculate totals for each shot type
  const totalsByShotType = new Map<TableShotType, { totalSG: number; shotCount: number; avgSG: number }>();
  shotTypes.forEach(st => {
    const holeMap = sgByHoleAndType.get(st)!;
    let totalSG = 0;
    let shotCount = 0;
    holeMap.forEach(holeData => {
      totalSG += holeData.totalSG;
      shotCount += holeData.shotCount;
    });
    totalsByShotType.set(st, {
      totalSG,
      shotCount,
      avgSG: shotCount > 0 ? totalSG / shotCount : 0
    });
  });

  // Calculate totals for each hole (across all shot types)
  const totalsByHole = new Map<number, { totalSG: number; shotCount: number; avgSG: number }>();
  for (let hole = 1; hole <= 18; hole++) {
    let totalSG = 0;
    let shotCount = 0;
    shotTypes.forEach(st => {
      const holeMap = sgByHoleAndType.get(st)!;
      const holeData = holeMap.get(hole);
      if (holeData) {
        totalSG += holeData.totalSG;
        shotCount += holeData.shotCount;
      }
    });
    totalsByHole.set(hole, {
      totalSG,
      shotCount,
      avgSG: shotCount > 0 ? totalSG / shotCount : 0
    });
  }

  // Build category data for stat cards
  // Map existing categories: Drive, Approach, Short Game, Putt
  // For Recovery + Other: combine Recovery shots with any edge cases
  const categoryData = byCategory.map(cat => ({
    type: cat.type,
    totalShots: cat.totalShots,
    strokesGained: cat.strokesGained,
    avgStrokesGained: cat.avgStrokesGained,
  }));

  // Find Recovery shots for "Recovery + Other"
  const recoveryShots = filteredShots.filter(s => s.shotType === 'Recovery');
  const recoverySG = recoveryShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);

  // Build stat cards data
  const statCards = [
    {
      id: 'driving',
      label: 'Driving',
      category: categoryData.find(c => c.type === 'Drive'),
      accentColor: '',
    },
    {
      id: 'approach',
      label: 'Approach',
      category: categoryData.find(c => c.type === 'Approach'),
      accentColor: '',
    },
    {
      id: 'putting',
      label: 'Putting',
      category: categoryData.find(c => c.type === 'Putt'),
      accentColor: '',
    },
    {
      id: 'shortgame',
      label: 'Short Game',
      category: categoryData.find(c => c.type === 'Short Game'),
      accentColor: '',
    },
    {
      id: 'recovery',
      label: 'Recovery + Other',
      category: {
        type: 'Recovery + Other',
        totalShots: recoveryShots.length,
        strokesGained: recoverySG,
        avgStrokesGained: recoveryShots.length > 0 ? recoverySG / recoveryShots.length : 0,
      },
      accentColor: '',
    },
  ];

  // Find highest and lowest SG values for accent colors
  const sgValues = statCards.map(card => card.category?.avgStrokesGained ?? 0);
  const highestSG = Math.max(...sgValues);
  const lowestSG = Math.min(...sgValues);

  // Apply accent colors (green for highest, red for lowest)
  statCards.forEach(card => {
    const sg = card.category?.avgStrokesGained ?? 0;
    if (sg === highestSG && highestSG !== lowestSG) {
      card.accentColor = 'var(--under)'; // Green
    } else if (sg === lowestSG && highestSG !== lowestSG) {
      card.accentColor = 'var(--scarlet)'; // Red
    }
  });

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 className="mb-4 text-ash">Strokes Gained</h4>

      {/* Hero Card - Total SG */}
      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--spacing-4)', maxWidth: '400px' }}>
        <div className="card-hero is-flagship">
          <div className="flex justify-between items-center mb-4 gap-3" >
            <div className="label" style={{ color: 'var(--scarlet)' }}>Total SG</div>
            <div style={{ width: '6px', height: '6px', background: 'var(--scarlet)', borderRadius: '50%' }}></div>
          </div>
          <div className="value-hero" style={{ color: getStrokeGainedColor(totalStrokesGained) }}>
            {formatStrokesGained(totalStrokesGained)}
          </div>
          <div className="flex justify-between mt-4 gap-3" >
            <div>
              <div className="label text-ash" >SG / Hole</div>
              <div className="value-stat" style={{ color: getStrokeGainedColor(sgPerHole) }}>
                {formatStrokesGained(sgPerHole)}
              </div>
            </div>
            <div className="text-right">
              <div className="label text-ash" >Total Holes</div>
              <div className="value-stat">{totalHoles}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards - SG by Shot Type */}
      <div className="grid-tiles-5 gap-3 mt-6" >
        {statCards.map((card) => {
          const cat = card.category;
          if (!cat || cat.totalShots === 0) return null;

          return (
            <div
 key={card.id}
 className="card-stat"
 style={{
                borderLeft: card.accentColor ? `3px solid ${card.accentColor}` : '3px solid var(--pitch)',
                background: card.accentColor ? 'var(--shadow)' : 'var(--shadow)',
              }}
            >
              <div className="label text-ash mb-3" >
                {card.label}
              </div>
              <div
 className="value-stat"
 style={{ color: getStrokeGainedColor(cat.strokesGained) }}
              >
                {formatStrokesGained(cat.strokesGained)}
              </div>
              <div className="flex justify-between mt-3 gap-3" >
                <div>
                  <div className="label text-ash" >SG / Shot</div>
                  <div
 className="value-stat"
 style={{ color: getStrokeGainedColor(cat.avgStrokesGained), fontSize: 'var(--text-label)' }}
                  >
                    {formatStrokesGained(cat.avgStrokesGained)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="label text-ash" >Shots</div>
                  <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{cat.totalShots}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend for accents */}
      <div className="mt-4 flex gap-6 text-label-sm text-ash">
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'var(--under)', borderRadius: '2px' }}></div>
          <span>Highest SG</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'var(--scarlet)', borderRadius: '2px' }}></div>
          <span>Lowest SG</span>
        </div>
      </div>

      {/* SG Separators Section - Distance-based SG breakdown */}
      <div className="mt-8">
        <h4 className="mb-4 text-ash">Strokes Gained Separators</h4>
        <p className="text-label text-ash mb-4">
          SG breakdown by distance categories
        </p>

        <div className="grid-tiles-5 gap-3" >
          {sgSeparators.map((separator) => {
            return (
              <div
 key={separator.label}
 className="card-stat"
 style={{ borderLeft: '3px solid var(--pitch)' }}
              >
                <div className="label text-ash mb-1" >
                  {separator.label}
                </div>
                <div className="label text-ash mb-3" >
                  {separator.description}
                </div>
                <div
 className="value-stat"
 style={{ color: getStrokeGainedColor(separator.strokesGained) }}
                >
                  {formatStrokesGained(separator.strokesGained)}
                </div>
                <div className="flex justify-between mt-3 gap-3" >
                  <div>
                    <div className="label text-ash" >SG / Shot</div>
                    <div
 className="value-stat"
 style={{ color: getStrokeGainedColor(separator.avgStrokesGained), fontSize: 'var(--text-label)' }}
                    >
                      {formatStrokesGained(separator.avgStrokesGained)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="label text-ash" >Shots</div>
                    <div className="value-stat"  style={{ fontSize: 'var(--text-label)' }}>{separator.totalShots}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SG Per Hole By Shot Type Table */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-ash">SG by Hole & Shot Type</h4>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-ash text-label">
              <input
 type="radio"
 name="sgDisplayMode"
 checked={sgDisplayMode === 'total'}
 onChange={() => setSgDisplayMode('total')}
 style={{ accentColor: 'var(--scarlet)' }}
              />
              Total SG
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-ash text-label">
              <input
 type="radio"
 name="sgDisplayMode"
 checked={sgDisplayMode === 'average'}
 onChange={() => setSgDisplayMode('average')}
 style={{ accentColor: 'var(--scarlet)' }}
              />
              Avg SG / Shot
            </label>
          </div>
        </div>

        <div style={{ background: 'var(--shadow)', borderRadius: '4px', overflow: 'hidden' }}>
          <div className="gi-table-scroll">
            <table style={{ minWidth: '520px', width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pitch)' }}>
                  <th style={{ padding: 'var(--spacing-2-5) var(--spacing-3)', textAlign: 'left', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', position: 'sticky', left: 0, zIndex: 1 }}>
                    Shot Type
                  </th>
                  {[...Array(18)].map((_, i) => (
                    <th key={i + 1} style={{ padding: 'var(--spacing-2-5) var(--spacing-2)', textAlign: 'center', color: 'var(--ash)', fontWeight: 600, minWidth: '40px' }}>
                      {i + 1}
                    </th>
                  ))}
                  <th style={{ padding: 'var(--spacing-2-5) var(--spacing-3)', textAlign: 'center', color: 'var(--ash)', fontWeight: 600, background: 'var(--obsidian)', minWidth: '50px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {shotTypes.map((shotType) => {
                  const holeMap = sgByHoleAndType.get(shotType)!;
                  const totals = totalsByShotType.get(shotType)!;

                  return (
                    <tr key={shotType} style={{ borderBottom: '1px solid var(--pitch)' }}>
                      <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 500, background: 'var(--obsidian)', position: 'sticky', left: 0, zIndex: 1 }}>
                        {shotType}
                      </td>
                      {[...Array(18)].map((_, i) => {
                        const holeNum = i + 1;
                        const holeData = holeMap.get(holeNum);
                        const value = holeData ? (sgDisplayMode === 'total' ? holeData.totalSG : holeData.avgSG) : 0;
                        const hasData = holeData && holeData.shotCount > 0;

                        return (
                          <td
 key={holeNum}
 style={{ padding: 'var(--spacing-2) var(--spacing-1)',
                              textAlign: 'center',
                              color: hasData ? getStrokeGainedColor(value) : 'var(--ash)',
                              opacity: hasData ? 1 : 0.3,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-label-sm)' }}
                          >
                            {hasData ? formatStrokesGained(value) : '-'}
                          </td>
                        );
                      })}
                      <td
 style={{ padding: 'var(--spacing-2) var(--spacing-3)',
                          textAlign: 'center',
                          color: getStrokeGainedColor(sgDisplayMode === 'total' ? totals.totalSG : totals.avgSG),
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-label-sm)', fontWeight: 600,
                          background: 'var(--obsidian)' }}
                      >
                        {formatStrokesGained(sgDisplayMode === 'total' ? totals.totalSG : totals.avgSG)}
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row - sums across all shot types for each hole */}
                <tr style={{ borderTop: '2px solid var(--pitch)', background: 'var(--obsidian)' }}>
                  <td style={{ padding: 'var(--spacing-2-5) var(--spacing-3)', color: 'var(--chalk)', fontWeight: 700, position: 'sticky', left: 0, zIndex: 1 }}>
                    Total
                  </td>
                  {[...Array(18)].map((_, i) => {
                    const holeNum = i + 1;
                    const holeTotal = totalsByHole.get(holeNum)!;
                    const value = sgDisplayMode === 'total' ? holeTotal.totalSG : holeTotal.avgSG;
                    const hasData = holeTotal.shotCount > 0;

                    return (
                      <td
 key={holeNum}
 style={{ padding: 'var(--spacing-2-5) var(--spacing-1)',
                          textAlign: 'center',
                          color: hasData ? getStrokeGainedColor(value) : 'var(--ash)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-label-sm)', fontWeight: 600 }}
                      >
                        {hasData ? formatStrokesGained(value) : '-'}
                      </td>
                    );
                  })}
                  <td
 style={{ padding: 'var(--spacing-2-5) var(--spacing-3)',
                      textAlign: 'center',
                      color: getStrokeGainedColor(sgDisplayMode === 'total' ? totalStrokesGained : metrics.avgStrokesGained),
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-label-sm)', fontWeight: 700 }}
                  >
                    {formatStrokesGained(sgDisplayMode === 'total' ? totalStrokesGained : metrics.avgStrokesGained)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Strokes Gained Trend Chart */}
      <StrokesGainedTrendChart filteredShots={filteredShots} />
    </div>
  )
}
