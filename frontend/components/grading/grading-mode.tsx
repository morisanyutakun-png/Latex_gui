"use client";

/**
 * 採点モード — フルスクリーン UI のトップレベル
 *
 * 構造:
 *   ┌─────────── ヘッダ (タイトル + 閉じる) ───────────┐
 *   │ ステッパー (4 ステップ)                          │
 *   │ メインエリア (Step 1〜4 のうち現在の phase を表示)│
 *   │ フッタ (戻る / 次へ / 採点開始 等)               │
 *   └──────────────────────────────────────────────────┘
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ClipboardCheck, RotateCcw } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useI18n } from "@/lib/i18n";
import { gradeAnswerStream } from "@/lib/api";
import type { GradingStreamEvent } from "@/lib/grading-types";
import { GradingStepper } from "./grading-stepper";
import { Step1Rubric } from "./step-1-rubric";
import { Step2Upload } from "./step-2-upload";
import { Step3Grading, type ProgressLogItem } from "./step-3-grading";
import { Step4Result } from "./step-4-result";
import { toast } from "sonner";

const PHASE_LABELS: Record<string, string> = {
  extracting_pages: "答案を読み込んでいます",
  parsing_rubric: "採点基準を読み込みました",
  ai_grading: "AIが採点中…",
  retrying: "再試行中…",
  rendering: "採点結果を整理中…",
};

export function GradingMode() {
  const { t } = useI18n();
  const gradingMode = useUIStore((s) => s.gradingMode);
  const phase = useUIStore((s) => s.gradingPhase);
  const setPhase = useUIStore((s) => s.setGradingPhase);
  const closeGrading = useUIStore((s) => s.closeGrading);
  const problemTitle = useUIStore((s) => s.gradingProblemTitle);
  const problemLatex = useUIStore((s) => s.gradingProblemLatex);
  const rubricBundle = useUIStore((s) => s.gradingRubrics);
  const answerFiles = useUIStore((s) => s.gradingAnswerFiles);
  const studentName = useUIStore((s) => s.gradingStudentName);
  const studentId = useUIStore((s) => s.gradingStudentId);
  const processing = useUIStore((s) => s.gradingProcessing);
  const setProcessing = useUIStore((s) => s.setGradingProcessing);
  const setProgress = useUIStore((s) => s.setGradingProgress);
  const setResult = useUIStore((s) => s.setGradingResult);
  const isMobile = useIsMobile();

  // Step 3 用の進捗ログとハイライト
  const [progressLog, setProgressLog] = useState<ProgressLogItem[]>([]);
  const [highlightPage, setHighlightPage] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup: 採点モードを抜けるときに進行中のリクエストを中断
  useEffect(() => {
    if (!gradingMode) {
      abortRef.current?.abort();
      abortRef.current = null;
      setProgressLog([]);
      setHighlightPage(null);
    }
  }, [gradingMode]);

  const updateLastInProgress = useCallback((status: ProgressLogItem["status"]) => {
    setProgressLog((log) => {
      const next = [...log];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].status === "in_progress") {
          next[i] = { ...next[i], status };
          break;
        }
      }
      return next;
    });
  }, []);

  const handleStartGrading = useCallback(async () => {
    if (!rubricBundle || rubricBundle.rubrics.length === 0) {
      toast.error("採点基準が設定されていません");
      return;
    }
    if (answerFiles.length === 0) {
      toast.error("答案ファイルがアップロードされていません");
      return;
    }

    // Step 3 に遷移して採点開始
    setPhase("step3-grading");
    setProcessing(true);
    setProgressLog([]);
    setProgress("");
    setResult(null);
    setHighlightPage(0);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const result = await gradeAnswerStream(
        {
          rubrics: rubricBundle,
          problemLatex,
          studentName,
          studentId,
          files: answerFiles,
        },
        (event: GradingStreamEvent) => {
          if (event.type === "progress") {
            const userText = PHASE_LABELS[event.phase] ?? event.message;
            // 既存の in_progress を done にして、新しい行を in_progress で追加
            setProgressLog((log) => {
              const next = log.map((item) =>
                item.status === "in_progress" ? { ...item, status: "done" as const } : item
              );
              next.push({ kind: "stage", text: userText, status: "in_progress" });
              return next;
            });
            setProgress(userText);
            // ai_grading 中はサムネのページ送りアニメ
            if (event.phase === "ai_grading") {
              setHighlightPage(0);
            }
          } else if (event.type === "question_done") {
            setProgressLog((log) => {
              const next = [...log];
              next.push({
                kind: "question",
                text: `${event.questionId} 採点完了`,
                status: "done",
                detail: `${event.awarded}/${event.max}点`,
              });
              return next;
            });
            // ハイライトを次のページへ進めるダミー (実際のページ対応は将来)
            setHighlightPage((p) => (p === null ? 0 : p));
          } else if (event.type === "done") {
            updateLastInProgress("done");
            setProgressLog((log) => [
              ...log,
              { kind: "stage", text: "採点が完了しました", status: "done" },
            ]);
          } else if (event.type === "error") {
            updateLastInProgress("error");
            setProgressLog((log) => [
              ...log,
              { kind: "error", text: event.message, status: "error" },
            ]);
          }
        },
        abortRef.current.signal,
      );
      setResult(result);
      setHighlightPage(null);
      // 余韻 0.4s でステップ4へ
      setTimeout(() => setPhase("step4-result"), 400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "採点に失敗しました";
      toast.error(msg);
      setProgressLog((log) => [
        ...log,
        { kind: "error", text: msg, status: "error" },
      ]);
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }, [
    rubricBundle, answerFiles, problemLatex, studentName, studentId,
    setPhase, setProcessing, setProgress, setResult, updateLastInProgress,
  ]);

  if (!gradingMode) return null;

  // Mobile gate
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-medium">{t("grading.mobile.unsupported")}</p>
        <button
          onClick={closeGrading}
          className="mt-2 px-4 py-2 text-sm rounded-lg border border-border/40 hover:bg-muted/40"
        >
          {t("grading.header.close")}
        </button>
      </div>
    );
  }

  // ── Step ごとのフッタ可否 ──
  const canGoBack = phase === "step2-upload" || phase === "step4-result";
  const hasRubrics = (rubricBundle?.rubrics?.length ?? 0) > 0;
  const hasAnswers = answerFiles.length > 0;

  let nextLabel = t("grading.action.next");
  let nextDisabled = false;
  let nextHandler: (() => void) | null = null;

  if (phase === "step1-rubric") {
    nextLabel = t("grading.action.next");
    nextDisabled = !hasRubrics;
    nextHandler = () => setPhase("step2-upload");
  } else if (phase === "step2-upload") {
    nextLabel = t("grading.action.start");
    nextDisabled = !hasAnswers || processing;
    nextHandler = () => {
      handleStartGrading();
    };
  } else if (phase === "step3-grading") {
    nextLabel = t("grading.action.next");
    nextDisabled = true;
    nextHandler = null;
  } else if (phase === "step4-result") {
    nextLabel = t("grading.action.again");
    nextDisabled = false;
    nextHandler = () => {
      // Step 2 に戻り、答案だけクリア (採点基準は保持)
      useUIStore.setState({
        gradingAnswerFiles: [],
        gradingResult: null,
        gradingMarkedPdfUrl: null,
        gradingFeedbackPdfUrl: null,
        gradingProgress: "",
      });
      setProgressLog([]);
      setPhase("step2-upload");
    };
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200"
      role="dialog"
      aria-label="採点モード"
    >
      {/* ── ヘッダ ── */}
      <div className="h-12 border-b border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">{t("grading.header.title")}</span>
          {problemTitle && (
            <span className="text-xs text-muted-foreground truncate max-w-[280px]">
              — {problemTitle}
            </span>
          )}
        </div>
        <button
          onClick={closeGrading}
          disabled={processing}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("grading.header.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── ステッパー ── */}
      <GradingStepper />

      {/* ── メインエリア ── */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#fafaf8] dark:bg-[#0d0d0c]">
        {phase === "step1-rubric" && <Step1Rubric />}
        {phase === "step2-upload" && <Step2Upload />}
        {phase === "step3-grading" && (
          <Step3Grading log={progressLog} highlightPage={highlightPage} />
        )}
        {phase === "step4-result" && <Step4Result />}
      </div>

      {/* ── フッタ ── */}
      <div className="h-14 border-t border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-6 shrink-0">
        <button
          onClick={() => {
            if (phase === "step2-upload") setPhase("step1-rubric");
            else if (phase === "step4-result") setPhase("step2-upload");
          }}
          disabled={!canGoBack || processing}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("grading.action.back")}
        </button>

        {nextHandler && (
          <button
            onClick={nextHandler}
            disabled={nextDisabled}
            className={`
              inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg transition-all
              ${phase === "step4-result"
                ? "bg-foreground/10 text-foreground hover:bg-foreground/15"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30"
              }
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
            `}
          >
            {phase === "step4-result" ? <RotateCcw className="h-4 w-4" /> : null}
            {nextLabel}
            {phase !== "step4-result" && <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
