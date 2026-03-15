'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const NAV_LINKS = [
  { href: '/',                  label: 'Home' },
  { href: '/golf-intelligence', label: 'Golf Intelligence' },
  { href: '/player-path',       label: 'PlayerPath' },
  { href: '/resources',         label: 'Resources' },
  { href: '/contact',           label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header
      className="themed"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 28px',
          height: '61px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* ── LOGO ── */}
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '22px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            color: 'var(--color-text)',
            flexShrink: 0,
          }}
        >
          theory<span style={{ color: 'var(--color-accent)' }}>.golf</span>
        </Link>

        {/* ── NAV + TOGGLE ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            {NAV_LINKS.map(({ href, label }) => {
              const isActive =
                href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link${isActive ? ' active' : ''}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
