"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { createDefaultDocument } from "@/lib/types";
import { loadFromLocalStorage } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Sparkles,
  Printer,
  BookOpen,
  CheckSquare,
  Upload,
  Copy,
  Code2,
  ChevronDown,
} from "lucide-react";

/* ── Scrolling background — math problems, not LaTeX code ── */
const SCROLL_ITEMS_A = [
  "二次方程式 x²+3x-4=0 を解け",
  "∫₀^π sin x dx を計算せよ",
  "三角形ABCでAB=5, BC=7, CA=6のとき面積を求めよ",
  "lim_{x→0} (sin x)/x の値を求めよ",
  "行列 A = [[1,2],[3,4]] の逆行列を求めよ",
  "微分方程式 dy/dx = 2y を解け",
  "cos 75° の値を求めよ",
  "数列 {aₙ}: a₁=2, aₙ₊₁=3aₙ の一般項を求めよ",
  "ベクトル a=(1,2,3), b=(4,5,6) の内積を求めよ",
  "円 x²+y²=25 と直線 y=x+1 の交点を求めよ",
];

const SCROLL_ITEMS_B = [
  "次の英文を和訳せよ: The quick brown fox…",
  "化学反応式を完成させよ: H₂ + O₂ → ?",
  "ニュートンの運動方程式 F = ma を用いて…",
  "地球の公転周期を求めよ（ケプラーの法則）",
  "オームの法則: V = IR を用いて抵抗を求めよ",
  "DNA二重らせん構造の塩基対を答えよ",
  "光の速さを c として波長 λ と振動数 f の関係を示せ",
  "熱力学第一法則 ΔU = Q - W を説明せよ",
  "次の連立方程式を解け: 2x+y=5, x-y=1",
  "確率: コインを3回投げて表が2回出る確率は？",
];

