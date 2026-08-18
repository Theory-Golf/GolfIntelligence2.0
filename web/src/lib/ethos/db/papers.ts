import { createPublicClient } from '@/lib/supabase/publicClient';
import type { EthosPaperRow } from './types';

export async function listPublishedPapers(): Promise<EthosPaperRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('ethos_papers')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data as EthosPaperRow[];
}

export async function getPublishedPaperBySlug(
  slug: string
): Promise<EthosPaperRow | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('ethos_papers')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();
  if (error) throw error;
  return data as EthosPaperRow | null;
}

export function getPaperPdfUrl(pdfPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/ethos-papers/${pdfPath}`;
}
