'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ACTIVITY_ROUTES } from '@/data/practiceActivities';
import type { Block } from '../types';

/**
 * An assessment block sends the player out to a game on its own route.
 *
 * The game records its own score to `drill_sessions` — this block only tracks
 * that the test was run, so the session summary never carries a second,
 * possibly disagreeing, number for the same attempt.
 */
export default function AssessmentBlock({
  block,
  onToggle,
}: {
  block: Block;
  onToggle: (blockId: string) => void;
}) {
  const route = block.activityId ? ACTIVITY_ROUTES[block.activityId] : undefined;

  return (
    <div className="space-y-4">
      <div className="border-l-2 border-primary bg-accent/30 px-3 py-2">
        <div className="font-mono text-label uppercase tracking-[0.2em] text-primary">
          Scored Test
        </div>
        <div className="text-sm text-foreground">
          This one keeps its own score and history — open it, play it, and your result saves to
          your account.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {route ? (
          <Link
            href={route}
            className="inline-flex min-h-[44px] items-center justify-center bg-primary px-6 font-display text-label font-bold uppercase tracking-[0.15em] text-primary-foreground no-underline transition-colors hover:bg-scarlet-dim"
          >
            Open {block.name.replace(/^Test · /, '')} →
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">
            This assessment isn&apos;t built yet.
          </span>
        )}
        <Button
          variant={block.completed ? 'ghost' : 'outline'}
          size="sm"
          onClick={() => onToggle(block.id)}
        >
          {block.completed ? 'Mark not done' : 'Mark complete'}
        </Button>
      </div>
    </div>
  );
}
