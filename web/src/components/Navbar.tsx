'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/golf-intelligence', label: 'Golf Intelligence' },
  { href: '/player-path', label: 'PlayerPath' },
  { href: '/resources', label: 'Resources' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border themed">
      <div className="max-w-[1280px] mx-auto px-7 h-[61px] flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="font-display font-extrabold text-[22px] tracking-[0.04em] uppercase no-underline text-foreground shrink-0">
          theory<span className="text-primary">.golf</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'font-mono text-[11px] tracking-[0.12em] uppercase no-underline whitespace-nowrap transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme Toggle + Hamburger */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            className="flex md:hidden flex-col justify-center items-center gap-[5px] w-10 h-10 bg-transparent border-none cursor-pointer p-2 shrink-0"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className={cn(
              'block w-[22px] h-0.5 bg-muted-foreground transition-all duration-200',
              menuOpen && 'translate-y-[7px] rotate-45'
            )} />
            <span className={cn(
              'block w-[22px] h-0.5 bg-muted-foreground transition-all duration-200',
              menuOpen && 'opacity-0'
            )} />
            <span className={cn(
              'block w-[22px] h-0.5 bg-muted-foreground transition-all duration-200',
              menuOpen && '-translate-y-[7px] -rotate-45'
            )} />
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {menuOpen && (
        <nav className="flex flex-col border-t border-border bg-surface md:hidden" aria-hidden={!menuOpen}>
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'font-mono text-xs tracking-[0.12em] uppercase no-underline px-7 min-h-[52px] flex items-center border-b border-border transition-colors',
                  isActive
                    ? 'text-primary bg-card'
                    : 'text-muted-foreground hover:text-primary hover:bg-card'
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
