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
  thinking: { icon: Brain, color: "text-slate-400", dotColor: "bg-slate-400", label: "思考" },
  tool_call: { icon: Terminal, color: "text-blue-400", dotColor: "bg-blue-400", label: "ツール実行" },
  tool_result: { icon: CheckCircle, color: "text-emerald-400", dotColor: "bg-emerald-400", label: "結果" },
  error: { icon: AlertCircle, color: "text-red-400", dotColor: "bg-red-400", label: "エラー" },
} as const;

export function ActionTimeline({ steps }: { steps: ThinkingStep[] }) {
  // Auto-expand if there are tool calls (not just thinking)
  const hasToolCalls = steps?.some(s => s.type === "tool_call") ?? false;
  const [expanded, setExpanded] = React.useState(hasToolCalls);
  if (!steps || steps.length === 0) return null;

  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
  const toolCalls = steps.filter(s => s.type === "tool_call").length;
  const thinkingSteps = steps.filter(s => s.type === "thinking").length;
  const errors = steps.filter(s => s.type === "error").length;

  // Build rich summary
  const summaryParts: string[] = [];
  if (thinkingSteps) summaryParts.push(`${thinkingSteps}ステップ思考`);
  if (toolCalls) summaryParts.push(`${toolCalls}ツール実行`);
  if (errors) summaryParts.push(`${errors}エラー`);
  const summary = summaryParts.join(" · ") || `${steps.length}ステップ`;

  // Unique tools used
  const toolsUsed = [...new Set(steps.filter(s => s.tool).map(s => s.tool!))];

  return (
    <div className="w-full mt-1">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-1 py-1 rounded-md text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors w-full group"
      >
        <ChevronRight className={`h-3 w-3 transition-transform duration-200 text-slate-400 ${expanded ? "rotate-90" : ""}`} />
        <Brain className="h-3 w-3 text-slate-400" />
        <span className="text-slate-500 dark:text-slate-400">{summary}</span>

        {/* Tool badges */}
        {toolsUsed.length > 0 && (
          <div className="flex items-center gap-1 ml-1">
            {toolsUsed.map((tool) => {
              const Icon = TOOL_ICONS[tool] || Terminal;
              return (
                <span
                  key={tool}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px]"
                  title={tool}
                >
                  <Icon className="h-2.5 w-2.5 text-blue-400" />
                </span>
              );
            })}
          </div>
        )}

        {totalDuration > 0 && (
          <span className="text-slate-400 dark:text-slate-500 ml-auto">{formatDuration(totalDuration)}</span>
        )}
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="ml-1.5 mt-1 pl-3 border-l border-slate-200 dark:border-slate-700/60 space-y-0">
          {steps.map((step, i) => {
            const baseConfig = stepConfig[step.type] || stepConfig.thinking;
            const Icon = step.tool ? (TOOL_ICONS[step.tool] || baseConfig.icon) : baseConfig.icon;
            const color = baseConfig.color;

            return (
              <div key={i} className="relative flex items-start gap-2 py-1">
                {/* Timeline dot */}
                <div className={`absolute -left-[13.5px] top-[7px] h-2 w-2 rounded-full ${baseConfig.dotColor} ring-2 ring-white dark:ring-surface-2`} />
                {/* Content */}
                <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[11px] font-mono ${color}`}>
                      {step.tool || baseConfig.label}
                    </span>
                    {step.duration != null && step.duration > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        {formatDuration(step.duration)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed break-all">
                    {step.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
