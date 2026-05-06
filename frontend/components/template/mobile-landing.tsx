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

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Sparkles, Check, ChevronRight, ChevronDown,
  Monitor, Zap, Shield, Printer, FileText, Pencil, RefreshCw,
  Wrench, Crown, Mail, Smartphone, FileSignature,
  Save, FileDown, Play,
} from "lucide-react";
import { renderMathHTML } from "@/lib/katex-render";

/* KaTeX CSS をモバイル LP 内で 1 回だけ動的に注入する。
 * ヒーローの成果物プレビューが KaTeX 描画に依存するため、初期描画時に必要。
 * critical CSS から外して `<link>` で後追い投入することで、LCP の対象である
 * H1 テキストが先に paint されるようにしている。 */
let _mobileKatexCssInjected = false;
function ensureKatexCssMobile() {
  if (typeof document === "undefined" || _mobileKatexCssInjected) return;
  _mobileKatexCssInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
  link.crossOrigin = "anonymous";
  link.referrerPolicy = "no-referrer";
  document.head.appendChild(link);
  const style = document.createElement("style");
  style.textContent = [
    "KaTeX_Main", "KaTeX_Math", "KaTeX_AMS", "KaTeX_Caligraphic",
    "KaTeX_Fraktur", "KaTeX_SansSerif", "KaTeX_Script", "KaTeX_Size1",
    "KaTeX_Size2", "KaTeX_Size3", "KaTeX_Size4", "KaTeX_Typewriter",
  ].map((f) => `@font-face { font-family: ${f}; font-display: swap; }`).join("\n");
  document.head.appendChild(style);
}
import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";
import { PLANS, type PlanId } from "@/lib/plans";
import { IdleMount } from "./idle-mount";
import { UserMenu } from "@/components/auth/user-menu";
// Mockup は lp-mockups.tsx (1300+ 行) を別 chunk に切り出して dynamic import する。
// 静的 import すると EditorMockup の重い JSX + setInterval 駆動コードがモバイル初期
// JS に乗ってしまい TBT/LCP が悪化する。IdleMount でビューポート接近を待ってから
// マウントするので、ヒーロー読み込み中は import すら走らない。
const EditorMockup = dynamic(
  () => import("./lp-mockups").then((m) => ({ default: m.EditorMockup })),
  { ssr: false, loading: () => null },
);
const FigureDrawMockup = dynamic(
  () => import("./lp-mockups").then((m) => ({ default: m.FigureDrawMockup })),
  { ssr: false, loading: () => null },
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
  onPlanSelect: (planId: "free" | "starter" | "pro" | "premium") => void;
  /** LP プロンプト入力 CTA: variant === "free" のときだけ実装される。
   *  prompt を sessionStorage に預けてエディタへ遷移する。 */
  onPromptSubmit?: (prompt: string) => void;
}

