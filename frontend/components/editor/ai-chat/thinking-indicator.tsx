import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Bot, Brain, Terminal, CheckCircle, AlertCircle,
  Search, FileText, Wrench, Code2, Eye,
} from "lucide-react";
import { formatDuration } from "./utils";

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_document: FileText,
  search_blocks: Search,
  edit_document: Wrench,
  compile_check: CheckCircle,
  get_latex_source: Code2,
};

const TOOL_LABELS: Record<string, string> = {
  read_document: "文書を読み込み中",
  search_blocks: "ブロックを検索中",
  edit_document: "文書を編集中",
  compile_check: "コンパイルチェック中",
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

  // Auto-scroll log to bottom when new steps arrive
  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveSteps, currentTool]);

  const hasSteps = liveSteps && liveSteps.length > 0;
  const isLongWait = elapsed >= 15;
  const statusText = currentTool
    ? TOOL_LABELS[currentTool] || `${currentTool} 実行中`
    : hasSteps
    ? "エージェント実行中"
    : "思考中";

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

      {/* Agent activity terminal */}
      <div className="ml-7 rounded-lg bg-surface-0 dark:bg-surface-0 border border-slate-700/60 overflow-hidden">
        <div className="px-3 py-2 font-mono text-[11px] space-y-1 min-h-[40px] max-h-[320px] overflow-y-auto scroll-smooth">
          {/* Header line */}
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-indigo-400/60 shrink-0">$</span>
            <span className="text-emerald-400/70">eddivom-agent</span>
            <span className="text-slate-500">run</span>
            <span className="text-amber-400/60">--auto</span>
          </div>

          {/* Live steps */}
          {hasSteps && liveSteps.map((step, i) => {
            const Icon = step.tool ? (TOOL_ICONS[step.tool] || Terminal) :
              step.type === "thinking" ? Brain :
              step.type === "error" ? AlertCircle : Eye;

            const color = step.type === "error" ? "text-red-400" :
              step.type === "tool_call" ? "text-blue-400" :
              step.type === "tool_result" ? "text-emerald-400" :
              "text-slate-400";

            return (
              <div key={i} className="flex items-start gap-2 pl-2">
                <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${color}`} />
                <span className={`${color} break-all`}>
                  {step.text}
                </span>
                {step.duration != null && step.duration > 0 && (
                  <span className="text-slate-600 shrink-0 ml-auto">{formatDuration(step.duration)}</span>
                )}
              </div>
            );
          })}

          {/* Current activity indicator */}
          {currentTool && (
            <div className="flex items-center gap-2 pl-2">
              {(() => {
                const Icon = TOOL_ICONS[currentTool] || Terminal;
                return <Icon className="h-3 w-3 text-amber-400 animate-pulse" />;
              })()}
              <span className="text-amber-300/90">
                {TOOL_LABELS[currentTool] || currentTool}...
              </span>
              <span className="inline-block w-[6px] h-[12px] bg-indigo-400/80 animate-pulse" />
            </div>
          )}

          {/* No steps yet — show generic activity */}
          {!hasSteps && !currentTool && (
            <div className="flex items-center gap-2 pl-2">
              <Brain className="h-3 w-3 text-slate-400 animate-pulse" />
              <span className="text-slate-400">
                リクエストを分析中...
              </span>
              <span className="inline-block w-[6px] h-[12px] bg-indigo-400/80 animate-pulse" />
            </div>
          )}

          {isLongWait && (
            <div className="flex items-center gap-1 pl-2 mt-1">
              <span className="text-amber-400/60">⏳</span>
              <span className="text-amber-300/70">API制限のためリトライ待機中...</span>
            </div>
          )}

          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
