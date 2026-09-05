'use client';

import {
  summarizeByDistance,
  summarizeByGroup,
  type PuttLog,
} from '@/lib/golf/puttingLadder';
import BallGlyph from './BallGlyph';
import './LadderPlay.css';

/**
 * Read-outs of a putt-by-putt ladder session. Both render nothing when there
 * is no putt-level data, so a legacy or quick-entry session (total score only)
 * simply doesn't show them.
 */

/** Per-group results for one session — the round-level view of the ladder. */
export function LadderGroupBreakdown({ putts }: { putts: PuttLog[] | undefined }) {
  if (!putts?.length) return null;
  const groups = summarizeByGroup(putts);

  return (
    <div className="it-card">
      <p className="it-section-label">Ladder Breakdown</p>
      <div className="lp-breakdown-head">
        <span>Group</span>
        <span>Putts</span>
        <span className="text-right">Made</span>
        <span className="text-right">Rate</span>
      </div>
      {groups.map((g) => (
        <div className="lp-breakdown-row" key={g.group}>
          <span className="lp-breakdown-label">Group {g.group}</span>
          <span className="lp-breakdown-balls">
            {g.distances.map((d, i) => (
              <span className="lp-breakdown-ball" key={i}>
                <BallGlyph status={g.results[i] ? 'made' : 'missed'} size={18} />
                <span className="lp-breakdown-ball-dist">{d}ft</span>
              </span>
            ))}
          </span>
          <span className="lp-breakdown-made">{g.made}</span>
          <span className="lp-breakdown-rate">
            {Math.round((g.made / g.attempted) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Make rate by distance. Pass one session's putts for a session view, or every
 * session's putts concatenated for a practice summary across a player's
 * history.
 */
export function DistanceProfile({
  putts,
  title = 'By Distance',
  note,
}: {
  putts: PuttLog[] | undefined;
  title?: string;
  note?: string;
}) {
  if (!putts?.length) return null;
  const stats = summarizeByDistance(putts);

  return (
    <div className="it-card">
      <p className="it-section-label">{title}</p>
      {stats.map((s) => (
        <div className="lp-dist-row" key={s.distanceFt}>
          <span className="lp-dist-label">{s.distanceFt}<span>ft</span></span>
          <span className="lp-dist-bar-track">
            <span className="lp-dist-bar-fill" style={{ width: `${s.makeRate * 100}%` }} />
          </span>
          <span className="lp-dist-stat">
            {s.made}<span>/{s.attempted}</span>
          </span>
        </div>
      ))}
      {note && <p className="lp-note">{note}</p>}
    </div>
  );
}
