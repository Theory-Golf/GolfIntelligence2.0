import type { ReactNode } from 'react';

/**
 * Shared header for the three PlayerPath sections. The numbered eyebrow is what
 * separates them now that the page is a single scroll rather than a tab switch.
 */
export default function SectionHeader({
  index,
  eyebrow,
  title,
  lead,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="mb-10 space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        {index} — {eyebrow}
      </p>
      <h2 className="font-display text-[clamp(32px,5vw,56px)] font-extrabold uppercase leading-[0.95] tracking-tight text-foreground">
        {title}
      </h2>
      {lead && (
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{lead}</p>
      )}
    </header>
  );
}
