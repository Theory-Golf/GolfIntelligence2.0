'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from React.
 *
 * Prefer plain CSS wherever it can do the job — this exists only for
 * values CSS cannot reach. Recharts writes its container size as inline
 * styles, and `interval`, `angle`, `barSize` and `YAxis width` are
 * consumed by its layout engine with no CSS surface at all.
 *
 * Returns false on the server and on the first client render, then
 * resolves in a mount effect, so it cannot cause a hydration mismatch.
 * (The dashboard views never server-render anyway — they are lazy()
 * behind a Suspense boundary that only resolves once data has loaded —
 * but the guard keeps the hook safe to use anywhere.)
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** The dashboard's mobile breakpoint, matching dashboard.css. */
export const MOBILE_QUERY = '(max-width: 767px)';
