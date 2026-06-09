import HistoryDashboard from '@/components/InsideTen/HistoryDashboard';

export const metadata = {
  title: 'Inside Ten — History',
  description: 'Your Inside Ten session history. Score trend, tier breakdown, and session log.',
};

export default function InsideTenHistoryPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-5">Drill · Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Inside Ten<span className="text-primary"> / History</span>
          </h1>
        </div>
      </section>

      <HistoryDashboard />
    </>
  );
}
