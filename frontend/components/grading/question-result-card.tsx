"use client";

/**
 * 採点モード Step 4 — 1 設問の採点結果カード
 */
import React, { useState } from "react";
import {
  ChevronDown, ChevronRight, CheckCircle2, MinusCircle, XCircle,
  AlertTriangle, FileQuestion, EyeOff,
} from "lucide-react";
import type { GradedQuestion, AnswerStatus } from "@/lib/grading-types";
import { useI18n } from "@/lib/i18n";

interface Props {
  question: GradedQuestion;
  selected?: boolean;
  onClick?: () => void;
}

function statusOf(awarded: number, max: number): "ok" | "partial" | "ng" {
  if (max <= 0) return "ng";
  const ratio = awarded / max;
  if (ratio >= 0.95) return "ok";
  if (ratio >= 0.4) return "partial";
  return "ng";
}

function StatusIcon({ s }: { s: "ok" | "partial" | "ng" }) {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "partial") return <MinusCircle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

// answerStatus → 注意バナー (answered 以外のときだけ表示)
function AnswerStatusBanner({ status }: { status: AnswerStatus }) {
  const { locale } = useI18n();
  if (status === "answered") return null;
  const isEn = locale === "en";
  const meta: Record<Exclude<AnswerStatus, "answered">, {
    icon: React.ReactNode;
    title: string;
    body: string;
    cls: string;
  }> = {
    off_topic: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      title: isEn ? "Image unrelated to the question" : "問題と無関係な画像",
      body: isEn
        ? "The uploaded image does not appear to be an answer to this question. Please re-upload the correct image."
        : "アップロードされた画像はこの問題への答案ではないようです。問題に対応する答案を再度アップロードしてください。",
      cls: "bg-rose-50 text-rose-700 border-rose-300/50 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-700/40",
    },
    blank: {
      icon: <FileQuestion className="h-3.5 w-3.5" />,
      title: isEn ? "No answer written" : "答案記述なし",
      body: isEn
        ? "No answer was found for this question."
        : "この設問に対する答案記述が見つかりませんでした。",
      cls: "bg-amber-50 text-amber-700 border-amber-300/50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700/40",
    },
    illegible: {
      icon: <EyeOff className="h-3.5 w-3.5" />,
      title: isEn ? "Illegible" : "判読不能",
      body: isEn
        ? "The answer could not be read. Please re-upload a clearer image."
        : "答案を読み取れませんでした。鮮明な画像で再アップロードしてください。",
      cls: "bg-slate-100 text-slate-700 border-slate-300/60 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-600/50",
    },
  };
  const m = meta[status];
  return (
    <div className={`flex items-start gap-2 px-2.5 py-1.5 mt-2 text-[11px] rounded-md border ${m.cls}`}>
      <span className="mt-0.5 shrink-0">{m.icon}</span>
      <div>
        <div className="font-semibold">{m.title}</div>
        <div className="opacity-90 mt-0.5">{m.body}</div>
      </div>
    </div>
  );
}

export function QuestionResultCard({ question, selected = false, onClick }: Props) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [open, setOpen] = useState(true);
  const status = statusOf(question.awardedPoints, question.maxPoints);
  const answerStatus: AnswerStatus = question.answerStatus ?? "answered";

  return (
    <div
      className={`
        border rounded-lg overflow-hidden bg-background transition-all duration-200
        ${selected ? "border-emerald-500 shadow-md shadow-emerald-500/10" : "border-border/40"}
      `}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          onClick?.();
        }}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <StatusIcon s={status} />
        <span className="text-sm font-semibold flex-1 truncate">
          {question.questionLabel || question.questionId}
        </span>
        <span className="text-sm tabular-nums font-mono">
          <span className={status === "ok" ? "text-emerald-600 dark:text-emerald-400" : status === "partial" ? "text-amber-600 dark:text-amber-400" : "text-red-500"}>
            {question.awardedPoints}
          </span>
          <span className="text-muted-foreground"> / {question.maxPoints}</span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/30 bg-muted/10">
          {/* answer status バナー (off_topic / blank / illegible のときだけ) */}
          <AnswerStatusBanner status={answerStatus} />

          {/* 観点別 */}
          {question.criteriaResults.length > 0 && (
            <ul className="space-y-1">
              {question.criteriaResults.map((c, i) => {
                const cs = statusOf(c.awarded, c.weight);
                return (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    <StatusIcon s={cs} />
                    <span className="flex-1 text-foreground/80">{c.description}</span>
                    <span className="tabular-nums font-mono text-muted-foreground">
                      {c.awarded}/{c.weight}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 読み取り答案 */}
          {question.transcribedAnswer && (
            <details className="mt-2">
              <summary className="text-[10px] font-mono text-muted-foreground cursor-pointer hover:text-foreground/80">
                {isEn ? "Transcribed answer" : "読み取り答案"}
              </summary>
              <pre className="mt-1 text-[11px] font-mono text-foreground/70 bg-background border border-border/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {question.transcribedAnswer}
              </pre>
            </details>
          )}

          {/* 講評 */}
          {question.overallComment && (
            <p className="text-[11px] text-foreground/75 leading-relaxed border-l-2 border-emerald-500/40 pl-2 mt-2">
              {question.overallComment}
            </p>
          )}

          {/* 観点コメント */}
          {question.criteriaResults.some((c) => c.comment) && (
            <ul className="space-y-0.5 mt-1">
              {question.criteriaResults.filter((c) => c.comment).map((c, i) => (
                <li key={i} className="text-[10px] text-muted-foreground">
                  · {c.description}: {c.comment}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
