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
  Play, Monitor, Zap, Shield, Printer, FileText, Pencil, RefreshCw,
  Wrench, Crown, BookOpen, Mail, Smartphone, FileSignature,
} from "lucide-react";
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
  scrollToSample,
  onPlanSelect,
  onPromptSubmit,
}: Props) {
  const { locale, setLocale } = useI18n();
  const isJa = locale !== "en";
  const [heroLoaded, setHeroLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

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

      {/* ━━ HERO (mobile compact) ━━ */}
      <section className="relative overflow-hidden pt-8 pb-6 px-5">
        <div className={`transition-all duration-700 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.08] border border-violet-500/[0.18] mb-3">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent text-[10.5px] font-bold tracking-wide">
              {isJa ? "数学・理科の AI 教材ジェネレーター" : "AI worksheet generator for math and science"}
            </span>
          </div>
          <h1 className="text-[clamp(1.6rem,7vw,2.2rem)] leading-[1.12] font-bold tracking-[-0.025em] mb-3">
            {isJa
              ? "AIで印刷できるプリントを作成。"
              : "Create printable worksheets with AI."}
          </h1>
          <p className="text-foreground/80 text-[14px] leading-relaxed mb-2 font-medium">
            {isJa
              ? "数学・理科の問題を、解答付きPDFで60秒で生成。"
              : "Generate math and science quizzes with answer-key PDFs in 60 seconds."}
          </p>
          <p className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-[12px] font-semibold mb-4">
            <Check className="h-3.5 w-3.5" />
            {isJa
              ? "登録なしで、まず1枚お試し。"
              : "Try 1 sheet for free — no sign-up required."}
          </p>
        </div>

        {/* プロンプト入力 CTA — 未ログイン free フローでのみ出す */}
        {primaryCta.variant === "free" && onPromptSubmit && (
          <div className={`mb-3 transition-all duration-700 delay-100 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            <MobilePromptCta isJa={isJa} onSubmit={onPromptSubmit} />
            <MobileFlowStrip isJa={isJa} />
          </div>
        )}

        {/* CTA buttons — full width, ChatGPT-style mobile
            CVR の「無料」ボタンが画面内で連続するとノイズになるため、free フローでは
            プロンプト入力の "Create" ボタン + 画面下の固定 CTA に役割を集約し、
            ここではセカンダリの「デモを見る」だけ残してリズムを整える。
            ログイン済み (resume / paid-new) はプロンプト CTA を出さないので primary を残す。 */}
        <div className={`flex flex-col gap-2.5 transition-all duration-700 delay-150 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          {primaryCta.variant !== "free" && (
            <button
              onClick={primaryCta.onClick}
              className="group flex items-center justify-center gap-2 w-full h-12 rounded-full bg-foreground text-background font-bold text-[14.5px] shadow-lg shadow-foreground/15 active:scale-[0.98] transition"
            >
              {primaryCta.variant === "resume" && <FileText className="h-4 w-4" />}
              <span>{primaryCta.label}</span>
              <ArrowRight className="h-4 w-4 group-active:translate-x-0.5 transition-transform" />
            </button>
          )}
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

      {/* ━━ モバイル / PC バナー — 「モバイルでも動く」を先に伝えて離脱防止 ━━ */}
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
        <h2 className="text-[20px] font-bold tracking-tight mb-2">
          {isJa ? "今夜中に、最初の1枚を。" : "Your first sheet, tonight."}
        </h2>
        <p className="text-[13px] text-muted-foreground mb-5">
          {isJa ? "30秒で始められます。" : "Set up in 30 seconds."}
        </p>
        <button
          onClick={primaryCta.onClick}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-full bg-foreground text-background font-bold text-[14.5px] shadow-lg shadow-foreground/15 active:scale-[0.98] transition"
        >
          {primaryCta.label}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-[10.5px] text-muted-foreground/45 mt-3 inline-flex items-center gap-1 justify-center">
          <Monitor className="h-3 w-3" />
          {isJa ? "PC ブラウザだとさらに快適" : "Even better on desktop"}
        </p>
      </section>

      {/* ━━ 下部固定 CTA ━━
           CVR 改善: ヒーロー CTA を見逃したユーザがスクロール途中でも戻れるよう、
           常時表示の固定バーを置く。free フロー (= 未ログイン) のときだけ出して、
           ログイン済みは邪魔にならないよう非表示。フッター末尾の余白は本バー分を見越して足す。 */}
      {primaryCta.variant === "free" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 border-t border-foreground/[0.08] bg-background/95 backdrop-blur-md"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          <button
            onClick={primaryCta.onClick}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full bg-foreground text-background font-bold text-[14.5px] shadow-lg shadow-foreground/20 active:scale-[0.98] transition"
            aria-label={primaryCta.label}
          >
            <Sparkles className="h-4 w-4" />
            <span>{primaryCta.label}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 固定 CTA で隠れる分、ページ末尾に下駄を履かせる */}
      {primaryCta.variant === "free" && <div aria-hidden style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }} />}

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

/* ── モバイル: プロンプト入力風 CTA ── */
function MobilePromptCta({ isJa, onSubmit }: { isJa: boolean; onSubmit: (prompt: string) => void }) {
  const [value, setValue] = useState("");
  const placeholder = isJa
    ? "二次方程式の問題を10問、解答付きで作って"
    : "Create 10 quadratic equation problems with answers";
  const submit = () => onSubmit(value);
  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-1.5 p-1.5 pl-3 rounded-2xl border-2 border-foreground/[0.08] bg-card/80 shadow-sm focus-within:border-violet-500/40 transition">
        <Sparkles className="h-3.5 w-3.5 text-violet-500 self-center shrink-0" aria-hidden />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          aria-label={isJa ? "AIに作成内容を伝える" : "Tell the AI what to make"}
          className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/50 text-foreground"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-foreground text-background font-bold text-[14px] shadow-md shadow-foreground/15 active:scale-[0.98] transition"
      >
        {isJa ? "無料で1枚作る" : "Create 1 free worksheet"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── モバイル: Prompt → Worksheet PDF → Answer Key PDF フロー帯 ── */
function MobileFlowStrip({ isJa }: { isJa: boolean }) {
  const items = [
    { icon: <Sparkles className="h-3 w-3" />, label: isJa ? "プロンプト" : "Prompt", tone: "from-blue-500 to-violet-500" },
    { icon: <FileText className="h-3 w-3" />, label: isJa ? "問題 PDF" : "Worksheet", tone: "from-emerald-500 to-teal-500" },
    { icon: <FileSignature className="h-3 w-3" />, label: isJa ? "解答 PDF" : "Answer key", tone: "from-amber-500 to-orange-500" },
  ];
  return (
    <div className="mt-3 flex items-center justify-center gap-1 text-[10.5px] text-muted-foreground">
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.06]">
            <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full bg-gradient-to-br ${it.tone} text-white`}>
              {it.icon}
            </span>
            <span className="font-medium text-foreground/80">{it.label}</span>
          </span>
          {i < items.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" aria-hidden />}
        </React.Fragment>
      ))}
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
