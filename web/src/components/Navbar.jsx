'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import './Navbar.css';

const NAV_LINKS = [
  { href: '/',                  label: 'Home' },
  { href: '/golf-intelligence', label: 'Golf Intelligence' },
  { href: '/player-path',       label: 'PlayerPath' },
  { href: '/resources',         label: 'Resources' },
  { href: '/contact',           label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="navbar themed">
      <div className="navbar-inner">

        {/* ── LOGO ── */}
        <Link href="/" className="navbar-logo">
          theory<span className="navbar-logo-accent">.golf</span>
        </Link>

        {/* ── DESKTOP NAV ── */}
        <nav className="navbar-nav">
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

        {/* ── RIGHT: THEME TOGGLE + HAMBURGER ── */}
        <div className="navbar-right">
          <ThemeToggle />
          <button
            className={`navbar-hamburger${menuOpen ? ' is-open' : ''}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

      </div>

      {/* ── MOBILE DROPDOWN MENU ── */}
      <nav
        className={`navbar-mobile-menu${menuOpen ? ' is-open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`navbar-mobile-link${isActive ? ' active' : ''}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
