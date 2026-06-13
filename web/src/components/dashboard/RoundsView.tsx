'use client';

import { useMemo, useState } from 'react';
import type { HoleOutcome, ProcessedShot, RoundSummary } from '@/lib/golf/types';
import { getHoleScores, getHoleOutcome } from '@/lib/golf/calculations';
import { getStrokeGainedColor, formatStrokesGained } from '@/lib/golf/tokens';

// Same semantic scoring colors as ScoringView's donut chart
const OUTCOME_COLORS: Record<HoleOutcome, string> = {
  'Eagle': '#00C07A',
  'Birdie': '#52D9A0',
  'Par': '#8A8580',
  'Bogey': '#F59520',
  'Double Bogey+': '#E8202A',
};

function formatToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}

function formatRoundType(summary: RoundSummary): string {
  return summary.roundNumber != null ? `${summary.roundType} ${summary.roundNumber}` : summary.roundType;
}

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
  color: 'var(--ash)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 6px',
  textAlign: 'center',
  color: 'var(--chalk)',
  fontFamily: 'var(--font-mono)',
};

export function RoundsView({ roundSummaries, filteredShots }: { roundSummaries: RoundSummary[]; filteredShots: ProcessedShot[] }) {
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);

  // Most recent rounds first
  const summaries = useMemo(() => [...roundSummaries].reverse(), [roundSummaries]);

  // Show the player column only when rounds from multiple players are visible
  const showPlayer = useMemo(() => new Set(summaries.map(s => s.playerName)).size > 1, [summaries]);

  const shotsByRound = useMemo(() => {
    const map = new Map<string, ProcessedShot[]>();
    filteredShots.forEach(shot => {
      if (!map.has(shot.roundId)) map.set(shot.roundId, []);
      map.get(shot.roundId)!.push(shot);
    });
    return map;
  }, [filteredShots]);

  const expandedHoleScores = useMemo(() => {
    if (!expandedRoundId) return [];
    const roundShots = shotsByRound.get(expandedRoundId) ?? [];
    return getHoleScores(roundShots).sort((a, b) => a.hole - b.hole);
  }, [expandedRoundId, shotsByRound]);

  const columnCount = showPlayer ? 9 : 8;

  return (
    <div className="content">
      <h4 style={{ marginBottom: '16px', color: 'var(--ash)' }}>Rounds</h4>

      {summaries.length === 0 ? (
        <div className="card" style={{ padding: '24px', color: 'var(--ash)' }}>
          No rounds match the current filters.
        </div>
      ) : (
        <div style={{ background: 'var(--charcoal)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pitch)', background: 'var(--obsidian)' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Date</th>
                  {showPlayer && <th style={{ ...thStyle, textAlign: 'left' }}>Player</th>}
                  <th style={{ ...thStyle, textAlign: 'left' }}>Course</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>SG</th>
                  <th style={thStyle}>Fairways</th>
                  <th style={thStyle}>GIR</th>
                  <th style={thStyle}>Penalties</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((round, idx) => {
                  const isExpanded = expandedRoundId === round.roundId;
                  const rowBackground = idx % 2 === 0 ? 'var(--charcoal)' : 'var(--obsidian)';
                  return (
                    <RoundRow
                      key={round.roundId}
                      round={round}
                      showPlayer={showPlayer}
                      isExpanded={isExpanded}
                      rowBackground={rowBackground}
                      columnCount={columnCount}
                      holeScores={isExpanded ? expandedHoleScores : null}
                      onToggle={() => setExpandedRoundId(isExpanded ? null : round.roundId)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--ash)' }}>
        Click a round to see its hole-by-hole scorecard. Hole scores include penalty strokes.
      </p>
    </div>
  );
}

function RoundRow({
  round,
  showPlayer,
  isExpanded,
  rowBackground,
  columnCount,
  holeScores,
  onToggle,
}: {
  round: RoundSummary;
  showPlayer: boolean;
  isExpanded: boolean;
  rowBackground: string;
  columnCount: number;
  holeScores: ReturnType<typeof getHoleScores> | null;
  onToggle: () => void;
}) {
  const scoreToPar = round.totalScore - round.totalPar;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: '1px solid var(--pitch)',
          background: isExpanded ? 'var(--pitch)' : rowBackground,
          cursor: 'pointer',
        }}
      >
        <td style={{ ...tdStyle, textAlign: 'left', whiteSpace: 'nowrap' }}>
          <span style={{ marginRight: '8px', color: 'var(--ash)' }}>{isExpanded ? '▾' : '▸'}</span>
          {round.date}
        </td>
        {showPlayer && (
          <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{round.playerName}</td>
        )}
        <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{round.course}</td>
        <td style={tdStyle}>{formatRoundType(round)}</td>
        <td style={{ ...tdStyle, fontWeight: 600 }}>
          {round.totalScore}{' '}
          <span style={{ color: scoreToPar > 0 ? OUTCOME_COLORS['Bogey'] : scoreToPar < 0 ? OUTCOME_COLORS['Birdie'] : 'var(--ash)' }}>
            ({formatToPar(scoreToPar)})
          </span>
        </td>
        <td style={{ ...tdStyle, color: getStrokeGainedColor(round.strokesGained) }}>
          {formatStrokesGained(round.strokesGained)}
        </td>
        <td style={tdStyle}>{round.fairwaysHit}/{round.fairwaysTotal}</td>
        <td style={tdStyle}>{round.gir}/{round.girTotal}</td>
        <td style={tdStyle}>{round.penalties}</td>
      </tr>

      {isExpanded && holeScores && (
        <tr style={{ borderBottom: '1px solid var(--pitch)', background: 'var(--obsidian)' }}>
          <td colSpan={columnCount} style={{ padding: '16px' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '11px', margin: '0 auto' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', padding: '6px 10px' }}>Hole</th>
                  {holeScores.map(h => (
                    <th key={h.hole} style={{ ...thStyle, padding: '6px 10px' }}>{h.hole}</th>
                  ))}
                  <th style={{ ...thStyle, padding: '6px 10px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--ash)', padding: '6px 10px' }}>Par</td>
                  {holeScores.map(h => (
                    <td key={h.hole} style={{ ...tdStyle, color: 'var(--ash)', padding: '6px 10px' }}>{h.par}</td>
                  ))}
                  <td style={{ ...tdStyle, color: 'var(--ash)', padding: '6px 10px' }}>
                    {holeScores.reduce((sum, h) => sum + h.par, 0)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--ash)', padding: '6px 10px' }}>Score</td>
                  {holeScores.map(h => (
                    <td
                      key={h.hole}
                      style={{
                        ...tdStyle,
                        padding: '6px 10px',
                        fontWeight: 600,
                        color: OUTCOME_COLORS[getHoleOutcome(h.score, h.par)],
                      }}
                    >
                      {h.score}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, fontWeight: 600, padding: '6px 10px' }}>
                    {holeScores.reduce((sum, h) => sum + h.score, 0)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--ash)', padding: '6px 10px' }}>SG</td>
                  {holeScores.map(h => {
                    const holeSG = h.shots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
                    return (
                      <td key={h.hole} style={{ ...tdStyle, padding: '6px 10px', color: getStrokeGainedColor(holeSG) }}>
                        {formatStrokesGained(holeSG)}
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, padding: '6px 10px', color: getStrokeGainedColor(round.strokesGained) }}>
                    {formatStrokesGained(round.strokesGained)}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
