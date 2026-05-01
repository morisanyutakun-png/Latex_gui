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
import { usePlanStore } from "@/store/plan-store";
import { useI18n } from "@/lib/i18n";
import { trackGuestSignupClick } from "@/lib/gtag";
import { FileText, Loader2, AlertTriangle, RefreshCw, Sparkles, Download, ArrowRight, Check, Crown, Lock } from "lucide-react";

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
  // ゲスト用プリコンパイル PDF の URL — runGuestSingleShot で stash 済み。
  // doc.latex がこれと一致する間は backend を叩かず blob URL をそのまま表示する。
  const guestPreviewBlobUrl = useUIStore((s) => s.guestPreviewBlobUrl);
  const guestPreviewBlobLatex = useUIStore((s) => s.guestPreviewBlobLatex);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<CompileErrorView | null>(null);

  const seqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 旧実装は `useEffect(() => () => revoke(previewUrl), [])` で blob URL を revoke
  // していたが、空 deps の closure は初回 render の null を掴むため、unmount 時に
  // 実際の blob URL が revoke されず memory leak していた。ref で常に最新を追って unmount 時に revoke する。
  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;
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
        if (old && old !== useUIStore.getState().guestPreviewBlobUrl) URL.revokeObjectURL(old);
        return url;
      });
    } catch (e) {
      if (seq !== seqRef.current) return;
      // ── ゲスト (1 枚無料お試し) で compile が失敗した場合の自己修復 ──
      // ULTRA_MINIMAL で再コンパイルを試みる。**クライアント生成の偽 PDF は使わない**
      // (Helvetica + ASCII で数式が汚く LaTeX プレビューとして破綻するため)。
      // サーバ側でも失敗したら、エラー表示を出さずに retry ボタン付きの空状態に戻す。
      if (isGuestRef.current) {
        try {
          const fallback = String.raw`\documentclass{article}
\begin{document}
Worksheet ready --- ask the AI to refine the content.
\end{document}
`;
          const blob = await compileRawLatex(fallback, titleRef.current, { anonymous: true });
          if (seq !== seqRef.current) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl((old) => {
            if (old && old !== useUIStore.getState().guestPreviewBlobUrl) URL.revokeObjectURL(old);
            return url;
          });
          return; // サーバ側 fallback 成功
        } catch {
          /* サーバ完全停止 — 偽 PDF は出さず空状態 + 「プレビューを更新」ボタンで retry */
        }
        // 既存の guest preview blob があればそれを残す (前回成功した PDF を維持)。
        // 何も無ければ null のまま → 下の「教材の準備ができました」+ refresh UI が出る。
        return;
      }
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
    // ゲスト経路の最重要分岐: AI チャット側で既に compile 済みの blob URL があれば
    // それをそのまま表示する。バックエンドへの再コールをスキップ → 422 リスク 0。
    if (
      isGuestRef.current &&
      guestPreviewBlobUrl &&
      guestPreviewBlobLatex &&
      document?.latex === guestPreviewBlobLatex
    ) {
      compiledOnceRef.current = true;
      setPreviewUrl((old) => {
        if (old && old !== guestPreviewBlobUrl) URL.revokeObjectURL(old);
        return guestPreviewBlobUrl;
      });
      setCompiling(false);
      setCompileError(null);
      return;
    }
    const delay = compiledOnceRef.current ? 600 : 0;
    debounceRef.current = setTimeout(() => {
      compiledOnceRef.current = true;
      if (document?.latex) runCompile(document.latex);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [document?.latex, runCompile, guestPreviewBlobUrl, guestPreviewBlobLatex]);

  // unmount で最新の blob URL を revoke (タブ切替で頻繁に mount/unmount するので地味に効く)
  // ただし ui-store がオーナーのゲスト用 blob URL は revoke しない (他で使っている可能性あり)。
  useEffect(() => {
    return () => {
      const url = previewUrlRef.current;
      if (!url) return;
      const ownedByStore = useUIStore.getState().guestPreviewBlobUrl;
      if (url !== ownedByStore) URL.revokeObjectURL(url);
    };
  }, []);

  const handleRetry = () => {
    if (document?.latex) runCompile(document.latex);
  };

  // ゲストの DL は 1 タップで CV 機会を奪うので、サインアップ overlay に切替。
  // 登録ユーザだけ実際にダウンロードを許す。
  const openSignupOverlay = useUIStore((s) => s.openSignupOverlay);
  const setShowPricing = usePlanStore((s) => s.setShowPricing);
  const handleDownload = () => {
    if (!previewUrl) return;
    if (isGuest) {
      trackGuestSignupClick({ placement: "preview_download_btn" });
      openSignupOverlay({ reason: "manual", placement: "preview_download_btn" });
      return;
    }
    const a = window.document.createElement("a");
    a.href = previewUrl;
    a.download = (titleRef.current || "document") + ".pdf";
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const handleGuestSignup = (placement: string) => {
    trackGuestSignupClick({ placement });
    openSignupOverlay({ reason: "manual", placement });
  };
  const handleGuestUpgrade = (placement: string) => {
    trackGuestSignupClick({ placement });
    // 未ログインでは pricing modal を直接出すと checkout で弾かれるので、
    // signupOverlay (Google ログイン → プラン選択 → checkout) フローに集約する。
    openSignupOverlay({ reason: "manual", placement });
    // 登録済みユーザがプレビューに残っているケース (将来的に有料アップグレードを
    // 同 UI から促す場合) のため pricing も並列に開けるようにしておく。
    setShowPricing(true);
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
          aria-label={isGuest ? (isJa ? "ダウンロードには無料登録が必要" : "Sign up free to download") : (isJa ? "PDFをダウンロード" : "Download PDF")}
          title={isGuest ? (isJa ? "ダウンロードには無料登録が必要" : "Sign up free to download") : (isJa ? "PDFをダウンロード" : "Download PDF")}
        >
          {isGuest ? <Lock className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Preview body */}
      <div className="relative flex-1 overflow-hidden">
        {/* ★ ゲストには赤いエラーカードを絶対表示しない ★ */}
        {compileError && !isGuest && (
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
          // 空状態 — ゲストの場合は「準備できました」のポジティブ UI、
          // それ以外は「AI に依頼を」の誘導 UI。
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            {isGuest ? (
              <>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="text-[14px] font-semibold text-foreground/85">
                  {isJa ? "教材の準備ができました" : "Worksheet ready"}
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs">
                  {isJa
                    ? "AI チャットで内容を確認できます。プレビューを更新するには下のボタンを押してください。"
                    : "Check the AI chat for the content. Tap the button below to refresh the preview."}
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-[12px] font-semibold shadow-md hover:bg-emerald-600 active:scale-[0.97] transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isJa ? "プレビューを更新" : "Refresh preview"}
                </button>
                {onOpenChat && (
                  <button
                    type="button"
                    onClick={onOpenChat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-foreground/70 text-[11.5px] font-medium hover:bg-foreground/[0.05] transition"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isJa ? "AI チャットへ戻る" : "Back to AI chat"}
                  </button>
                )}
              </>
            ) : (
              <>
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
              </>
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

      {/* ── ゲスト用 CV カード ──
           プレビュー本体の **下** に flex 兄弟として配置し、
           PDF 領域は CTA 高さぶん縮んで全ページがちゃんと見える + スクロール可能。
           絶対配置 (absolute) で PDF に重ねていた旧実装は最終ページが隠れてしまっていた。 */}
      {isGuest && previewUrl && !compiling && (
        <div className="shrink-0 border-t border-foreground/[0.06] bg-background/95">
          <GuestPreviewCta
            isJa={isJa}
            onSignup={() => handleGuestSignup("preview_cta_signup")}
            onUpgrade={() => handleGuestUpgrade("preview_cta_upgrade")}
          />
        </div>
      )}
    </div>
  );
}

/**
 * ゲストプレビュー専用 CTA カード。下部 sticky で常時可視。
 * - 主導線: 無料登録 (signup overlay)
 * - 副導線: 有料プランで何ができるか (pricing modal / signup overlay 経由)
 *
 * モバイル前提なので押しやすさ最優先 (h-12 / full-width pill / shadow)。
 */
function GuestPreviewCta({
  isJa,
  onSignup,
  onUpgrade,
}: {
  isJa: boolean;
  onSignup: () => void;
  onUpgrade: () => void;
}) {
  // 「展開」状態でベネフィット 3 行 + 有料アップセルを出す。デフォルトは折り畳み。
  // PDF を見ながら登録判断したいユーザのため、初期は最小占有 (主 CTA + ▼) に倒す。
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div
      className="px-3 pt-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
    >
      {/* コンパクト 1 行: 「無料登録」CTA + アップセル展開トグル */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSignup}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-foreground text-background font-bold text-[13.5px] shadow-md shadow-foreground/20 active:scale-[0.98] transition"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>{isJa ? "無料登録して保存・編集を続ける" : "Sign up free to save & continue"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={isJa ? "プラン詳細" : "Plan details"}
          className="h-11 w-11 shrink-0 rounded-full border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center active:scale-95 transition"
        >
          <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </button>
      </div>

      {/* 展開時: ベネフィット + 有料プラン誘導 */}
      {expanded && (
        <div className="mt-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.05] dark:bg-violet-500/[0.08] overflow-hidden">
          <div className="flex items-start gap-2 px-3 py-2.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold tracking-tight">
                {isJa ? "登録すると解放されること" : "What you unlock by signing up"}
              </div>
              <ul className="mt-1 space-y-0.5">
                {(isJa
                  ? ["保存・PDFダウンロード", "AI で類題量産・解答付き", "図エディタ・採点モード"]
                  : ["Save & download PDF", "AI variants + answer keys", "Figure editor + grading"]
                ).map((b) => (
                  <li key={b} className="flex items-center gap-1.5 text-[11px] text-foreground/85">
                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full px-3 py-2 flex items-center gap-2 text-left border-t border-violet-400/20 active:bg-foreground/[0.03] transition"
          >
            <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] font-semibold tracking-tight">
                {isJa ? "Pro / Premium で本格運用" : "Go Pro / Premium for daily use"}
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug">
                {isJa
                  ? "回数無制限・透かし無し PDF・採点モード"
                  : "Unlimited AI · watermark-free PDF · grading"}
              </div>
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
