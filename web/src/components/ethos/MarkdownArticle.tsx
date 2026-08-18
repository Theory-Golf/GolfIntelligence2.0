import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import EthosLineChart from './EthosLineChart';
import { parseChartSpec } from './chartSpec';

const components: Components = {
  h2: ({ children }) => (
    <h2 className="font-display font-bold text-2xl tracking-[0.02em] uppercase text-foreground mt-12 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display font-bold text-lg tracking-[0.02em] uppercase text-foreground mt-8 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="font-body text-base text-muted-foreground leading-relaxed mb-5">{children}</p>
  ),
  strong: ({ children }) => <strong className="text-foreground font-medium">{children}</strong>,
  em: ({ children }) => <em className="text-foreground">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary pl-5 my-6 font-body italic text-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 font-body text-base text-muted-foreground leading-relaxed mb-5 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 font-body text-base text-muted-foreground leading-relaxed mb-5 space-y-1">
      {children}
    </ol>
  ),
  hr: () => <hr className="my-10 border-border" />,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ''} className="my-8 border border-border w-full" />
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto border border-border">
      <table className="w-full text-sm font-body border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground px-4 py-2 border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 border-b border-border text-foreground align-top">{children}</td>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? '');
    const raw = String(children).replace(/\n$/, '');

    if (match?.[1] === 'chart') {
      const spec = parseChartSpec(raw);
      return spec ? <EthosLineChart spec={spec} /> : null;
    }

    if (match) {
      return (
        <pre className="my-6 p-4 bg-card border border-border overflow-x-auto">
          <code className="font-mono text-xs text-foreground">{raw}</code>
        </pre>
      );
    }

    return (
      <code className="font-mono text-[0.9em] bg-card border border-border px-1.5 py-0.5 rounded-sm">
        {children}
      </code>
    );
  },
};

export default function MarkdownArticle({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}
