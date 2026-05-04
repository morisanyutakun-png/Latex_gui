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
import { FileText, Loader2, AlertTriangle, Maximize2, X, RefreshCw, Sparkles } from "lucide-react";
import { trackVariantGenClick } from "@/lib/gtag";
import { usePlanStore } from "@/store/plan-store";

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
  // AI チャット側でプリコンパイル済みの blob URL があり、latex が一致するならそれを使う。
  // バックエンドを再度叩かないので、不安定で 422 が返るリスクがゼロになる。
  const guestPreviewBlobUrl = useUIStore((s) => s.guestPreviewBlobUrl);
  const guestPreviewBlobLatex = useUIStore((s) => s.guestPreviewBlobLatex);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<CompileErrorView | null>(null);
  const [expanded, setExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const compiledOnceRef = useRef(false);
  const seqRef = useRef(0);
  // unmount で最新 blob URL を revoke するための ref (旧実装は空 deps の closure
  // で初回 null を捕まえてしまい revoke できていなかった)。
  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;

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
        if (old && old !== useUIStore.getState().guestPreviewBlobUrl) URL.revokeObjectURL(old);
        return url;
      });
    } catch (e) {
      if (seq !== seqRef.current) return;
      // ── ゲスト (1 枚無料お試し) 自己修復: ULTRA_MINIMAL で再コンパイル ──
      // **クライアント生成の偽 PDF は使わない** (Helvetica + ASCII で数式が汚いため)。
      // サーバが完全停止していれば preview なしで retry ボタンを出す。
      if (isGuestRef.current) {
        try {
          const fallback = String.raw`\documentclass{article}
\begin{document}
Worksheet ready --- ask the AI to refine the content.
\end{document}
`;
          const blob = await compileRawLatex(fallback, title, { anonymous: true });
          if (seq !== seqRef.current) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl((old) => {
            if (old && old !== useUIStore.getState().guestPreviewBlobUrl) URL.revokeObjectURL(old);
            return url;
          });
          return;
        } catch {
          /* サーバ完全停止 — preview なしで retry ボタンを出す */
        }
        return;
      }
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

  // ゲスト経路の最重要分岐: AI チャット側で既に compile 済みの blob URL があり
  // 同じ latex なら、それをそのまま表示する。バックエンドへの再コールはしない。
  useEffect(() => {
    if (
      isGuestRef.current &&
      guestPreviewBlobUrl &&
      guestPreviewBlobLatex === latex &&
      !previewUrl
    ) {
      compiledOnceRef.current = true;
      setPreviewUrl(guestPreviewBlobUrl);
    }
  }, [guestPreviewBlobUrl, guestPreviewBlobLatex, latex, previewUrl]);

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

  // unmount で最新の blob URL を revoke (ただし store オーナーの URL は触らない)
  useEffect(() => {
    return () => {
      const url = previewUrlRef.current;
      if (!url) return;
      const ownedByStore = useUIStore.getState().guestPreviewBlobUrl;
      if (url !== ownedByStore) URL.revokeObjectURL(url);
    };
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
            {/* ✨ もう1枚 — PDF 完成直後に最も自然な「次の一手」として提示 */}
            {!compiling && previewUrl && !isGuest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  trackVariantGenClick({ placement: "pdf_card", plan: usePlanStore.getState().currentPlan });
                  useUIStore.getState().openVariantStudio({
                    seed: latex,
                    preselectedStyle: "same",
                  });
                }}
                title={isJa ? "この問題から類題を作る" : "Make variants from this"}
                className="flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm hover:from-violet-600 hover:to-fuchsia-600 active:scale-[0.97] transition"
                aria-label={isJa ? "類題を作る" : "Make variants"}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {isJa ? "類題" : "Variants"}
              </button>
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
          {/* ★ ゲストには赤いエラーカードを絶対表示しない ★ */}
          {error && !isGuest && (
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
            // ゲスト経路で compile が完全失敗してもエラーカードは出さず、
            // ポジティブな「教材を準備しました」UI を表示 → CVR を守る。
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
              {isGuest ? (
                <>
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/25">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-[12.5px] font-semibold text-foreground/85">
                    {isJa ? "教材の準備ができました" : "Worksheet ready"}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug max-w-[240px]">
                    {isJa
                      ? "プレビュータブまたはチャットで内容をご確認ください。"
                      : "Open the preview tab or check the chat for details."}
                  </p>
                  <button
                    type="button"
                    onClick={runCompile}
                    className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {isJa ? "プレビューを更新" : "Refresh preview"}
                  </button>
                </>
              ) : (
                <span className="text-muted-foreground/45 text-[11px]">
                  {isJa ? "プレビューを準備中..." : "Preparing preview..."}
                </span>
              )}
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
