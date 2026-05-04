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
  Wrench, Crown, BookOpen, Mail, Smartphone, FileSignature,
  GraduationCap, Save, FileDown,
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

      {/* ━━ HERO (mobile, action-first)
           ファーストビューを「H1 → 1行サブ → 入力 → タップ即送信チップ → 大プライマリ」に圧縮。
           長文サブや target band は CTA の下に降ろし、最初の画面はとにかく「触って試せる」状態に。 */}
      <section className="relative overflow-hidden pt-5 pb-5 px-5">
        <div className={`transition-all duration-700 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h1 className="text-[clamp(1.65rem,7.4vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.025em] mb-2">
            {isJa ? (
              <>
                <HighlightMark>解答付きのプリント</HighlightMark>を、
                <GradientWord>60秒で1枚</GradientWord>。
              </>
            ) : (
              <>
                A <HighlightMark>printable worksheet with answers</HighlightMark> in{" "}
                <GradientWord>60 seconds</GradientWord>.
              </>
            )}
          </h1>
          <p className="text-foreground/75 text-[13.5px] leading-snug mb-3 font-medium">
            {isJa
              ? "数学・理科のトピックを書くだけ。"
              : "Just write a math or science topic."}{" "}
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
              {isJa ? "登録不要で1枚試せます。" : "No sign-up for your first sheet."}
            </span>
          </p>
        </div>

        {/* ── 成果物プレビュー: 「実際に出てくるもの」を H1 直下に配置 ──
             KaTeX や画像を使わず、軽量な div+SVG で Worksheet PDF + Answer Key PDF の
             2枚を並べて「これが60秒で出てくる」を一目で見せる。
             タップでプライマリと同じ動作 (= ゲスト生成へ)。 */}
        <button
          type="button"
          onClick={primaryCta.onClick}
          aria-label={primaryCta.label}
          className={`block w-full text-left mb-4 transition-all duration-700 delay-75 active:scale-[0.99] ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
        >
          <WorksheetPreviewDuo isJa={isJa} />
        </button>

        {/* ── アクション集約: 入力 + サンプルチップ + 巨大プライマリを一塊に ──
             free フローのときだけ展示。タップ→即生成へ。 */}
        {primaryCta.variant === "free" && onPromptSubmit ? (
          <div className={`transition-all duration-700 delay-100 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            <MobilePromptHeroBlock
              isJa={isJa}
              onSubmit={onPromptSubmit}
              ctaLabel={primaryCta.label}
              ctaSubLabel={primaryCta.subLabel}
              onPrimary={primaryCta.onClick}
            />
          </div>
        ) : (
          <div className={`transition-all duration-700 delay-100 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
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

      {/* ━━ Trust + ターゲット帯 — 1 行で圧縮し、ファーストビューを軽くする ━━ */}
      <section className="px-5 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
            <Shield className="h-3 w-3" />{isJa ? "登録不要" : "No signup"}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-foreground/75 font-medium">
            <Zap className="h-3 w-3" />{isJa ? "30〜60秒" : "30–60s"}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-foreground/75 font-medium">
            <Printer className="h-3 w-3" />{isJa ? "印刷OK" : "Print-ready"}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-foreground/75 font-medium">
            <GraduationCap className="h-3 w-3" />{isJa ? "塾・教員向け" : "Tutors & teachers"}
          </span>
        </div>
      </section>

      {/* ━━ モバイル/PC バナー — フル編集は PC 推奨。ファーストビューから外して下に。 ━━ */}
      <section className="px-5 pb-4">
        <div className="flex items-start gap-2.5 rounded-2xl bg-foreground/[0.025] dark:bg-white/[0.03] border border-foreground/[0.08] p-3">
          <div className="h-8 w-8 rounded-full bg-foreground/[0.05] flex items-center justify-center shrink-0">
            <Smartphone className="h-4 w-4 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-foreground/85 mb-0.5">
              {isJa
                ? "モバイル対応 · 編集は PC が快適"
                : "Works on mobile · Best editing experience on desktop"}
            </p>
            <p className="text-[11.5px] text-muted-foreground leading-snug">
              {isJa
                ? "AI チャット + PDF プレビューはモバイルで動きます。図エディタ・採点・OCR などフル編集は PC ブラウザを推奨。"
                : "AI chat + PDF preview work on mobile. Open on a desktop browser for the full editor, figure editor, OCR, and grading."}
            </p>
          </div>
        </div>
      </section>

      {/* ━━ DEMO STRIP (30s editor) — モバイル向けに横スクロールではなく等比縮小 ━━ */}
      <section id="sample-output" className="relative pt-6 pb-10 px-3 overflow-hidden">
        <div className="px-2 mb-5 text-center">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.18em] uppercase mb-2">
            <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
              {isJa ? "30 秒デモ" : "30s Demo"}
            </span>
          </p>
          <h2 className="text-[20px] font-bold tracking-tight mb-2 leading-snug">
            {isJa ? "AIに頼んで、紙面にすぐ反映。" : "Ask the AI. See it on the page."}
          </h2>
          <p className="text-muted-foreground text-[12.5px] leading-relaxed">
            {isJa
              ? "依頼するだけで、印刷できる教材ができあがります。"
              : "Just ask. Get a print-ready worksheet."}
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

        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5 px-3">
          {[
            { icon: <Sparkles className="h-3 w-3" />, label: isJa ? "AI即反映" : "AI instant" },
            { icon: <FileText className="h-3 w-3" />, label: isJa ? "PDF出力" : "PDF" },
            { icon: <Pencil className="h-3 w-3" />, label: isJa ? "直接編集" : "Edit" },
            { icon: <RefreshCw className="h-3 w-3" />, label: isJa ? "類題量産" : "Variants" },
          ].map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.06] text-[10.5px] text-muted-foreground">
              <span className="text-primary/70">{c.icon}</span>{c.label}
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

      {/* ━━ FIGURE DRAW DEMO ━━ */}
      <section className="pt-8 pb-10 px-3 bg-gradient-to-b from-emerald-50/30 to-transparent dark:from-emerald-500/[0.04]">
        <div className="px-2 mb-5 text-center">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.18em] uppercase mb-2">
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              {isJa ? "図形描画モード" : "Figure mode"}
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-extrabold tracking-wider shadow-sm shadow-emerald-500/30">
              <Check className="h-2 w-2" />
              FREE
            </span>
          </p>
          <h2 className="text-[20px] font-bold tracking-tight mb-2 leading-snug">
            {isJa ? "図も、Free で描ける。" : "Draw figures, free."}
          </h2>
          <p className="text-muted-foreground text-[12.5px] leading-relaxed">
            {isJa
              ? "回路 / 力学 / 幾何 / 化学 / 生物 / フローチャート対応。"
              : "Circuits, mechanics, geometry, chemistry, biology, flowcharts."}
          </p>
        </div>

        <IdleMount minHeight="320px">
          <MockupShrink>
            <FigureDrawMockup isJa={isJa} />
          </MockupShrink>
        </IdleMount>
      </section>

      {/* ━━ WHO IS THIS FOR ━━ */}
      <section className="px-5 py-9">
        <h2 className="text-[20px] font-bold tracking-tight mb-4 text-center">
          {isJa ? "こんな方に" : "Built for"}
        </h2>
        <div className="flex flex-col gap-2.5">
          {[
            { gradient: "from-blue-500 to-cyan-500", icon: <BookOpen className="h-4 w-4 text-white" />, title: isJa ? "塾講師" : "Tutors", desc: isJa ? "毎週の確認テストを最短で" : "Weekly quizzes in minutes" },
            { gradient: "from-emerald-500 to-teal-500", icon: <Pencil className="h-4 w-4 text-white" />, title: isJa ? "学校教員" : "Teachers", desc: isJa ? "問題集と解答を一括出力" : "Worksheet + answer key in one go" },
            { gradient: "from-violet-500 to-fuchsia-500", icon: <Wrench className="h-4 w-4 text-white" />, title: isJa ? "教材クリエイター" : "Content creators", desc: isJa ? "TikZ図と数式を綺麗に量産" : "Clean TikZ figures at scale" },
          ].map((p) => (
            <div key={p.title} className="flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-foreground/[0.06]">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center shadow-md shrink-0`}>
                {p.icon}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight mb-0.5">{p.title}</h3>
                <p className="text-[12px] text-muted-foreground leading-snug">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━ 開発者紹介 — Pricing 直前で「誰が作っているか」を見せて信頼感を底上げ ━━ */}
      <section className="px-5 py-8 border-t border-foreground/[0.05] bg-foreground/[0.012]">
        <p className="text-center text-[10.5px] font-bold tracking-[0.22em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-3">
          {isJa ? "開発者について" : "About the developer"}
        </p>
        <h2 className="text-center text-[17px] font-bold tracking-tight mb-4 leading-snug">
          {isJa
            ? "ソフトウェアだけでなく、STEM教材を実際に作ってきた人間が設計。"
            : "Built by someone who creates STEM materials, not just software."}
        </h2>
        <div className="space-y-3 text-[12.5px] leading-relaxed text-foreground/80">
          <p>
            {isJa
              ? "Eddivom は、名古屋大学工学部の学生で、物理の学習教材も自作している森 祐太によって開発されています。"
              : "Eddivom is developed by Yuta Mori, an engineering student at Nagoya University and creator of physics learning materials."}
          </p>
          <p>
            {isJa
              ? "「教材は手早く作れるべき。でもその裏側にある考え方は、ちゃんと残るべき」── そんな信念のもとで作られています。"
              : "The product is built around a simple belief: worksheets should be easy to create, but the reasoning behind them should stay clear."}
          </p>
          <p>
            {isJa
              ? "だから Eddivom は、汎用 AI チャットで終わらせず、数式・解答・印刷可能な PDF・問題単位で編集できるワークフローに集中しています。"
              : "That is why Eddivom focuses on equations, answer keys, printable PDFs, and editable problem-by-problem workflows — not just generic AI chat."}
          </p>
        </div>
      </section>

      {/* ━━ PRICING — 必ず PC 版と同じ PLANS データから派生させる
          (Free / Starter / Pro / Premium の 4 種、価格・特徴は SSOT) ━━ */}
      <section id="pricing" className="px-5 py-9 bg-foreground/[0.015]">
        <div className="text-center mb-5">
          <p className="text-[10.5px] font-bold tracking-[0.22em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-2">
            {isJa ? "料金プラン" : "Pricing"}
          </p>
          <h2 className="text-[20px] font-bold tracking-tight">
            {isJa ? "用途に合わせて選べる" : "Pick what fits"}
          </h2>
          <p className="text-[11.5px] text-muted-foreground/65 mt-1">
            {isJa ? "税込・月額" : "Monthly · tax incl."}
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
            // Premium は紫グラデで差別化、Pro は highlight (PC と同じ扱い)
            const isPremium = planId === "premium";
            const cardClass = highlight
              ? "bg-gradient-to-br from-violet-500/[0.07] to-fuchsia-500/[0.04] border-2 border-violet-500/40 shadow-lg shadow-violet-500/10"
              : isPremium
                ? "bg-gradient-to-br from-amber-500/[0.05] to-rose-500/[0.04] border-2 border-amber-500/30"
                : "bg-card border border-foreground/[0.08]";
            return (
              <button
                key={planId}
                type="button"
                onClick={() => onPlanSelect(planId)}
                className={`relative text-left rounded-2xl p-4 active:scale-[0.99] transition ${cardClass}`}
              >
                {highlight && (
                  <span className="absolute -top-2 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[9.5px] font-extrabold tracking-wider shadow-sm">
                    <Crown className="h-2.5 w-2.5" />
                    {isJa ? (def.badge || "人気 No.1") : "POPULAR"}
                  </span>
                )}
                {isPremium && !highlight && (
                  <span className="absolute -top-2 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[9.5px] font-extrabold tracking-wider shadow-sm">
                    <Crown className="h-2.5 w-2.5" />
                    {isJa ? "教育機関向け" : "ENTERPRISE"}
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
                {tagline && (
                  <p className="text-[11.5px] text-muted-foreground/70 mb-2">{tagline}</p>
                )}
                <ul className="space-y-1.5 mb-2">
                  {items.map((it) => (
                    <li key={it} className="flex items-start gap-1.5 text-[12px] text-foreground/80 leading-snug">
                      <Check className={`h-3 w-3 mt-0.5 shrink-0 ${
                        highlight ? "text-violet-500" : isPremium ? "text-amber-600" : "text-emerald-500"
                      }`} />
                      <span>{it}</span>
                    </li>
                  ))}
                  {features.length > items.length && (
                    <li className="text-[10.5px] text-muted-foreground/55 pl-4.5 ml-3">
                      {isJa
                        ? `他 ${features.length - items.length} 件`
                        : `+${features.length - items.length} more`}
                    </li>
                  )}
                </ul>
                <div className={`flex items-center justify-end gap-1 text-[11.5px] font-semibold ${
                  highlight
                    ? "text-violet-600 dark:text-violet-400"
                    : isPremium
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-foreground/70"
                }`}>
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
      <section className="px-5 py-9">
        <div className="text-center mb-5">
          <p className="text-[10.5px] font-bold tracking-[0.22em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-2">
            {isJa ? "よくある質問" : "FAQ"}
          </p>
          <h2 className="text-[18px] font-bold tracking-tight leading-snug">
            {isJa ? "気になるところに、先にお答え" : "Quick answers"}
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

      {/* ━━ Final CTA ━━ */}
      <section className="px-5 py-10 text-center bg-gradient-to-b from-transparent to-foreground/[0.02]">
        <h2 className="text-[22px] font-bold tracking-tight mb-2 leading-snug">
          {isJa ? (
            <>今すぐ <HighlightMark>1枚</HighlightMark> 作ってみる。</>
          ) : (
            <>Make your <HighlightMark>first sheet</HighlightMark> now.</>
          )}
        </h2>
        <p className="text-[13px] text-muted-foreground mb-5">
          {isJa ? "登録不要・30秒で始められます。" : "No signup · 30 seconds to start."}
        </p>
        <button
          onClick={primaryCta.onClick}
          className="flex items-center justify-center gap-2 w-full h-13 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-white font-bold text-[15px] shadow-xl shadow-violet-500/25 active:scale-[0.98] transition"
        >
          <Sparkles className="h-4 w-4" />
          {primaryCta.label}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-[10.5px] text-muted-foreground/45 mt-3 inline-flex items-center gap-1 justify-center">
          <Monitor className="h-3 w-3" />
          {isJa ? "PC ブラウザだとさらに快適" : "Even better on desktop"}
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
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-white font-bold text-[14.5px] shadow-lg shadow-violet-500/30 active:scale-[0.98] transition"
            aria-label={primaryCta.label}
          >
            <Sparkles className="h-4 w-4" />
            <span>{primaryCta.label}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-1">
            {isJa ? "登録不要 · 30〜60秒で1枚" : "No signup · 30–60s per sheet"}
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
  const placeholder = isJa
    ? "二次方程式の問題を10問、解答付きで"
    : "Create 10 quadratic equation problems with answers";

  const samples = isJa
    ? [
        "中2数学 一次関数の確認テスト10問",
        "高校物理 運動方程式の基本問題",
        "小学生向け 分数の計算プリント",
        "回路の基本クイズ 解説付き",
      ]
    : [
        "10 quadratic equation problems with answers",
        "High school physics: forces and motion quiz",
        "Grade 6 fractions worksheet with answer key",
        "Circuit basics quiz with explanations",
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

      {/* タップ即送信のサンプルチップ — 横スクロール一行で親指の移動を最小化 */}
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 w-max pb-1">
          <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 shrink-0">
            {isJa ? "例：" : "Try:"}
          </span>
          {samples.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSubmit(s)}
              className="text-[11.5px] px-2.5 py-1.5 rounded-full border border-violet-500/25 bg-gradient-to-r from-blue-500/[0.06] to-violet-500/[0.06] text-foreground/85 hover:border-violet-500/45 active:scale-[0.96] transition shrink-0 whitespace-nowrap"
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
      <p className="text-center text-[11px] text-muted-foreground/65">
        {ctaSubLabel}
      </p>
    </div>
  );
}

/* ── 旧 MobilePromptCta は廃止 (MobilePromptHeroBlock に統合) ── */

/* ── Hero 直下: 成果物プレビュー (Worksheet + Answer-key)
 *
 * モバイル幅でも見える「成果物」を出すため、左ページは display 数式 3 問に絞り、
 * 右ページは放物線グラフ + 単位円の図を入れた解答にする。 */
function WorksheetPreviewDuo({ isJa }: { isJa: boolean }) {
  useEffect(() => { ensureKatexCssMobile(); }, []);

  const promptText = isJa ? "高1数学・関数と三角比 解答グラフ付き" : "Algebra & trig with graph answers";

  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-card border border-foreground/[0.1] text-[10.5px] font-medium text-foreground/85 shadow-sm max-w-[58vw]">
          <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
          <span className="truncate">{promptText}</span>
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/55 shrink-0" />
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-blue-500 text-white text-[10px] font-extrabold tracking-wider shadow-md shadow-violet-500/30 shrink-0">
          <Zap className="h-3 w-3" />
          {isJa ? "60秒" : "60s"}
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-2.5" style={{ perspective: "1500px" }}>
        <div aria-hidden className="absolute inset-x-3 -bottom-3 h-8 rounded-[50%] bg-foreground/15 blur-2xl pointer-events-none" />
        <MobilePaperWorksheet isJa={isJa} />
        <MobilePaperAnswerKey isJa={isJa} />
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground/75 font-medium">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-violet-500/25 bg-violet-500/[0.06]">
          <Sparkles className="h-3 w-3 text-violet-500" />
          {isJa ? "タップしてあなたのプリントを作る" : "Tap to generate your own"}
          <ArrowRight className="h-3 w-3 text-violet-500" />
        </span>
      </p>
    </div>
  );
}

function MobilePaperFrame({ children, tilt }: { children: React.ReactNode; tilt: "left" | "right" }) {
  const rotate = tilt === "left" ? "rotateY(4deg) rotate(-1deg)" : "rotateY(-4deg) rotate(1deg)";
  return (
    <div
      className="relative rounded-[3px] bg-white border border-gray-300/80 overflow-hidden text-gray-900"
      style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
        backgroundImage:
          "linear-gradient(to bottom, rgba(250,250,247,1), rgba(255,255,255,1)), repeating-linear-gradient(0deg, rgba(0,0,0,0.014) 0 1px, transparent 1px 22px)",
        backgroundBlendMode: "multiply",
        boxShadow: "0 18px 30px -12px rgba(0,0,0,0.25), 0 4px 8px -4px rgba(0,0,0,0.12)",
        transform: rotate,
        transformOrigin: "center bottom",
      }}
    >
      <div aria-hidden className="absolute top-0 right-0 w-3.5 h-3.5"
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 50%)" }} />
      <div aria-hidden className="absolute top-0 right-0 w-3.5 h-3.5"
        style={{
          clipPath: "polygon(100% 0, 100% 100%, 0 0)",
          background: "linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.13))",
        }} />
      <div aria-hidden className="absolute left-2.5 top-0 bottom-0 w-px bg-rose-300/45" />
      {children}
    </div>
  );
}

function MobilePointsBadge({ pts, isJa }: { pts: string; isJa: boolean }) {
  return (
    <span className="ml-auto inline-flex items-center px-1.5 py-[1px] rounded-full text-[7px] font-extrabold tracking-wider text-white bg-gradient-to-r from-amber-500 to-rose-500 shadow-sm shrink-0"
      style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {pts}{isJa ? "点" : "p"}
    </span>
  );
}

function MobilePaperWorksheet({ isJa }: { isJa: boolean }) {
  return (
    <MobilePaperFrame tilt="left">
      <div className="px-2.5 pt-2">
        <div className="flex items-baseline justify-between text-[7px] tracking-[0.2em] uppercase text-gray-500">
          <span>EDDIVOM</span>
          <span>05·25</span>
        </div>
        <div className="border-t-[1.5px] border-gray-800 mt-0.5" />
        <h3 className="text-center text-[10.5px] font-bold tracking-wide leading-tight pt-1">
          {isJa ? "関数 ・ 三角比" : "Func & Trig"}
        </h3>
        <p className="text-center text-[7.5px] text-gray-500 leading-tight pb-1">
          {isJa ? "次の各問に答えよ。" : "Answer each."}
        </p>
        <div className="border-t border-gray-800" />
        <div className="border-t border-gray-800 mt-[1.5px]" />
      </div>

      <ol className="px-2.5 pt-1.5 pb-2 space-y-2">
        <li>
          <div className="flex items-baseline gap-1">
            <span className="text-[9.5px] font-bold text-gray-700 shrink-0">{isJa ? "問1" : "Q1"}</span>
            <span className="text-[8.5px] text-gray-700 truncate">{isJa ? "最小値を求めよ" : "min?"}</span>
            <MobilePointsBadge pts="30" isJa={isJa} />
          </div>
          <div className="pl-2 mt-0.5"><PreviewMathDisplay latex="f(x)=x^2-6x+11" /></div>
        </li>
        <li>
          <div className="flex items-baseline gap-1">
            <span className="text-[9.5px] font-bold text-gray-700 shrink-0">{isJa ? "問2" : "Q2"}</span>
            <span className="text-[8.5px] text-gray-700 truncate">{isJa ? "値を求めよ" : "evaluate"}</span>
            <MobilePointsBadge pts="30" isJa={isJa} />
          </div>
          <div className="pl-2 mt-0.5"><PreviewMathDisplay latex="\sin\dfrac{\pi}{3}+\cos\dfrac{\pi}{6}" /></div>
        </li>
        <li>
          <div className="flex items-baseline gap-1">
            <span className="text-[9.5px] font-bold text-gray-700 shrink-0">{isJa ? "問3" : "Q3"}</span>
            <span className="text-[8.5px] text-gray-700 truncate">{isJa ? "解け" : "solve"}</span>
            <MobilePointsBadge pts="40" isJa={isJa} />
          </div>
          <div className="pl-2 mt-0.5"><PreviewMathDisplay latex="\log_2(x+1)+\log_2(x-1)=3" /></div>
        </li>
      </ol>

      <div className="px-2.5 pb-1.5 flex justify-end">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] text-[7.5px] font-extrabold tracking-[0.15em] text-white bg-gradient-to-r from-blue-500 to-violet-500 shadow-sm" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <FileText className="h-2 w-2" />{isJa ? "問題 PDF" : "Worksheet"}
        </span>
      </div>
    </MobilePaperFrame>
  );
}

function MobilePaperAnswerKey({ isJa }: { isJa: boolean }) {
  return (
    <MobilePaperFrame tilt="right">
      <div className="px-2.5 pt-2">
        <div className="flex items-baseline justify-between text-[7px] tracking-[0.2em] uppercase text-gray-500">
          <span>EDDIVOM</span>
          <span>{isJa ? "解答" : "ANSWER"}</span>
        </div>
        <div className="border-t-[1.5px] border-gray-800 mt-0.5" />
        <h3 className="text-center text-[10.5px] font-bold tracking-wide leading-tight pt-1">
          {isJa ? "解答 ・ 解説" : "Solutions"}
        </h3>
        <p className="text-center text-[7.5px] text-gray-500 leading-tight pb-1">
          {isJa ? "図入りの完全解答" : "with figures"}
        </p>
        <div className="border-t border-gray-800" />
        <div className="border-t border-gray-800 mt-[1.5px]" />
      </div>

      <ol className="px-2.5 pt-1.5 pb-2 space-y-2">
        <li>
          <div className="flex items-baseline gap-1">
            <span className="text-[9.5px] font-bold text-gray-700 shrink-0">{isJa ? "問1" : "Q1"}</span>
            <span className="overflow-hidden text-[9px]">
              <PreviewMathInline latex="(x-3)^2+2" />
            </span>
            <MobileCorrectMark />
          </div>
          <div className="flex items-center gap-1.5 pl-2 mt-0.5">
            <ParabolaSvgMobile />
            <span className="text-[7.5px] font-semibold text-rose-700 leading-tight">
              {isJa ? "最小=" : "min="}<PreviewMathInline latex="\boxed{2}" />
            </span>
          </div>
        </li>

        <li>
          <div className="flex items-baseline gap-1">
            <span className="text-[9.5px] font-bold text-gray-700 shrink-0">{isJa ? "問2" : "Q2"}</span>
            <span className="overflow-hidden text-[9px]">
              <PreviewMathInline latex="\sqrt{3}" />
            </span>
            <MobileCorrectMark />
          </div>
          <div className="flex items-center gap-1.5 pl-2 mt-0.5">
            <UnitCircleSvgMobile />
            <span className="text-[7.5px] text-gray-700 leading-tight">
              <PreviewMathInline latex="\sin60^\circ=\tfrac{\sqrt3}{2}" />
            </span>
          </div>
        </li>

        {/* Q3: 対数方程式の解説 — 解法ステップ + 数直線図解 */}
        <li>
          <div className="flex items-baseline gap-1">
            <span className="text-[9.5px] font-bold text-gray-700 shrink-0">{isJa ? "問3" : "Q3"}</span>
            <span className="text-[8px] font-semibold tracking-wide text-violet-700">
              {isJa ? "対数" : "log"}
            </span>
            <MobileCorrectMark />
          </div>
          <div className="ml-2 pl-1.5 border-l-2 border-violet-400/60 space-y-0.5 mt-0.5">
            <MobileSolutionStep n={1}>
              <PreviewMathInline latex="x>1" />
              <span className="text-[7px] text-gray-500 ml-0.5">{isJa ? "(真数)" : "(dom)"}</span>
            </MobileSolutionStep>
            <MobileSolutionStep n={2}>
              <PreviewMathInline latex="x^2-1=8" />
            </MobileSolutionStep>
            <MobileSolutionStep n={3}>
              <PreviewMathInline latex="x=\pm 3" />
            </MobileSolutionStep>
          </div>
          <div className="ml-2 mt-1 flex items-center gap-1.5">
            <NumberLineLogDomainMobile />
          </div>
          <div className="ml-2 mt-1 inline-flex items-center gap-1 px-1 py-0.5 rounded bg-gradient-to-r from-amber-100 to-rose-100 border border-rose-300/60">
            <span className="text-[7.5px] font-bold text-rose-800">{isJa ? "答" : "Ans"}</span>
            <PreviewMathInline latex="x=\boxed{3}" />
          </div>
        </li>
      </ol>

      <div className="px-2.5 pb-1.5 flex justify-end">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] text-[7.5px] font-extrabold tracking-[0.15em] text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <FileText className="h-2 w-2" />{isJa ? "解答 PDF" : "Answer key"}
        </span>
      </div>
    </MobilePaperFrame>
  );
}

/* モバイル: 解法ステップの 1 行 */
function MobileSolutionStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 text-[8.5px] leading-snug">
      <span
        className="inline-flex items-center justify-center h-3 w-3 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-[7px] font-extrabold shadow-sm shrink-0"
        style={{ fontFamily: "ui-sans-serif, system-ui" }}
      >
        {n}
      </span>
      <span className="overflow-hidden">{children}</span>
    </div>
  );
}

/* モバイル: 真数条件 x>1 の数直線図解 */
function NumberLineLogDomainMobile() {
  const W = 90, H = 28;
  const xMin = -5, xMax = 5;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const baseY = 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[88px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="domainOKMobile" x1="0" x2="1">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="domainNGMobile" x1="0" x2="1">
          <stop offset="0" stopColor="#f43f5e" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f43f5e" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x={sx(xMin)} y={baseY - 4} width={sx(1) - sx(xMin)} height="8" fill="url(#domainNGMobile)" />
      <rect x={sx(1)} y={baseY - 4} width={sx(xMax) - sx(1)} height="8" fill="url(#domainOKMobile)" />
      <line x1={sx(xMin)} y1={baseY} x2={sx(xMax)} y2={baseY} stroke="#1f2937" strokeWidth="0.8" />
      <polygon points={`${sx(xMax)},${baseY} ${sx(xMax)-2},${baseY-1.2} ${sx(xMax)-2},${baseY+1.2}`} fill="#1f2937" />
      {[-3, 1, 3].map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={baseY - 1.5} x2={sx(t)} y2={baseY + 1.5} stroke="#1f2937" strokeWidth="0.6" />
          <text x={sx(t)} y={baseY + 7} fontSize="4.5" fill="#374151" textAnchor="middle">{t}</text>
        </g>
      ))}
      <circle cx={sx(1)} cy={baseY} r="1.6" fill="white" stroke="#1f2937" strokeWidth="0.8" />
      <circle cx={sx(3)} cy={baseY} r="2" fill="#10b981" stroke="white" strokeWidth="0.6" />
      <circle cx={sx(-3)} cy={baseY} r="2" fill="#f43f5e" stroke="white" strokeWidth="0.6" />
      <line x1={sx(-3) - 1.2} y1={baseY - 1.2} x2={sx(-3) + 1.2} y2={baseY + 1.2} stroke="white" strokeWidth="0.7" />
      <line x1={sx(-3) - 1.2} y1={baseY + 1.2} x2={sx(-3) + 1.2} y2={baseY - 1.2} stroke="white" strokeWidth="0.7" />
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

/* ディスプレイ KaTeX (中央寄せ + やや大きめ) */
function PreviewMathDisplay({ latex }: { latex: string }) {
  const { html, ok } = renderMathHTML(latex, { displayMode: true });
  if (ok) {
    return (
      <div
        className="text-center [&_.katex-display]:m-0 [&_.katex]:text-[0.92em]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <div className="text-center text-gray-700">{latex}</div>;
}

/* 放物線 SVG (モバイル小型) */
function ParabolaSvgMobile() {
  const W = 70, H = 54;
  const xMin = -1, xMax = 7, yMin = -1, yMax = 12;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  const points: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = xMin + (i / 60) * (xMax - xMin);
    const y = (x - 3) * (x - 3) + 2;
    points.push(`${sx(x).toFixed(2)},${sy(y).toFixed(2)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[64px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="parabolaStrokeMobile" x1="0" x2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <pattern id="gridMobile" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#gridMobile)" />
      <line x1={sx(xMin)} y1={sy(0)} x2={sx(xMax)} y2={sy(0)} stroke="#1f2937" strokeWidth="0.6" />
      <line x1={sx(0)} y1={sy(yMin)} x2={sx(0)} y2={sy(yMax)} stroke="#1f2937" strokeWidth="0.6" />
      <polyline points={points.join(" ")} fill="none" stroke="url(#parabolaStrokeMobile)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(3)} cy={sy(2)} r="1.6" fill="#ec4899" stroke="white" strokeWidth="0.7" />
    </svg>
  );
}

/* 単位円 SVG (モバイル小型) */
function UnitCircleSvgMobile() {
  const cx = 28, cy = 28, r = 20;
  const angle = 60 * Math.PI / 180;
  const px = cx + r * Math.cos(angle);
  const py = cy - r * Math.sin(angle);
  return (
    <svg viewBox="0 0 56 56" className="w-[52px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="circleStrokeMobile" x1="0" x2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <line x1="4" y1={cy} x2="52" y2={cy} stroke="#1f2937" strokeWidth="0.6" />
      <line x1={cx} y1="4" x2={cx} y2="52" stroke="#1f2937" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#circleStrokeMobile)" strokeWidth="1.4" />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke="#0ea5e9" strokeWidth="1.2" />
      <line x1={px} y1={py} x2={px} y2={cy} stroke="#ec4899" strokeWidth="0.9" strokeDasharray="1.5 1" />
      <path d={`M ${cx + 7} ${cy} A 7 7 0 0 0 ${cx + 7 * Math.cos(angle)} ${cy - 7 * Math.sin(angle)}`} fill="none" stroke="#f59e0b" strokeWidth="0.8" />
      <circle cx={px} cy={py} r="1.4" fill="#0ea5e9" stroke="white" strokeWidth="0.6" />
    </svg>
  );
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
    { icon: <Sparkles className="h-3 w-3" />,    label: isJa ? "プリントを1枚生成"        : "Generate 1 worksheet" },
    { icon: <Pencil className="h-3 w-3" />,      label: isJa ? "問題を画面で編集"          : "Edit problems on the page" },
    { icon: <FileDown className="h-3 w-3" />,    label: isJa ? "問題プリントを PDF 出力"   : "Export worksheet PDF" },
    { icon: <FileSignature className="h-3 w-3" />, label: isJa ? "解答 PDF を出力"          : "Export answer-key PDF" },
    { icon: <Save className="h-3 w-3" />,        label: isJa ? "無料アカウントで保存"       : "Save with a free account" },
  ];
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-2.5">
      <p className="inline-flex items-center gap-1 text-[10.5px] font-bold tracking-wide text-emerald-700 dark:text-emerald-300 mb-1.5">
        <Check className="h-3 w-3" />
        {isJa ? "Free でできること" : "Free users can do this"}
      </p>
      <ul className="grid grid-cols-1 gap-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-1.5 text-[11.5px] text-foreground/85">
            <span className="text-emerald-600 dark:text-emerald-400">{it.icon}</span>
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
