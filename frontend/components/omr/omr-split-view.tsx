"use client";

/**
 * OMR (画像/PDF → LaTeX) の全画面 Split View。採点モードと同じ「ヘッダ + メイン + フッタ」
 * の骨格で、メインエリアは 2 段階:
 *
 *   phase = analyzing  →  [Source | 進捗ログ]
 *   phase = review     →  [Source | LaTeX ソース (編集可) | コンパイル済み PDF プレビュー]
 *
 * ユーザは right pane の LaTeX を直接書き換えて middle pane の PDF プレビューで
 * ちゃんと組版できるか即時確認してから「承認して編集画面へ」を押せる。
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import {
  streamOMRAnalyze,
  compileRawLatex,
  CompileError,
  formatCompileError,
} from "@/lib/api";
import type { OMRStreamEvent } from "@/lib/api";
import {
  X, Check, RefreshCw, Loader2, ArrowRight, ScanLine, AlertTriangle,
  FileText, Code2, FileDown, CheckCircle2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

type ProgressItem = { text: string; status: "in_progress" | "done" | "error" };

interface CompileErrorView {
  title: string;
  lines: string[];
  hint?: string;
}

export function OMRSplitView() {
  const { t, locale } = useI18n();
  const isJa = locale === "ja";

  const omrMode = useUIStore((s) => s.omrMode);
  const sourceUrl = useUIStore((s) => s.omrSourceUrl);
  const sourceName = useUIStore((s) => s.omrSourceName);
  const extractedLatex = useUIStore((s) => s.omrExtractedLatex);
  const processing = useUIStore((s) => s.omrProcessing);
  const progress = useUIStore((s) => s.omrProgress);
  const closeOMR = useUIStore((s) => s.closeOMR);
  const setOMRLatex = useUIStore((s) => s.setOMRLatex);
  const setOMRProcessing = useUIStore((s) => s.setOMRProcessing);
  const setOMRProgress = useUIStore((s) => s.setOMRProgress);

  const doc = useDocumentStore((s) => s.document);
  const applyAiLatex = useDocumentStore((s) => s.applyAiLatex);

  const fileRef = useRef<File | null>(null);

  // ローカル編集可能な LaTeX (ユーザーが適用前に手直しできる)
  const [editedLatex, setEditedLatex] = useState<string>("");

  // extractedLatex が反映されたらローカル state に同期
  useEffect(() => {
    if (extractedLatex) setEditedLatex(extractedLatex);
  }, [extractedLatex]);

  // 進捗ログ — 解析中に段階的にたまる
  const [progressLog, setProgressLog] = useState<ProgressItem[]>([]);

  const pushProgress = useCallback((text: string, status: ProgressItem["status"] = "in_progress") => {
    setProgressLog((log) => {
      // 直前の in_progress を done に昇格して、新しい行を in_progress で積む
      const next = log.map((item) =>
        item.status === "in_progress" ? { ...item, status: "done" as const } : item
      );
      next.push({ text, status });
      return next;
    });
  }, []);

  const startAnalysis = useCallback(async (file: File) => {
    if (!doc) return;
    fileRef.current = file;
    setOMRProcessing(true);
    setOMRProgress(t("omr.analyzing"));
    setOMRLatex(null);
    setEditedLatex("");
    setProgressLog([{ text: t("omr.analyzing"), status: "in_progress" }]);

    try {
      const result = await streamOMRAnalyze(
        file, doc,
        (event: OMRStreamEvent) => {
          if (event.type === "progress") {
            setOMRProgress(event.message);
            pushProgress(event.message, "in_progress");
          }
        },
        "", undefined, locale,
      );

      if (result.latex) {
        setOMRLatex(result.latex);
        const summary = isJa
          ? `${result.latex.length} 文字の LaTeX を抽出しました`
          : `Extracted ${result.latex.length} chars of LaTeX`;
        setOMRProgress(`${result.latex.length} ${t("omr.extracted.suffix")}`);
        setProgressLog((log) => {
          const next = log.map((i) =>
            i.status === "in_progress" ? { ...i, status: "done" as const } : i
          );
          next.push({ text: summary, status: "done" });
          return next;
        });
      } else {
        setOMRProgress(t("omr.no_latex"));
        setProgressLog((log) => [...log, { text: t("omr.no_latex"), status: "error" }]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OMR error";
      setOMRProgress(`${t("omr.error.prefix")}: ${msg}`);
      setProgressLog((log) => [...log, { text: msg, status: "error" }]);
    } finally {
      setOMRProcessing(false);
    }
  }, [doc, t, locale, isJa, setOMRLatex, setOMRProcessing, setOMRProgress, pushProgress]);

  const handleApprove = useCallback(() => {
    if (!editedLatex.trim()) return;
    applyAiLatex(editedLatex);
    toast.success(t("omr.applied"));
    closeOMR();
  }, [editedLatex, applyAiLatex, closeOMR, t]);

  const handleRetry = useCallback(() => {
    if (fileRef.current) startAnalysis(fileRef.current);
  }, [startAnalysis]);

  // ファイル取り込み後に自動解析開始
  const initialized = useRef(false);
  useEffect(() => {
    if (!omrMode || initialized.current) return;
    initialized.current = true;

    if (sourceUrl && sourceName) {
      fetch(sourceUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], sourceName, { type: blob.type });
          startAnalysis(file);
        })
        .catch(() => setOMRProgress(t("omr.read_failed")));
    }
    return () => { initialized.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [omrMode, sourceUrl, sourceName]);

  if (!omrMode) return null;

  const isPdf = !!sourceName?.toLowerCase().endsWith(".pdf");
  const hasExtracted = !!extractedLatex;
  const canApply = !processing && !!editedLatex.trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200"
      role="dialog"
      aria-label={t("omr.title")}
    >
      {/* ── ヘッダ (採点モードと同じ骨格) ── */}
      <div className="h-12 border-b border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <ScanLine className="h-4 w-4 text-cyan-500" />
          <span className="text-sm font-medium">{t("omr.title")}</span>
          {sourceName && (
            <span className="text-xs text-muted-foreground truncate max-w-[280px]">
              — {sourceName}
            </span>
          )}
          {processing && (
            <span className="inline-flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress || t("omr.analyzing")}
            </span>
          )}
          {!processing && hasExtracted && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {isJa ? "抽出完了" : "Extracted"}
            </span>
          )}
        </div>
        <button
          onClick={closeOMR}
          disabled={processing}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={isJa ? "閉じる" : "Close"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── メインエリア ── */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#fafaf8] dark:bg-[#0d0d0c]">
        {processing || !hasExtracted ? (
          <AnalyzingView
            sourceUrl={sourceUrl}
            sourceName={sourceName}
            isPdf={isPdf}
            progressLog={progressLog}
            isJa={isJa}
            t={t}
          />
        ) : (
          <ReviewView
            sourceUrl={sourceUrl}
            sourceName={sourceName}
            isPdf={isPdf}
            latex={editedLatex}
            onLatexChange={setEditedLatex}
            isJa={isJa}
            t={t}
          />
        )}
      </div>

      {/* ── フッタ ── */}
      <div className="h-14 border-t border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-6 shrink-0">
        <button
          onClick={handleRetry}
          disabled={processing || !fileRef.current}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RefreshCw className="h-4 w-4" />
          {t("omr.rescan")}
        </button>

        <div className="flex items-center gap-3">
          {hasExtracted && !processing && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {editedLatex.length.toLocaleString()} {t("status.chars")}
            </span>
          )}
          <button
            onClick={handleApprove}
            disabled={!canApply}
            className={`
              inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg transition-all
              bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
            `}
          >
            <Check className="h-4 w-4" />
            {t("omr.approve")}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// AnalyzingView — 解析中の 2 ペイン (Source | 進捗ログ)
