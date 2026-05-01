"use client";

/**
 * MobilePdfPreview
 * ─────────────────────────────────────────────────
 * モバイル版エディタの「プレビュー」タブで使う、編集 UI を含まないクリーンな PDF 表示。
 * 現在の document.latex を debounce してコンパイルし、PDF をフル領域で表示する。
 *
 * 設計方針:
 *  - DocumentEditor (PC 用の visual/source/preview 3 ペイン) は使わない
 *  - 操作系は最小: PDF 共有 / 再コンパイル / コンパイル中スピナー
 *  - エラー時は friendly に表示し、retry ボタンを出す
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { compileRawLatex, CompileError, formatCompileError } from "@/lib/api";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { FileText, Loader2, AlertTriangle, RefreshCw, Sparkles, Download } from "lucide-react";

interface CompileErrorView {
  title: string;
  lines: string[];
  hint?: string;
}

export function MobilePdfPreview({ onOpenChat }: { onOpenChat?: () => void }) {
  const { t, locale } = useI18n();
  const isJa = locale !== "en";
  const document = useDocumentStore((s) => s.document);
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  // ゲスト (ログインなしお試し) は /api/compile-raw が 401 になるので、
  // PC 版の DocumentEditor と同じく anonymous プロキシ (/api/anonymous/compile-raw) に切り替える。
  // ref で保持して runCompile の closure を再生成しないようにする。
  const isGuest = useUIStore((s) => s.isGuest);
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<CompileErrorView | null>(null);

  const seqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef("");
  titleRef.current = document?.metadata.title || "";

  const runCompile = useCallback(async (source: string) => {
    if (!source.trim()) {
      setPreviewUrl(null);
      setCompileError(null);
      setCompiling(false);
      return;
    }
    const seq = ++seqRef.current;
    setCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileRawLatex(source, titleRef.current, { anonymous: isGuestRef.current });
      if (seq !== seqRef.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (e instanceof CompileError) {
        setCompileError(formatCompileError(e, t));
      } else if (e instanceof Error) {
        setCompileError({ title: t("error.compile"), lines: [e.message] });
      } else {
        setCompileError({ title: t("error.compile"), lines: [t("doc.editor.compile_error")] });
      }
    } finally {
      if (seq === seqRef.current) setCompiling(false);
    }
  }, [t]);

  // latex が変わるたび debounce してコンパイル
  const compiledOnceRef = useRef(false);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = compiledOnceRef.current ? 600 : 0;
    debounceRef.current = setTimeout(() => {
      compiledOnceRef.current = true;
      if (document?.latex) runCompile(document.latex);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [document?.latex, runCompile]);

  // unmount で blob URL を revoke
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    if (document?.latex) runCompile(document.latex);
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = window.document.createElement("a");
    a.href = previewUrl;
    a.download = (titleRef.current || "document") + ".pdf";
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const hasContent = !!document?.latex?.trim();

  return (
    <div className="flex flex-col h-full bg-neutral-100 dark:bg-neutral-950">
      {/* Toolbar (シンプル: タイトル + 共有 + 再コンパイル) */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-background/80 backdrop-blur-sm shrink-0">
        <FileText className="h-3.5 w-3.5 text-sky-500 shrink-0" />
        <span className="text-[12px] font-semibold text-foreground/70 truncate flex-1">
          {document?.metadata.title || t("header.untitled")}
        </span>
        {(compiling || isChatLoading) && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {isChatLoading
              ? (isJa ? "AI 編集中" : "AI editing")
              : (isJa ? "生成中" : "Compiling")}
          </span>
        )}
        <button
          type="button"
          onClick={handleRetry}
          disabled={!hasContent || compiling}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={isJa ? "再コンパイル" : "Recompile"}
          title={isJa ? "再コンパイル" : "Recompile"}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!previewUrl}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={isJa ? "PDFをダウンロード" : "Download PDF"}
          title={isJa ? "PDFをダウンロード" : "Download PDF"}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preview body */}
      <div className="relative flex-1 overflow-hidden">
        {compileError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-rose-50/95 dark:bg-rose-950/40 p-6 text-center overflow-auto">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
            <div className="max-w-sm space-y-1.5">
              <div className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">
                {compileError.title}
              </div>
              <div className="text-[11.5px] text-rose-700/90 dark:text-rose-300/90 space-y-0.5 text-left">
                {compileError.lines.slice(0, 6).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
              {compileError.hint && (
                <div className="text-[11px] italic text-rose-600/80 dark:text-rose-400/80 pt-1 border-t border-rose-300/40">
                  {compileError.hint}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-600"
              >
                <RefreshCw className="h-3 w-3" />
                {isJa ? "再試行" : "Retry"}
              </button>
              {onOpenChat && (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="inline-flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-600"
                >
                  <Sparkles className="h-3 w-3" />
                  {isJa ? "AI に修正を依頼" : "Ask AI to fix"}
                </button>
              )}
            </div>
          </div>
        )}

        {previewUrl ? (
          <object data={previewUrl} type="application/pdf" className="w-full h-full">
            <iframe src={previewUrl} className="w-full h-full" title={isJa ? "PDF プレビュー" : "PDF preview"} />
          </object>
        ) : compiling ? (
          // 初回コンパイル中の中央表示 — 「セッションが進行中」を体感させる UI。
          // 旧実装では blank になり「壊れているのでは?」と感じさせていた。
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
            <div className="space-y-1">
              <div className="text-[14px] font-semibold text-foreground/85">
                {isJa ? "PDF を組版しています…" : "Typesetting your PDF…"}
              </div>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-xs">
                {isJa
                  ? "数秒で完成します。閉じずにお待ちください。"
                  : "Done in a few seconds — please keep this screen open."}
              </p>
            </div>
            <div className="w-40 h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-violet-400 to-fuchsia-500 animate-pulse" />
            </div>
          </div>
        ) : !compileError ? (
          // 空状態 — まだ何もない / コンパイル待ち
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="text-[14px] font-semibold text-foreground/75">
              {isJa ? "AI に依頼してプレビューを作る" : "Ask the AI to start your worksheet"}
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs">
              {isJa
                ? "「AI チャット」タブで内容を依頼すると、ここに完成した PDF プレビューが表示されます。"
                : "Open the AI Chat tab and describe what you need. The finished PDF preview will appear here."}
            </p>
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-[12px] font-semibold shadow-md hover:opacity-90 active:scale-[0.97] transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isJa ? "AI チャットを開く" : "Open AI chat"}
              </button>
            )}
          </div>
        ) : null}

        {/* コンパイル中の薄いオーバーレイ (PDF が既にあれば下にうっすら見える) */}
        {compiling && (
          <div className="absolute inset-x-0 top-0 flex justify-center pt-3 pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/[0.7] text-white text-[10.5px] font-medium backdrop-blur-md">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isJa ? "PDF を生成中..." : "Compiling PDF..."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
