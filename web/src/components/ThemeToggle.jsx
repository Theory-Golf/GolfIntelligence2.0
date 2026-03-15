// ============================================================
//  THEORY GOLF — ThemeToggle
//  src/components/ThemeToggle.jsx
//
//  Drop this anywhere in your nav. It:
//    • Reads the saved preference from localStorage on mount
//    • Falls back to dark (your default) if nothing is saved
//    • Writes to localStorage on every toggle
//    • Applies data-theme="light" to <html> — tokens.css does
//      the rest automatically
// ============================================================
'use client'; // Required if you're using Next.js App Router
import { useEffect, useState } from 'react';
export default function ThemeToggle() {
const [isLight, setIsLight] = useState(false);
// On mount — read saved preference
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
style={{
display: 'flex',
alignItems: 'center',
gap: '8px',
background: 'none',
border: 'none',
cursor: 'pointer',
padding: '4px',
color: 'var(--color-muted)',
      }}
>
{/* Sun / Moon icon */}
<span style={{ fontSize: '14px', lineHeight: 1 }}>
{isLight ? '☀︎' : '☾'}
</span>
{/* Toggle track */}
<span
style={{
position: 'relative',
display: 'inline-block',
width: '36px',
height: '20px',
background: isLight ? 'var(--color-accent-wash)' : 'var(--pitch)',
border: '1px solid var(--color-border)',
borderRadius: '10px',
transition: 'background 250ms ease, border-color 250ms ease',
        }}
>
{/* Thumb */}
<span
style={{
position: 'absolute',
top: '2px',
left: isLight ? '16px' : '2px',
width: '14px',
height: '14px',
borderRadius: '50%',
background: 'var(--color-accent)',
transition: 'left 250ms ease',
          }}
/>
</span>
</button>
  );
}
