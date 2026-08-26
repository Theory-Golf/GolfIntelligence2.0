'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SectionHeader from '@/components/playerpath/SectionHeader';
import {
  ACTIVITIES,
  ACTIVITY_HISTORY_ROUTES,
  ACTIVITY_ROUTES,
  SEGMENTS,
  isBuilt,
} from '@/data/practiceActivities';
import type { Activity, ActivityCategory } from '@/data/practiceActivities';
import { getRecentDrillActivity } from '@/lib/golf/db';
import type { DrillActivitySummary } from '@/lib/golf/db';
import { fmtRelativeDay } from '@/lib/playerpath/format';

type Recency = Record<string, DrillActivitySummary>;

/** Built activities first, in-development last, alphabetical within each. */
function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const builtDelta = Number(isBuilt(b.id)) - Number(isBuilt(a.id));
    if (builtDelta !== 0) return builtDelta;
    return a.name.localeCompare(b.name);
  });
}

type Group = {
  id: ActivityCategory;
  label: string;
  /** Putting separates technique from the assessments; other segments don't. */
  subgroups: { key: string; label: string | null; activities: Activity[] }[];
  total: number;
};

function buildGroups(): Group[] {
  return SEGMENTS.map(({ id, label }) => {
    const inSegment = ACTIVITIES.filter((a) => a.category === id);

    // Putting technique is trained separately from the full swing, so it gets
    // its own list rather than sitting among the putting assessments.
    if (id === 'putting') {
      const assessments = sortActivities(
        inSegment.filter((a) => a.type === 'skill_assessment'),
      );
      const technical = sortActivities(
        inSegment.filter((a) => a.type === 'skill_development'),
      );
      return {
        id,
        label,
        subgroups: [
          { key: 'assessment', label: 'Assessment', activities: assessments },
          { key: 'technical', label: 'Technical', activities: technical },
        ].filter((s) => s.activities.length > 0),
        total: inSegment.length,
      };
    }

    return {
      id,
      label,
      subgroups: [{ key: 'all', label: null, activities: sortActivities(inSegment) }],
      total: inSegment.length,
    };
  }).filter((g) => g.total > 0); // never render an empty segment
}

