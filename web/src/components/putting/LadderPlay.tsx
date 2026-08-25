'use client';

import { useState } from 'react';
import { deriveLadderState, type LadderGroup } from '@/lib/golf/puttingLadder';
import BallGlyph, { type BallStatus } from './BallGlyph';
import './LadderPlay.css';

/**
 * Putt-by-putt play screen shared by the ladder drills (Inside Ten, Inside
 * Twenty). The parent owns the results array -- this component only renders
 * the state derived from it and reports each putt back, which keeps undo and
 * the group recap consistent with the rules for free.
 *
 * The screen has two beats: logging the putt in front of you, and a recap
 * after every completed group. The recap is the round-level moment -- it is
 * where the player sees what the ladder they just finished actually produced
 * before walking to the next one.
 */

interface LadderPlayProps {
  navLabel: string;
  groups: LadderGroup[];
  results: boolean[];
  /** Score at or above which the player is meeting the drill's benchmark. */
  benchmarkScore: number;
  benchmarkLabel: string;
  onPutt: (made: boolean) => void;
  onUndo: () => void;
  onQuit: () => void;
}

export default function LadderPlay({
  navLabel,
  groups,
  results,
  benchmarkScore,
  benchmarkLabel,
  onPutt,
  onUndo,
  onQuit,
}: LadderPlayProps) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  // Number of logged putts at which the player last dismissed a recap. Keyed
  // on the count rather than a boolean so undoing back across a boundary
  // brings the recap back instead of silently skipping it.
  const [recapDismissedAt, setRecapDismissedAt] = useState(-1);

  const state = deriveLadderState(groups, results);
  const remaining = state.totalPutts - state.attempted;
  const justFinishedGroup = state.groups[state.currentGroupIndex - 1];
  const showRecap =
    state.atGroupBoundary &&
    !state.complete &&
    recapDismissedAt !== state.attempted &&
    justFinishedGroup !== undefined;

  function handleQuit() {
    if (!confirmQuit) {
      setConfirmQuit(true);
      return;
    }
    onQuit();
  }

  const nav = (
    <div className="it-top-nav">
      <button className="it-back-btn" onClick={handleQuit} onBlur={() => setConfirmQuit(false)}>
        {confirmQuit ? 'Tap to discard' : '✕ Quit'}
      </button>
      <span className="it-nav-label">{navLabel}</span>
      <span className="lp-nav-count">
        {state.attempted}<span>/{state.totalPutts}</span>
      </span>
    </div>
  );

  // Indices after which one group ends and the next begins, so the progress
  // bar reads as six ladders rather than eighteen undifferentiated ticks.
  const groupEnds = new Set<number>();
  groups.reduce((n, g) => {
    const end = n + g.putts.length;
    if (end < state.totalPutts) groupEnds.add(end - 1);
    return end;
  }, 0);

  const progress = (
    <div className="lp-progress" aria-label={`${state.attempted} of ${state.totalPutts} putts logged`}>
      {Array.from({ length: state.totalPutts }, (_, i) => {
        const logged = i < results.length;
        const cls = logged ? (results[i] ? 'is-made' : 'is-missed') : 'is-pending';
        return <span key={i} className={`lp-tick ${cls}${groupEnds.has(i) ? ' is-group-end' : ''}`} />;
      })}
    </div>
  );

  const makesRow = (
    <div className="lp-makes-row">
      <span className="lp-makes-value">{state.makes}</span>
      <span className="lp-makes-label">
        {remaining > 0
          ? `makes · ${remaining} ${remaining === 1 ? 'putt' : 'putts'} left`
          : 'makes · ladder complete'}
      </span>
    </div>
  );

  if (showRecap) {
    const nextGroup = groups[state.currentGroupIndex];
    const benchmarkReachable = state.makes + remaining >= benchmarkScore;
    const onBenchmarkPace = state.makes / state.attempted >= benchmarkScore / state.totalPutts;
    const paceCopy = !benchmarkReachable
      ? `${benchmarkLabel} is out of reach this session — play the rest for a clean number`
      : onBenchmarkPace
        ? `On pace for ${benchmarkLabel} — ${benchmarkScore} makes clears it`
        : `${benchmarkScore - state.makes} more to reach ${benchmarkLabel} (${benchmarkScore} of ${state.totalPutts})`;

    return (
      <div className="it-wrapper">
        {nav}

        <div className="lp-card lp-recap-card">
          <p className="lp-eyebrow">Group {justFinishedGroup.group} complete</p>
          <div className="lp-recap-score">
            {justFinishedGroup.made}<span>/{justFinishedGroup.attempted}</span>
          </div>

          <div className="lp-recap-list">
            {justFinishedGroup.distances.map((d, i) => (
              <div className="lp-recap-row" key={i}>
                <span className="lp-recap-dist">{d} ft</span>
                <BallGlyph status={justFinishedGroup.results[i] ? 'made' : 'missed'} />
                <span className={`lp-recap-verdict ${justFinishedGroup.results[i] ? 'is-made' : 'is-missed'}`}>
                  {justFinishedGroup.results[i] ? 'Made' : 'Missed'}
                </span>
              </div>
            ))}
          </div>

          {progress}
          {makesRow}
          <p className="lp-pace">{paceCopy}</p>
        </div>

        <div className="lp-next-card">
          <p className="lp-eyebrow">Next up · Group {nextGroup.group}</p>
          <div className="lp-next-dists">
            {nextGroup.putts.map((d, i) => (
              <span className="lp-next-dist" key={i}>{d}<span>ft</span></span>
            ))}
          </div>
        </div>

        <button className="lp-primary-btn" onClick={() => setRecapDismissedAt(state.attempted)}>
          Continue to Group {nextGroup.group}
        </button>
        <button className="lp-undo-btn" onClick={onUndo}>
          Undo last putt
        </button>
      </div>
    );
  }

  const currentGroup = state.groups[state.currentGroupIndex];

  return (
    <div className="it-wrapper">
      {nav}

      <div className="lp-card lp-play-card">
        <p className="lp-eyebrow">
          Group {currentGroup.group} of {groups.length} · Putt {state.currentPuttInGroup + 1} of {currentGroup.distances.length}
        </p>

        <div className="lp-distance" key={`${currentGroup.group}-${state.currentPuttInGroup}`}>
          {state.currentDistanceFt}<span>FT</span>
        </div>

        <div className="lp-ball-row">
          {currentGroup.distances.map((d, i) => {
            const status: BallStatus =
              i < currentGroup.attempted
                ? currentGroup.results[i] ? 'made' : 'missed'
                : i === currentGroup.attempted ? 'current' : 'pending';
            return (
              <div className={`lp-ball-cell is-${status}`} key={i}>
                <BallGlyph status={status} />
                <span className="lp-ball-dist">{d} ft</span>
              </div>
            );
          })}
        </div>

        {progress}
        {makesRow}
      </div>

      <div className="lp-btn-row">
        <button className="lp-made-btn" onClick={() => onPutt(true)}>
          Putt Made
        </button>
        <button className="lp-missed-btn" onClick={() => onPutt(false)}>
          Putt Missed
        </button>
      </div>

      <button className="lp-undo-btn" onClick={onUndo} disabled={results.length === 0}>
        Undo last putt
      </button>
    </div>
  );
}