// ═══════════════════════════════════════════════════════════════════════════

interface AnalyzingViewProps {
  sourceUrl: string | null;
  sourceName: string | null;
  isPdf: boolean;
  progressLog: ProgressItem[];
  isJa: boolean;
  t: (k: string) => string;
}

function AnalyzingView({ sourceUrl, sourceName, isPdf, progressLog, isJa, t }: AnalyzingViewProps) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 px-6 py-4 overflow-hidden">
      <SourcePanel sourceUrl={sourceUrl} sourceName={sourceName} isPdf={isPdf} t={t} />

      {/* 進捗ログ */}
      <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-background">
        <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
          <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
            {isJa ? "解析の進行状況" : "Analysis progress"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {progressLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
              <span className="text-sm">{t("omr.analyzing")}</span>
            </div>
          ) : (
            progressLog.map((item, i) => (
              <ProgressRow key={i} item={item} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ item }: { item: ProgressItem }) {
  const iconCls = "h-3.5 w-3.5 shrink-0 mt-0.5";
  const icon =
    item.status === "in_progress" ? (
      <Loader2 className={`${iconCls} animate-spin text-cyan-500`} />
    ) : item.status === "done" ? (
      <CheckCircle2 className={`${iconCls} text-emerald-500`} />
    ) : (
      <AlertTriangle className={`${iconCls} text-rose-500`} />
    );
  const textCls =
    item.status === "error"
      ? "text-rose-600 dark:text-rose-400"
      : item.status === "in_progress"
        ? "text-foreground/90"
        : "text-foreground/65";
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed">
      {icon}
      <span className={textCls}>{item.text}</span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ReviewView — 抽出完了後の 3 ペイン (Source | LaTeX ソース | コンパイル PDF)
// ═══════════════════════════════════════════════════════════════════════════

interface ReviewViewProps {
  sourceUrl: string | null;
  sourceName: string | null;
  isPdf: boolean;
  latex: string;
  onLatexChange: (v: string) => void;
  isJa: boolean;
  t: (k: string) => string;
}

function ReviewView({ sourceUrl, sourceName, isPdf, latex, onLatexChange, isJa, t }: ReviewViewProps) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 py-3 overflow-hidden">
      <SourcePanel sourceUrl={sourceUrl} sourceName={sourceName} isPdf={isPdf} t={t} />
      <LatexEditorPanel value={latex} onChange={onLatexChange} isJa={isJa} />
      <CompiledPdfPanel latex={latex} isJa={isJa} t={t} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SourcePanel — 入力元 PDF / 画像プレビュー
// ═══════════════════════════════════════════════════════════════════════════

function SourcePanel({
  sourceUrl, sourceName, isPdf, t,
}: {
  sourceUrl: string | null;
  sourceName: string | null;
  isPdf: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-muted/10">
      <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider flex-1">
          {t("omr.source")}
        </span>
        {sourceName && (
          <span className="text-[10px] text-muted-foreground/70 truncate max-w-[160px]">
            {sourceName}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center bg-white dark:bg-neutral-900">
        {sourceUrl ? (
          isPdf ? (
            <object data={sourceUrl} type="application/pdf" className="w-full h-full" aria-label={t("omr.source")}>
              <iframe src={sourceUrl} title={t("omr.source")} className="w-full h-full border-0" />
            </object>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sourceUrl}
              alt={sourceName || "Source"}
              className="max-w-full max-h-full object-contain"
            />
          )
        ) : (
          <span className="text-sm text-muted-foreground">{t("omr.no_file")}</span>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// LatexEditorPanel — 編集可能な LaTeX ソース
// ═══════════════════════════════════════════════════════════════════════════

function LatexEditorPanel({
  value, onChange, isJa,
}: {
  value: string;
  onChange: (v: string) => void;
  isJa: boolean;
}) {
  return (
    <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-background">
      <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
        <Code2 className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider flex-1">
          {isJa ? "抽出された LaTeX (編集可)" : "Extracted LaTeX (editable)"}
        </span>
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
          {value.length.toLocaleString()}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 min-h-0 w-full resize-none px-4 py-3 text-[12px] font-mono leading-[1.55] bg-background text-foreground/90 outline-none focus:ring-2 focus:ring-violet-500/30 border-0"
        placeholder={isJa ? "LaTeX ソースがここに表示されます…" : "Extracted LaTeX appears here…"}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// CompiledPdfPanel — 編集中 LaTeX を debounce コンパイルして PDF 表示
//
// step-1-rubric.tsx の ProblemPdfPreview と同じパターン:
//   - 初回マウント時は即時コンパイル、以降は 600ms debounce
//   - <object> + <iframe> フォールバックで Safari の blob 白紙問題を回避
//   - ref 経由で最新の t を保持し、useCallback の deps から外す
// ═══════════════════════════════════════════════════════════════════════════

function CompiledPdfPanel({
  latex, isJa, t,
}: {
  latex: string;
  isJa: boolean;
  t: (k: string) => string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<CompileErrorView | null>(null);
  const compileSeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  const runCompile = useCallback(async (source: string) => {
    if (!source.trim()) {
      setPreviewUrl(null);
      setCompileError(null);
      setCompiling(false);
      return;
    }
    const seq = ++compileSeqRef.current;
    setCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileRawLatex(source, "omr-preview");
      if (seq !== compileSeqRef.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setCompileError(null);
    } catch (e) {
      if (seq !== compileSeqRef.current) return;
      const tt = tRef.current;
      if (e instanceof CompileError) {
        setCompileError(formatCompileError(e, tt));
      } else if (e instanceof Error) {
        setCompileError({ title: tt("error.compile"), lines: [e.message] });
      } else {
        setCompileError({ title: tt("error.compile"), lines: ["compile failed"] });
      }
    } finally {
      if (seq === compileSeqRef.current) setCompiling(false);
    }
  }, []);

  // 初回は即時、以降は 600ms debounce
  const hasCompiledOnceRef = useRef(false);
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const delay = hasCompiledOnceRef.current ? 600 : 0;
    debounceTimerRef.current = setTimeout(() => {
      hasCompiledOnceRef.current = true;
      runCompile(latex);
    }, delay);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [latex, runCompile]);

  // アンマウント時に Blob URL を解放
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-muted/10">
      <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
        <FileDown className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider flex-1">
          {isJa ? "組版プレビュー (PDF)" : "Compiled PDF preview"}
        </span>
        {compiling && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {isJa ? "コンパイル中…" : "Compiling…"}
          </span>
        )}
        <button
          type="button"
          onClick={() => runCompile(latex)}
          disabled={!latex.trim() || compiling}
          className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30"
          title={isJa ? "再コンパイル" : "Re-compile"}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-white dark:bg-neutral-900">
        {compileError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-rose-50/95 p-6 text-center dark:bg-rose-950/40 overflow-auto">
            <AlertTriangle className="h-7 w-7 text-rose-500 shrink-0" />
            <div className="max-w-md space-y-2">
              <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {compileError.title}
              </div>
              <div className="text-xs text-rose-700/90 dark:text-rose-300/90 space-y-1 text-left">
                {compileError.lines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
              {compileError.hint && (
                <div className="text-[11px] italic text-rose-600/80 dark:text-rose-400/80 pt-1 border-t border-rose-300/40">
                  {compileError.hint}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => runCompile(latex)}
              className="rounded-md bg-rose-500 px-3 py-1 text-xs font-medium text-white hover:bg-rose-600"
            >
              {isJa ? "再試行" : "Retry"}
            </button>
          </div>
        )}

        {!compileError && previewUrl && (
          <>
            {/* Safari の <iframe src="blob:...pdf"> 白紙問題を <object> で回避 */}
            <object data={previewUrl} type="application/pdf" className="h-full w-full" aria-label="Compiled PDF">
              <iframe src={previewUrl} title="Compiled PDF" className="h-full w-full border-0" />
            </object>
            <a
              href={previewUrl}
              download="omr-preview.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-foreground/80 text-background px-2 py-1 text-[10px] font-medium shadow-md hover:bg-foreground"
              title={isJa ? "PDFをダウンロード" : "Download PDF"}
            >
              PDF
            </a>
          </>
        )}

        {!compileError && !previewUrl && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {compiling
              ? (isJa ? "組版中…" : "Rendering…")
              : (latex.trim() ? (isJa ? "プレビュー準備中…" : "Preview loading…") : (isJa ? "LaTeX を入力すると組版結果が表示されます" : "Enter LaTeX to see the rendered output"))}
          </div>
        )}
      </div>
    </div>
  );
}
