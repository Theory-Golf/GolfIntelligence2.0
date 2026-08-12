'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import SectionHeader from '@/components/playerpath/SectionHeader';
import { ACTIVITIES, CATEGORIES, TYPES } from '@/data/practiceActivities';
import type { Activity } from '@/data/practiceActivities';

/**
 * Map activity IDs to their interactive tool routes.
 * As each activity page is built, add its route here.
 */
const ACTIVITY_ROUTES: Record<string, string> = {
  'round-simulation': '/player-path/round-simulation',
  'lag-putt-test': '/player-path/lag-putt-test',
  'inside-ten': '/player-path/putting/inside-ten',
  'inside-twenty': '/player-path/putting/inside-twenty',
  'winners-circle': '/player-path/putting/winners-circle',
  'wedge-standard': '/player-path/wedge-standard',
  'approach-standard': '/player-path/approach-standard',
  'driver-standard': '/player-path/driver-standard',
  'line-test': '/player-path/line-test',
};

/**
 * All Performance Driver IDs available for demo toggling.
 * Putting: M1, M2, L1, L2, L3
 * Wedge: A1, A2, A3, A4
 * Additional segments extend this list as activities are added.
 */
const ALL_DRIVER_IDS = ['M1', 'M2', 'L1', 'L2', 'L3', 'A1', 'A2', 'A3', 'A4'];

/** Chip row that scrolls horizontally on phones and wraps on larger screens. */
const CHIP_ROW =
  'flex gap-1.5 overflow-x-auto -mx-6 px-6 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible';

const FILTER_BTN =
  'min-h-[44px] whitespace-nowrap border px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-150';

export default function PracticeLibrary() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [flaggedDrivers, setFlaggedDrivers] = useState<string[]>([]);

  // Toggle a driver chip on/off
  function toggleDriver(id: string) {
    setFlaggedDrivers((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  // Derive filtered + annotated activity list
  const { relevant, others } = useMemo(() => {
    const flaggedSet = new Set(flaggedDrivers);

    const filtered = ACTIVITIES.filter((a) => {
      const catMatch = activeCategory === 'all' || a.category === activeCategory;
      const typeMatch = activeType === 'all' || a.type === activeType;
      return catMatch && typeMatch;
    });

    if (flaggedSet.size === 0) {
      return { relevant: [], others: filtered };
    }

    const rel = filtered.filter((a) =>
      a.connected_drivers.some((cd) => flaggedSet.has(cd.driver_id))
    );
    const oth = filtered.filter(
      (a) => !a.connected_drivers.some((cd) => flaggedSet.has(cd.driver_id))
    );
    return { relevant: rel, others: oth };
  }, [activeCategory, activeType, flaggedDrivers]);

  const totalVisible = relevant.length + others.length;
  const hasDriverFilter = flaggedDrivers.length > 0;

  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-5xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <SectionHeader
          index="03"
          eyebrow="The Library"
          title={
            <>
              Review the <span className="text-primary">drivers</span>
            </>
          }
          lead="Start from your flagged performance drivers — the leaks the analysis says are costing you the most — and the activities that address them rise to the top. Everything else stays browsable by segment and type."
        />

        {/* ── Flagged drivers ─────────────────────────────────── */}
        <div className="mb-10 border border-border bg-card p-5 sm:p-6">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Flagged Drivers
            </span>
            <span className="text-xs text-muted-foreground">
              Toggle a driver to surface the activities that address it
            </span>
          </div>
          <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
            These will be populated from your Golf Intelligence analysis — the driver set below is a
            stand-in while that connection is built.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_DRIVER_IDS.map((id) => (
              <button
                key={id}
                className={`min-h-[44px] border px-3.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ${
                  flaggedDrivers.includes(id)
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                }`}
                onClick={() => toggleDriver(id)}
              >
                {id}
              </button>
            ))}
            {hasDriverFilter && (
              <button
                className="min-h-[44px] pl-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-150 hover:text-primary"
                onClick={() => setFlaggedDrivers([])}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────────── */}
        <div className="mb-4">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Category
          </span>
          <div className={CHIP_ROW}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`${FILTER_BTN} ${
                  activeCategory === cat.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Type
          </span>
          <div className={CHIP_ROW}>
            {TYPES.map((t) => (
              <button
                key={t.id}
                className={`${FILTER_BTN} ${
                  activeType === t.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results bar ────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <strong className="font-normal text-foreground">{totalVisible}</strong>{' '}
            {totalVisible === 1 ? 'activity' : 'activities'}
            {hasDriverFilter && relevant.length > 0 && (
              <> &mdash; <strong className="font-normal text-foreground">{relevant.length}</strong> matched</>
            )}
          </p>
          {hasDriverFilter && relevant.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-primary">
              Relevant activities ranked first
            </span>
          )}
        </div>

        {/* ── Activity grid ───────────────────────────────────── */}
        {totalVisible === 0 ? (
          <div className="mt-3 border border-border bg-card px-6 py-12 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
              No activities match the current filters
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {/* Relevant activities first */}
            {relevant.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                flaggedDrivers={flaggedDrivers}
                variant="relevant"
              />
            ))}
            {/* Remaining activities */}
            {others.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                flaggedDrivers={flaggedDrivers}
                variant={hasDriverFilter ? 'dimmed' : 'normal'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Activity Card ──────────────────────────────────────────────────

interface ActivityCardProps {
  activity: Activity;
  flaggedDrivers: string[];
  variant: 'relevant' | 'dimmed' | 'normal';
}

function ActivityCard({ activity, flaggedDrivers, variant }: ActivityCardProps) {
  const flaggedSet = new Set(flaggedDrivers);
  const isRelevant = variant === 'relevant';
  const isDimmed = variant === 'dimmed';
  const isAssessment = activity.type === 'skill_assessment';
  const route = ACTIVITY_ROUTES[activity.id];

  const cardClass = [
    'relative flex flex-col gap-3 bg-card p-6 transition-colors duration-150',
    isRelevant
      ? 'bg-surface before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary'
      : '',
    isDimmed ? 'opacity-45' : '',
    route ? 'group cursor-pointer no-underline hover:bg-surface' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardContent = (
    <>
      {/* Name + type badge */}
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-base font-bold uppercase leading-tight tracking-[0.03em] text-foreground">
          {activity.name}
        </span>
        <span
          className={`shrink-0 whitespace-nowrap px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.18em] ${
            isAssessment
              ? 'bg-accent text-accent-foreground'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          {isAssessment ? 'Assessment' : 'Development'}
        </span>
      </div>

      {/* Description */}
      <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
        {activity.description}
      </p>

      {/* Connected drivers + launch arrow */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <span className="mr-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
          Drivers
        </span>
        {activity.connected_drivers.map((cd) => {
          const isFlagged = flaggedSet.has(cd.driver_id);
          return (
            <span
              key={cd.driver_id}
              className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-150 ${
                isFlagged
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border bg-surface text-muted-foreground'
              }`}
              title={cd.connection}
            >
              {cd.driver_id}
            </span>
          );
        })}
        {isRelevant && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.15em] text-primary">
            Recommended
          </span>
        )}
        {route && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition duration-150 group-hover:translate-x-[3px] group-hover:text-primary">
            Launch →
          </span>
        )}
      </div>
    </>
  );

  if (route) {
    return (
      <Link href={route} className={cardClass}>
        {cardContent}
      </Link>
    );
  }

  return <div className={cardClass}>{cardContent}</div>;
}
