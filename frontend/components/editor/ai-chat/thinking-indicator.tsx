import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Sparkles, Brain, Terminal, AlertCircle,
  Search, Wrench, Eye, Hammer, BookOpen,
} from "lucide-react";
import { formatDuration } from "./utils";
import { useI18n } from "@/lib/i18n";

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_latex: BookOpen,
  set_latex: Wrench,
  replace_in_latex: Search,
  compile_check: Hammer,
};

function getToolLabel(name: string, t: (k: string) => string): string {
  switch (name) {
    case "read_latex": return t("chat.tool.read.label");
    case "set_latex": return t("chat.tool.write.label");
    case "replace_in_latex": return t("chat.tool.replace.label");
    case "compile_check": return t("chat.tool.compile.label");
    default: return `${name} ${t("chat.tool.executing")}`;
  }
}

export function ThinkingIndicator({
  userMessage,
  liveSteps,
  currentTool,
}: {
  userMessage: string;
  liveSteps?: ThinkingStep[];
  currentTool?: string | null;
}) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = React.useState(0);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveSteps, currentTool]);

  const hasSteps = liveSteps && liveSteps.length > 0;
  const isLongWait = elapsed >= 15;
  const statusText = currentTool
    ? getToolLabel(currentTool, t)
    : hasSteps
    ? t("chat.thinking.processing")
    : t("chat.thinking.thinking");

  return (
    <div className="flex gap-3">
      {/* Avatar — animated halo */}
      <div className="h-7 w-7 rounded-full chat-avatar-ai flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-white/90" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[12px] font-semibold tracking-wide text-foreground/60 uppercase">Eddivom AI</span>
          <span className="flex items-center gap-1.5 text-[11px] text-amber-600/75 dark:text-amber-400/75 font-medium">
            <span className="thinking-dot-ripple">
              <span className="h-1.5 w-1.5 rounded-full inline-block bg-amber-500" />
            </span>
            {statusText}
          </span>
          <span className="text-[10px] text-muted-foreground/30 tabular-nums ml-auto">{elapsed}s</span>
        </div>

        {/* Activity log card */}
        <div className="chat-thinking-card rounded-2xl rounded-tl-sm overflow-hidden">
          <div className="px-3.5 py-3 space-y-2 text-[12px] min-h-[44px] max-h-[260px] overflow-y-auto scroll-smooth scrollbar-thin">
            {hasSteps && liveSteps.map((step, i) => {
              const Icon = step.tool
                ? (TOOL_ICONS[step.tool] || Terminal)
                : step.type === "thinking" ? Brain
                : step.type === "error" ? AlertCircle
                : Eye;

              const isCompleted = step.type === "tool_result";
              const isError = step.type === "error";
              const isThinking = step.type === "thinking";

              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    isError   ? "bg-red-100/80 dark:bg-red-500/12" :
                    isCompleted ? "bg-emerald-100/80 dark:bg-emerald-500/12" :
                    isThinking  ? "bg-violet-100/60 dark:bg-violet-500/10" :
                    "bg-indigo-100/60 dark:bg-indigo-500/10"
                  }`}>
                    <Icon className={`h-3 w-3 ${
                      isError     ? "text-red-500" :
                      isCompleted ? "text-emerald-500" :
                      isThinking  ? "text-violet-400" :
                      "text-indigo-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`leading-relaxed break-all ${
                      isError     ? "text-red-500/80" :
                      isCompleted ? "text-emerald-600/80 dark:text-emerald-400/70" :
                      isThinking  ? "text-muted-foreground/50" :
                      "text-indigo-500/80 dark:text-indigo-400/70"
                    }`}>{step.text}</span>
                  </div>
                  {step.duration != null && step.duration > 0 && (
                    <span className="text-muted-foreground/25 shrink-0 text-[10px] tabular-nums">{formatDuration(step.duration)}</span>
                  )}
                </div>
              );
            })}

            {/* Currently running tool */}
            {currentTool && (
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-md bg-amber-100/70 dark:bg-amber-500/12 flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = TOOL_ICONS[currentTool] || Terminal;
                    return <Icon className="h-3 w-3 text-amber-600/80 dark:text-amber-400/80 animate-pulse" />;
                  })()}
                </div>
                <span className="text-amber-600/70 dark:text-amber-400/70 animate-pulse">
                  {getToolLabel(currentTool, t)}...
                </span>
              </div>
            )}

            {/* Generic thinking */}
            {!hasSteps && !currentTool && (
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-md bg-amber-100/60 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Brain className="h-3 w-3 text-amber-500/70 dark:text-amber-400/60 animate-pulse" />
                </div>
                <span className="text-muted-foreground/45">{t("chat.thinking.analyzing")}</span>
              </div>
            )}

            {isLongWait && (
              <div className="flex items-center gap-2 pt-0.5 text-[11px] text-amber-500/60 border-t border-amber-200/20 dark:border-amber-500/10">
                <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                {t("chat.thinking.api_wait")}
              </div>
            )}

            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
