import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Sparkles, Brain, Terminal, CheckCircle, AlertCircle,
  Search, FileText, Wrench, Code2, Eye, Hammer, BookOpen,
} from "lucide-react";
import { formatDuration } from "./utils";

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_document: BookOpen,
  search_blocks: Search,
  edit_document: Wrench,
  compile_check: Hammer,
  get_latex_source: Code2,
};

const TOOL_LABELS: Record<string, string> = {
  read_document: "文書を読み込み中",
  search_blocks: "ブロックを検索中",
  edit_document: "文書を編集中",
  compile_check: "コンパイルを検証中",
  get_latex_source: "LaTeXソースを取得中",
};

export function ThinkingIndicator({
  userMessage,
  liveSteps,
  currentTool,
}: {
  userMessage: string;
  liveSteps?: ThinkingStep[];
  currentTool?: string | null;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveSteps, currentTool]);

  const hasSteps = liveSteps && liveSteps.length > 0;
  const isLongWait = elapsed >= 15;
  const statusText = currentTool
    ? TOOL_LABELS[currentTool] || `${currentTool} を実行中`
    : hasSteps
    ? "作業中..."
    : "考えています...";

  return (
    <div className="flex gap-2.5">
      {/* Avatar */}
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-medium text-foreground/80">Eddivom AI</span>
          <span className="flex items-center gap-1.5 text-[11px] text-violet-500/70">
            <span className={`h-1.5 w-1.5 rounded-full ${isLongWait ? 'bg-amber-400' : 'bg-violet-500'} animate-pulse`} />
            {statusText}
          </span>
          <span className="text-[11px] text-muted-foreground/30">{elapsed}s</span>
        </div>

        {/* Activity steps — soft card design */}
        <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.03] overflow-hidden">
          <div className="px-3 py-2.5 space-y-1.5 text-[12px] min-h-[40px] max-h-[280px] overflow-y-auto scroll-smooth scrollbar-thin">
            {/* Live steps */}
            {hasSteps && liveSteps.map((step, i) => {
              const Icon = step.tool ? (TOOL_ICONS[step.tool] || Terminal) :
                step.type === "thinking" ? Brain :
                step.type === "error" ? AlertCircle : Eye;

              const colorClass = step.type === "error"
                ? "text-red-500"
                : step.type === "tool_call"
                ? "text-blue-500"
                : step.type === "tool_result"
                ? "text-emerald-500"
                : "text-muted-foreground/50";

              return (
                <div key={i} className="flex items-start gap-2">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${colorClass}`} />
                  <span className={`${colorClass} break-all leading-relaxed`}>{step.text}</span>
                  {step.duration != null && step.duration > 0 && (
                    <span className="text-muted-foreground/25 shrink-0 ml-auto text-[11px]">{formatDuration(step.duration)}</span>
                  )}
                </div>
              );
            })}

            {/* Current activity */}
            {currentTool && (
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TOOL_ICONS[currentTool] || Terminal;
                  return <Icon className="h-3.5 w-3.5 text-violet-500/70 animate-pulse" />;
                })()}
                <span className="text-violet-500/70">
                  {TOOL_LABELS[currentTool] || currentTool}...
                </span>
              </div>
            )}

            {/* No steps — generic thinking */}
            {!hasSteps && !currentTool && (
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-violet-500/50 animate-pulse" />
                <span className="text-muted-foreground/50">リクエストを分析中...</span>
              </div>
            )}

            {isLongWait && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-amber-500/60">
                API応答を待機中...
              </div>
            )}

            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
