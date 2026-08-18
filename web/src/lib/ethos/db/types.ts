export interface EthosPaperRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_markdown: string;
  pdf_path: string | null;
  display_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
