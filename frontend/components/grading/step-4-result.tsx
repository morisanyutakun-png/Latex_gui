"use client";

/**
 * 採点モード Step 4 — 採点結果と PDF 出力
 *
 * Phase 5 では:
 *   - 設問別カード列 (左)
 *   - 答案プレビュー (中央) — Phase 7 で赤入れ PDF プレビューに差し替え
 *   - 出力ボタン群 (右) — Phase 6/7 で実装するが UI はここで配置
 *   - 全体講評 (下)
 */
import React, { useEffect, useState } from "react";
import { FileDown, Image as ImageIcon, Loader2, AlertTriangle } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { renderFeedbackPdf, renderMarkedPdf } from "@/lib/api";
import { QuestionResultCard } from "./question-result-card";
import { AnswerThumbnailStrip } from "./answer-thumbnail-strip";
import { toast } from "sonner";

function fileName(student: string, kind: "marked" | "feedback"): string {
  const base = (student || "answer").replace(/\s+/g, "_");
  return `${base}_${kind}.pdf`;
}

function triggerDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function Step4Result() {
  const { t } = useI18n();
  const result = useUIStore((s) => s.gradingResult);
  const files = useUIStore((s) => s.gradingAnswerFiles);
  const markedUrl = useUIStore((s) => s.gradingMarkedPdfUrl);
  const setMarkedUrl = useUIStore((s) => s.setGradingMarkedPdfUrl);
  const feedbackUrl = useUIStore((s) => s.gradingFeedbackPdfUrl);
  const setFeedbackUrl = useUIStore((s) => s.setGradingFeedbackPdfUrl);

  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(0);
  const [renderingMarked, setRenderingMarked] = useState(false);
  const [renderingFeedback, setRenderingFeedback] = useState(false);
  const [markedError, setMarkedError] = useState<string | null>(null);

  // 初回 / 結果変更時に自動で赤入れPDFを生成
  useEffect(() => {
    if (!result || markedUrl || renderingMarked) return;
    setRenderingMarked(true);
    setMarkedError(null);
    renderMarkedPdf(result)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setMarkedUrl(url);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "赤入れPDF生成に失敗しました";
        setMarkedError(msg);
      })
      .finally(() => setRenderingMarked(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const handleDownloadFeedback = async () => {
    if (!result) return;
    if (feedbackUrl) {
      triggerDownload(feedbackUrl, fileName(result.studentName, "feedback"));
      return;
    }
    setRenderingFeedback(true);
    try {
      const blob = await renderFeedbackPdf(result);
      const url = URL.createObjectURL(blob);
      setFeedbackUrl(url);
      triggerDownload(url, fileName(result.studentName, "feedback"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "フィードバックPDF生成に失敗しました");
    } finally {
      setRenderingFeedback(false);
    }
  };

  const handleDownloadMarked = () => {
    if (!result || !markedUrl) return;
    triggerDownload(markedUrl, fileName(result.studentName, "marked"));
  };

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        採点結果がまだありません
      </div>
    );
  }

  const totalPct = result.percentage;

  // 全設問が answered 以外なら、答案が問題と一致しなかった可能性が高い
  const allInvalid =
    result.questions.length > 0 &&
    result.questions.every((q) => (q.answerStatus ?? "answered") !== "answered");
  const allOffTopic =
    allInvalid && result.questions.every((q) => q.answerStatus === "off_topic");

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-4 gap-3 overflow-hidden">
      {/* 全設問が無関係/空白だった場合の警告バナー */}
      {allInvalid && (
        <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300/60 dark:border-rose-700/50 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800 dark:text-rose-200 leading-relaxed">
            <div className="font-semibold mb-0.5">
              {allOffTopic
                ? "アップロードされた画像は、この問題への答案ではないようです"
                : "この答案からは有効な解答記述が読み取れませんでした"}
            </div>
            <div className="text-[12px] text-rose-700/85 dark:text-rose-300/85">
              採点を行うため、問題と一致する答案画像を Step 2 から再アップロードしてください。
              （AI が無関係なファイルに点数を付けてしまうのを防ぐため、自動的に 0 点としています。）
            </div>
          </div>
        </div>
      )}

      {/* ヘッダ: 合計スコア */}
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-sky-50 dark:from-emerald-950/20 dark:to-sky-950/20 border border-emerald-200/40 dark:border-emerald-800/40 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          {result.studentName && (
            <span className="text-sm font-medium">{result.studentName}</span>
          )}
          {result.studentId && (
            <span className="text-[11px] font-mono text-muted-foreground">
              ({result.studentId})
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {result.totalPoints}
          </span>
          <span className="text-base text-muted-foreground"> / {result.maxPoints}</span>
          <span className="ml-3 text-base text-muted-foreground">({totalPct}%)</span>
        </div>
      </div>

      {/* メイン: 3 カラム */}
      <div className="grid grid-cols-[280px_1fr_220px] gap-3 flex-1 min-h-0 overflow-hidden">
        {/* ── 左: 設問カード列 ── */}
        <div className="flex flex-col min-h-0 border border-border/40 rounded-lg bg-background overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 bg-muted/30">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              設問別
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {result.questions.map((q) => (
              <QuestionResultCard
                key={q.questionId}
                question={q}
                selected={selectedQ === q.questionId}
                onClick={() => {
                  setSelectedQ(q.questionId);
                  // 最初の mark の page を選択
                  const firstMark = q.marks.find((m) => m.bbox);
                  if (firstMark?.bbox) setActivePage(firstMark.bbox.pageIndex);
                }}
              />
            ))}
          </div>
        </div>

        {/* ── 中央: 赤入れ PDF プレビュー ── */}
        <div className="flex flex-col min-h-0 border border-border/40 rounded-lg bg-background overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              赤入れPDFプレビュー
            </span>
            {renderingMarked && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                生成中
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/10">
            {renderingMarked && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <span className="text-xs">LuaLaTeX でコンパイル中…</span>
              </div>
            )}
            {!renderingMarked && markedError && (
              <div className="flex flex-col items-center gap-2 text-center px-6 py-4">
                <span className="text-xs text-red-500 max-w-md">{markedError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMarkedUrl(null);
                    setMarkedError(null);
                  }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 underline"
                >
                  もう一度生成
                </button>
              </div>
            )}
            {!renderingMarked && !markedError && markedUrl && (
              <embed
                src={markedUrl}
                type="application/pdf"
                className="w-full h-full"
              />
            )}
            {!renderingMarked && !markedError && !markedUrl && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-30" />
                <span className="text-xs">プレビューなし</span>
              </div>
            )}
          </div>
          {/* サムネ列 (クリックでページ移動ヒント) */}
          {files.length > 1 && (
            <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
              <AnswerThumbnailStrip
                files={files}
                highlightIndex={activePage}
                onClickPage={(i) => setActivePage(i)}
              />
            </div>
          )}
        </div>

        {/* ── 右: 出力ボタン群 ── */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider px-1">
            出力
          </span>
          <button
            type="button"
            disabled={!markedUrl || renderingMarked}
            onClick={handleDownloadMarked}
            className="flex items-center gap-2 px-3 py-3 rounded-lg border border-border/40 bg-background hover:bg-emerald-50/40 dark:hover:bg-emerald-500/10 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-xs font-medium leading-tight">
              {t("grading.result.dl_marked")}
            </span>
          </button>
          <button
            type="button"
            disabled={renderingFeedback}
            onClick={handleDownloadFeedback}
            className="flex items-center gap-2 px-3 py-3 rounded-lg border border-border/40 bg-background hover:bg-emerald-50/40 dark:hover:bg-emerald-500/10 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {renderingFeedback
              ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500 shrink-0" />
              : <FileDown className="h-4 w-4 text-emerald-500 shrink-0" />}
            <span className="text-xs font-medium leading-tight">
              {t("grading.result.dl_feedback")}
            </span>
          </button>
        </div>
      </div>

      {/* 全体講評 */}
      {result.overallFeedback && (
        <div className="border border-border/40 rounded-lg bg-background px-4 py-3">
          <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {t("grading.result.feedback")}
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            {result.overallFeedback}
          </p>
        </div>
      )}
    </div>
  );
}
