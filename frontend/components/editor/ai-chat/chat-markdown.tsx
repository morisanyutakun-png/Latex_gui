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
          <pre className="rounded-lg p-3 my-2 overflow-x-auto text-[12px] font-mono bg-slate-100 dark:bg-[#1a1d24] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/40">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300">
                {children}
              </code>
            );
          }
          return <code className={className}>{children}</code>;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline">
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
          <blockquote className="border-l-2 pl-3 my-1.5 italic border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-[11px] border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-semibold border-b border-slate-300 dark:border-slate-600">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border-b border-slate-200 dark:border-slate-700">
            {children}
          </td>
        ),
        hr: () => <hr className="my-2 border-slate-200 dark:border-slate-700" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
