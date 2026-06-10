'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PracticePlanner from '@/components/PracticePlanner';
import PracticeLibrary from '@/components/PracticeLibrary';

type SectionKey = 'plan' | 'library';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'plan', label: 'The Plan' },
  { key: 'library', label: 'The Library' },
];

const NAVBAR_HEIGHT = 61;

function hashToSection(hash: string): SectionKey | null {
  if (hash === '#plan') return 'plan';
  if (hash === '#library') return 'library';
  return null;
}

export default function PlayerPathSections() {
  const [active, setActive] = useState<SectionKey>('plan');
  const toggleRef = useRef<HTMLDivElement>(null);

  // Sync with the URL hash: deep links on load + manual hash navigation
  useEffect(() => {
    const apply = () => {
      const next = hashToSection(window.location.hash);
      if (next) setActive(next);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const handleSelect = useCallback((key: SectionKey) => {
    setActive(key);
    // replaceState avoids history spam and the native anchor scroll-jump
    window.history.replaceState(null, '', `#${key}`);
    // If the user is scrolled past the toggle, bring it back into view
    const el = toggleRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top;
      if (top <= NAVBAR_HEIGHT) {
        window.scrollTo({
          top: window.scrollY + top - NAVBAR_HEIGHT,
          behavior: 'smooth',
        });
      }
    }
  }, []);

  return (
    <>
      <div
        ref={toggleRef}
        className="sticky top-[61px] z-40 border-b border-border bg-background/95 backdrop-blur themed"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-2 px-6" role="tablist">
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={s.key}
                onClick={() => handleSelect(s.key)}
                className={`-mb-px min-h-[48px] border-b-2 px-4 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-150 ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Both sections stay mounted so in-progress planner state survives switching */}
      <div id="plan" role="tabpanel" className="pt-10" hidden={active !== 'plan'}>
        <PracticePlanner />
      </div>
      <div id="library" role="tabpanel" className="pt-10" hidden={active !== 'library'}>
        <PracticeLibrary />
      </div>
    </>
  );
}
