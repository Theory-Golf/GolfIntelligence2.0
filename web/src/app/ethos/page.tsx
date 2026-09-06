import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { listPublishedPapers } from '@/lib/ethos/db';
import type { EthosPaperRow } from '@/lib/ethos/db';

export const revalidate = 3600;

export const metadata = {
  title: 'Ethos',
  description:
    'Research and methodology behind theory.golf — the frameworks that power Golf Intelligence and PlayerPath.',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export default async function EthosPage() {
  // Fail soft: a transient Supabase outage during a build/ISR revalidation
  // should render an empty state, not take down the whole page (or build).
  let papers: EthosPaperRow[] = [];
  try {
    papers = await listPublishedPapers();
  } catch (err) {
    console.error('Failed to load Ethos papers', err);
  }

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-5">Research</p>
          <h1 className="font-display font-extrabold text-[clamp(40px,7vw,80px)] leading-[0.9] tracking-tight uppercase text-foreground">
            <span className="text-primary">Ethos</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            The research and methodology behind theory.golf — the frameworks that power
            Golf Intelligence and PlayerPath.
          </p>
        </div>
      </section>

      {/* ── Paper List ───────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <p className="section-label mb-6">Papers</p>

          {papers.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">
              No papers published yet — check back soon.
            </p>
          ) : (
            <div className="flex flex-col gap-px bg-border border border-border">
              {papers.map((paper) => (
                <Link
                  key={paper.slug}
                  href={`/ethos/${paper.slug}`}
                  className="bg-card p-7 no-underline flex items-start justify-between gap-6 group transition-colors hover:bg-surface"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="size-4 text-primary" />
                      <span className="font-mono text-label tracking-[0.25em] uppercase text-primary">
                        Paper{paper.published_at ? ` · ${formatDate(paper.published_at)}` : ''}
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-xl tracking-[0.02em] uppercase text-foreground mb-2">
                      {paper.title}
                    </h2>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      {paper.summary}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
