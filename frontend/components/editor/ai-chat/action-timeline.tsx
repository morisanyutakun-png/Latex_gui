import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Brain, Terminal, CheckCircle, AlertCircle, ChevronRight,
  Search, Wrench, Code2, BookOpen, Hammer,
} from "lucide-react";
import { formatDuration } from "./utils";
import { useI18n } from "@/lib/i18n";

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_latex: BookOpen,
  set_latex: Wrench,
  replace_in_latex: Search,
  compile_check: Hammer,
  // Legacy aliases
  read_document: BookOpen,
  search_blocks: Search,
  edit_document: Wrench,
  get_latex_source: Code2,
};

const stepStyle = {
  thinking:    { icon: Brain,         bg: "bg-violet-100/50 dark:bg-violet-500/08", color: "text-violet-400/70",             dot: "bg-violet-400/60",  labelKey: "timeline.label.thinking" },
  tool_call:   { icon: Terminal,      bg: "bg-indigo-100/60 dark:bg-indigo-500/10", color: "text-indigo-500 dark:text-indigo-400", dot: "bg-indigo-400",  labelKey: "timeline.label.exec"     },
  tool_result: { icon: CheckCircle,   bg: "bg-emerald-100/60 dark:bg-emerald-500/10", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-400", labelKey: "timeline.label.done"    },
  error:       { icon: AlertCircle,   bg: "bg-red-100/60 dark:bg-red-500/10",       color: "text-red-500",                  dot: "bg-red-400",    labelKey: "timeline.label.error"   },
} as const;

export function ActionTimeline({ steps }: { steps: ThinkingStep[] }) {
  const { t } = useI18n();
  const hasToolCalls = steps?.some(s => s.type === "tool_call") ?? false;
  const [expanded, setExpanded] = React.useState(hasToolCalls);
  if (!steps || steps.length === 0) return null;

  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
  const toolCalls = steps.filter(s => s.type === "tool_call").length;
  const thinkingSteps = steps.filter(s => s.type === "thinking").length;
  const errors = steps.filter(s => s.type === "error").length;

  const summaryParts: string[] = [];
  if (thinkingSteps) summaryParts.push(`${thinkingSteps} ${t("timeline.thinking")}`);
  if (toolCalls) summaryParts.push(`${toolCalls} ${t("timeline.tools")}`);
  if (errors) summaryParts.push(`${errors} ${t("timeline.errors")}`);
  const summary = summaryParts.join(" · ") || `${steps.length} ${t("timeline.steps")}`;

  const toolsUsed = [...new Set(steps.filter(s => s.tool).map(s => s.tool!))];

  return (
    <div className="w-full mt-2">
      {/* Collapsible toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-muted/20 transition-all duration-150 w-full group"
      >
        <ChevronRight className={`h-2.5 w-2.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""} text-violet-400/40 group-hover:text-violet-400/60`} />
        <Brain className="h-2.5 w-2.5 text-violet-400/40 group-hover:text-violet-400/60" />
        <span className="tracking-wide">{summary}</span>

        {toolsUsed.length > 0 && (
          <div className="flex items-center gap-1 ml-1">
            {toolsUsed.map((tool) => {
              const Icon = TOOL_ICONS[tool] || Terminal;
              return (
                <span
                  key={tool}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-indigo-100/50 dark:bg-indigo-500/08 text-[8.5px]"
                  title={tool}
                >
                  <Icon className="h-2 w-2 text-indigo-400/60" />
                </span>
              );
            })}
          </div>
        )}

        {totalDuration > 0 && (
          <span className="text-muted-foreground/25 ml-auto tabular-nums">{formatDuration(totalDuration)}</span>
        )}
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="ml-2 mt-1 pl-3 border-l-2 chat-timeline-border space-y-0">
          {steps.map((step, i) => {
            const baseConfig = stepStyle[step.type] || stepStyle.thinking;
            const Icon = step.tool ? (TOOL_ICONS[step.tool] || baseConfig.icon) : baseConfig.icon;

            return (
              <div key={i} className="relative flex items-start gap-2 py-1">
                {/* Timeline dot */}
                <div className={`absolute -left-[14px] top-[9px] h-1.5 w-1.5 rounded-full ${baseConfig.dot} ring-2 ring-background`} />

                {/* Icon badge */}
                <div className={`h-5 w-5 rounded-md ${baseConfig.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-3 w-3 ${baseConfig.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[11px] font-medium ${baseConfig.color}`}>
                      {step.tool || t(baseConfig.labelKey)}
                    </span>
                    {step.duration != null && step.duration > 0 && (
                      <span className="text-[10px] text-muted-foreground/25 tabular-nums">{formatDuration(step.duration)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/45 leading-relaxed break-all mt-0.5">{step.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
