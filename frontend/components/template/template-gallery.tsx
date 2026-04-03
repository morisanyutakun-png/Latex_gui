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
  PenLine,
  GraduationCap,
  Users,
  RefreshCw,
  FileDown,
  Layers,
  Pencil,
} from "lucide-react";

/* ── Scrolling background — worksheet problems (bilingual) ── */
const SCROLL_ITEMS_A = [
  "Solve x² + 3x - 4 = 0",
  "二次方程式 x²+3x-4=0 を解け",
  "Find the slope through (2, 3) and (5, 9)",
  "三角形ABCの面積を求めよ",
  "Simplify √(48) + √(27)",
  "連立方程式を解け: 2x+y=5, x-y=1",
  "Factor 6x² - 7x - 3",
  "確率: コインを3回投げて表が2回出る確率は？",
  "Find m∠ABC if △ABC is isosceles",
  "Graph y = 2(x − 3)² + 1",
];

const SCROLL_ITEMS_B = [
  "Worksheet: Quadratic Equations (20 problems)",
  "小テスト: 二次関数の基本（10問）",
  "Quiz: Systems of Linear Equations",
  "演習プリント: 三角比の応用",
  "Assessment: Polynomial Operations",
  "確認テスト: 微分の計算",
  "Practice Set: Solving Proportions",
  "宿題プリント: 図形の証明（5問）",
  "Exit Ticket: Solving Inequalities",
  "Unit Test: Congruent Triangles",
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

/* ── Editor Workspace Mockup — 実際のアプリに合わせた2ペイン+アクティビティバー ── */
function EditorMockup({ isJa }: { isJa: boolean }) {
  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-2xl border border-foreground/[0.08] bg-card/80 backdrop-blur-xl shadow-2xl shadow-foreground/[0.04] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-foreground/[0.06] bg-foreground/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
        </div>
        <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center ml-2">
          <span className="text-white text-[7px] font-bold">Ed</span>
        </div>
        <span className="text-[11px] text-muted-foreground/50 font-medium">Eddivom</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            {isJa ? "PDF出力" : "Export PDF"}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
            {isJa ? "印刷" : "Print"}
          </span>
        </div>
      </div>

      {/* 2-pane + activity bar */}
      <div className="flex min-h-[300px] sm:min-h-[340px]">
        {/* ━━ Left: 紙面エディタ (コンパイル済みPDF表示) ━━ */}
        <div className="flex-1 bg-gray-50/50 dark:bg-gray-950/30 p-4 flex justify-center overflow-hidden">
          {/* PDF紙面 */}
          <div className="bg-white dark:bg-white/[0.97] rounded shadow-lg border border-gray-200/60 dark:border-gray-700/40 w-full max-w-[320px] p-5 space-y-3">
            {/* タイトル */}
            <div className="text-center space-y-1 pb-2 border-b border-gray-100 dark:border-gray-300/30">
              <div className="h-2.5 w-3/4 bg-gray-800 dark:bg-gray-700 rounded-full mx-auto" />
              <div className="h-1.5 w-1/2 bg-gray-300 dark:bg-gray-400 rounded-full mx-auto" />
            </div>
            {/* 問題1 */}
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-600 mt-0.5">1.</span>
                <div className="flex-1 space-y-1">
                  <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-full" />
                  <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-4/5" />
                </div>
              </div>
              <div className="ml-4 bg-gray-50 dark:bg-gray-100 rounded px-2 py-1.5 text-center">
                <span className="text-[11px] font-medium text-gray-600 font-mono">2x² − 5x + 3 = 0</span>
              </div>
            </div>
            {/* 問題2 */}
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-600 mt-0.5">2.</span>
                <div className="flex-1 space-y-1">
                  <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-full" />
                  <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-3/5" />
                </div>
              </div>
              <div className="ml-4 bg-gray-50 dark:bg-gray-100 rounded px-2 py-1.5 text-center">
                <span className="text-[11px] font-medium text-gray-600 font-mono">x² + 4x − 12 = 0</span>
              </div>
            </div>
            {/* 問題3 */}
            <div className="flex items-start gap-2">
              <span className="text-[9px] font-bold text-gray-700 dark:text-gray-600 mt-0.5">3.</span>
              <div className="flex-1 space-y-1">
                <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-full" />
                <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-2/3" />
                <div className="h-1 bg-gray-200 dark:bg-gray-300 rounded-full w-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* ━━ Right: AI チャットサイドバー ━━ */}
        <div className="w-[200px] sm:w-[240px] border-l border-foreground/[0.06] flex flex-col bg-foreground/[0.01]">
          {/* パネルヘッダー */}
          <div className="px-3 py-2 border-b border-foreground/[0.06] flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-violet-500" />
            </div>
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">AI Assistant</span>
          </div>
          {/* チャット履歴 */}
          <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
            {/* ユーザーメッセージ */}
            <div className="flex justify-end">
              <div className="bg-primary/[0.08] rounded-xl rounded-tr-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-foreground/70 leading-relaxed">
                  {isJa ? "二次方程式の練習問題を5問作って" : "Make 5 quadratic equation problems"}
                </p>
              </div>
            </div>
            {/* AIレスポンス */}
            <div className="flex justify-start">
              <div className="bg-foreground/[0.03] rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-foreground/60 leading-relaxed">
                  {isJa ? "5問作成しました。紙面に反映しています。" : "Done — 5 problems added to your worksheet."}
                </p>
                <div className="flex gap-1 mt-1.5">
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                    {isJa ? "✓ 反映済み" : "✓ Applied"}
                  </span>
                </div>
              </div>
            </div>
            {/* 2回目のユーザーメッセージ */}
            <div className="flex justify-end">
              <div className="bg-primary/[0.08] rounded-xl rounded-tr-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-foreground/70 leading-relaxed">
                  {isJa ? "もう少し難しくして" : "Make them a bit harder"}
                </p>
              </div>
            </div>
          </div>
          {/* 入力欄 */}
          <div className="p-2 border-t border-foreground/[0.06]">
            <div className="flex items-center gap-1.5 bg-foreground/[0.03] rounded-lg px-2.5 py-1.5 border border-foreground/[0.05]">
              <span className="text-[9px] text-muted-foreground/30 flex-1 truncate">
                {isJa ? "指示を入力…" : "Type a prompt…"}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/20" />
            </div>
          </div>
        </div>

        {/* ━━ Activity Bar (far right) ━━ */}
        <div className="w-8 border-l border-foreground/[0.06] bg-foreground/[0.02] flex flex-col items-center py-2 gap-2">
          <div className="w-5 h-5 rounded bg-violet-500/15 flex items-center justify-center border-l-2 border-violet-500">
            <Sparkles className="h-3 w-3 text-violet-500" />
          </div>
          <div className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60">
            <Code2 className="h-3 w-3" />
          </div>
          <div className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 relative">
            <PenLine className="h-3 w-3" />
          </div>
          <div className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60">
            <BookOpen className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Persona card ── */
function PersonaCard({ icon, title, desc }: {
  icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-card/50 backdrop-blur-sm border border-foreground/[0.06] hover:border-foreground/[0.10] transition-all duration-300">
      <div className="h-10 w-10 rounded-xl bg-primary/[0.08] flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="text-[14px] font-semibold tracking-tight mb-1">{title}</h4>
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

  const personaFade = useFadeIn(0);
  const mockupFade = useFadeIn(0);
  const workflowFade = useFadeIn(0);
  const featuresFade = useFadeIn(0);
  const diffFade = useFadeIn(0);
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
              <span className="text-white text-[10px] font-bold tracking-tighter leading-none">Ed</span>
            </div>
            <span className="text-[15px] font-bold tracking-tight">
              Eddivom
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

        {/* Scrolling background */}
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
                Eddivom — {isJa ? "数式がきれいな教材を、自分の手で" : "math worksheets that just work"}
              </span>
            </div>

            <h1 className="text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.08] font-bold tracking-[-0.03em] mb-6">
              <span className="block">
                {isJa ? "教材を、もっと速く" : "Your worksheets,"}
              </span>
              <span className="bg-gradient-to-r from-blue-600 via-violet-500 to-fuchsia-500 dark:from-blue-400 dark:via-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                {isJa ? "もっときれいに。" : "done right."}
              </span>
            </h1>

            <p className="text-muted-foreground text-[16px] sm:text-[18px] leading-relaxed max-w-xl mx-auto mb-10 font-light">
              {isJa
                ? "Eddivom なら、PDFを取り込んで問題ごとに編集。\n類題を一瞬で増やし、解答付きPDFですぐ配布。"
                : "Eddivom turns your PDFs into editable problems.\nGenerate variants. Export with answer keys. Equations always look perfect."}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <button
                onClick={handleStart}
                className="group flex items-center gap-3 px-8 py-4 rounded-full bg-foreground text-background font-semibold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "Eddivom を無料で試す" : "Try Eddivom free"}
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
              {isJa ? "登録不要 · クレジットカード不要 · 30秒で最初の1枚" : "No signup · No credit card · First worksheet in 30 seconds"}
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

      {/* ━━ Who is this for ━━ */}
      <section className="relative border-y border-foreground/[0.04] bg-foreground/[0.01] dark:bg-white/[0.015] py-20">
        <div
          ref={personaFade.ref}
          className={`relative max-w-4xl mx-auto px-6 transition-all duration-1000 ${personaFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-12">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              {isJa ? "Eddivom はこんな方に" : "Who uses Eddivom"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "教材を自分で作る、すべての先生へ。" : "For math educators who make their own worksheets."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "演習プリント・小テスト・宿題・模試。自分で作るからこそ、速く作りたい。"
                : "Algebra, geometry, precalc — whether for your classes or for sale. Eddivom makes the build-part fast."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PersonaCard
              icon={<BookOpen className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "テスト対策・教材制作" : "Worksheet Creators & Sellers"}
              desc={isJa
                ? "問題集やドリルを作って配布・販売する方。印刷品質のPDFを大量に。"
                : "Build algebra, geometry, and more to sell or share. Reuse past materials, spin up variants, and export print-ready PDFs with answer keys."}
            />
            <PersonaCard
              icon={<Users className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "学校の教科担当" : "Math & STEM Teachers"}
              desc={isJa
                ? "授業用プリント・小テスト・定期テストを効率よく作成。解答付きPDFで採点も楽に。"
                : "Create worksheets, quizzes, and assessments for your classes. Answer-key PDFs make grading painless."}
            />
            <PersonaCard
              icon={<GraduationCap className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "個人塾・家庭教師" : "Tutors & Test Prep"}
              desc={isJa
                ? "生徒に合わせたオリジナル教材を毎週作る先生。過去問の再利用や類題の量産に。"
                : "Custom problem sets for each student. Generate fresh variants to keep practice materials from going stale."}
            />
          </div>
        </div>
      </section>

      {/* ━━ Editor Workspace Mockup ━━ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.04),transparent_70%)]" />
        <div
          ref={mockupFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${mockupFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-12">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              {isJa ? "Eddivom のワークスペース" : "The Eddivom workspace"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "AIに頼んで、紙面にすぐ反映。" : "Tell the AI what you need. See it on the page."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "AIに指示を出すと、コンパイル済みのPDFが紙面にそのまま表示。\n数式も図もきれいに組版された状態で、直接編集できます。"
                : "Type a prompt, and Eddivom renders the finished PDF right on the page.\nEquations and layout are print-ready. Edit anything directly."}
            </p>
          </div>

          <EditorMockup isJa={isJa} />

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {[
              { icon: <Sparkles className="h-3.5 w-3.5" />, label: isJa ? "AIに指示→即反映" : "Prompt AI → instant result" },
              { icon: <FileText className="h-3.5 w-3.5" />, label: isJa ? "コンパイル済みPDF表示" : "Compiled PDF on page" },
              { icon: <Pencil className="h-3.5 w-3.5" />, label: isJa ? "紙面を直接編集" : "Edit directly on page" },
              { icon: <RefreshCw className="h-3.5 w-3.5" />, label: isJa ? "類題を一瞬で量産" : "Variants in one click" },
            ].map((chip) => (
              <div key={chip.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.03] border border-foreground/[0.06] text-[11px] text-muted-foreground">
                {chip.icon}
                {chip.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Outcome stats ━━ */}
      <section className="relative border-y border-foreground/[0.04] bg-foreground/[0.01] dark:bg-white/[0.015]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-center text-[11px] font-semibold tracking-[0.15em] uppercase text-primary/60 mb-6">
            {isJa ? "Eddivom なら" : "With Eddivom"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: isJa ? "30秒" : "30s", label: isJa ? "で問題セットを生成" : "to generate a problem set" },
              { value: isJa ? "1クリック" : "1 click", label: isJa ? "で類題を量産" : "to spin up variants" },
              { value: isJa ? "自動" : "Auto", label: isJa ? "解答付きPDF生成" : "answer key generation" },
              { value: isJa ? "即印刷" : "Print", label: isJa ? "A4/B5対応" : "Letter / A4 ready" },
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

      {/* ━━ Workflow — Input to Output ━━ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,hsl(var(--primary)/0.03),transparent_70%)]" />
        <div
          ref={workflowFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${workflowFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              {isJa ? "Eddivom のワークフロー" : "How Eddivom works"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "入力から配布まで、5ステップ。" : "PDF to printable worksheet in 5 steps."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa
                ? "PDF・画像・テキスト、何からでも始められます。"
                : "Start from an old worksheet, a photo, or just a description."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-3">
            <StepCard
              num="01"
              icon={<Upload className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "素材を入力" : "Bring your source"}
              desc={isJa ? "PDFをアップロード、画像を貼る、またはテキストで指示。何からでもOK" : "Upload an old worksheet PDF, snap a photo, or just describe what you need"}
              color="bg-gradient-to-br from-blue-500 to-cyan-500"
            />
            <StepCard
              num="02"
              icon={<Layers className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "問題を抽出" : "Extract problems"}
              desc={isJa ? "PDFや画像から問題を自動で認識し、編集可能な形式に変換" : "AI pulls out each problem — equations, diagrams, choices — and makes them editable"}
              color="bg-gradient-to-br from-violet-500 to-fuchsia-500"
            />
            <StepCard
              num="03"
              icon={<PenLine className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "問題ごとに編集" : "Edit per problem"}
              desc={isJa ? "数式・選択肢・配点をWord感覚で自由に修正。1問ずつ微調整" : "Change numbers, reword prompts, adjust points. No LaTeX — just click and type"}
              color="bg-gradient-to-br from-emerald-500 to-teal-500"
            />
            <StepCard
              num="04"
              icon={<Copy className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "類題を増やす" : "Generate variants"}
              desc={isJa ? "「類題を5問」で数値・難易度を変えたバリエーションを即生成" : "\"5 more like this\" — get fresh problems with different numbers and difficulty levels"}
              color="bg-gradient-to-br from-amber-500 to-orange-500"
            />
            <StepCard
              num="05"
              icon={<FileDown className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "PDF出力・印刷" : "Export & print"}
              desc={isJa ? "生徒用と解答付きの2種類のPDFを出力。A4/B5で即印刷" : "One click for the student version, one click for the answer key. Print-ready PDF"}
              color="bg-gradient-to-br from-slate-500 to-gray-600"
            />
          </div>

          <div className="text-center mt-10">
            <button
              onClick={handleStart}
              className="group inline-flex items-center gap-3 px-9 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-[14px] shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              {isJa ? "PDFから始めてみる" : "Try it with your PDF"}
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
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              {isJa ? "Eddivom の機能" : "Eddivom features"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "問題作成から配布まで、全部ここで。" : "Everything between \"I need a worksheet\" and \"it's printing.\""}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa ? "LaTeXの知識は不要。Eddivom が数式をきれいに仕上げます。" : "No LaTeX knowledge needed. Eddivom handles the typesetting — you just focus on the math."}
            </p>
          </div>

          {/* Big 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            {[
              {
                icon: <Upload className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-blue-500 to-cyan-500",
                title: isJa ? "PDF・画像から教材を再利用" : "Reuse your existing worksheets",
                desc: isJa
                  ? "既存の教材PDF・過去問・画像をアップロードするだけ。問題を自動で認識・抽出し、そのまま編集できます。"
                  : "Upload a PDF you already made or a past exam photo. Problems are auto-extracted — equations intact — and ready to edit.",
              },
              {
                icon: <PenLine className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-emerald-500 to-teal-500",
                title: isJa ? "問題ごとにWord感覚で編集" : "Edit problem by problem",
                desc: isJa
                  ? "数式・選択肢・配点・解説をクリックして直接編集。問題の入れ替え・並べ替えも自在です。"
                  : "Click any equation, answer choice, or point value and just type. Reorder and rearrange problems freely.",
              },
              {
                icon: <Copy className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-violet-500 to-fuchsia-500",
                title: isJa ? "類題を即座に量産" : "Spin up variants instantly",
                desc: isJa
                  ? "1問から数値・条件・難易度を変えたバリエーションを一括生成。演習量を一気に増やせます。"
                  : "One problem becomes five — or fifty. Different numbers, different difficulty, same skill. Perfect for multiple versions.",
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
                title: isJa ? "解答付きPDFをワンクリック" : "Answer key included automatically",
                desc: isJa ? "生徒用と解答付きの2種類をボタン一つで書き出し。採点・配布がすぐできます。" : "Student version and answer key export separately with one click. No manual answer-key formatting.",
              },
              {
                icon: <Printer className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-slate-500 to-zinc-500",
                title: isJa ? "印刷に強いA4/B5レイアウト" : "Print-ready, every time",
                desc: isJa ? "プロ品質の組版で印刷配布に最適。余白・フォント・レイアウトも調整可能。" : "Professional typesetting with clean margins and crisp equations. Prints beautifully on Letter or A4.",
              },
              {
                icon: <Sparkles className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-pink-500 to-rose-500",
                title: isJa ? "テキストからも問題を生成" : "Generate problems from scratch",
                desc: isJa ? "「二次方程式を5問」のように指示するだけで問題を自動生成。ゼロからでも始められます。" : "Type \"10 factoring problems, medium difficulty\" and get a full worksheet. No source file needed.",
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

      {/* ━━ Differentiation — Not Canva, Not Overleaf ━━ */}
      <section className="relative py-20 border-t border-foreground/[0.04]">
        <div
          ref={diffFade.ref}
          className={`relative max-w-4xl mx-auto px-6 transition-all duration-1000 ${diffFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-12">
            <h2 className="text-[clamp(1.3rem,3.5vw,2rem)] font-bold tracking-tight mb-4">
              {isJa ? "Canva でもない、Overleaf でもない。" : "Canva can't do equations. Overleaf is overkill."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "Eddivom は、数式教材の「運用」を速くする専用ツールです。"
                : "Eddivom sits right in between — built specifically for math worksheet workflows."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Template tools */}
            <div className="p-5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.01]">
              <p className="text-[11px] text-muted-foreground/50 font-semibold tracking-wider uppercase mb-3">
                {isJa ? "テンプレ系ツール" : "Canva / Google Docs"}
              </p>
              <ul className="space-y-2 text-[12px] text-muted-foreground/60">
                <li>✕ {isJa ? "数式の細かい編集が難しい" : "Equations break or look ugly"}</li>
                <li>✕ {isJa ? "問題単位で管理できない" : "No per-problem management"}</li>
                <li>✕ {isJa ? "類題生成ができない" : "No variant generation"}</li>
                <li>✕ {isJa ? "解答PDFの自動生成なし" : "Answer key? Build it by hand"}</li>
              </ul>
            </div>

            {/* This tool */}
            <div className="p-5 rounded-2xl border-2 border-primary/20 bg-primary/[0.03] shadow-lg shadow-primary/[0.05]">
              <p className="text-[11px] text-primary font-bold tracking-wider uppercase mb-3">
                Eddivom
              </p>
              <ul className="space-y-2 text-[12px] text-foreground/80 font-medium">
                <li>✓ {isJa ? "PDF・画像から問題を再利用" : "Import from your existing PDFs"}</li>
                <li>✓ {isJa ? "問題ごとに編集・並べ替え" : "Edit each problem individually"}</li>
                <li>✓ {isJa ? "類題を1クリックで量産" : "Generate variants in one click"}</li>
                <li>✓ {isJa ? "生徒用 + 解答付きPDF出力" : "Auto answer-key PDF export"}</li>
                <li>✓ {isJa ? "印刷に最適な組版品質" : "Equations that actually look right"}</li>
              </ul>
            </div>

            {/* LaTeX tools */}
            <div className="p-5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.01]">
              <p className="text-[11px] text-muted-foreground/50 font-semibold tracking-wider uppercase mb-3">
                {isJa ? "LaTeX専用ツール" : "Overleaf / LaTeX"}
              </p>
              <ul className="space-y-2 text-[12px] text-muted-foreground/60">
                <li>✕ {isJa ? "LaTeXの知識が必須" : "You need to learn LaTeX first"}</li>
                <li>✕ {isJa ? "問題単位の管理がない" : "No per-problem structure"}</li>
                <li>✕ {isJa ? "類題の自動生成なし" : "No auto variant generation"}</li>
                <li>✕ {isJa ? "教材ワークフロー非対応" : "Way more power than you need"}</li>
              </ul>
            </div>
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
                  {isJa ? "上級者向け — LaTeXも直接触れる" : "Power users — full LaTeX under the hood"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isJa ? "必要なときだけ。LaTeX・回路図・化学式・カスタムパッケージ対応" : "You don't need it. But if you know LaTeX, you can drop in and fine-tune anything"}
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
                ? "知らなくても使える。知っていれば Eddivom はもっと自由に。"
                : "You don't need to know it. But if you do, Eddivom goes even further."}
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
            {isJa ? "Eddivom で、教材づくりを今夜から変えよう。" : "Try Eddivom tonight. Your worksheet will be done before bed."}
          </h2>
          <p className="text-muted-foreground text-[15px] mb-10 max-w-md mx-auto leading-relaxed whitespace-pre-line">
            {isJa
              ? "手持ちのPDFでも、ゼロからでも。\n登録なし、30秒で最初の1枚。"
              : "Bring a PDF you already have, or start from scratch.\nNo signup — just open Eddivom and go."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleStart}
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-[15px] shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              {isJa ? "Eddivom を無料で試す" : "Try Eddivom free"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground/40">
            {isJa ? "登録不要 · カード不要 · 30秒で最初の1枚" : "No signup · No credit card · First worksheet in 30 seconds"}
          </p>
        </div>
      </section>

      {/* ━━ Footer ━━ */}
      <footer className="border-t border-foreground/[0.05] py-10 text-center">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold tracking-tighter">Ed</span>
            </div>
            <span className="text-[13px] font-bold tracking-tight opacity-60">
              Eddivom
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/30 tracking-wide">
            Powered by LuaLaTeX & AI
          </p>
        </div>
      </footer>
    </div>
  );
}
