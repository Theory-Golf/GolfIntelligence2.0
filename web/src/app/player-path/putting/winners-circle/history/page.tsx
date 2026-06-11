import HistoryDashboard from '@/components/WinnersCircle/HistoryDashboard';

export const metadata = {
  title: 'Winners Circle — History',
  description: 'Your Winners Circle run history. Makes trend, standards cleared, and run log.',
};

export default function WinnersCircleHistoryPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-5">Assessment · Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Winners Circle<span className="text-primary"> / History</span>
          </h1>
        </div>
      </section>

      <HistoryDashboard />
    </>
  );
}
