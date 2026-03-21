'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tg-theme');
    if (saved === 'light') {
      setIsLight(true);
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggle = () => {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('tg-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('tg-theme', 'dark');
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {isLight ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span
        className="relative inline-block w-9 h-5 rounded-full border border-border transition-all duration-250"
        style={{ background: isLight ? 'var(--accent)' : 'var(--pitch)' }}
      >
        <span
          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-primary transition-all duration-250"
          style={{ left: isLight ? '16px' : '2px' }}
        />
      </span>
    </button>
  );
}
