import HistoryDashboard from '@/components/InsideTwenty/HistoryDashboard';

export const metadata = {
  title: 'Inside Twenty — History',
  description: 'Your Inside Twenty session history. Score trend, tier breakdown, make rate by distance, and session log.',
};

export default function InsideTwentyHistoryPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-5">Drill · Mid-Range Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Inside Twenty<span className="text-primary"> / History</span>
          </h1>
        </div>
      </section>

      <HistoryDashboard />
    </>
  );
}
