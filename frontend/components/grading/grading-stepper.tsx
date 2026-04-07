"use client";

/**
 * 採点モード ステッパー
 *
 * 4 ステップを横並びで表示する。完了済みは緑チェック、現在地は強調、
 * 未着手はグレー。クリックで自由に行き来できる(ただし AI 採点中は不可)。
 */
import React from "react";
import { Check, FileCheck2, Upload, Brain, ClipboardList } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import type { GradingPhase } from "@/lib/grading-types";

type StepKey = "step1-rubric" | "step2-upload" | "step3-grading" | "step4-result";

interface StepDef {
  key: StepKey;
  index: number;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepDef[] = [
  { key: "step1-rubric", index: 1, labelKey: "grading.step.1.label", Icon: FileCheck2 },
  { key: "step2-upload", index: 2, labelKey: "grading.step.2.label", Icon: Upload },
  { key: "step3-grading", index: 3, labelKey: "grading.step.3.label", Icon: Brain },
  { key: "step4-result", index: 4, labelKey: "grading.step.4.label", Icon: ClipboardList },
];

function phaseToIndex(phase: GradingPhase): number {
  switch (phase) {
    case "step1-rubric": return 1;
    case "step2-upload": return 2;
    case "step3-grading": return 3;
    case "step4-result": return 4;
    default: return 0;
  }
}

export function GradingStepper() {
  const { t } = useI18n();
  const phase = useUIStore((s) => s.gradingPhase);
  const setPhase = useUIStore((s) => s.setGradingPhase);
  const processing = useUIStore((s) => s.gradingProcessing);

  const currentIndex = phaseToIndex(phase);

  const handleClick = (target: StepKey) => {
    if (processing) return;       // AI 採点中は移動禁止
    setPhase(target);
  };

  return (
    <div
      role="tablist"
      aria-label="採点モード ステップ"
      className="flex items-center justify-center gap-1 px-6 py-3 border-b border-border/40 bg-background/95"
    >
      {STEPS.map((step, i) => {
        const isCompleted = step.index < currentIndex;
        const isCurrent = step.index === currentIndex;
        const isClickable = !processing;

        return (
          <React.Fragment key={step.key}>
            <button
              role="tab"
              aria-current={isCurrent ? "step" : undefined}
              aria-disabled={!isClickable}
              onClick={() => handleClick(step.key)}
              disabled={!isClickable}
              className={`
                group flex items-center gap-2.5 px-4 py-2 rounded-full transition-all duration-200
                ${isCurrent
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105"
                  : isCompleted
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                }
                ${!isClickable ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
              `}
            >
              <span
                className={`
                  flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold
                  ${isCurrent
                    ? "bg-white/20 text-white"
                    : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground/70"
                  }
                `}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.index}
              </span>
              <span className={`text-sm font-medium ${isCurrent ? "" : "hidden md:inline"}`}>
                {t(step.labelKey)}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-6 md:w-12 transition-colors duration-300 ${
                  step.index < currentIndex ? "bg-emerald-500/50" : "bg-border/60"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
