"use client";

import React, { useCallback, useRef } from "react";
import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { streamOMRAnalyze } from "@/lib/api";
import type { OMRStreamEvent } from "@/lib/api";
import { X, Check, RefreshCw, FileText, Loader2, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function OMRSplitView() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

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

  const startAnalysis = useCallback(async (file: File) => {
    if (!doc) return;
    fileRef.current = file;
    setOMRProcessing(true);
    setOMRProgress(isJa ? "ファイルを解析中..." : "Analyzing file...");
    setOMRLatex(null);

    try {
      const result = await streamOMRAnalyze(
        file, doc,
        (event: OMRStreamEvent) => {
          if (event.type === "progress") setOMRProgress(event.message);
        },
      );

      if (result.latex) {
        setOMRLatex(result.latex);
        setOMRProgress(isJa ? `${result.latex.length}文字のLaTeXを抽出しました` : `Extracted ${result.latex.length} chars`);
      } else {
        setOMRProgress(isJa ? "LaTeXを抽出できませんでした" : "No LaTeX extracted");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OMR error";
      setOMRProgress(`エラー: ${msg}`);
    } finally {
      setOMRProcessing(false);
    }
  }, [doc, isJa, setOMRLatex, setOMRProcessing, setOMRProgress]);

  // 承認: 抽出されたLaTeXを文書に適用
  const handleApprove = useCallback(() => {
    if (!extractedLatex) return;
    applyAiLatex(extractedLatex);
    toast.success(isJa ? `LaTeXソースを文書に適用しました` : `LaTeX applied`);
    closeOMR();
  }, [extractedLatex, applyAiLatex, closeOMR, isJa]);

  const handleRetry = useCallback(() => {
    if (fileRef.current) startAnalysis(fileRef.current);
  }, [startAnalysis]);

  const initialized = useRef(false);
  React.useEffect(() => {
    if (!omrMode || initialized.current) return;
    initialized.current = true;

    if (sourceUrl && sourceName) {
      fetch(sourceUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], sourceName, { type: blob.type });
          startAnalysis(file);
        })
        .catch(() => setOMRProgress("ファイルの読み込みに失敗しました"));
    }
    return () => { initialized.current = false; };
  }, [omrMode, sourceUrl, sourceName, startAnalysis, setOMRProgress]);

  if (!omrMode) return null;

  const isPdf = sourceName?.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
      <div className="h-12 border-b border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">{isJa ? "読み取りモード" : "OMR Mode"}</span>
          {sourceName && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{sourceName}</span>}
        </div>
        <div className="flex items-center gap-2">
          {(processing || progress) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {processing && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>{progress}</span>
            </div>
          )}

          {!processing && extractedLatex && (
            <button onClick={handleRetry}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <RefreshCw className="h-3 w-3" />
              {isJa ? "再スキャン" : "Re-scan"}
            </button>
          )}

          {extractedLatex && !processing && (
            <button onClick={handleApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm">
              <Check className="h-3.5 w-3.5" />
              {isJa ? "承認して編集画面へ" : "Approve & Edit"}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}

          <button onClick={closeOMR}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左パネル: 入力ファイルプレビュー */}
        <div className="w-1/2 border-r border-border/30 bg-muted/20 flex flex-col">
          <div className="px-3 py-2 border-b border-border/20 bg-muted/30">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              {isJa ? "入力ファイル" : "Source File"}
            </span>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {sourceUrl ? (
              isPdf ? (
                <embed src={sourceUrl} type="application/pdf" className="w-full h-full rounded-md border border-border/20" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceUrl} alt={sourceName || "Source"} className="max-w-full max-h-full object-contain rounded-md shadow-md" />
              )
            ) : (
              <span className="text-muted-foreground text-sm">{isJa ? "ファイルなし" : "No file"}</span>
            )}
          </div>
        </div>

        {/* 右パネル: 抽出LaTeXソース */}
        <div className="w-1/2 bg-background flex flex-col">
          <div className="px-3 py-2 border-b border-border/20 bg-muted/30 flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              {isJa ? "抽出LaTeX" : "Extracted LaTeX"}
            </span>
            {extractedLatex && (
              <span className="text-[10px] text-muted-foreground">{extractedLatex.length.toLocaleString()} {isJa ? "文字" : "chars"}</span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-0">
            {processing ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">{progress}</p>
              </div>
            ) : !extractedLatex ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">{progress || (isJa ? "解析結果がここに表示されます" : "Results appear here")}</p>
              </div>
            ) : (
              <pre className="text-[12px] font-mono leading-[1.55] text-foreground/85 px-4 py-3 whitespace-pre-wrap break-all">
                {extractedLatex}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
