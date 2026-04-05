import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        pre: ({ children }) => (
          <pre className="rounded-xl p-3 my-2 overflow-x-auto text-[12px] font-mono bg-slate-50 dark:bg-surface-3 text-slate-800 dark:text-slate-200 border border-black/[0.06] dark:border-white/[0.06]">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 rounded-md text-[12px] font-mono bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300">
                {children}
              </code>
            );
          }
          return <code className={className}>{children}</code>;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-violet-600 dark:text-violet-400 hover:underline">
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <p className="font-bold text-[14px] mt-2 mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-bold text-[13px] mt-2 mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold text-[13px] mt-1.5 mb-0.5">{children}</p>,
        p: ({ children }) => <p className="leading-relaxed my-0.5">{children}</p>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 pl-3 my-1.5 italic border-violet-200 dark:border-violet-500/30 text-slate-600 dark:text-slate-400">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
            <table className="text-[12px] border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-2.5 py-1.5 text-left font-semibold border-b border-black/[0.06] dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2.5 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
            {children}
          </td>
        ),
        hr: () => <hr className="my-3 border-black/[0.06] dark:border-white/[0.06]" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
