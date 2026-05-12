import type { StatusKey } from '../types';

const STYLES: Record<StatusKey | 'pending' | 'locked' | 'complete', string> = {
  new: 'bg-muted text-muted-foreground border-border',
  building: 'bg-muted text-muted-foreground border-border',
  acquiring: 'bg-accent text-accent-foreground border-accent-foreground/30',
  stable: 'bg-primary/10 text-primary border-primary/30',
  mastered: 'bg-primary text-primary-foreground border-primary',
  pending: 'bg-muted text-muted-foreground border-border',
  locked: 'bg-muted text-muted-foreground border-border',
  complete: 'bg-primary/10 text-primary border-primary/30',
};

export default function StatusPill({
  status,
  children,
}: {
  status: StatusKey | 'pending' | 'locked' | 'complete';
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${STYLES[status]}`}
    >
      {children}
    </span>
  );
}
