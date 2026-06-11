// Shared UI primitives for PlayerPath assessment/development tools.
// Extracted from DriverStandard's atoms — every Library tool consumes these
// so the games share one container width, button language, and type scale.

export type Band = 'Pass' | 'Fail' | 'Elite';

export function ToolContainer({
  children, className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <section className="px-6 pb-16">
      <div className={`max-w-xl mx-auto flex flex-col gap-6 ${className}`}>{children}</div>
    </section>
  );
}

export function Eyebrow({
  children, className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10px] tracking-[0.28em] uppercase text-primary ${className}`}>{children}</p>
  );
}

export function Mono({
  children, className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground ${className}`}>{children}</span>
  );
}

export function PrimaryButton({
  children, onClick, disabled = false, className = '',
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-6 py-4 font-display text-sm font-bold tracking-[0.16em] uppercase transition-colors duration-150
        ${disabled
          ? 'bg-pitch text-muted-foreground cursor-not-allowed'
          : 'bg-primary text-primary-foreground hover:bg-scarlet-glow cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-6 py-[15px] font-display text-sm font-bold tracking-[0.16em] uppercase
        bg-transparent text-foreground border border-border hover:border-cement transition-colors duration-150 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

type CardTone = 'default' | 'primary' | 'success' | 'danger';

const toneBorder: Record<CardTone, string> = {
  default: 'border-border',
  primary: 'border-primary',
  success: 'border-sg-strong',
  danger: 'border-sg-weak',
};

export function ToolCard({
  children, accent, tone = 'default', className = '',
}: {
  children: React.ReactNode;
  accent?: 'top' | 'left';
  tone?: CardTone;
  className?: string;
}) {
  const accentClass =
    accent === 'top' ? `border-t-[3px] ${toneBorder[tone].replace('border-', 'border-t-')}`
    : accent === 'left' ? `border-l-[3px] ${toneBorder[tone].replace('border-', 'border-l-')}`
    : '';
  return (
    <div className={`bg-surface border border-border p-5 ${accentClass} ${className}`}>{children}</div>
  );
}

export function Stat({
  label, value, unit, className = '',
}: { label: React.ReactNode; value: React.ReactNode; unit?: string; className?: string }) {
  return (
    <div className={className}>
      <Mono className="text-primary">{label}</Mono>
      <div className="font-display text-3xl font-bold mt-1 text-foreground">
        {value}
        {unit && <span className="text-base text-muted-foreground ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export function StatRow({
  children, className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-t border-border pt-6 flex flex-wrap gap-x-12 gap-y-4 ${className}`}>{children}</div>
  );
}

export const bandClasses: Record<Band, { text: string; bg: string; border: string; bgTint: string }> = {
  Pass:  { text: 'text-sg-gain',   bg: 'bg-sg-gain',   border: 'border-sg-gain',   bgTint: 'bg-sg-gain/10' },
  Elite: { text: 'text-sg-strong', bg: 'bg-sg-strong', border: 'border-sg-strong', bgTint: 'bg-sg-strong/10' },
  Fail:  { text: 'text-sg-weak',   bg: 'bg-sg-weak',   border: 'border-sg-weak',   bgTint: 'bg-sg-weak/10' },
};
