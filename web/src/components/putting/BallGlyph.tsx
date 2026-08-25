'use client';

export type BallStatus = 'made' | 'missed' | 'current' | 'pending';

/** One putt, drawn as a ball: filled when made, struck through when missed. */
export default function BallGlyph({ status, size = 22 }: { status: BallStatus; size?: number }) {
  return (
    <span className={`lp-ball is-${status}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <circle
          cx="12"
          cy="12"
          r="9"
          fill={status === 'made' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
        />
        {status === 'missed' && (
          <path d="M7 17 L17 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}
