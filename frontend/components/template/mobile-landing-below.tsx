"use client";

/**
 * MobileLandingBelow — モバイル LP の "below-the-fold" 全部。
 * ─────────────────────────────────────────────────
 * Hero / nav / PC 推奨バナーは即時 SSR、それ以下のすべてのセクションは
 * このコンポーネントで lazy 読み込みする。
 *  - LCP は Hero テキストになり、TTFB / FCP / LCP が大幅に短縮
 *  - 各セクションを min-height 付きの IntersectionObserver placeholder で囲み、
 *    スクロール接近時にだけ実体を mount → メインスレッド負荷をスクロールに合わせて分散
 *
 * PC 版 LP には一切影響しない (使われない)。
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Sparkles, Check, ChevronRight, ChevronDown,
  Zap, Shield, Printer, FileText, Pencil, RefreshCw,
  Wrench, Crown, BookOpen, Mail, Monitor,
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
  EditorMockup: React.ComponentType<{ isJa: boolean }>;
  FigureDrawMockup: React.ComponentType<{ isJa: boolean }>;
  onPlanSelect: (planId: "free" | "starter" | "pro" | "premium") => void;
}

export function MobileLandingBelow({
  primaryCta,
  EditorMockup,
  FigureDrawMockup,
  onPlanSelect,
}: Props) {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  return (
    <>
      {/* ━━ DEMO STRIP (30s editor) ━━ */}
      <DeferredSection minHeight={520}>
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
              {isJa ? "依頼するだけで、印刷できる教材ができあがります。" : "Just ask. Get a print-ready worksheet."}
            </p>
          </div>
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
      </DeferredSection>

      {/* ━━ TRUST SIGNALS ━━ */}
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
      <DeferredSection minHeight={500}>
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
      </DeferredSection>

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

      {/* ━━ PRICING ━━ */}
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
            const items = features.slice(0, 4);
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
                      {isJa ? `他 ${features.length - items.length} 件` : `+${features.length - items.length} more`}
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

      {/* ━━ FAQ ━━ */}
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
    </>
  );
}

/* ── DeferredSection ──
 * 子コンテンツを IntersectionObserver で「viewport の rootMargin 内に入ったら」
 * mount する。それまでは min-height だけ確保 → CLS なし、メインスレッド負荷の分散 */
function DeferredSection({ children, minHeight }: { children: React.ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            obs.disconnect();
            return;
          }
        }
      },
      { rootMargin: "400px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ minHeight: shown ? undefined : minHeight }}>
      {shown ? children : null}
    </div>
  );
}

/* ── MockupShrink (mobile-landing.tsx と同等) ── */
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

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden"
      style={{ height: innerH, minHeight: innerH ? undefined : 240, contain: "layout paint" as React.CSSProperties["contain"] }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%`, willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}

/* ── FAQ data — app/layout.tsx の FAQPage JSON-LD と完全一致 (8 問) ── */
const FAQ_JA = [
  { q: "AI で問題集を自動生成できますか？", a: "はい。Eddivom はチャットで「二次関数の問題を10題」のように依頼するだけで、AIがLaTeX組版で問題を自動生成します。難易度や範囲・分野・問題数を自然言語で指定でき、生成と同時にPDFプレビューが更新されます。" },
  { q: "解答付きPDFは自動で作成されますか？", a: "はい。問題ページと解答ページがセットになったPDFを自動で書き出します。模範解答だけでなく略解・配点バッジ・解説の有無も指定でき、A4/B5の印刷に最適化されます。" },
  { q: "数学プリント作成ソフトとして無料で使えますか？", a: "無料プランで会員登録なしに利用を開始できます。AI生成回数とPDF出力数に上限がありますが、数式・図・化学式の組版や直接編集は無料プランでも利用できます。" },
  { q: "Overleaf との違いは何ですか？", a: "Overleafは汎用LaTeXエディタですが、Eddivomは教材作成に特化したIDEです。AIによる問題自動生成・類題量産・解答付きPDFの自動構成・採点など、Overleafにはない教材作成専用フローを最初から備えています。日本語UIと日本語フォント (haranoaji) も初期設定済みです。" },
  { q: "1つの問題から類題を自動で量産できますか？", a: "はい。既存の問題にカーソルを当てて「類題を5問」と依頼すると、係数や設定を変えた類題をAIが生成します。難易度を一段上げる・下げるといった指示にも対応しています。" },
  { q: "高校数学の確認テストや塾の教材作成にも使えますか？", a: "はい。共通テスト風レイアウト・国公立二次風・学校用テスト・問題集など、高校数学の確認テスト作成や塾の教材作成に最適化されたテンプレートを多数収録しています。配点バッジや大問ボックスなど、紙に印刷したときに読みやすい体裁を初期設定で実現します。" },
  { q: "ルーブリック採点機能はどう使いますか？", a: "Pro プランでは、答案画像をアップロードするとAIが採点項目ごとに○×と部分点を提案します。採点基準 (ルーブリック) は教員が編集でき、最終的な点数調整は人が行えます。OMR (マークシート) 採点も同じ画面から実行可能です。" },
  { q: "既存のPDFや画像から問題を取り込めますか？", a: "はい。OCR機能で既存のテストPDFや教科書画像を読み取り、数式を含めてLaTeXに変換します。読み取った内容をベースに、Eddivom内で類題量産や解答生成までシームレスに行えます。" },
];
const FAQ_EN = [
  { q: "Can AI generate practice problems automatically?", a: "Yes. Just ask in chat — “10 quadratic equation problems, harder difficulty.” Eddivom generates problems in LaTeX and updates the PDF preview live. You can specify topic, difficulty, count, and scope in plain language." },
  { q: "Are answer-key PDFs generated automatically?", a: "Yes. Eddivom exports a paired PDF with the worksheet and a separate answer key. You can choose between full solutions, brief answers, point-value badges, and explanation toggles. Output is print-ready for A4/B5." },
  { q: "Is it free to use as a math worksheet maker?", a: "Yes — the free plan needs no signup. AI generations and PDF exports are quota-limited, but math/diagram/chemistry typesetting and direct editing are fully available on the free tier." },
  { q: "How is this different from Overleaf?", a: "Overleaf is a general-purpose LaTeX editor; Eddivom is an IDE built specifically for worksheet creation. AI problem generation, variant multiplication, answer-key composition, and grading flows are first-class — none of which exist in Overleaf. Japanese UI and Japanese fonts (haranoaji) are preconfigured." },
  { q: "Can it generate variants from one problem?", a: "Yes. Place the cursor on an existing problem and ask for “5 variants” — the AI rewrites coefficients and parameters while preserving structure. You can also tell it to nudge difficulty up or down." },
  { q: "Is it suitable for high-school quizzes and tutor worksheets?", a: "Yes. We ship templates tuned for Japanese national exam style, university second-stage exam style, in-class quizzes, and problem sets. Point-value badges and big-question frames render cleanly on paper out of the box." },
  { q: "How does the rubric grading feature work?", a: "On the Pro plan you upload student answer images and the AI scores each rubric item with partial credit. Teachers edit the rubric and make the final call. OMR (multiple-choice bubble) grading is supported from the same screen." },
  { q: "Can it import problems from an existing PDF or image?", a: "Yes. OCR reads existing exam PDFs and textbook images and converts them — equations included — into LaTeX. From there you can generate variants and answer keys without leaving Eddivom." },
];
