import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WinnersCircle from '@/components/WinnersCircle';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';

export const metadata = {
  title: 'Winners Circle — PlayerPath',
  description:
    '5 tees around the hole starting at 4 feet. Make it and the tee survives, miss it and the tee is gone. Move back a foot each round — 20 total makes clears the Standard.',
};

export default function WinnersCirclePage() {
  return (
    <>
      <ResumeSessionBar />
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/player-path#practice"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" /> Practice
          </Link>
          <p className="eyebrow mb-5">Assessment · Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Winners<span className="text-primary">Circle</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            A survival putting test. Five tees, one hole, no second chances —
            every miss raises the cost of the next one.
          </p>
        </div>
      </section>

      <WinnersCircle />
    </>
  );
}