export function MobileLanding({
  primaryCta,
  scrollToPricing,
  onPlanSelect,
  onPromptSubmit,
}: Props) {
  // `scrollToSample` は親から受け取るが、Hero 簡素化に伴いボタンを廃止したため
  // 現状は使用していない。親側のシグネチャを変えないよう Props は残す。
  const { locale, setLocale } = useI18n();
  const isJa = locale !== "en";
  // 旧実装は heroLoaded=false で 60ms 後に true へ flip させ、CSS opacity-0→1 の
  // transition でフェードインしていた。だがモバイル低速回線ではバンドル評価が
  // 数秒かかり、その間 LCP 要素 (h1) が opacity-0 で paint されず Lighthouse の
  // 「element render delay」が 3 秒以上に膨らんでいた。CVR 訴求とパフォーマンス
  // を比較すると後者の方が重いので、初期描画から表示済み状態 (true) にする。
  const [heroLoaded] = useState(true);

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
        {/* PC 版 nav と同じく UserMenu を出してログイン状態 (アバター + プラン
            バッジ / 未ログイン時はログイン CTA) を視認できるようにする。
            UserMenu の dropdown は hover ベースだが、モバイル Safari/Chrome の
            sticky-hover で初回タップ → ドロップダウン表示 → 外側タップで閉じる
            という操作が一応成立する。 */}
        <UserMenu />
      </nav>

      {/* ━━ HERO (mobile, visual-first)
           モバイル最適化: 文字情報を大幅削減し、「H1 + 1行サブ + 即触れる入力」を主役に。
           target band, 3 段強調文, 重複フレーズを scroll-down 領域へ降ろす。
           タイポグラフィは iOS HIG 準拠 (H1 32px / sub 14px / meta 11px) で 3 段階のみ。 */}
      <section className="relative overflow-hidden pt-1.5 pb-3 px-5">
        {/* 背景グロー — 視覚的アンカー */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none -z-10">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent blur-3xl" />
          <div className="absolute top-20 right-0 w-[260px] h-[260px] rounded-full bg-gradient-to-br from-amber-400/15 via-orange-400/8 to-transparent blur-3xl" />
        </div>

        {/* Hero 中央揃え。CV 最大化のため "説明" を削り "出力" を主役にする方針:
              - バッジ: 「塾講師・教師向け · 類題生成エンジン NEW」(機能チップは最大2要素)
              - H1: 維持 (60秒 / 1タップで類題)
              - サブ: 短文化 (「小テスト・宿題プリント・解答付きPDFをすぐ作成。」)
              - 権威性 (情報工学科) はプリント直下に移動
              - Before/After は撤去
             プリント上端を確実にファーストビューに乗せるための最終形。 */}
        <div className={`text-center transition-all duration-700 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {/* 核機能バッジ */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-gradient-to-r from-violet-500/[0.14] via-fuchsia-500/[0.14] to-blue-500/[0.14] border border-violet-500/40 shadow-sm shadow-violet-500/15 mb-1.5">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 bg-clip-text text-transparent text-[10px] font-extrabold tracking-wider">
              {isJa ? "塾講師・教師向け · 類題生成エンジン" : "For tutors · Variant Engine"}
            </span>
            <span className="inline-flex items-center px-1 py-[1px] rounded text-[8.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500">
              NEW
            </span>
          </div>

          {/* H1 — 維持 */}
          <h1 className="text-[clamp(1.5rem,7.2vw,2rem)] leading-[1.1] font-black tracking-[-0.03em] mb-1.5">
            {isJa ? (
              <>
                <GradientWord>60秒で教材プリント1枚</GradientWord>。<br />
                あとは<HighlightMark>1タップで類題作成</HighlightMark>。
              </>
            ) : (
              <>
                <GradientWord>One worksheet in 60s</GradientWord>.<br />
                Then <HighlightMark>1 tap for variants</HighlightMark>.
              </>
            )}
          </h1>

          {/* サブ — 短文化。1 行に収まる長さで「成果物 3 種」だけ伝える。 */}
          <p className="text-foreground/80 text-[13px] leading-[1.5] mb-2 font-medium max-w-[22rem] mx-auto">
            {isJa
              ? "小テスト・宿題プリント・解答付きPDFをすぐ作成。"
              : "Quizzes, homework & answer-key PDFs — instantly."}
          </p>
        </div>

        {/* ━━ 成果物の視覚的証拠 (Hero 直下・作成フローより上) ━━
             プリントが「ファーストビュー内で上部までしっかり見える」位置に
             なるよう、ラッパーの上下マージンを最小化 (mb-5 → mb-3)。
             入力例チップ → "このプリントが生成されます" → 実際のプリント
             の流れを明示し、入力 ⇄ 出力の対応関係を 1 視覚で伝える。 */}
        <div className={`mb-3 transition-all duration-700 delay-25 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <WorksheetPreviewDuo isJa={isJa} />
          {/* プレビュー直下に「自分の版を作る」橋渡し CTA */}
          <button
            type="button"
            onClick={primaryCta.onClick}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full border border-violet-500/40 bg-gradient-to-r from-violet-500/[0.08] to-fuchsia-500/[0.08] text-[12px] font-bold text-violet-700 dark:text-violet-300 active:scale-[0.98] transition shadow-sm"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            {isJa ? "自分のテーマで作ってみる" : "Make one with my own topic"}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>

        {/* ━━ 時間ベースの「生成→プレビュー→修正」サイクル可視化 ━━
             モバイルで「実際どう動くか」が想像できないと購入動機にならないため、
             ステップ番号 + 時間タグ + アイコン の 3 行カードでサイクルを脳内再生させる。
             各ステップは「秒数」と「ターゲット視点の動詞」をペアにして、講師が
             "Eddivom の前で何をしているか" を 1 秒で読み取れるようにする。 */}
        <div className={`mb-5 transition-all duration-700 delay-50 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <div className="rounded-2xl border border-foreground/[0.08] bg-gradient-to-br from-violet-500/[0.04] via-fuchsia-500/[0.03] to-blue-500/[0.04] p-3.5 shadow-[0_2px_10px_-6px_rgba(139,92,246,0.25)]">
            <p className="text-center text-[10px] font-bold tracking-[0.18em] uppercase text-violet-700 dark:text-violet-300 mb-2.5">
              {isJa ? "1 タブで完結する作成サイクル" : "End-to-end in one tab"}
            </p>
            <ol className="space-y-1.5">
              {(isJa
                ? [
                    { sec: "0:10", title: "AIに依頼", body: "「高1 三角比の小テスト10問、解答付きで」", icon: <Sparkles className="h-3.5 w-3.5" aria-hidden /> },
                    { sec: "0:30", title: "プレビュー即反映", body: "数式・図・解答までA4紙面で表示", icon: <FileText className="h-3.5 w-3.5" aria-hidden /> },
                    { sec: "0:50", title: "気になる箇所を修正", body: "「この問題だけ難易度上げて」と1行追加", icon: <Pencil className="h-3.5 w-3.5" aria-hidden /> },
                    { sec: "1:00", title: "PDFで保存・印刷", body: "解答付きPDFをそのまま配布できる", icon: <FileDown className="h-3.5 w-3.5" aria-hidden /> },
                  ]
                : [
                    { sec: "0:10", title: "Ask the AI", body: "\"10 trig quiz items with answers\"", icon: <Sparkles className="h-3.5 w-3.5" aria-hidden /> },
                    { sec: "0:30", title: "Preview live", body: "Math, figures, answers — A4 page", icon: <FileText className="h-3.5 w-3.5" aria-hidden /> },
                    { sec: "0:50", title: "Tweak in one line", body: "\"Make problem 3 harder\"", icon: <Pencil className="h-3.5 w-3.5" aria-hidden /> },
                    { sec: "1:00", title: "Export PDF", body: "Answer-key PDF, ready to print", icon: <FileDown className="h-3.5 w-3.5" aria-hidden /> },
                  ]
              ).map((step, idx, arr) => (
                <li key={step.sec} className="relative">
                  <div className="flex items-start gap-2.5 text-left">
                    {/* 時間タグ — タブ番号と秒数を一体で。violet の縦タイムライン */}
                    <div className="flex flex-col items-center shrink-0 pt-[1px]">
                      <span className="inline-flex items-center justify-center min-w-[34px] h-[18px] px-1.5 rounded-md bg-foreground text-background text-[9.5px] font-mono font-bold tabular-nums tracking-tight">
                        {step.sec}
                      </span>
                      {idx < arr.length - 1 && (
                        <span aria-hidden className="w-px flex-1 bg-gradient-to-b from-violet-500/40 to-violet-500/10 mt-0.5 h-3" />
                      )}
                    </div>
                    {/* 内容 */}
                    <div className="flex-1 min-w-0 pb-0.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-violet-600 dark:text-violet-400">{step.icon}</span>
                        <span className="text-[12.5px] font-bold tracking-tight text-foreground">{step.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/85 leading-snug">{step.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {/* サイクルの強調 — このループを「1タップで何回でも」回せることを最後に明示 */}
            <div className="mt-2.5 pt-2.5 border-t border-foreground/[0.06] flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-foreground/75">
              <RefreshCw className="h-3 w-3 text-violet-600" aria-hidden />
              {isJa ? (
                <span>このサイクルを<span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent font-extrabold"> 1タップで何回でも </span>回せる</span>
              ) : (
                <span>Repeat the loop, <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent font-extrabold">1 tap any time</span></span>
              )}
            </div>
          </div>
        </div>

        {/* ── アクション集約 (入力 + チップ + 巨大プライマリ) ──
             ファーストビューに「触れる入力欄」を配置。free フローのみ。 */}
        {primaryCta.variant === "free" && onPromptSubmit ? (
          <div className={`mb-4 transition-all duration-700 delay-75 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            <MobilePromptHeroBlock
              isJa={isJa}
              onSubmit={onPromptSubmit}
              ctaLabel={primaryCta.label}
              ctaSubLabel={primaryCta.subLabel}
              onPrimary={primaryCta.onClick}
            />
          </div>
        ) : (
          <div className={`mb-4 transition-all duration-700 delay-75 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            <button
              onClick={primaryCta.onClick}
              className="group flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-foreground text-background font-bold text-[15.5px] shadow-xl shadow-foreground/20 active:scale-[0.98] transition"
            >
              {primaryCta.variant === "resume" && <FileText className="h-4 w-4" />}
              <span>{primaryCta.label}</span>
              <ArrowRight className="h-4 w-4 group-active:translate-x-0.5 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-muted-foreground/60 mt-2">{primaryCta.subLabel}</p>
          </div>
        )}

      </section>

      {/* ━━ FREE PERKS — Hero 直下で「無料でどこまで」を最速で見せる (CTA 周辺の補強) ━━ */}
      {primaryCta.variant === "free" && (
        <section className="px-5 pb-3">
          <MobileFreePerks isJa={isJa} />
        </section>
      )}

      {/* ━━ Trust 行 — rainbow の 3 タイル → 罫線で区切る editorial な数字バンド ━━ */}
      <section className="px-5 pb-6">
        <div className="grid grid-cols-3 divide-x divide-foreground/[0.08] border-y border-foreground/[0.08] py-4">
          {[
            { valueJa: "60秒",  valueEn: "60s",  labelJa: "1枚を生成",  labelEn: "to make one" },
            { valueJa: "∞",     valueEn: "∞",    labelJa: "類題を量産",  labelEn: "for variants" },
            { valueJa: "0円",   valueEn: "$0",   labelJa: "登録なしで",  labelEn: "no signup" },
          ].map(({ valueJa, valueEn, labelJa, labelEn }, i) => (
            <div key={labelJa} className={`flex flex-col items-start ${i === 0 ? "pl-1 pr-3" : "px-3"}`}>
              <span className="text-[20px] font-semibold tabular-nums leading-none text-foreground tracking-tight mb-1.5">
                {isJa ? valueJa : valueEn}
              </span>
              <span className="text-[10.5px] text-muted-foreground/70 leading-tight">
                {isJa ? labelJa : labelEn}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ━━ PC 推奨バナー — アイコン1個 + 1行 (旧2行版を圧縮) ━━ */}
      <section className="px-5 pb-5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-foreground/[0.03] dark:bg-white/[0.03] border border-foreground/[0.08] px-3 py-2.5">
          <Smartphone className="h-4 w-4 text-foreground/55 shrink-0" />
          <p className="text-[11.5px] text-foreground/75 leading-snug font-medium flex-1">
            {isJa ? "モバイルで動きます · 編集は PC が快適" : "Works on mobile · Best editing on desktop"}
          </p>
        </div>
      </section>

      {/* ━━ DEMO STRIP (30s editor) — モバイル向けに横スクロールではなく等比縮小 ━━ */}
      <section id="sample-output" className="relative pt-8 pb-12 px-3 overflow-hidden">
        <div className="px-2 mb-5">
          <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
            <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
            <span className="font-mono text-[10px] text-foreground/45">§ 02</span>
            {isJa ? "実際の動き" : "How it actually moves"}
          </p>
          <h2 className="text-[22px] font-bold tracking-[-0.015em] leading-[1.3]">
            {isJa ? (<>依頼 <span className="text-foreground/40">→</span> 紙面に即反映。</>) : "Ask. See it. Done."}
          </h2>
          <p className="text-[12px] text-muted-foreground/75 mt-2 leading-relaxed">
            {isJa ? "AI に投げた瞬間、印刷品質の紙面が組み上がります。" : "The moment you ask, a print-quality sheet builds itself."}
          </p>
        </div>

        {/* MockupShrink: 端末幅から逆算して transform: scale で縮小 */}
        {/* IdleMount: モバイル LCP/TBT を圧迫していた 394 行の EditorMockup JSX を idle まで
            遅延マウント。LCP 候補がヒーロー headline に移り、ハイドレーション直後の
            Style & Layout 12 秒スパイクを解消する。CLS 抑止のため minHeight を確保。 */}
        <IdleMount minHeight="320px">
          <MockupShrink>
            <EditorMockup isJa={isJa} />
          </MockupShrink>
        </IdleMount>

        <div className="flex flex-wrap items-center gap-1.5 mt-6 px-2">
          {[
            isJa ? "AI即反映" : "AI instant",
            isJa ? "PDF出力" : "PDF",
            isJa ? "直接編集" : "Edit",
            isJa ? "類題量産" : "Variants",
          ].map((label) => (
            <span key={label} className="inline-flex items-center px-2 py-0.5 rounded-md bg-foreground/[0.025] border border-foreground/[0.07] text-[10.5px] text-foreground/70 font-medium">
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ━━ TRUST SIGNALS — モバイルは縦スタック ━━ */}
      <section className="px-5 py-5 border-y border-foreground/[0.05] bg-foreground/[0.012]">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Zap className="h-3.5 w-3.5" />, label: isJa ? "LuaLaTeX 組版" : "LuaLaTeX" },
            { icon: <Shield className="h-3.5 w-3.5" />, label: isJa ? "無料・登録不要" : "Free · No signup" },
            { icon: <Printer className="h-3.5 w-3.5" />, label: isJa ? "A4/B5 印刷対応" : "Print-ready" },
            { icon: <Sparkles className="h-3.5 w-3.5" />, label: isJa ? "数式・図対応" : "Math & figures" },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-background border border-foreground/[0.06] text-[11.5px] text-muted-foreground/85">
              <span className="text-primary/70">{t.icon}</span>{t.label}
            </div>
          ))}
        </div>
      </section>

      {/* ━━ FIGURE DRAW DEMO ━━
           "綺麗すぎ" を避けるため、emerald グラデの薄い帯と FREE グラデバッジを廃し、
           editorial な eyebrow + neutral chip だけにする。 */}
      <section className="pt-10 pb-10 px-5">
        <div className="mb-5">
          <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
            <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
            <span className="font-mono text-[10px] text-foreground/45">§ 04</span>
            {isJa ? "図形描画" : "Figure mode"}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-medium tracking-wide border text-foreground/55 bg-foreground/[0.04] border-foreground/[0.08]">
              {isJa ? "Freeでも" : "Free"}
            </span>
          </p>
          <h2 className="text-[22px] font-bold tracking-[-0.015em] leading-[1.3]">
            {isJa ? (<>図も、<span className="italic font-serif text-foreground/85">手で</span>描ける。</>) : (<>Figures, drawn <span className="italic font-serif text-foreground/85">by hand</span>.</>)}
          </h2>
          <p className="text-[12px] text-muted-foreground/75 mt-2 leading-relaxed max-w-[20rem]">
            {isJa
              ? "回路・力学・幾何・化学・生物まで、TikZ コードを書かずに描ける図形パレット。"
              : "Circuits, mechanics, geometry, chemistry, biology — a shape palette that skips TikZ."}
          </p>
        </div>

        <IdleMount minHeight="320px">
          <MockupShrink>
            <FigureDrawMockup isJa={isJa} />
          </MockupShrink>
        </IdleMount>
      </section>

      {/* ━━ WHO IS THIS FOR — 3 アイコン横並びを「人が組んだ」感の縦リストに刷新 ━━
           rainbow グラデのアイコンタイル → 線画アイコン + 番号 + bullet。 */}
      <section className="px-5 py-10 border-t border-foreground/[0.05]">
        <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
          <span className="font-mono text-[10px] text-foreground/45">§ 05</span>
          {isJa ? "こんな先生に" : "Built for"}
        </p>
        <h2 className="text-[22px] font-bold tracking-[-0.015em] leading-[1.3] mb-1">
          {isJa ? "毎週、教材を手作りしている方へ。" : "For tutors who hand-craft worksheets."}
        </h2>
        <p className="text-[12px] text-muted-foreground/75 leading-relaxed mb-6 max-w-[22rem]">
          {isJa
            ? "一枚ずつ作っていた時間を、生徒に向き合う時間に戻したい。Eddivom はそのための道具です。"
            : "Take back the hours spent hand-building worksheets — and spend them with students instead."}
        </p>
        <ul className="space-y-4">
          {[
            { num: "01", title: isJa ? "個人塾・家庭教師" : "Tutors & Private Instructors", desc: isJa ? "生徒ごとに違うプリントを毎週。「あと5問」で類題を即追加。" : "Different worksheet per student, each week. \"5 more like this\" in seconds." },
            { num: "02", title: isJa ? "学校の教科担当" : "Math & STEM Teachers", desc: isJa ? "小テスト・定期テストを効率よく。解答付き PDF で採点まで一気通貫。" : "Quick quizzes, with answer-key PDFs that make grading painless." },
            { num: "03", title: isJa ? "教材制作・販売" : "Creators & Sellers", desc: isJa ? "問題集やドリルを印刷品質で量産。配布・販売にそのまま使える。" : "Build print-quality problem sets ready to distribute or sell." },
          ].map((p) => (
            <li key={p.num} className="flex gap-3 pb-4 border-b border-foreground/[0.05] last:border-b-0 last:pb-0">
              <span
                className="text-[18px] tabular-nums leading-none text-foreground/30 font-light tracking-tight pt-0.5 shrink-0"
                style={{ fontFamily: 'ui-serif, "Iowan Old Style", "Apple Garamond", Georgia, serif' }}
              >
                {p.num}
              </span>
              <div>
                <h4 className="text-[13.5px] font-semibold tracking-tight mb-1">{p.title}</h4>
                <p className="text-[12px] text-muted-foreground/80 leading-relaxed">{p.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ━━ 開発者紹介 — モバイルは超圧縮で 1 段落のみ ━━ */}
      <section className="px-5 py-8 border-t border-foreground/[0.05] bg-foreground/[0.012]">
        <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
          <span className="font-mono text-[10px] text-foreground/45">§ 06</span>
          {isJa ? "開発者について" : "About the developer"}
        </p>
        <p
          className="text-[14px] leading-[1.75] text-foreground/85"
          style={{ fontFamily: 'ui-serif, "Iowan Old Style", "Apple Garamond", Georgia, serif' }}
        >
          {isJa
            ? "STEM 教材を実際に作ってきた人間 — 名古屋大学・森 祐太 — が設計しています。「手早く・印刷品質で」を守るために生まれた道具です。"
            : "Designed by Yuta Mori, an engineering student at Nagoya University who actually creates STEM materials. Built around one belief: worksheets should be fast to make, but print-quality every time."}
        </p>
        <p className="text-[10.5px] text-muted-foreground/55 mt-3 italic">
          {isJa ? "— a tool built by, and for, people who teach" : "— a tool built by, and for, people who teach"}
        </p>
      </section>

      {/* ━━ PRICING — 必ず PC 版と同じ PLANS データから派生させる
          (Free / Starter / Pro / Premium の 4 種、価格・特徴は SSOT) ━━ */}
      <section id="pricing" className="px-5 py-10 bg-foreground/[0.015]">
        <div className="mb-6">
          <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
            <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
            <span className="font-mono text-[10px] text-foreground/45">§ 07</span>
            {isJa ? "料金プラン" : "Pricing"}
          </p>
          <h2 className="text-[24px] font-bold tracking-[-0.015em] leading-[1.25]">
            {isJa ? "用途で選ぶ。" : "Pick what fits."}
          </h2>
          <p className="text-[11.5px] text-muted-foreground/70 mt-2">
            {isJa ? "税込・月額・いつでも解約" : "Monthly · tax incl. · cancel anytime"}
          </p>
          {/* 視線を Starter に誘導するサブコピー — emerald で本セクションの "推し" を可視化 */}
          <p className="text-[11.5px] mt-1.5 font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
            <Zap className="h-3 w-3" aria-hidden />
            {isJa ? "迷ったら、無料から最も近い Starter から。" : "Not sure? Start with Starter — the closest step up from free."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {(["free", "starter", "pro", "premium"] as const).map((planId: PlanId) => {
            const def = PLANS[planId];
            const highlight = !!def.highlight;
            const features = isJa ? def.features : (def.featuresEn ?? def.features);
            const tagline = isJa ? def.tagline : (def.taglineEn ?? def.tagline);
            const sub = planId === "free"
              ? (isJa ? "永久無料" : "Free forever")
              : (isJa ? "/ 月" : "/ mo");
            // モバイルでは特徴を 4 件までに切り詰めて占有面積を抑える
            const items = features.slice(0, 4);
            const isPremium = planId === "premium";
            const isStarter = planId === "starter";
            // Pro 推奨は SSOT (PLANS.highlight) のままに、Starter にも視覚強調を追加。
            // 「無料 → ¥1,980」が最も自然なステップであることを強調するため、
            // emerald 系の border + 微弱 shadow で Pro と対等に見せる。
            const cardClass = highlight
              ? "relative bg-card border border-foreground/[0.18] shadow-[0_2px_12px_-6px_rgba(0,0,0,0.12)]"
              : isPremium
                ? "bg-card border border-foreground/[0.12]"
                : isStarter
                  ? "bg-card border border-emerald-500/40 shadow-[0_2px_12px_-6px_rgba(16,185,129,0.18)]"
                  : "bg-card border border-foreground/[0.08]";
            return (
              <button
                key={planId}
                type="button"
                onClick={() => onPlanSelect(planId)}
                className={`relative text-left rounded-2xl p-5 active:scale-[0.99] transition ${cardClass}`}
              >
                {highlight && (
                  <>
                    <span aria-hidden className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full bg-foreground" />
                    <span className="absolute -top-2 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-foreground text-background text-[9.5px] font-semibold tracking-wide">
                      <Crown className="h-2.5 w-2.5" />
                      {isJa ? (def.badge || "おすすめ") : "RECOMMENDED"}
                    </span>
                  </>
                )}
                {isStarter && (
                  <>
                    {/* 左の細い emerald バー — Pro の foreground バーと対称 */}
                    <span aria-hidden className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full bg-emerald-500" />
                    {/* "無料からの最初の一歩" バッジ — Pro の "おすすめ" と並立する第二の軸として
                         「無料との価格差が小さい = アップグレードしやすい」を訴求 */}
                    <span className="absolute -top-2 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[9.5px] font-semibold tracking-wide shadow-sm">
                      <Zap className="h-2.5 w-2.5" />
                      {isJa ? "無料からの最初の一歩" : "BEST FIRST UPGRADE"}
                    </span>
                  </>
                )}
                {isPremium && !highlight && (
                  <span className="absolute -top-2 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-violet-700 dark:text-violet-300 bg-violet-500/[0.06] border border-violet-500/25 text-[9.5px] font-medium tracking-wide">
                    <Crown className="h-2.5 w-2.5" />
                    {isJa ? "教育機関向け" : "Enterprise"}
                  </span>
                )}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[15px] font-bold tracking-tight">
                    {isJa ? def.name : def.nameEn}
                  </span>
                  <span className="text-[20px] font-bold ml-auto tabular-nums">
                    {def.priceLabel}
                  </span>
                  <span className="text-[11px] text-muted-foreground/65">{sub}</span>
                </div>
                {/* Starter には「1日あたり ¥66」のコスト訴求を追加。
                     ¥1,980 / 30日 ≈ ¥66/日 で、Pro の ¥4,980 (≒¥166/日) との対比で
                     "毎日のコーヒー1杯より安い" レベルを暗示。 */}
                {isStarter && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5 inline-flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" />
                    {isJa ? "1日あたり約 ¥66 ・ 無料からの最も小さなステップ" : "About ¥66/day · the smallest step up from free"}
                  </p>
                )}
                {tagline && (
                  <p className="text-[11.5px] text-muted-foreground/70 mb-2">{tagline}</p>
                )}
                <ul className="space-y-1.5 mb-2">
                  {items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-[12px] text-foreground/80 leading-snug">
                      <span aria-hidden className="text-foreground/40 mt-[1px]">—</span>
                      <span>{it}</span>
                    </li>
                  ))}
                  {features.length > items.length && (
                    <li className="text-[10.5px] text-muted-foreground/55 pl-5">
                      {isJa
                        ? `他 ${features.length - items.length} 件`
                        : `+${features.length - items.length} more`}
                    </li>
                  )}
                </ul>
                <div className="flex items-center justify-end gap-1 text-[11.5px] font-medium text-foreground/75">
                  {planId === "free"
                    ? (isJa ? "無料で始める" : "Start free")
                    : (isJa ? "選ぶ" : "Choose")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ━━ FAQ — mobile accordion ━━ */}
      <section className="px-5 py-10">
        <div className="mb-5">
          <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
            <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
            <span className="font-mono text-[10px] text-foreground/45">§ 08</span>
            {isJa ? "よくある質問" : "FAQ"}
          </p>
          <h2 className="text-[20px] font-bold tracking-[-0.015em] leading-[1.3]">
            {isJa ? "気になるところに、先にお答え。" : "Answers, before you ask."}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {(isJa ? FAQ_JA : FAQ_EN).map((qa) => (
            <details key={qa.q} className="group rounded-xl border border-foreground/[0.08] bg-card/50 overflow-hidden">
              <summary className="flex items-center gap-2 px-3 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-[13px] font-semibold tracking-tight text-foreground/90 leading-snug">{qa.q}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground/55 transition-transform group-open:rotate-180 group-open:text-violet-500 shrink-0" />
              </summary>
              <div className="px-3 pb-3 pt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {qa.a}
              </div>
            </details>
          ))}
        </div>
        <p className="text-center text-[11.5px] text-muted-foreground/65 mt-5">
          {isJa ? "他にご質問があれば、" : "Different question? "}
          <a href="/contact" className="text-violet-500 underline-offset-4 underline font-medium">
            {isJa ? "お問い合わせ" : "Contact us"}
          </a>
          {isJa ? " からどうぞ。" : "."}
        </p>
      </section>

      {/* ━━ Final CTA ━━
           虹色グラデの目立ちすぎボタンを廃し、黒地のミニマル CTA に。
           "綺麗すぎ" を避けるため左下に小さな手書き風の矢印スタブを差し込む。 */}
      <section className="px-5 py-12 border-t border-foreground/[0.05]">
        <p className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-block h-px w-5 bg-foreground/25" />
          <span className="font-mono text-[10px] text-foreground/45">§ 09</span>
          {isJa ? "はじめてみる" : "Get started"}
        </p>
        <h2 className="text-[26px] font-bold tracking-[-0.02em] mb-2 leading-[1.25]">
          {isJa ? (
            <>今、<HighlightMark>1枚</HighlightMark>だけ作ってみる。</>
          ) : (
            <>Make just <HighlightMark>one sheet</HighlightMark>.</>
          )}
        </h2>
        <p className="text-[12.5px] text-muted-foreground/80 mb-6 leading-relaxed">
          {isJa ? "登録不要、30 秒で完成。気に入らなければそのまま閉じて構いません。" : "No signup, 30 seconds. Close the tab if you don't like it."}
        </p>
        <button
          onClick={primaryCta.onClick}
          className="group flex items-center justify-center gap-2.5 w-full h-13 py-3 rounded-full bg-foreground text-background font-semibold text-[14.5px] active:scale-[0.98] transition-all"
        >
          {primaryCta.label}
          <ArrowRight className="h-4 w-4 group-active:translate-x-0.5 transition-transform" />
        </button>
        <p className="text-[10.5px] text-muted-foreground/55 mt-3 inline-flex items-center gap-1.5">
          <Monitor className="h-3 w-3" />
          {isJa ? "PC ブラウザだと、さらに快適に動きます。" : "Even better on desktop."}
        </p>
      </section>

      {/* ━━ 下部固定 CTA ━━
           スクロール途中・ページ下部のどこからでも 1 タップで生成画面に行ける窓口。
           グラデの目立つ pill にして「ここを押す」が初見で分かるようにする。
           free フロー (= 未ログイン) のときだけ出して、ログイン済みには見せない。 */}
      {primaryCta.variant === "free" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 border-t border-foreground/[0.08] bg-background/95 backdrop-blur-md"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          <button
            onClick={primaryCta.onClick}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full bg-foreground text-background font-semibold text-[14px] active:scale-[0.98] transition"
            aria-label={primaryCta.label}
          >
            <span>{primaryCta.label}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-1">
            {isJa ? "登録不要・まずは1枚無料・解答付きPDFで保存" : "No signup · First sheet free · Answer-key PDF"}
          </p>
        </div>
      )}

      {/* 固定 CTA で隠れる分、ページ末尾に下駄を履かせる */}
      {primaryCta.variant === "free" && <div aria-hidden style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }} />}

      {/* ━━ Footer ━━ */}
      <footer
        className="px-5 py-6 border-t border-foreground/[0.06] bg-foreground/[0.015] text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <div className="flex justify-center gap-4 mb-3 text-[11.5px] text-muted-foreground/70">
          <a href="/terms" className="hover:text-foreground transition">{isJa ? "利用規約" : "Terms"}</a>
          <a href="/privacy" className="hover:text-foreground transition">{isJa ? "プライバシー" : "Privacy"}</a>
          <a href="/refunds" className="hover:text-foreground transition">{isJa ? "返金" : "Refunds"}</a>
          <a href="/commerce" className="hover:text-foreground transition">{isJa ? "特商法" : "Legal"}</a>
        </div>
        <a
          href="/contact"
          className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition"
        >
          <Mail className="h-3 w-3" />
          {isJa ? "お問い合わせ" : "Contact"}
        </a>
        {/* 権威性向上のための開発者サイトへの控えめリンク。
            副次扱いに徹するため: footer の「© 」行に inline で混ぜる / 小さいフォント /
            target="_blank" + rel="noopener noreferrer" で離脱を最小化。 */}
        <p className="text-[10px] text-muted-foreground/35 mt-3">
          © {new Date().getFullYear()} Eddivom ·{" "}
          <a
            href="https://yuta-eng.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline hover:text-muted-foreground/70 transition-colors"
          >
            {isJa ? "開発者について" : "About the developer"}
          </a>
        </p>
      </footer>
    </div>
  );
}

/* ── FAQ data (page-level の JSON-LD と一致させる) ── */
const FAQ_JA = [
  { q: "AI で問題集を自動生成できますか？", a: "はい。チャットで「二次関数の問題を10題」のように依頼するだけで、AIがLaTeX組版で問題を自動生成します。" },
  { q: "解答付きPDFは自動で作成されますか？", a: "はい。問題ページと解答ページがセットになったPDFを自動で書き出します。A4/B5 印刷に最適化されます。" },
  { q: "数学プリント作成ソフトとして無料で使えますか？", a: "無料プランで会員登録なしに利用を開始できます。AI回数とPDF出力に上限がありますが、数式・図・化学式・直接編集は無料で使えます。" },
  { q: "Overleaf との違いは何ですか？", a: "Eddivom は教材作成に特化した IDE です。AIによる問題自動生成・類題量産・解答付きPDFの自動構成・採点など、Overleaf にはない教材作成専用フローを最初から備えています。" },
  { q: "1つの問題から類題を自動で量産できますか？", a: "はい。既存の問題にカーソルを当てて「類題を5問」と依頼すると、係数や設定を変えた類題をAIが生成します。" },
  { q: "高校数学の確認テストや塾の教材作成にも使えますか？", a: "はい。共通テスト風 / 国公立二次風 / 学校用テストなど、確認テストや塾教材に最適化されたテンプレートを多数収録しています。" },
];
const FAQ_EN = [
  { q: "Can AI generate practice problems automatically?", a: "Yes. Just ask in chat — '10 quadratic equation problems'. Eddivom generates problems in LaTeX live." },
  { q: "Are answer-key PDFs generated automatically?", a: "Yes. A paired PDF with the worksheet and a separate answer key. Print-ready for A4/B5." },
  { q: "Is it free as a math worksheet maker?", a: "Yes — the free plan needs no signup. AI and PDF exports are quota-limited but math/figure/chemistry typesetting is fully available." },
  { q: "How is this different from Overleaf?", a: "Eddivom is built for worksheet creation. AI problem generation, variants, answer-key composition, and grading are first-class — none of which exist in Overleaf." },
  { q: "Can it generate variants from one problem?", a: "Yes. Place the cursor on a problem and ask for '5 variants' — the AI rewrites coefficients while preserving structure." },
  { q: "Is it suitable for high-school quizzes and tutor worksheets?", a: "Yes. Templates tuned for Japanese national exam, university second-stage, in-class quizzes, and problem sets." },
];

/* ── モバイル: 統合 Hero ブロック ──
 *  ① 大きな入力欄 (16px 以上で iOS auto-zoom 抑制)
 *  ② サンプルチップ — タップで即 onSubmit (空でもエディタ側で空白テンプレが立ち上がる)
 *  ③ 大プライマリ pill — 入力空でも踏める。タップ即生成へ。
 *  ④ サブテキスト「登録不要 · 30〜60秒で1枚」
 *
 * 「考えて入力」より先に「ボタンを押す」を出して摩擦を最小化する設計。 */
function MobilePromptHeroBlock({
  isJa, onSubmit, ctaLabel, ctaSubLabel, onPrimary,
}: {
  isJa: boolean;
  onSubmit: (prompt: string) => void;
  ctaLabel: string;
  ctaSubLabel: string;
  onPrimary: () => void;
}) {
  const [value, setValue] = useState("");
  // Placeholder: 高校物理を起点に「学年・分野・問題数・解答付き」の指示パターンを暗示。
  // 旧 (二次方程式10問) は範囲が抽象だったため、対象学年と用途まで含めた版に差し替え。
  const placeholder = isJa
    ? "高校物理 運動方程式の基本確認テスト10問、解答付きで"
    : "High school physics: 10 motion-equation quiz items with answers";

  // サンプルチップ: 「学年 + 分野 + 用途 (テスト/演習/解答付き)」を 1 チップで完結させる。
  // レベル感 (中2 / 高1 / 高校) と出力形式 (解答付き / グラフ付き / 演習) が即読み取れるように。
  const samples = isJa
    ? [
        "高校物理 運動方程式の基本確認テスト10問",
        "中2数学 一次関数の小テスト 解答付き",
        "高1数学 関数と三角比 グラフ付き演習",
      ]
    : [
        "High-school physics: 10 motion-equation quiz items",
        "Grade 8 linear functions quiz with answers",
        "Algebra & trig: graph-based practice",
      ];

  const submitWithValue = () => onSubmit(value);

  return (
    <div className="space-y-2.5">
      {/* 入力欄 */}
      <div className="flex items-stretch gap-1.5 p-2 pl-3 rounded-2xl border-2 border-foreground/[0.1] bg-card shadow-sm focus-within:border-violet-500/50 focus-within:shadow-violet-500/10 transition">
        <Sparkles className="h-4 w-4 text-violet-500 self-center shrink-0" aria-hidden />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitWithValue(); } }}
          placeholder={placeholder}
          aria-label={isJa ? "AIに作成内容を伝える" : "Tell the AI what to make"}
          className="flex-1 min-w-0 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground/55 text-foreground"
        />
      </div>

      {/* タップ即送信のサンプルチップ — 横スクロール一行で親指の移動を最小化。
           プレフィックスを「例：」から「タップで即生成 →」に変えて、
           チップが "見本" ではなく "ワンタップ起動ボタン" であることを明示する。 */}
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 w-max pb-1">
          <span className="inline-flex items-center gap-1 shrink-0 text-[10.5px] font-bold tracking-wide text-violet-700 dark:text-violet-300">
            <Zap className="h-2.5 w-2.5 text-amber-500" aria-hidden />
            {isJa ? "タップで即生成" : "Tap to generate"}
            <ArrowRight className="h-2.5 w-2.5 text-violet-500/70" aria-hidden />
          </span>
          {samples.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSubmit(s)}
              className="text-[11.5px] px-2.5 py-1.5 rounded-full border border-violet-500/30 bg-gradient-to-r from-blue-500/[0.07] to-violet-500/[0.08] text-foreground/90 font-medium hover:border-violet-500/50 active:scale-[0.96] transition shrink-0 whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* プライマリ — 入力なしでも踏める。これが「とにかく1枚作る」の主導線。 */}
      <button
        type="button"
        onClick={() => {
          // 入力に文字があればそれを送信、無ければ空でゲスト生成画面へ
          if (value.trim()) submitWithValue();
          else onPrimary();
        }}
        className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-white font-bold text-[15.5px] shadow-xl shadow-violet-500/25 active:scale-[0.98] transition"
      >
        <Sparkles className="h-4 w-4" />
        <span>{ctaLabel}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
      {/* CTA 直下の安心材料 — 「無料の入口」+ 「課金後に手に入る成果物」を 2 段で。
           ① 入口の不安 (登録不要・1枚無料・PDF保存) を解消
           ② 継続価値: 1 タップで類題、解答付き PDF、A4 印刷品質 を成果物として明示
           講師視点で「明日の授業にそのまま使える」イメージを Hero 内で完結させる。 */}
      <div className="text-center space-y-1 pt-0.5">
        <p className="text-[11.5px] text-foreground/80 font-semibold">
          {ctaSubLabel}
        </p>
        <p className="text-[10.5px] text-muted-foreground/70 inline-flex items-center justify-center gap-1.5 flex-wrap">
          <RefreshCw className="h-2.5 w-2.5 text-violet-500" aria-hidden />
          {isJa ? (
            <>
              気に入ったら<span className="font-bold text-foreground/85">1タップで類題</span>・
              <span className="font-bold text-foreground/85">解答付きPDF</span>・
              <span className="font-bold text-foreground/85">A4印刷品質</span>
            </>
          ) : (
            <>
              Then <span className="font-bold text-foreground/85">1-tap variants</span> ·
              <span className="font-bold text-foreground/85">answer-key PDF</span> ·
              <span className="font-bold text-foreground/85">print-ready A4</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ── 旧 MobilePromptCta は廃止 (MobilePromptHeroBlock に統合) ── */

/* ── Hero 直下: 成果物プレビュー (Worksheet + Answer-key)
 *
 * モバイル: 「問題 / 解答」のタブ + フルワイドのスワイプカルーセル。
 * 横 2 列の窮屈な並列ではなく、画面幅いっぱいに 1 枚ずつ表示し、
 * scroll-snap で横スワイプ切替。タブを押すと scrollIntoView でアニメ移動。
 * 右側の紙の端を peek として残して「もう1枚ある」アフォーダンスを出す。 */
function WorksheetPreviewDuo({ isJa }: { isJa: boolean }) {
  useEffect(() => { ensureKatexCssMobile(); }, []);

  const promptText = isJa ? "高1数学・関数と三角比 解答グラフ付き" : "Algebra & trig with graph answers";

  // タブ状態 + スクロール先 ref
  const [active, setActive] = React.useState<"q" | "a">("q");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const qRef = React.useRef<HTMLDivElement>(null);
  const aRef = React.useRef<HTMLDivElement>(null);

  const goTo = (which: "q" | "a") => {
    setActive(which);
    const target = which === "q" ? qRef.current : aRef.current;
    // inline: "center" で snap-center と組み合わせ、画面中央にカードを合わせる
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  // スワイプで active を更新 — IntersectionObserver で「画面中央にどちらが来たか」検出
  React.useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.55) {
            const which = (e.target as HTMLElement).dataset.page as "q" | "a";
            if (which) setActive(which);
          }
        }
      },
      { root, threshold: [0.55, 0.8] },
    );
    if (qRef.current) obs.observe(qRef.current);
    if (aRef.current) obs.observe(aRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="relative">
      {/* 入力例 + 実際の出力ラベル — 横 1 行に統合し縦長を最小化。
           [✨ 入力例]  [実際の出力 ↓]
           PDF への視線誘導のため、右側にバウンス矢印を入れる。 */}
      <div className="flex items-center justify-center gap-1.5 mb-1 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full bg-card border border-foreground/[0.12] text-[10.5px] font-semibold text-foreground/85 shadow-sm max-w-[60vw]">
          <Sparkles className="h-2.5 w-2.5 text-violet-500 shrink-0" aria-hidden />
          <span className="truncate">{promptText}</span>
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold tracking-wide text-violet-700 dark:text-violet-300">
          {isJa ? "実際の出力" : "Actual output"}
          <ChevronDown className="h-3 w-3 animate-bounce" aria-hidden />
        </span>
      </div>

      {/* タブ切替 — 小型化 (h-7→h-6, text-[11px]→[10px]) で PDF を主役に */}
      <div className="flex items-center justify-center mb-1">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-foreground/[0.05] border border-foreground/[0.08]">
          <button
            type="button"
            onClick={() => goTo("q")}
            className={`flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-bold transition ${
              active === "q"
                ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm shadow-violet-500/30"
                : "text-foreground/60"
            }`}
          >
            <FileText className="h-2.5 w-2.5" />
            {isJa ? "問題" : "Worksheet"}
          </button>
          <button
            type="button"
            onClick={() => goTo("a")}
            className={`flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-bold transition ${
              active === "a"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/30"
                : "text-foreground/60"
            }`}
          >
            <FileSignature className="h-2.5 w-2.5" />
            {isJa ? "解答" : "Answers"}
          </button>
        </div>
      </div>

      {/* カルーセル — 親の px-5 を相殺して 100vw を確保し、各カードを画面中央に snap。
           ・両端に 7vw 程度の peek (もう1枚の存在を示唆)
           ・カード幅 = 86vw (max 440px)、視覚中央軸 = 50vw に snap
           ・スクロールパディングは要らない (snap-center は scroll-port 中心基準)
           ・カード本体は onClick を持たない (role/tabIndex も無し): スワイプとタップが
             競合して「タップで即遷移 → 画面が固まったように見える」現象が起きていたため、
             カードは "見るだけ" にし、明示ボタン (下の "タップしてあなたのプリントを作る") から
             生成画面へ遷移する設計に統一。 */}
      <div
        ref={scrollRef}
        className="-mx-5 overflow-x-auto no-scrollbar snap-x snap-mandatory flex gap-3 pb-1.5 pt-0.5 px-[7vw]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          ref={qRef}
          data-page="q"
          className="snap-center shrink-0 w-[86vw] max-w-[440px]"
        >
          <MobilePaperWorksheet isJa={isJa} />
        </div>
        <div
          ref={aRef}
          data-page="a"
          className="snap-center shrink-0 w-[86vw] max-w-[440px]"
        >
          <MobilePaperAnswerKey isJa={isJa} />
        </div>
      </div>

      {/* スワイプ／ドット指示 */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          type="button"
          aria-label={isJa ? "問題ページ" : "Worksheet page"}
          onClick={() => goTo("q")}
          className={`h-1.5 rounded-full transition-all ${active === "q" ? "w-6 bg-foreground/80" : "w-1.5 bg-foreground/20"}`}
        />
        <button
          type="button"
          aria-label={isJa ? "解答ページ" : "Answer page"}
          onClick={() => goTo("a")}
          className={`h-1.5 rounded-full transition-all ${active === "a" ? "w-6 bg-foreground/80" : "w-1.5 bg-foreground/20"}`}
        />
      </div>

      {/* プリント補足ラベル — 機能チップは最大 2 つ (PDF + 印刷)。
           手作業 30 分→60 秒の Before/After も小さく統合し、
           「速さ + 成果物形式」を 1 行で完結。 */}
      <div className="mt-1.5 flex items-center justify-center gap-1 flex-wrap px-2">
        <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-[10px] font-semibold text-foreground/80">
          <FileDown className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" aria-hidden />
          {isJa ? "そのまま配布できるPDF" : "Distribute as PDF"}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-[10px] font-semibold text-foreground/80">
          <Printer className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" aria-hidden />
          {isJa ? "解答付きで印刷可能" : "Print w/ answer key"}
        </span>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-[3px] rounded-full bg-gradient-to-r from-violet-500/[0.1] to-fuchsia-500/[0.1] border border-violet-500/30 text-[10px] font-bold">
          <Zap className="h-2.5 w-2.5 text-amber-500" aria-hidden />
          <span className="text-muted-foreground/65 line-through">{isJa ? "30分" : "30m"}</span>
          <ArrowRight className="h-2 w-2 text-foreground/40" aria-hidden />
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            {isJa ? "60秒" : "60s"}
          </span>
        </span>
      </div>

      {/* 権威性ライン — Hero から PDF 直下に移設。控えめサイズで圧迫しない。 */}
      <p className="mt-1.5 text-center text-[9.5px] text-muted-foreground/65 leading-snug">
        <span className="font-semibold text-foreground/65">
          {isJa ? "名古屋大学 情報工学科 発" : "Built at Nagoya Univ. — CS & Eng."}
        </span>
        <span aria-hidden className="mx-1 text-foreground/25">·</span>
        <span>{isJa ? "← スワイプで切替 →" : "← swipe →"}</span>
      </p>
    </div>
  );
}

function MobilePaperFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-md bg-white border border-gray-300/80 overflow-hidden text-gray-900"
      style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
        backgroundImage:
          "linear-gradient(to bottom, rgba(250,250,247,1), rgba(255,255,255,1)), repeating-linear-gradient(0deg, rgba(0,0,0,0.014) 0 1px, transparent 1px 24px)",
        backgroundBlendMode: "multiply",
        boxShadow: "0 24px 50px -16px rgba(0,0,0,0.3), 0 6px 12px -4px rgba(0,0,0,0.12)",
      }}
    >
      <div aria-hidden className="absolute top-0 right-0 w-5 h-5"
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 50%)" }} />
      <div aria-hidden className="absolute top-0 right-0 w-5 h-5"
        style={{
          clipPath: "polygon(100% 0, 100% 100%, 0 0)",
          background: "linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.13))",
        }} />
      <div aria-hidden className="absolute left-4 top-0 bottom-0 w-px bg-rose-300/45" />
      {children}
    </div>
  );
}

function MobilePointsBadge({ pts, isJa }: { pts: string; isJa: boolean }) {
  return (
    <span className="ml-auto inline-flex items-center px-2 py-[2px] rounded-full text-[9.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-amber-500 to-rose-500 shadow-sm shrink-0"
      style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {pts}{isJa ? "点" : "pt"}
    </span>
  );
}

function MobilePaperWorksheet({ isJa }: { isJa: boolean }) {
  return (
    <MobilePaperFrame>
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between text-[9px] tracking-[0.22em] uppercase text-gray-500">
          <span>EDDIVOM · {isJa ? "確認テスト" : "Quiz"}</span>
          <span>2025 · 05</span>
        </div>
        <div className="border-t-[1.5px] border-gray-800 mt-1" />
        <h3 className="text-center text-[16px] font-bold tracking-wide leading-tight pt-2">
          {isJa ? "数学Ⅰ・Ⅱ　関数と三角比" : "Math I/II — Functions & Trig"}
        </h3>
        <p className="text-center text-[10px] text-gray-500 leading-tight pb-1.5">
          {isJa ? "次の各問に答えよ。" : "Answer each problem."}
        </p>
        <div className="border-t border-gray-800" />
        <div className="border-t border-gray-800 mt-[1.5px]" />
        <div className="flex items-end justify-between gap-2 mt-1.5 text-[9.5px] text-gray-500">
          <span className="flex items-baseline gap-1">
            <span>{isJa ? "氏名" : "Name"}</span>
            <span className="border-b border-gray-500 w-20 inline-block mb-0.5" />
          </span>
          <span className="flex items-baseline gap-1">
            <span className="border-b border-gray-500 w-7 inline-block mb-0.5" />
            <span>/100</span>
          </span>
        </div>
      </div>

      <ol className="px-5 pt-3 pb-3 space-y-3">
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[12.5px] font-bold text-gray-700 shrink-0">{isJa ? "問1" : "Q1"}</span>
            <span className="text-[11px] text-gray-700">{isJa ? "次の関数の最小値を求めよ。" : "Find the minimum value."}</span>
            <MobilePointsBadge pts="30" isJa={isJa} />
          </div>
          <div className="pl-4"><PreviewMathDisplayLg latex="f(x)=x^2-6x+11" /></div>
          <div className="ml-4 mt-1 h-3 border-b border-dashed border-gray-300/80" />
        </li>
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[12.5px] font-bold text-gray-700 shrink-0">{isJa ? "問2" : "Q2"}</span>
            <span className="text-[11px] text-gray-700">{isJa ? "次の値を計算せよ。" : "Evaluate."}</span>
            <MobilePointsBadge pts="30" isJa={isJa} />
          </div>
          <div className="pl-4"><PreviewMathDisplayLg latex="\sin\dfrac{\pi}{3}+\cos\dfrac{\pi}{6}-\tan\dfrac{\pi}{4}" /></div>
          <div className="ml-4 mt-1 h-3 border-b border-dashed border-gray-300/80" />
        </li>
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[12.5px] font-bold text-gray-700 shrink-0">{isJa ? "問3" : "Q3"}</span>
            <span className="text-[11px] text-gray-700">{isJa ? "次の方程式を解け。" : "Solve."}</span>
            <MobilePointsBadge pts="40" isJa={isJa} />
          </div>
          <div className="pl-4"><PreviewMathDisplayLg latex="\log_{2}(x+1)+\log_{2}(x-1)=3" /></div>
          <div className="ml-4 mt-1 h-3 border-b border-dashed border-gray-300/80" />
        </li>
      </ol>

      <div className="px-5 pb-3 flex justify-end">
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-[3px] text-[9.5px] font-extrabold tracking-[0.15em] text-white bg-gradient-to-r from-blue-500 to-violet-500 shadow-sm" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <FileText className="h-2.5 w-2.5" />{isJa ? "問題プリント PDF" : "Worksheet PDF"}
        </span>
      </div>
    </MobilePaperFrame>
  );
}

function MobilePaperAnswerKey({ isJa }: { isJa: boolean }) {
  return (
    <MobilePaperFrame>
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between text-[9px] tracking-[0.22em] uppercase text-gray-500">
          <span>EDDIVOM · {isJa ? "解答" : "Answer Key"}</span>
          <span>2025 · 05</span>
        </div>
        <div className="border-t-[1.5px] border-gray-800 mt-1" />
        <h3 className="text-center text-[16px] font-bold tracking-wide leading-tight pt-2">
          {isJa ? "解答 ・ 解説" : "Solutions & Explanations"}
        </h3>
        <p className="text-center text-[10px] text-gray-500 leading-tight pb-1.5">
          {isJa ? "図入りの完全解答。" : "Complete answers with figures."}
        </p>
        <div className="border-t border-gray-800" />
        <div className="border-t border-gray-800 mt-[1.5px]" />
        <div className="flex items-end justify-end gap-1 mt-1.5">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/35 text-emerald-700 font-bold text-[9.5px]">
            <Check className="h-2.5 w-2.5" />
            {isJa ? "全問正解" : "All correct"}
          </span>
        </div>
      </div>

      <ol className="px-5 pt-3 pb-3 space-y-3">
        {/* Q1: 放物線 */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-[12.5px] font-bold text-gray-700 shrink-0">{isJa ? "問1" : "Q1"}</span>
            <span className="overflow-hidden">
              <PreviewMathInline latex="f(x)=(x-3)^2+2" />
            </span>
            <MobileCorrectMark />
          </div>
          <div className="flex items-center gap-3 pl-4">
            <ParabolaSvgMobileLg />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10.5px] text-gray-700">
                {isJa ? "頂点 " : "vertex "}<PreviewMathInline latex="(3,\,2)" />
              </span>
              <span className="text-[10.5px] font-semibold text-rose-700">
                {isJa ? "最小値 " : "min = "}<PreviewMathInline latex="\boxed{2}" />
              </span>
            </div>
          </div>
        </li>

        {/* Q2: 単位円 */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-[12.5px] font-bold text-gray-700 shrink-0">{isJa ? "問2" : "Q2"}</span>
            <span className="overflow-hidden">
              <PreviewMathInline latex="\dfrac{\sqrt{3}}{2}+\dfrac{\sqrt{3}}{2}-1=\sqrt{3}-1" />
            </span>
            <MobileCorrectMark />
          </div>
          <div className="flex items-center gap-3 pl-4">
            <UnitCircleSvgMobileLg />
            <span className="text-[10.5px] text-gray-700 leading-snug">
              {isJa ? "単位円で " : "unit circle: "}
              <PreviewMathInline latex="\sin60^\circ=\tfrac{\sqrt{3}}{2}" />
            </span>
          </div>
        </li>

        {/* Q3: 対数の解法ステップ + 数直線 */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-[12.5px] font-bold text-gray-700 shrink-0">{isJa ? "問3" : "Q3"}</span>
            <span className="text-[10px] font-semibold tracking-wide text-violet-700">
              {isJa ? "対数方程式" : "log eqn"}
            </span>
            <MobileCorrectMark />
          </div>
          <div className="ml-4 pl-3 border-l-2 border-violet-400/60 space-y-1">
            <MobileSolutionStep n={1} label={isJa ? "真数条件" : "Domain"}>
              <PreviewMathInline latex="x+1>0\;\land\;x-1>0\;\Rightarrow\;x>1" />
            </MobileSolutionStep>
            <MobileSolutionStep n={2} label={isJa ? "和→積" : "Combine"}>
              <PreviewMathInline latex="\log_2\{(x+1)(x-1)\}=3" />
            </MobileSolutionStep>
            <MobileSolutionStep n={3} label={isJa ? "対数を外す" : "Exp"}>
              <PreviewMathInline latex="x^2-1=2^3=8" />
            </MobileSolutionStep>
            <MobileSolutionStep n={4} label={isJa ? "解の選別" : "Select"}>
              <PreviewMathInline latex="x=\pm 3" />
            </MobileSolutionStep>
          </div>
          <div className="ml-4 mt-2 flex items-center gap-3">
            <NumberLineLogDomainMobileLg />
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 text-[10px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-semibold">
                  <PreviewMathInline latex="x=3" /> {isJa ? "可" : "OK"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px]">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="text-rose-600 line-through">
                  <PreviewMathInline latex="x=-3" />
                </span>
              </span>
            </div>
          </div>
          <div className="ml-4 mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-100 to-rose-100 border border-rose-300/60">
            <span className="text-[10.5px] font-bold text-rose-800">{isJa ? "答 " : "Ans. "}</span>
            <PreviewMathInline latex="x=\boxed{3}" />
          </div>
        </li>
      </ol>

      <div className="px-5 pb-3 flex justify-end">
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-[3px] text-[9.5px] font-extrabold tracking-[0.15em] text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <FileText className="h-2.5 w-2.5" />{isJa ? "解答 PDF" : "Answer-key PDF"}
        </span>
      </div>
    </MobilePaperFrame>
  );
}

/* モバイル: 解法ステップの 1 行 — 番号チップ + ラベル + 数式 */
function MobileSolutionStep({ n, label, children }: { n: number; label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[10px] leading-snug">
      <span
        className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-[9px] font-extrabold shadow-sm shrink-0"
        style={{ fontFamily: "ui-sans-serif, system-ui" }}
      >
        {n}
      </span>
      {label && (
        <span
          className="text-[8.5px] font-bold tracking-wider uppercase text-violet-700 shrink-0"
          style={{ fontFamily: "ui-sans-serif, system-ui" }}
        >
          {label}
        </span>
      )}
      <span className="overflow-hidden">{children}</span>
    </div>
  );
}

/* モバイル (フルワイド): 大型ディスプレイ数式 */
function PreviewMathDisplayLg({ latex }: { latex: string }) {
  const { html, ok } = renderMathHTML(latex, { displayMode: true });
  if (ok) {
    return (
      <div
        className="text-center [&_.katex-display]:m-0 [&_.katex]:text-[1.1em]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <div className="text-center text-gray-700">{latex}</div>;
}

/* モバイル (フルワイド): 大型放物線 */
function ParabolaSvgMobileLg() {
  const W = 120, H = 90;
  const xMin = -1, xMax = 7, yMin = -1, yMax = 12;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  const points: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = xMin + (i / 80) * (xMax - xMin);
    const y = (x - 3) * (x - 3) + 2;
    points.push(`${sx(x).toFixed(2)},${sy(y).toFixed(2)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[120px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="parabolaStrokeMobileLg" x1="0" x2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <pattern id="gridMobileLg" width="15" height="15" patternUnits="userSpaceOnUse">
          <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#gridMobileLg)" />
      <line x1={sx(xMin)} y1={sy(0)} x2={sx(xMax)} y2={sy(0)} stroke="#1f2937" strokeWidth="0.7" />
      <line x1={sx(0)} y1={sy(yMin)} x2={sx(0)} y2={sy(yMax)} stroke="#1f2937" strokeWidth="0.7" />
      <polygon points={`${sx(xMax)},${sy(0)} ${sx(xMax)-2.5},${sy(0)-1.5} ${sx(xMax)-2.5},${sy(0)+1.5}`} fill="#1f2937" />
      <polygon points={`${sx(0)},${sy(yMax)} ${sx(0)-1.5},${sy(yMax)+2.5} ${sx(0)+1.5},${sy(yMax)+2.5}`} fill="#1f2937" />
      <polyline points={points.join(" ")} fill="none" stroke="url(#parabolaStrokeMobileLg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(3)} cy={sy(2)} r="2" fill="#ec4899" stroke="white" strokeWidth="1" />
      <text x={sx(3)+3} y={sy(2)-3} fontSize="6" fill="#be185d" fontWeight="700">(3,2)</text>
      <text x={sx(xMax)-4} y={sy(0)+6} fontSize="5.5" fill="#374151">x</text>
      <text x={sx(0)+2} y={sy(yMax)+5} fontSize="5.5" fill="#374151">y</text>
    </svg>
  );
}

/* モバイル (フルワイド): 大型単位円 */
function UnitCircleSvgMobileLg() {
  const cx = 45, cy = 45, r = 32;
  const angle = 60 * Math.PI / 180;
  const px = cx + r * Math.cos(angle);
  const py = cy - r * Math.sin(angle);
  return (
    <svg viewBox="0 0 90 90" className="w-[88px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="circleStrokeMobileLg" x1="0" x2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <line x1="6" y1={cy} x2="86" y2={cy} stroke="#1f2937" strokeWidth="0.7" />
      <line x1={cx} y1="6" x2={cx} y2="86" stroke="#1f2937" strokeWidth="0.7" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#circleStrokeMobileLg)" strokeWidth="1.6" />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke="#0ea5e9" strokeWidth="1.4" />
      <line x1={px} y1={py} x2={px} y2={cy} stroke="#ec4899" strokeWidth="1.2" strokeDasharray="2 1.5" />
      <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#6366f1" strokeWidth="1.2" strokeDasharray="2 1.5" />
      <path d={`M ${cx + 10} ${cy} A 10 10 0 0 0 ${cx + 10 * Math.cos(angle)} ${cy - 10 * Math.sin(angle)}`} fill="none" stroke="#f59e0b" strokeWidth="0.9" />
      <text x={cx + 12} y={cy - 4} fontSize="6" fill="#b45309" fontWeight="700">60°</text>
      <circle cx={px} cy={py} r="1.8" fill="#0ea5e9" stroke="white" strokeWidth="0.8" />
      <text x={px + 1.5} y={py - 2} fontSize="6" fill="#0c4a6e" fontWeight="700">P</text>
    </svg>
  );
}

/* モバイル (フルワイド): 大型 真数条件 数直線 */
function NumberLineLogDomainMobileLg() {
  const W = 150, H = 40;
  const xMin = -5, xMax = 5;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const baseY = 24;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[150px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="domainOKMobileLg" x1="0" x2="1">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="domainNGMobileLg" x1="0" x2="1">
          <stop offset="0" stopColor="#f43f5e" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f43f5e" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x={sx(xMin)} y={baseY - 5} width={sx(1) - sx(xMin)} height="10" fill="url(#domainNGMobileLg)" />
      <rect x={sx(1)} y={baseY - 5} width={sx(xMax) - sx(1)} height="10" fill="url(#domainOKMobileLg)" />
      <line x1={sx(xMin)} y1={baseY} x2={sx(xMax)} y2={baseY} stroke="#1f2937" strokeWidth="0.9" />
      <polygon points={`${sx(xMax)},${baseY} ${sx(xMax)-2.5},${baseY-1.5} ${sx(xMax)-2.5},${baseY+1.5}`} fill="#1f2937" />
      {[-3, 0, 1, 3].map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={baseY - 2} x2={sx(t)} y2={baseY + 2} stroke="#1f2937" strokeWidth="0.7" />
          <text x={sx(t)} y={baseY + 9} fontSize="6" fill="#374151" textAnchor="middle">{t}</text>
        </g>
      ))}
      <circle cx={sx(1)} cy={baseY} r="2" fill="white" stroke="#1f2937" strokeWidth="1" />
      <text x={sx(1)} y={baseY - 7} fontSize="6" fill="#374151" textAnchor="middle" fontStyle="italic">x&gt;1</text>
      <circle cx={sx(3)} cy={baseY} r="2.4" fill="#10b981" stroke="white" strokeWidth="0.8" />
      <circle cx={sx(-3)} cy={baseY} r="2.4" fill="#f43f5e" stroke="white" strokeWidth="0.8" />
      <line x1={sx(-3) - 1.5} y1={baseY - 1.5} x2={sx(-3) + 1.5} y2={baseY + 1.5} stroke="white" strokeWidth="0.9" />
      <line x1={sx(-3) - 1.5} y1={baseY + 1.5} x2={sx(-3) + 1.5} y2={baseY - 1.5} stroke="white" strokeWidth="0.9" />
    </svg>
  );
}

function MobileCorrectMark() {
  return (
    <span aria-hidden className="ml-auto relative h-3 w-3 shrink-0">
      <svg viewBox="0 0 20 20" className="absolute inset-0 w-full h-full">
        <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(225,29,72,0.85)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/* インライン KaTeX */
function PreviewMathInline({ latex }: { latex: string }) {
  const { html, ok } = renderMathHTML(latex, { displayMode: false });
  if (ok) return <span className="align-middle [&_.katex]:text-[0.88em]" dangerouslySetInnerHTML={{ __html: html }} />;
  return <span className="text-gray-700">{latex}</span>;
}

/* ── 装飾: 黄色マーカー風アンダーライン ──
 * 全体が黒文字で重く見えるとの指摘を受けて、Hero H1 の核フレーズに薄い黄色の
 * ハイライトを敷く。背景は半透明 + linear-gradient で「ペンで引いた」感を出し、
 * dark mode でも視認できるよう発色を強めにしている。 */
function HighlightMark({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="relative inline-block"
      style={{
        backgroundImage:
          "linear-gradient(180deg, transparent 58%, rgba(250, 204, 21, 0.55) 58%, rgba(250, 204, 21, 0.55) 92%, transparent 92%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </span>
  );
}

/* ── 装飾: 数値・キーワードに使うグラデ強調 ── */
function GradientWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/* ── モバイル: Free でできること一覧 ──
 * 「無料でどこまで」を初見で明確化。Pro 機能より先に無料体験の価値を見せる。 */
function MobileFreePerks({ isJa }: { isJa: boolean }) {
  const items = [
    { icon: <Sparkles className="h-3 w-3" />,      label: isJa ? "プリントを1枚生成"           : "Generate 1 worksheet" },
    { icon: <Pencil className="h-3 w-3" />,        label: isJa ? "問題を画面で編集"             : "Edit problems on the page" },
    { icon: <FileDown className="h-3 w-3" />,      label: isJa ? "問題プリントを PDF 出力"      : "Export worksheet PDF" },
    { icon: <FileSignature className="h-3 w-3" />, label: isJa ? "解答 PDF を出力"               : "Export answer-key PDF" },
    { icon: <Sparkles className="h-3 w-3" />,      label: isJa ? "類題ジェネレータ (お試し1回)" : "Variant Studio (1 free trial)" },
    { icon: <Save className="h-3 w-3" />,          label: isJa ? "無料アカウントで保存"          : "Save with a free account" },
  ];
  return (
    <div className="mt-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] p-3">
      <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground/70 mb-2 flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-px w-4 bg-foreground/25" />
        {isJa ? "Free でできること" : "Free includes"}
      </p>
      <ul className="grid grid-cols-1 gap-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-[11.5px] text-foreground/80">
            <span aria-hidden className="text-foreground/35">—</span>
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── MockupShrink ──
 * モバイル幅 (<768px) で max-w-3xl/4xl 想定の Mockup を等比縮小して収める。
 * 子の natural width を測って scale を計算し、パディング込みで box を確保する。 */
function MockupShrink({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>("[data-mockup-natural]") || (el.firstElementChild as HTMLElement | null);
    if (!target) return;

    const measure = () => {
      const containerW = el.clientWidth;
      // natural width = mockup の最大幅 (max-w-3xl=768 / max-w-4xl=896)
      const naturalW = target.scrollWidth || target.offsetWidth || containerW;
      const next = Math.min(1, containerW / naturalW);
      setScale(next);
      setInnerH(target.offsetHeight * next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // CLS 抑制: 初回測定前に最小高さを確保しておく (子の natural h ≈ 480 から逆算)
  return (
    <div
      ref={ref}
      className="w-full overflow-hidden"
      style={{
        height: innerH,
        minHeight: innerH ? undefined : 240,
        contain: "layout paint" as React.CSSProperties["contain"],
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${100 / scale}%`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
