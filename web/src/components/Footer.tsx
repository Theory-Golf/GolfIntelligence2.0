export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface themed">
      <div className="max-w-[1280px] mx-auto px-7 py-5 flex items-center justify-between flex-wrap gap-2">
        <span className="font-display font-bold text-sm tracking-[0.08em] uppercase text-muted-foreground">
          theory<span className="text-primary">.golf</span>
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          &copy; 2025 theory.golf &mdash; All rights reserved
        </span>
      </div>
    </footer>
  );
}
