import React from "react";
import { Bot } from "lucide-react";
import { getThinkingLines } from "./utils";

export function ThinkingIndicator({ userMessage }: { userMessage: string }) {
  const lines = React.useMemo(() => getThinkingLines(userMessage), [userMessage]);
  const [lineIdx, setLineIdx] = React.useState(0);
  const [charCount, setCharCount] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const line = lines[lineIdx % lines.length];
    if (charCount < line.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), 18);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setLineIdx((i) => (i + 1) % lines.length);
        setCharCount(0);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [lineIdx, charCount, lines]);

  const currentLine = lines[lineIdx % lines.length].slice(0, charCount);
  const jpPart = currentLine.split("...")[0];
  const enPart = currentLine.includes("...") ? currentLine.slice(currentLine.indexOf("...") + 4) : "";

  const isLongWait = elapsed >= 15;
  const statusText = isLongWait ? "retrying" : "running";
  const statusColor = isLongWait ? "text-amber-400/70" : "text-indigo-400/70";
  const dotColor = isLongWait ? "bg-amber-400" : "bg-indigo-400";

  return (
    <div className="w-full">
      {/* Role label */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center">
          <Bot className="h-3 w-3 text-white" />
        </div>
        <span className="text-[11px] font-semibold text-indigo-400">Eddivom AI</span>
        <span className={`flex items-center gap-1 text-[10px] font-mono ${statusColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor} animate-pulse`} />
          {statusText}
          <span className="text-slate-500 ml-0.5">{elapsed}s</span>
        </span>
      </div>

      {/* Terminal-style thinking display */}
      <div className="ml-7 rounded-lg bg-[#0d1117] dark:bg-[#060810] border border-slate-700/60 overflow-hidden">
        <div className="px-3 py-2 font-mono text-[11px] space-y-0.5 min-h-[40px]">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-indigo-400/60 shrink-0">$</span>
            <span className="text-emerald-400/70">eddivom</span>
            <span className="text-slate-500">generate</span>
            <span className="text-amber-400/60">--auto-apply</span>
          </div>
          <div className="flex items-center gap-1 pl-4">
            <span className="text-amber-300/90">{jpPart}</span>
            {enPart && <span className="text-slate-500 ml-1">{enPart}</span>}
            <span className="inline-block w-[6px] h-[12px] bg-indigo-400/80 animate-pulse" />
          </div>
          {isLongWait && (
            <div className="flex items-center gap-1 pl-4 mt-1">
              <span className="text-amber-400/60">⏳</span>
              <span className="text-amber-300/70">API制限のためリトライ待機中...</span>
              <span className="text-slate-600">Rate limit, auto-retrying</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
