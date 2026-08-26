'use client';

import { useEffect, useState } from 'react';

/**
 * The jump rail for the three PlayerPath sections.
 *
 * The page is deliberately a single scroll rather than a tab set — the
 * Diagnose → Train → Test order is the argument, and a first-time player
 * should read it. But a player who already knows what PlayerPath is came for
 * the Plan or a segment, and should not have to scroll the pitch again to get
 * there. So this overlays the scroll instead of replacing it: the narrative
 * stays intact, the jump becomes one tap.
 *
 * Sticks under the navbar, which is `sticky top-0 z-50 h-[61px]`.
 */

const SECTIONS = [
  { id: 'playerpath', label: 'Overview' },
  { id: 'plan', label: 'The Plan' },
  { id: 'practice', label: 'Practice' },
];

/** Where a section counts as "current": just under the rail's bottom edge. */
const CURRENT_LINE = 114; // 106px of fixed chrome + a little slack

export default function SectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const targets = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    /**
     * The active section is simply the last one whose top has passed under the
     * rail. Measured rather than observed: an IntersectionObserver reports each
     * target's crossings independently, so during a smooth scroll past two
     * boundaries the callbacks arrive with a partial picture and the rail
     * settles on the wrong item. Reading all three rects is exact every time.
     */
    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = targets[0].id;
      for (const el of targets) {
        if (el.getBoundingClientRect().top <= CURRENT_LINE) current = el.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <nav
      aria-label="PlayerPath sections"
      className="sticky top-[61px] z-40 border-b border-border bg-surface/95 px-6 backdrop-blur-sm"
    >
      {/*
        px-6 outside the max-w-5xl box, matching the page's sections — so the
        rail's measure lines up with the headings below it. -mx-3 then pulls the
        first item's label flush with that same content edge.
      */}
      <div className="mx-auto max-w-5xl">
        <div className="-mx-3 flex items-stretch">
          {SECTIONS.map((section) => {
            const isActive = active === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'flex min-h-[44px] items-center border-b-2 px-3 font-mono text-[10px] uppercase',
                  'tracking-[0.18em] no-underline transition-colors duration-150',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {section.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
