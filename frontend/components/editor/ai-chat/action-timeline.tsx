import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Brain, Terminal, CheckCircle, AlertCircle, ChevronRight,
  Search, Wrench, Code2, BookOpen, Hammer,
} from "lucide-react";
import { formatDuration } from "./utils";

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_document: BookOpen,
  search_blocks: Search,
  edit_document: Wrench,
  compile_check: Hammer,
  get_latex_source: Code2,
};

const stepConfig = {
  thinking: { icon: Brain, color: "text-muted-foreground/50", dotColor: "bg-slate-400", label: "思考" },
  tool_call: { icon: Terminal, color: "text-blue-500", dotColor: "bg-blue-500", label: "ツール実行" },
  tool_result: { icon: CheckCircle, color: "text-emerald-500", dotColor: "bg-emerald-500", label: "結果" },
  error: { icon: AlertCircle, color: "text-red-500", dotColor: "bg-red-500", label: "エラー" },
} as const;

export function ActionTimeline({ steps }: { steps: ThinkingStep[] }) {
  const hasToolCalls = steps?.some(s => s.type === "tool_call") ?? false;
  const [expanded, setExpanded] = React.useState(hasToolCalls);
  if (!steps || steps.length === 0) return null;

  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
  const toolCalls = steps.filter(s => s.type === "tool_call").length;
  const thinkingSteps = steps.filter(s => s.type === "thinking").length;
  const errors = steps.filter(s => s.type === "error").length;

  const summaryParts: string[] = [];
  if (thinkingSteps) summaryParts.push(`${thinkingSteps}ステップ`);
  if (toolCalls) summaryParts.push(`${toolCalls}ツール`);
  if (errors) summaryParts.push(`${errors}エラー`);
  const summary = summaryParts.join(" · ") || `${steps.length}ステップ`;

  const toolsUsed = [...new Set(steps.filter(s => s.tool).map(s => s.tool!))];

  return (
    <div className="w-full mt-2">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-muted-foreground/50 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors w-full group"
      >
        <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
        <Brain className="h-3 w-3" />
        <span>{summary}</span>

        {toolsUsed.length > 0 && (
          <div className="flex items-center gap-1 ml-1">
            {toolsUsed.map((tool) => {
              const Icon = TOOL_ICONS[tool] || Terminal;
              return (
                <span
                  key={tool}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] text-[9px]"
                  title={tool}
                >
                  <Icon className="h-2.5 w-2.5 text-blue-500/70" />
                </span>
              );
            })}
          </div>
        )}

        {totalDuration > 0 && (
          <span className="text-muted-foreground/30 ml-auto">{formatDuration(totalDuration)}</span>
        )}
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="ml-2 mt-1 pl-3 border-l-2 border-black/[0.06] dark:border-white/[0.06] space-y-0">
          {steps.map((step, i) => {
            const baseConfig = stepConfig[step.type] || stepConfig.thinking;
            const Icon = step.tool ? (TOOL_ICONS[step.tool] || baseConfig.icon) : baseConfig.icon;
            const color = baseConfig.color;

            return (
              <div key={i} className="relative flex items-start gap-2 py-1">
                <div className={`absolute -left-[13.5px] top-[7px] h-2 w-2 rounded-full ${baseConfig.dotColor} ring-2 ring-white dark:ring-surface-1`} />
                <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[11px] ${color}`}>{step.tool || baseConfig.label}</span>
                    {step.duration != null && step.duration > 0 && (
                      <span className="text-[10px] text-muted-foreground/30">{formatDuration(step.duration)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed break-all">{step.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
