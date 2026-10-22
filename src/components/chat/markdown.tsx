"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Messages are rendered as markdown. Raw HTML is never rendered, links open in a new tab,
// and remote images are not loaded (they would leak the reader's IP address).
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="break-words font-medium underline underline-offset-2">
      {children}
    </a>
  ),
  img: ({ alt }) => <span className="text-muted">[image{alt ? `: ${alt}` : ""}]</span>,
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-space p-3 text-xs leading-relaxed text-white">{children}</pre>,
  code: ({ className, children }) => {
    const block = /language-/.test(className ?? "") || String(children).includes("\n");
    return block ? <code className="font-mono">{children}</code> : <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
  p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-line pl-3 text-muted">{children}</blockquote>,
  h1: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-3 text-sm font-semibold">{children}</h4>,
  hr: () => <hr className="my-3 border-line" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1">{children}</td>,
};

export function MarkdownBody({ children }: { children: string }) {
  return (
    <div className="text-sm [overflow-wrap:anywhere]">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
