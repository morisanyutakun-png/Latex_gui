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
  Wrench, Crown, BookOpen, Mail,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PLANS, type PlanId } from "@/lib/plans";

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
      </nav>

      {/* ━━ HERO (mobile compact) ━━ */}
      <section className="relative overflow-hidden pt-8 pb-6 px-5">
        <div className={`transition-all duration-700 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.08] border border-violet-500/[0.18] mb-3">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent text-[10.5px] font-bold tracking-wide">
              {isJa ? "AI 教材作成 IDE" : "AI worksheet IDE"}
            </span>
          </div>
          <h1 className="text-[clamp(1.6rem,7vw,2.2rem)] leading-[1.12] font-bold tracking-[-0.025em] mb-3">
            {isJa ? (
              <>
                教材を、<br />
                <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  もっと速く。
                </span>
              </>
            ) : (
              <>
                Worksheets,<br />
                <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
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
        <div className={`flex flex-col gap-2.5 transition-all duration-700 delay-150 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
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
        <MockupShrink>
          <EditorMockup isJa={isJa} />
        </MockupShrink>

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

        <MockupShrink>
          <FigureDrawMockup isJa={isJa} />
        </MockupShrink>
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
        <p className="text-[10px] text-muted-foreground/35 mt-3">
          © {new Date().getFullYear()} Eddivom
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
