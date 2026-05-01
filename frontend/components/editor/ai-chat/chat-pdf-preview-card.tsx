"use client";

/**
 * ChatPdfPreviewCard
 * ─────────────────────────────────────────────────
 * モバイル版チャットで AI が編集を完了した直後に、その時点の LaTeX を
 * PDF にコンパイルして「チャット内のメッセージ」として表示するカード。
 *
 * 設計方針:
 *  - 表示中のメッセージだけ lazy にコンパイルする (IntersectionObserver)
 *  - blob URL は msg.id ごとに 1 回だけ生成し、unmount で revoke
 *  - サムネ表示は <object> + iframe フォールバック (Safari 対応)
 *  - タップでフルスクリーンビューア。背景クリックで閉じる
 *  - PC では使わない (モバイル専用)。MessageRow 側で gating する。
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { compileRawLatex, CompileError, formatCompileError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/store/ui-store";
import { FileText, Loader2, AlertTriangle, Maximize2, X, RefreshCw } from "lucide-react";

interface Props {
  /** AI が確定した LaTeX (msg.latex) */
  latex: string;
  /** ファイル名 (タイトル) */
  title: string;
  /** メッセージ ID — blob URL のキャッシュキー */
  msgId: string;
}

interface CompileErrorView {
  title: string;
  lines: string[];
  hint?: string;
}

export function ChatPdfPreviewCard({ latex, title, msgId }: Props) {
  const { t, locale } = useI18n();
  const isJa = locale !== "en";
  // ゲスト (LP からのお試し) は /api/compile-raw が 401 になり「プレビュー生成には
  // ログインが必要」エラーになる。MobilePdfPreview / DocumentEditor と同じく、
  // isGuest=true なら anonymous プロキシ (/api/anonymous/compile-raw) に切替。
  const isGuest = useUIStore((s) => s.isGuest);
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<CompileErrorView | null>(null);
  const [expanded, setExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const compiledOnceRef = useRef(false);
  const seqRef = useRef(0);

  const runCompile = useCallback(async () => {
    if (!latex.trim()) return;
    const seq = ++seqRef.current;
    setCompiling(true);
    setError(null);
    try {
      const blob = await compileRawLatex(latex, title, { anonymous: isGuestRef.current });
      if (seq !== seqRef.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (e instanceof CompileError) {
        setError(formatCompileError(e, t));
      } else if (e instanceof Error) {
        setError({ title: t("error.compile"), lines: [e.message] });
      } else {
        setError({ title: t("error.compile"), lines: [t("doc.editor.compile_error")] });
      }
    } finally {
      if (seq === seqRef.current) setCompiling(false);
    }
  }, [latex, title, t]);

  // 初回: viewport に入ったらコンパイル開始 (オフスクリーンでは走らせない)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || compiledOnceRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !compiledOnceRef.current) {
          compiledOnceRef.current = true;
          runCompile();
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [runCompile]);

  // unmount で blob URL を revoke
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // フルスクリーン表示中は body スクロールを止める
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  // Esc で閉じる
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <div
        ref={containerRef}
        data-msg-id={msgId}
        className="mt-2.5 rounded-xl border border-sky-200/60 dark:border-sky-500/25 bg-gradient-to-br from-sky-50/70 via-white to-blue-50/50 dark:from-sky-500/[0.06] dark:via-white/[0.01] dark:to-blue-500/[0.05] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_2px_rgba(2,132,199,0.04)]"
      >
        {/* ヘッダ帯 */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-sky-200/50 dark:border-sky-500/15">
          <FileText className="h-3 w-3 text-sky-600 dark:text-sky-400" />
          <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-sky-700/85 dark:text-sky-300/80">
            {isJa ? "プレビュー" : "Preview"}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {compiling && (
              <span className="flex items-center gap-1 text-[10px] text-sky-700/60 dark:text-sky-300/60">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isJa ? "生成中" : "Compiling"}
              </span>
            )}
            {!compiling && previewUrl && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:scale-[0.97] transition"
                aria-label={isJa ? "全画面で表示" : "Open fullscreen"}
              >
                <Maximize2 className="h-2.5 w-2.5" />
                {isJa ? "全画面" : "Open"}
              </button>
            )}
          </span>
        </div>

        {/* プレビュー本体 (低めの高さで thumb として) */}
        <div className="relative w-full bg-muted/30" style={{ height: "260px" }}>
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-rose-50/85 dark:bg-rose-950/40 overflow-auto">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
              <div className="text-[12px] font-semibold text-rose-700 dark:text-rose-300">{error.title}</div>
              {error.lines.slice(0, 2).map((line, i) => (
                <div key={i} className="text-[11px] text-rose-700/85 dark:text-rose-300/85">{line}</div>
              ))}
              <button
                type="button"
                onClick={runCompile}
                className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-600"
              >
                <RefreshCw className="h-3 w-3" />
                {isJa ? "再試行" : "Retry"}
              </button>
            </div>
          )}

          {!error && previewUrl && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute inset-0 w-full h-full"
              aria-label={isJa ? "全画面で表示" : "Open fullscreen"}
            >
              <object
                data={previewUrl}
                type="application/pdf"
                className="w-full h-full pointer-events-none"
              >
                <iframe
                  src={previewUrl}
                  className="w-full h-full pointer-events-none"
                  title={isJa ? "PDF プレビュー" : "PDF preview"}
                />
              </object>
              {/* タップ可視化のオーバーレイ */}
              <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/[0.7] text-white text-[10px] font-semibold backdrop-blur-sm">
                <Maximize2 className="h-2.5 w-2.5" />
                {isJa ? "タップで拡大" : "Tap to expand"}
              </span>
            </button>
          )}

          {!error && !previewUrl && compiling && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              <span className="text-[11px]">
                {isJa ? "PDF を生成しています..." : "Compiling PDF..."}
              </span>
            </div>
          )}

          {!error && !previewUrl && !compiling && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/45 text-[11px]">
              {isJa ? "プレビューを準備中..." : "Preparing preview..."}
            </div>
          )}
        </div>
      </div>

      {/* フルスクリーンビューア */}
      {expanded && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-sm animate-page-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={isJa ? "PDF プレビュー" : "PDF preview"}
        >
          <div className="flex items-center gap-2 px-3 h-12 border-b border-white/10 shrink-0">
            <FileText className="h-4 w-4 text-white/80" />
            <span className="text-[13px] font-semibold text-white/90 truncate">
              {title || (isJa ? "プレビュー" : "Preview")}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-auto h-9 w-9 flex items-center justify-center rounded-full text-white/85 hover:bg-white/10 active:scale-[0.95] transition"
              aria-label={isJa ? "閉じる" : "Close"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-neutral-900">
            {previewUrl && (
              <object data={previewUrl} type="application/pdf" className="w-full h-full">
                <iframe src={previewUrl} className="w-full h-full" title={isJa ? "PDF プレビュー" : "PDF preview"} />
              </object>
            )}
          </div>
        </div>
      )}
    </>
  );
}
