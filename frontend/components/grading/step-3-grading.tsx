"use client";

/**
 * 採点モード Step 3 — AI 採点中
 *
 * 進捗チェックリスト + 答案サムネハイライト + question_done アニメ。
 */
import React from "react";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { AnswerThumbnailStrip } from "./answer-thumbnail-strip";

export interface ProgressLogItem {
  kind: "stage" | "question" | "error";
  text: string;
  status: "in_progress" | "done" | "error";
  detail?: string;
}

interface Props {
  log: ProgressLogItem[];
  highlightPage: number | null;
}

export function Step3Grading({ log, highlightPage }: Props) {
  const { t } = useI18n();
  const files = useUIStore((s) => s.gradingAnswerFiles);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr] gap-4 px-6 py-6 overflow-hidden max-w-5xl mx-auto w-full">
      {/* ── 左: サムネ列 ── */}
      <div className="flex flex-col gap-3 overflow-hidden">
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          答案
        </span>
        <div className="overflow-y-auto">
          <div className="flex flex-col gap-2">
            <AnswerThumbnailStrip files={files} highlightIndex={highlightPage} />
          </div>
        </div>
      </div>

      {/* ── 右: 進捗チェックリスト ── */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <h3 className="text-base font-semibold">{t("grading.step.3.title")}</h3>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto border border-border/40 rounded-lg bg-background p-4"
          aria-live="polite"
        >
          <ul className="space-y-2.5">
            {log.length === 0 && (
              <li className="text-sm text-muted-foreground">準備中…</li>
            )}
            {log.map((item, i) => (
              <li
                key={i}
                className={`
                  flex items-start gap-2.5 text-sm
                  ${item.kind === "question" ? "pl-6" : ""}
                `}
              >
                <span className="mt-0.5">
                  {item.status === "done" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {item.status === "in_progress" && (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  )}
                  {item.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {/* fallback */}
                  {!["done", "in_progress", "error"].includes(item.status) && (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </span>
                <span
                  className={`
                    flex-1
                    ${item.status === "done" ? "text-foreground/80" : ""}
                    ${item.status === "in_progress" ? "text-foreground" : ""}
                    ${item.status === "error" ? "text-red-500" : ""}
                  `}
                >
                  {item.text}
                  {item.detail && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground/70 text-center mt-3">
          ⏱ {t("grading.progress.estimate")}
        </p>
      </div>
    </div>
  );
}
