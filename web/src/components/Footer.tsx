'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();

  // Round-entry screens have their own headers and need the full viewport
  // height on phones. Without this the footer adds ~85px of scroll to screens
  // whose content already fits, which on iOS keeps the URL bar permanently in
  // its collapse/expand animation and makes taps land off-target.
  if (pathname.startsWith('/golf-intelligence/round')) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-surface themed">
      <div className="max-w-[1280px] mx-auto px-7 py-5 flex items-center justify-between flex-wrap gap-2">
        <span className="font-display font-bold text-sm tracking-[0.08em] uppercase text-muted-foreground">
          theory<span className="text-primary">.golf</span>
        </span>
        <span className="font-mono text-label text-muted-foreground">
          &copy; 2025 theory.golf &mdash; All rights reserved
        </span>
      </div>
    </footer>
  );
}