/* ── Scroll column ── */
function ScrollColumn({
  items, speed, direction, className,
}: {
  items: string[]; speed: number; direction: "up" | "down"; className?: string;
}) {
  const tripled = [...items, ...items, ...items];
  return (
    <div className={`scroll-column-mask relative overflow-hidden ${className}`}>
      <div
        className={`flex flex-col gap-3 ${direction === "up" ? "animate-scroll-up" : "animate-scroll-down"}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {tripled.map((item, i) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-foreground/[0.025] dark:bg-white/[0.03] border border-foreground/[0.04] dark:border-white/[0.05]">
            <p className="text-[10px] font-medium text-foreground/15 dark:text-white/12 whitespace-nowrap leading-relaxed select-none">
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Intersection Observer fade-in ── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); observer.unobserve(el); } },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return { ref, isVisible };
}

/* ── Step card for workflow section ── */
function StepCard({ num, icon, title, desc, color }: {
  num: string; icon: React.ReactNode; title: string; desc: string; color: string;
}) {
  return (
    <div className="relative flex flex-col items-start gap-3 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-foreground/[0.06] hover:border-foreground/[0.12] hover:shadow-lg transition-all duration-400 group">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-300 ${color}`}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground/40 font-bold tracking-wider">{num}</span>
          <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);

  const workflowFade = useFadeIn(0);
  const featuresFade = useFadeIn(0);
  const powerFade = useFadeIn(0);
  const ctaFade = useFadeIn(0);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleStart = () => {
    const doc = createDefaultDocument("blank", []);
    setDocument(doc);
    router.push("/editor");
  };

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) { setDocument(doc); router.push("/editor"); }
  };

  const { locale } = useI18n();
  const saved = typeof window !== "undefined" ? loadFromLocalStorage() : null;

  const isJa = locale !== "en";

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ━━ Navigation ━━ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-foreground/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-12">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white text-[10px] font-bold tracking-tighter leading-none">Lx</span>
            </div>
            <span className="text-[14px] font-semibold tracking-tight">
              {isJa ? "かんたん教材メーカー" : "Easy Worksheet Maker"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ━━ Hero ━━ */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        {/* Ambient */}
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[140%] h-[60%] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.07),transparent_70%)]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-[radial-gradient(ellipse_at_center,hsl(260_80%_60%/0.04),transparent_70%)]" />
          <div className="absolute inset-0 opacity-[0.012] dark:opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Scrolling math problems background */}
        <div className="absolute inset-0 flex justify-between px-2 sm:px-6 pointer-events-none">
          <ScrollColumn items={SCROLL_ITEMS_A} speed={50} direction="up" className="w-28 sm:w-40 lg:w-56 opacity-70 sm:opacity-100" />
          <ScrollColumn items={SCROLL_ITEMS_B} speed={60} direction="down" className="w-40 lg:w-56 hidden md:block opacity-70" />
          <ScrollColumn items={SCROLL_ITEMS_A.slice(5)} speed={55} direction="up" className="w-40 lg:w-56 hidden md:block opacity-60" />
          <ScrollColumn items={SCROLL_ITEMS_B.slice(5)} speed={45} direction="down" className="w-28 sm:w-40 lg:w-56 opacity-70 sm:opacity-100" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 pt-20">
          <div className={`transition-all duration-1000 ease-out ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/[0.07] dark:bg-primary/[0.12] border border-primary/[0.10] mb-8">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary text-[12px] font-semibold tracking-wide">
                {isJa ? "教師・塾講師・受験生のための教材ツール" : "Worksheets made simple"}
              </span>
            </div>

            <h1 className="text-[clamp(2.6rem,6.5vw,5rem)] leading-[1.05] font-bold tracking-[-0.03em] mb-6">
              <span className="block">
                {isJa ? "教材を、" : "Make worksheets,"}
              </span>
              <span className="bg-gradient-to-r from-blue-600 via-violet-500 to-fuchsia-500 dark:from-blue-400 dark:via-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                {isJa ? "もっと速く。" : "insanely fast."}
              </span>
            </h1>

            <p className="text-muted-foreground text-[17px] sm:text-[18px] leading-relaxed max-w-xl mx-auto mb-10 font-light">
              {isJa
                ? "AIが問題を生成し、類題を量産し、解答付きPDFを自動で作成。\nWordのように編集して、そのまま印刷できます。"
                : "AI generates problems, creates variants, and auto-builds answer-key PDFs.\nEdit like Word, print immediately."}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <button
                onClick={handleStart}
                className="group flex items-center gap-3 px-8 py-4 rounded-full bg-foreground text-background font-semibold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "無料で始める" : "Start free"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              {saved && (
                <button
                  onClick={handleResume}
                  className="group flex items-center gap-3 px-7 py-4 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  {locale === "en"
                    ? `Resume "${saved.metadata.title || "Untitled"}"`
                    : `「${saved.metadata.title || "無題"}」を続ける`}
                  <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
            </div>

            <p className="text-[12px] text-muted-foreground/40">
              {isJa ? "クレジットカード不要 · 登録不要" : "No signup required"}
            </p>
          </div>

          {/* Scroll indicator */}
          <div className={`mt-14 transition-all duration-1000 delay-500 ${heroLoaded ? "opacity-100" : "opacity-0"}`}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
              <span className="text-[10px] tracking-widest uppercase">Scroll</span>
              <div className="w-px h-8 bg-gradient-to-b from-muted-foreground/20 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━ Outcome stats ━━ */}
      <section className="relative border-y border-foreground/[0.04] bg-foreground/[0.01] dark:bg-white/[0.015]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: isJa ? "30秒" : "30s", label: isJa ? "問題を生成" : "to generate" },
              { value: isJa ? "AI" : "AI", label: isJa ? "類題を量産" : "problem variants" },
              { value: isJa ? "自動" : "Auto", label: isJa ? "解答PDF生成" : "answer key PDF" },
              { value: isJa ? "即印刷" : "Print", label: isJa ? "A4/B5対応" : "A4/B5 ready" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                  {s.value}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1 tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Workflow — How it works ━━ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,hsl(var(--primary)/0.03),transparent_70%)]" />
        <div
          ref={workflowFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${workflowFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              {isJa ? "使い方" : "How it works"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "5ステップで教材完成。" : "From idea to print in 5 steps."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa
                ? "AIと一緒に、問題を作ってPDFに変えるまでの流れ。"
                : "The end-to-end flow from creating problems to printing PDFs."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-3">
            <StepCard
              num="01"
              icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "問題を作る" : "Create problems"}
              desc={isJa ? "AIに話しかけるだけ。「二次方程式を5問」で即完成" : "Just ask AI — \"5 quadratic equations\" and you're done"}
              color="bg-gradient-to-br from-violet-500 to-fuchsia-500"
            />
            <StepCard
              num="02"
              icon={<Upload className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "PDFを取り込む" : "Import a PDF"}
              desc={isJa ? "既存の教材PDFをAIが解析。問題を自動で抽出・編集" : "AI reads your existing PDFs and extracts problems"}
              color="bg-gradient-to-br from-blue-500 to-cyan-500"
            />
            <StepCard
              num="03"
              icon={<Copy className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "類題を出す" : "Generate variants"}
              desc={isJa ? "「類題を10問」と頼むだけで即量産。難易度も調整可" : "\"Make 10 variants\" — AI generates them instantly"}
              color="bg-gradient-to-br from-emerald-500 to-teal-500"
            />
            <StepCard
              num="04"
              icon={<CheckSquare className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "解答付きPDF" : "Answer key PDF"}
              desc={isJa ? "ワンクリックで解答・解説付きのPDFを自動生成" : "One click to auto-generate a full answer-key PDF"}
              color="bg-gradient-to-br from-amber-500 to-orange-500"
            />
            <StepCard
              num="05"
              icon={<Printer className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "印刷する" : "Print"}
              desc={isJa ? "A4/B5対応、美しい組版で即印刷。配布用に最適" : "A4/B5, perfect typesetting, ready to distribute"}
              color="bg-gradient-to-br from-slate-500 to-gray-600"
            />
          </div>

          <div className="text-center mt-10">
            <button
              onClick={handleStart}
              className="group inline-flex items-center gap-3 px-9 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-[14px] shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              {isJa ? "今すぐ試してみる" : "Try it now"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </section>

      {/* ━━ Features — outcome-based ━━ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

        <div
          ref={featuresFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${featuresFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">Features</p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "教材作成のすべてが、ここに。" : "Everything for worksheet creation."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa ? "LaTeXの知識は不要。直感的に使えて、プロ品質の仕上がり。" : "No LaTeX knowledge needed. Intuitive to use, professional results."}
            </p>
          </div>

          {/* Big 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            {[
              {
                icon: <Sparkles className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-violet-500 to-fuchsia-500",
                title: isJa ? "AIが問題を生成" : "AI problem generation",
                desc: isJa
                  ? "「数学の二次関数の問題を難易度別に3問」と話すだけ。数学・英語・理科・社会の問題を瞬時に作成します。"
                  : "Just say \"3 quadratic function problems by difficulty.\" Math, English, science — generated instantly.",
              },
              {
                icon: <BookOpen className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-emerald-500 to-teal-500",
                title: isJa ? "既存PDFを取り込んで編集" : "Import & edit PDFs",
                desc: isJa
                  ? "塾のテキストや過去問PDFをアップロードすると、AIが問題を解析。そのまま編集・流用できます。"
                  : "Upload textbook or past-exam PDFs. AI extracts and edits problems for reuse.",
              },
              {
                icon: <Copy className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-blue-500 to-cyan-500",
                title: isJa ? "類題を即量産" : "Instant problem variants",
                desc: isJa
                  ? "気に入った問題に「類題を5問」と頼めば、数値・難易度を変えたバリエーションを自動生成します。"
                  : "Ask for \"5 variants\" of any problem. AI adjusts numbers and difficulty automatically.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative p-7 rounded-[20px] bg-card/60 backdrop-blur-xl border border-foreground/[0.05] hover:border-foreground/[0.1] hover:shadow-xl transition-all duration-500"
              >
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 text-white shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-500`}>
                  {f.icon}
                </div>
                <h4 className="text-[15px] font-semibold mb-2 tracking-tight">{f.title}</h4>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Smaller 3 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <CheckSquare className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-amber-500 to-orange-500",
                title: isJa ? "解答付きPDFを自動生成" : "Auto answer-key PDF",
                desc: isJa ? "生徒用・教師用の2種類のPDFをワンクリックで書き出し。" : "Export student and teacher versions in one click.",
              },
              {
                icon: <Printer className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-slate-500 to-zinc-500",
                title: isJa ? "A4/B5 そのまま印刷" : "Print-ready A4/B5",
                desc: isJa ? "LaTeX品質の組版でプロ仕上がり。余白・フォントも自由に調整。" : "LaTeX-quality typesetting, fully customizable margins and fonts.",
              },
              {
                icon: <FileText className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-pink-500 to-rose-500",
                title: isJa ? "Word感覚で編集" : "Edit like Word",
                desc: isJa ? "クリックして即タイプ。数式もタブキーで自然に入力できます。" : "Click and type. Math entry with Tab key feels natural.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative p-6 rounded-[18px] bg-card/50 backdrop-blur-xl border border-foreground/[0.05] hover:border-foreground/[0.1] hover:shadow-lg transition-all duration-500"
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 text-white shadow-md group-hover:scale-110 transition-all duration-500`}>
                  {f.icon}
                </div>
                <h4 className="text-[13px] font-semibold mb-1.5 tracking-tight">{f.title}</h4>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Power-user reveal (collapsed by default) ━━ */}
      <section className="relative py-12 border-t border-foreground/[0.04]">
        <div
          ref={powerFade.ref}
          className={`relative max-w-3xl mx-auto px-6 transition-all duration-1000 ${powerFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <button
            onClick={() => setPowerOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-foreground/[0.02] dark:bg-white/[0.03] border border-foreground/[0.05] hover:border-foreground/[0.1] transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center shadow">
                <Code2 className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold tracking-tight">
                  {isJa ? "上級者向け — LaTeXを直接触れる" : "Power users — direct LaTeX access"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isJa ? "LaTeX・回路図・化学式・カスタムパッケージにも対応" : "LaTeX, circuits, chemistry, custom packages — all supported"}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-300 ${powerOpen ? "rotate-180" : ""}`} />
          </button>

          <div className={`overflow-hidden transition-all duration-500 ${powerOpen ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1">
              {[
                { label: isJa ? "LaTeX直接編集" : "Direct LaTeX edit", icon: "{ }" },
                { label: isJa ? "回路図 (TikZ)" : "Circuits (TikZ)", icon: "⚡" },
                { label: isJa ? "化学式" : "Chemistry", icon: "⚗" },
                { label: isJa ? "カスタムパッケージ" : "Custom packages", icon: "📦" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-foreground/[0.02] border border-foreground/[0.04] text-center">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground/40 mt-4 px-4">
              {isJa
                ? "知らなくても使える。知っていればもっと自由。"
                : "You don't need to know it. But if you do, you'll love it."}
            </p>
          </div>
        </div>
      </section>

      {/* ━━ CTA ━━ */}
      <section className="relative py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(var(--primary)/0.04),transparent_70%)]" />
        <div
          ref={ctaFade.ref}
          className={`relative max-w-2xl mx-auto text-center px-6 transition-all duration-1000 ${ctaFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-5">
            {isJa ? "今日の授業プリント、\nもう悩まない。" : "No more struggling with worksheets."}
          </h2>
          <p className="text-muted-foreground text-[15px] mb-10 max-w-md mx-auto leading-relaxed whitespace-pre-line">
            {isJa
              ? "AIに話しかけるだけで教材が完成。\nまずは無料でお試しください。"
              : "Just talk to AI. Your worksheet builds itself.\nStart free, no signup needed."}
          </p>
          <button
            onClick={handleStart}
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-[15px] shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            {isJa ? "無料で始める" : "Start free"}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
          <p className="mt-4 text-[11px] text-muted-foreground/40">
            {isJa ? "クレジットカード不要" : "No credit card required"}
          </p>
        </div>
      </section>

      {/* ━━ Footer ━━ */}
      <footer className="border-t border-foreground/[0.05] py-10 text-center">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold tracking-tighter">Lx</span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight opacity-60">
              {isJa ? "かんたん教材メーカー" : "Easy Worksheet Maker"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/30 tracking-wide">
            Powered by LuaLaTeX, TikZ & Claude AI
          </p>
        </div>
      </footer>
    </div>
  );
}
