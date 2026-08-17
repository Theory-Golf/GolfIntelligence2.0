import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { getPublishedPaperBySlug, getPaperPdfUrl } from '@/lib/ethos/db';
import MarkdownArticle from '@/components/ethos/MarkdownArticle';

export const revalidate = 3600;

type PageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageParams) {
  const { slug } = await params;
  const paper = await getPublishedPaperBySlug(slug);
  if (!paper) return {};
  return { title: paper.title, description: paper.summary };
}

export default async function EthosPaperPage({ params }: PageParams) {
  const { slug } = await params;
  const paper = await getPublishedPaperBySlug(slug);
  if (!paper) notFound();

  return (
    <section className="px-6 pt-16 pb-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/ethos"
          className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-3" /> Ethos
        </Link>
        <p className="eyebrow mb-4">Paper</p>
        <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
          {paper.title}
        </h1>
        <p className="font-body text-base text-muted-foreground mt-5 leading-relaxed">
          {paper.summary}
        </p>

        {paper.pdf_path && (
          <a
            href={getPaperPdfUrl(paper.pdf_path)}
            download
            className="inline-flex items-center gap-2 mt-6 font-mono text-[11px] tracking-[0.15em] uppercase text-foreground border border-border px-4 py-2 no-underline hover:border-primary hover:text-primary transition-colors"
          >
            <Download className="size-3.5" /> Download PDF
          </a>
        )}

        <div className="mt-12">
          <MarkdownArticle markdown={paper.body_markdown} />
        </div>
      </div>
    </section>
  );
}
