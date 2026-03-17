'use client';

import { useState } from 'react';
import type { CoachTableMetrics } from '@/lib/golf/types';
import { getStrokeGainedColor, formatStrokesGained } from '@/lib/golf/tokens';

export function CoachingView({ metrics }: { metrics: CoachTableMetrics }) {
  const [displayMode, setDisplayMode] = useState<'perRound' | 'total'>('perRound');
  const [valueMode, setValueMode] = useState<'value' | 'rank'>('value');
  const [sortColumn, setSortColumn] = useState<string>('player');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { players } = metrics;

  // Define columns with their data keys and display names
  // alwaysTotal: column always shows total value regardless of displayMode toggle
  // alwaysPerRound: column always shows per-round average regardless of displayMode toggle
  const columns = [
    { key: 'player', label: 'Player', isPlayer: true },
    { key: 'totalRounds', label: 'Rnd', alwaysTotal: true },
    { key: 'avgScore', label: 'Avg', alwaysPerRound: true },
    { key: 'totalT5Fails', label: 'T5F' },
    { key: 'threePutts', label: '3Put' },
    { key: 'doubleBogey', label: 'Dbl' },
    { key: 'par5Bogey', label: 'P5B' },
    { key: 'missedGreen', label: 'Msg' },
    { key: 'bogeyApproach', label: '125B' },
    { key: 'bounceBackPct', label: 'Bnc%', isPercent: true, alwaysTotal: true },
    { key: 'dropOffPct', label: 'Drp%', isPercent: true, alwaysTotal: true },
    { key: 'gasPedalPct', label: 'Gas%', isPercent: true, alwaysTotal: true },
    { key: 'bogeyTrainPct', label: 'Trn%', isPercent: true, alwaysTotal: true },
    { key: 'totalStrokesGained', label: 'SG', isSG: true },
    { key: 'sgDriving', label: 'SG Drv', isSG: true },
    { key: 'penaltyRate', label: 'Pnl%', isPercent: true, alwaysTotal: true },
    { key: 'sgApproach', label: 'SG Apr', isSG: true },
    { key: 'girPct', label: 'GIR%', isPercent: true, alwaysTotal: true },
    { key: 'sgPutting', label: 'SG Putt', isSG: true },
    { key: 'sg5to12Ft', label: 'SG 5-12', isSG: true },
    { key: 'poorLagPuttPct', label: 'PLag%', isPercent: true, invertPercent: true, alwaysTotal: true },
    { key: 'sgShortGame', label: 'SG SG', isSG: true },
  ];

  // Sort players based on current sort column and direction
  const sortedPlayers = [...players].sort((a, b) => {
    let aVal = a[sortColumn as keyof typeof a];
    let bVal = b[sortColumn as keyof typeof b];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = (bVal as string).toLowerCase();
    }

    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Calculate ranks for each metric
  const calculateRank = (columnKey: string) => {
    const sorted = [...players].sort((a, b) => {
      const aVal = a[columnKey as keyof typeof a];
      const bVal = b[columnKey as keyof typeof b];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      // For percentages, lower is better for some (penalty, poor lag), higher is better for others
      return (bVal as number) - (aVal as number);
    });
    return new Map(sorted.map((p, i) => [p.player, i + 1]));
  };

  // Handle column header click for sorting
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Format value based on column type
  // Takes into account alwaysTotal and alwaysPerRound flags
  const formatValue = (column: typeof columns[0], value: number | string | undefined, player: typeof players[0]) => {
    if (value === undefined || value === null) return '-';

    if (column.isPlayer) return value;

    if (valueMode === 'rank') {
      const rankMap = calculateRank(column.key);
      return rankMap.get(player.player) || '-';
    }

    // Determine effective display mode for this column
    // If column has alwaysTotal or alwaysPerRound flag, use that instead of global displayMode
    let effectiveDisplayMode: 'perRound' | 'total' = displayMode;
    if (column.alwaysTotal) {
      effectiveDisplayMode = 'total';
    } else if (column.alwaysPerRound) {
      effectiveDisplayMode = 'perRound';
    }

    if (effectiveDisplayMode === 'perRound' && !column.isPlayer && typeof value === 'number') {
      // For per round, divide by rounds
      const perRound = player.totalRounds > 0 ? value / player.totalRounds : 0;
      if (column.isPercent) return `${perRound.toFixed(1)}%`;
      if (column.isSG) return formatStrokesGained(perRound);
      return perRound.toFixed(1);
    }

    if (column.isPercent) return `${(value as number).toFixed(1)}%`;
    if (column.isSG) return formatStrokesGained(value as number);
    if (typeof value === 'number') return value.toFixed(1);
    return value;
  };

  // Get color for SG values - uses the raw total value for coloring regardless of display mode
  const getValueColor = (column: typeof columns[0], value: number | undefined): string => {
    if (value === undefined || value === null) return 'var(--ash)';
    if (column.isSG) return getStrokeGainedColor(value);
    if (column.isPercent) {
      if (column.invertPercent) {
        // Lower is better (e.g., Poor Lag %, Penalty %)
        if (value < 10) return 'var(--under)';
        if (value < 20) return 'var(--bogey)';
        return 'var(--double)';
      }
      // Higher is better (e.g., Bounce Back %, GIR %)
      if (value > 60) return 'var(--under)';
      if (value > 40) return 'var(--bogey)';
      return 'var(--double)';
    }
    return 'var(--chalk)';
  };

  if (players.length === 0) {
    return (
      <div className="content">
        <div className="card">
          <p>No player data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Coach Table</h4>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Display Mode Radio Buttons */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: displayMode === 'perRound' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === 'perRound'}
              onChange={() => setDisplayMode('perRound')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Avg / Round
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: displayMode === 'total' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === 'total'}
              onChange={() => setDisplayMode('total')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Total
          </label>
        </div>

        {/* Value Mode Radio Buttons */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: valueMode === 'value' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="valueMode"
              checked={valueMode === 'value'}
              onChange={() => setValueMode('value')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Value
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: valueMode === 'rank' ? 'var(--chalk)' : 'var(--ash)', fontSize: '13px' }}>
            <input
              type="radio"
              name="valueMode"
              checked={valueMode === 'rank'}
              onChange={() => setValueMode('rank')}
              style={{ accentColor: 'var(--scarlet)' }}
            />
            Rank
          </label>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--charcoal)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--pitch)', background: 'var(--obsidian)', position: 'sticky', top: 0, zIndex: 10 }}>
                {columns.map(column => (
                  <th
                    key={column.key}
                    onClick={() => !column.isPlayer && handleSort(column.key)}
                    style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      color: 'var(--ash)',
                      fontWeight: 600,
                      cursor: column.isPlayer ? 'default' : 'pointer',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      borderRight: '1px solid var(--charcoal)',
                    }}
                  >
                    {column.label}
                    {sortColumn === column.key && (
                      <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, idx) => (
                <tr
                  key={player.player}
                  style={{
                    borderBottom: '1px solid var(--pitch)',
                    background: idx % 2 === 0 ? 'var(--charcoal)' : 'var(--obsidian)',
                  }}
                >
                  {columns.map(column => {
                    const value = player[column.key as keyof typeof player];
                    return (
                      <td
                        key={column.key}
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          color: column.isPlayer ? 'var(--chalk)' : getValueColor(column, value as number),
                          fontFamily: column.isPlayer ? 'var(--font-sans)' : 'var(--font-mono)',
                          fontWeight: column.isPlayer ? 500 : 400,
                          fontSize: column.isPlayer ? '12px' : '10px',
                        }}
                      >
                        {formatValue(column, value as number | string, player)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '11px', color: 'var(--ash)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--under)', borderRadius: '2px' }}></div>
          <span>Good</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--bogey)', borderRadius: '2px' }}></div>
          <span>Average</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--double)', borderRadius: '2px' }}></div>
          <span>Poor</span>
        </div>
      </div>
    </div>
  );
}