export default function PracticeBySegment() {
  const groups = useMemo(buildGroups, []);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [recency, setRecency] = useState<Recency>({});
  const pendingJump = useRef<string | null>(null);

  // Collapsed on phones so the section is a short list rather than 18 cards;
  // expanded on wider screens where the whole catalog fits comfortably.
  //
  // A `#segment-*` landing overrides that for its own group: arriving from a
  // tool's back-link onto a collapsed header would be a dead end.
  useEffect(() => {
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
    const landing = window.location.hash.match(/^#segment-(.+)$/)?.[1];
    setOpen(Object.fromEntries(groups.map((g) => [g.id, wide || g.id === landing])));
  }, [groups]);

  /**
   * Chip click: open the group, then scroll to it. The scroll has to wait for
   * the open state to commit, or it measures the collapsed height and lands
   * short — so it runs from the effect below rather than here.
   */
  const jumpToSegment = useCallback((id: string) => {
    pendingJump.current = id;
    setOpen((o) => ({ ...o, [id]: true }));
  }, []);

  useEffect(() => {
    const id = pendingJump.current;
    if (!id) return;
    pendingJump.current = null;
    document.getElementById(`segment-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [open]);

  // Per-activity recency from the player's account. Absent when signed out —
  // the cards simply omit the line rather than erroring.
  useEffect(() => {
    let cancelled = false;
    getRecentDrillActivity()
      .then((rows) => {
        if (cancelled) return;
        setRecency(Object.fromEntries(rows.map((r) => [r.drillType, r])));
      })
      .catch(() => {
        /* signed out or offline — recency is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const builtCount = ACTIVITIES.filter((a) => isBuilt(a.id)).length;
  const readyByGroup = useMemo(
    () =>
      Object.fromEntries(
        groups.map((g) => [
          g.id,
          ACTIVITIES.filter((a) => a.category === g.id && isBuilt(a.id)).length,
        ]),
      ),
    [groups],
  );

  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          index="03"
          eyebrow="Practice"
          title={
            <>
              Work a <span className="text-primary">segment</span>
            </>
          }
          lead="Assessment games and development work, grouped by the part of the game they belong to. Each one keeps its own score and history, so every rep you log is measured the same way twice."
        />

        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <strong className="font-normal text-foreground">{builtCount}</strong> ready to play
          <span className="mx-2 text-border">·</span>
          <strong className="font-normal text-foreground">{ACTIVITIES.length - builtCount}</strong>{' '}
          in development
        </p>

        {/*
          The fast path into a segment. The accordion below starts collapsed on
          phones, which is exactly where scrolling a four-segment catalog costs
          most — so a chip opens its group as well as scrolling to it.
        */}
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Jump to a segment">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => jumpToSegment(group.id)}
              className="flex min-h-[44px] items-center gap-2 border border-border bg-card px-4 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground transition-colors duration-150 hover:border-primary hover:text-primary"
            >
              {group.label}
              <span className="text-muted-foreground">{readyByGroup[group.id]}</span>
            </button>
          ))}
        </div>

        <div className="border border-border">
          {groups.map((group, i) => {
            const isOpen = open[group.id] ?? false;
            const ready = readyByGroup[group.id];
            return (
              <div
                key={group.id}
                id={`segment-${group.id}`}
                className={`scroll-mt-[var(--pp-chrome-h)] ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [group.id]: !o[group.id] }))}
                  className="flex min-h-[56px] w-full items-center justify-between gap-4 bg-card px-5 py-4 text-left transition-colors duration-150 hover:bg-surface"
                >
                  <span className="flex items-baseline gap-3">
                    <span className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
                      {group.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {ready} of {group.total} ready
                    </span>
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-background">
                    {group.subgroups.map((sub) => (
                      <div key={sub.key}>
                        {sub.label && (
                          <div className="border-b border-border bg-surface px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {sub.label}
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
                          {sub.activities.map((activity) => (
                            <ActivityCard
                              key={activity.id}
                              activity={activity}
                              recency={recency[activity.id]}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Activity Card ──────────────────────────────────────────────────

function ActivityCard({
  activity,
  recency,
}: {
  activity: Activity;
  recency?: DrillActivitySummary;
}) {
  const route = ACTIVITY_ROUTES[activity.id];
  const historyRoute = ACTIVITY_HISTORY_ROUTES[activity.id];
  const inDevelopment = !route;
  const isAssessment = activity.type === 'skill_assessment';

  const cardClass = [
    'flex flex-1 flex-col gap-3 p-5 transition-colors duration-150',
    inDevelopment ? '' : 'group cursor-pointer no-underline hover:bg-surface',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-base font-bold uppercase leading-tight tracking-[0.03em] text-foreground">
          {activity.name}
        </span>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`whitespace-nowrap px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.18em] ${
              isAssessment ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {isAssessment ? 'Assessment' : 'Development'}
          </span>
          {inDevelopment && (
            <span className="whitespace-nowrap border border-border px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              In Development
            </span>
          )}
        </div>
      </div>

      <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
        {activity.description}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5">
        {recency ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {recency.count} {recency.count === 1 ? 'run' : 'runs'}
            <span className="mx-1.5 text-border">·</span>
            {fmtRelativeDay(recency.lastPlayed)}
          </span>
        ) : (
          !inDevelopment && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Not played yet
            </span>
          )
        )}
        {route && (
          // Always visible: a touch device has no hover to reveal it.
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition duration-150 group-hover:translate-x-[3px]">
            Play →
          </span>
        )}
      </div>
    </>
  );

  if (!route) {
    return (
      <div className="flex flex-col bg-card grayscale opacity-40">
        <div className={cardClass}>{content}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-card">
      <Link href={route} className={cardClass}>
        {content}
      </Link>
      {/* Sibling, not nested — an anchor inside an anchor is invalid. */}
      {historyRoute && (
        <Link
          href={historyRoute}
          className="min-h-[44px] border-t border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground no-underline transition-colors duration-150 hover:text-primary"
        >
          History →
        </Link>
      )}
    </div>
  );
}
