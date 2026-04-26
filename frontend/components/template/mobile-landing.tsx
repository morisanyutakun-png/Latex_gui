"use client";

/**
 * MobileLanding — モバイル専用 LP。
 * ─────────────────────────────────────────────────
 * 設計方針:
 *  - PC 版 (TemplateGallery) には一切手を入れず、こちらは独立した別コンポーネント
 *  - 縦 1 カラム、最大幅 max-w-md、ヒーローはコンパクト、CTA は full-width pill
 *  - LP デモ動画 (EditorMockup / FigureDrawMockup) はモバイルでも使うが、
 *    container 幅 100vw 内に収まるように `transform: scale()` で自動縮小
 *  - "PC 推奨" のディスクレートな帯を hero 直下に出す
 *  - FAQ は collapsed accordion で縦スペースを節約
 *  - フッターはミニマルに、料金 / 法務 / お問い合わせのみ
 *
 * 親の TemplateGallery が useIsMobile() で分岐してこちらを返す想定。
 * primaryCta / locale / handlers は親から props で受ける。
 */

import React from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight, Sparkles, Play, Monitor, FileText,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Below-the-fold は別 chunk で遅延ロード (initial HTML / JS を最小化 → LCP/TTFB 改善)。
// loading の min-height は実際の below-fold 全体を概算 (Demo 520 + Trust 100 + Figure 500
// + Persona 380 + Pricing 720 + FAQ 480 + CTA 240 + Footer 160 ≈ 3100px) して大きめに予約。
// CLS = 0 を狙うために小さくしすぎない。
const MobileLandingBelow = dynamic(
  () => import("./mobile-landing-below").then((m) => m.MobileLandingBelow),
  {
    ssr: false,
    loading: () => <div style={{ minHeight: 3100 }} aria-hidden />,
  },
);

interface PrimaryCta {
  label: string;
  subLabel: string;
  onClick: () => void;
  variant: "free" | "resume" | "paid-new";
}

interface Props {
  primaryCta: PrimaryCta;
  scrollToPricing: () => void;
  scrollToSample: () => void;
  EditorMockup: React.ComponentType<{ isJa: boolean }>;
  FigureDrawMockup: React.ComponentType<{ isJa: boolean }>;
  onPlanSelect: (planId: "free" | "starter" | "pro" | "premium") => void;
}

export function MobileLanding({
  primaryCta,
  scrollToPricing,
  scrollToSample,
  EditorMockup,
  FigureDrawMockup,
  onPlanSelect,
}: Props) {
  const { locale, setLocale } = useI18n();
  const isJa = locale !== "en";
  // 旧 heroLoaded の opacity/translate アニメは CLS の原因になるので削除。
  // 初期から完全表示にする (FCP/LCP 改善)。

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ━━ Mobile Nav (シンプル) ━━ */}
      <nav
        className="sticky top-0 z-40 flex items-center gap-2 px-3 h-12 border-b border-foreground/[0.06] bg-background/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/25">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight">Eddivom</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setLocale(isJa ? "en" : "ja")}
          aria-label={isJa ? "Switch to English" : "日本語に切替"}
          className="h-9 px-2 rounded-full text-[11px] font-mono font-bold text-foreground/55 hover:bg-foreground/[0.05] active:scale-95 transition"
        >
          {isJa ? "EN" : "JA"}
        </button>
        <button
          onClick={scrollToPricing}
          className="h-9 px-3 rounded-full text-[12px] font-semibold text-foreground/70 hover:bg-foreground/[0.05] active:scale-95 transition"
        >
          {isJa ? "料金" : "Pricing"}
        </button>
      </nav>

      {/* ━━ HERO (mobile compact) ━━ */}
      <section className="relative overflow-hidden pt-8 pb-6 px-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.08] border border-violet-500/[0.18] mb-3">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent text-[10.5px] font-bold tracking-wide">
              {isJa ? "AI 教材作成 IDE" : "AI worksheet IDE"}
            </span>
          </div>
          {/* LCP 候補の Hero h1 — Tailwind CSS が届く前でも即時描画されるよう
              全プロパティを inline style に倒す。以前は bg-clip-text text-transparent が
              CSS 待ちで透明テキスト → LCP 7s だった。inline で書けば LCP は FCP と同時に発火する。 */}
          <h1
            style={{
              fontSize: "clamp(1.6rem, 7vw, 2.2rem)",
              lineHeight: 1.12,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              margin: "0 0 0.75rem 0",
              minHeight: "calc(2 * 1.12em)",
              contain: "layout",
              // 1 行目: 通常色 (即時に黒テキストとして描画される)
              color: "var(--foreground, #0a0a0a)",
            }}
          >
            {isJa ? (
              <>
                教材を、<br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    // フォールバック: WebkitTextFillColor 未対応なら solid violet で見える
                    color: "#7c3aed",
                  }}
                >
                  もっと速く。
                </span>
              </>
            ) : (
              <>
                Worksheets,<br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    color: "#7c3aed",
                  }}
                >
                  faster.
                </span>
              </>
            )}
          </h1>
          <p className="text-muted-foreground text-[14px] leading-relaxed mb-5">
            {isJa
              ? "AIが問題を生成し、類題を量産し、解答付きPDFを自動で作成。"
              : "AI generates problems, multiplies variants, and auto-creates answer-key PDFs."}
          </p>
        </div>

        {/* CTA buttons — full width, ChatGPT-style mobile */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={primaryCta.onClick}
            className="group flex items-center justify-center gap-2 w-full h-12 rounded-full bg-foreground text-background font-bold text-[14.5px] shadow-lg shadow-foreground/15 active:scale-[0.98] transition"
          >
            {primaryCta.variant === "resume" && <FileText className="h-4 w-4" />}
            <span>{primaryCta.label}</span>
            <ArrowRight className="h-4 w-4 group-active:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={scrollToSample}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[13.5px] active:scale-[0.98] active:bg-foreground/[0.04] transition"
          >
            <Play className="h-3.5 w-3.5" />
            {isJa ? "デモを見る" : "Watch demo"}
          </button>
          <p className="text-center text-[11px] text-muted-foreground/55 mt-1">
            {primaryCta.subLabel}
          </p>
        </div>
      </section>

      {/* ━━ PC 推奨バナー — discreet, dismissible-feel ━━ */}
      <section className="px-5 pb-4">
        <div className="flex items-start gap-2.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-500/10 dark:to-orange-500/5 border border-amber-200/60 dark:border-amber-500/25 p-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Monitor className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-amber-900 dark:text-amber-200 mb-0.5">
              {isJa ? "PC ブラウザでのご利用を強く推奨" : "Best experienced on a desktop browser"}
            </p>
            <p className="text-[11.5px] text-amber-700/85 dark:text-amber-300/75 leading-snug">
              {isJa
                ? "モバイルでは AI チャット + PDF プレビューに機能を絞っています。図エディタ・採点・OCRなどフル機能は PC をご利用ください。"
                : "Mobile is limited to AI chat + PDF preview. Use a desktop browser for the full editor, figure editor, OCR, and grading."}
            </p>
          </div>
        </div>
      </section>
      {/* ━━ Below-the-fold (デモ / 機能 / 料金 / FAQ / フッター) は
          別 chunk として lazy 読み込み。LCP は Hero テキスト。
          各セクションは内部で IntersectionObserver gate されている。 */}
      <MobileLandingBelow
        primaryCta={primaryCta}
        EditorMockup={EditorMockup}
        FigureDrawMockup={FigureDrawMockup}
        onPlanSelect={onPlanSelect}
      />
    </div>
  );
}
