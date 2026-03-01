"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { DOCUMENT_CLASSES, LaTeXDocumentClass } from "@/lib/types";
import {
  TEMPLATES,
  createFromTemplate,
  type TemplateDefinition,
} from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ArrowRight,
  FileCheck,
  ChevronRight,
  Cpu,
  Download,
  Layers,
  Pen,
  Sigma,
  BookOpen,
  BarChart3,
  Presentation,
  Send,
  FileText,
  Sparkles,
  Zap,
  Shield,
} from "lucide-react";

/* ── Premium icon mapping ── */
const TEMPLATE_ICON: Record<string, React.ReactNode> = {
  article: <Sigma className="h-7 w-7" strokeWidth={1.5} />,
  report: <BarChart3 className="h-7 w-7" strokeWidth={1.5} />,
  book: <BookOpen className="h-7 w-7" strokeWidth={1.5} />,
  beamer: <Presentation className="h-7 w-7" strokeWidth={1.5} />,
  letter: <Send className="h-7 w-7" strokeWidth={1.5} />,
};

/* ── Gradient configs per template ── */
const TEMPLATE_GRADIENT: Record<string, string> = {
  article:
    "from-blue-600 via-blue-500 to-cyan-400 dark:from-blue-700 dark:via-blue-600 dark:to-cyan-500",
  report:
    "from-slate-700 via-slate-500 to-gray-400 dark:from-slate-800 dark:via-slate-600 dark:to-gray-500",
  book: "from-amber-600 via-orange-500 to-yellow-400 dark:from-amber-700 dark:via-orange-600 dark:to-yellow-500",
  beamer:
    "from-violet-600 via-purple-500 to-fuchsia-400 dark:from-violet-700 dark:via-purple-600 dark:to-fuchsia-500",
  letter:
    "from-emerald-600 via-green-500 to-teal-400 dark:from-emerald-700 dark:via-green-600 dark:to-teal-500",
};

/* ── Stripe-style scrolling LaTeX formulas ── */
const SCROLL_FORMULAS = [
  "e^{i\\pi} + 1 = 0",
  "\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}",
  "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}",
  "F = ma",
  "E = mc^2",
  "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
  "\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u",
  "\\oint \\mathbf{B} \\cdot d\\mathbf{l} = \\mu_0 I",
  "\\hat{H}|\\psi\\rangle = E|\\psi\\rangle",
  "\\mathcal{L} = T - V",
  "\\det(A - \\lambda I) = 0",
  "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  "\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}",
  "PV = nRT",
  "\\Delta S \\geq 0",
  "i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi",
  "\\mathbf{F} = q(\\mathbf{E} + \\mathbf{v} \\times \\mathbf{B})",
  "R_{\\mu\\nu} - \\frac{1}{2}Rg_{\\mu\\nu} = 8\\pi G T_{\\mu\\nu}",
  "\\frac{d}{dx}\\int_a^x f(t)dt = f(x)",
  "A\\mathbf{v} = \\lambda\\mathbf{v}",
];

const SCROLL_CODE_SNIPPETS = [
  "\\documentclass{article}",
  "\\usepackage{amsmath}",
  "\\begin{equation}",
  "\\usepackage{tikz}",
  "\\begin{document}",
  "\\section{Introduction}",
  "\\usepackage{pgfplots}",
  "\\begin{figure}[h]",
  "\\usepackage{circuitikz}",
  "\\tableofcontents",
  "\\bibliographystyle{plain}",
  "\\usepackage{geometry}",
  "\\begin{tikzpicture}",
  "\\maketitle",
  "\\usepackage{hyperref}",
  "\\begin{align*}",
  "\\newcommand{\\R}{\\mathbb{R}}",
  "\\usepackage{listings}",
  "\\end{document}",
  "\\renewcommand{\\baselinestretch}{1.2}",
];

/* ── Scroll column component ── */
function ScrollColumn({
  items,
  speed,
  direction,
  className,
}: {
  items: string[];
  speed: number;
  direction: "up" | "down";
  className?: string;
}) {
  const doubled = [...items, ...items, ...items];
  return (
    <div className={`scroll-column-mask relative overflow-hidden ${className}`}>
      <div
        className={`flex flex-col gap-4 ${
          direction === "up" ? "animate-scroll-up" : "animate-scroll-down"
        }`}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            className="px-4 py-3 rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04] border border-foreground/[0.04] dark:border-white/[0.06] backdrop-blur-sm"
          >
            <p className="text-[11px] font-mono text-foreground/20 dark:text-white/15 whitespace-nowrap leading-relaxed select-none">
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Intersection Observer hook for fade-in ── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [view, setView] = useState<"templates" | "classes">("templates");
  const [selectedClass, setSelectedClass] =
    useState<LaTeXDocumentClass>("article");
  const [heroLoaded, setHeroLoaded] = useState(false);

  const featuresFade = useFadeIn();
  const templatesFade = useFadeIn();

  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleTemplateStart = (tmpl: TemplateDefinition, blank: boolean) => {
    const doc = createFromTemplate(tmpl.id, blank);
    setDocument(doc);
    router.push("/editor");
  };

  const handleBlankStart = () => {
    const doc = createFromTemplate("blank");
    doc.settings.documentClass = selectedClass;
    setDocument(doc);
    router.push("/editor");
  };

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) {
      setDocument(doc);
      router.push("/editor");
    }
  };

  const saved =
    typeof window !== "undefined" ? loadFromLocalStorage() : null;
  const contentTemplates = TEMPLATES.filter((t) => t.id !== "blank");

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ━━ Navigation Bar ━━ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-foreground/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-12">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white text-[10px] font-bold tracking-tighter leading-none">
                Lx
              </span>
            </div>
            <span className="text-[14px] font-semibold tracking-tight">
              LaTeX PDF Maker
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ━━ Hero Section with Stripe-style scrolling background ━━ */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        {/* ── Ambient gradient background ── */}
        <div className="absolute inset-0">
          {/* Top gradient orb */}
          <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[140%] h-[60%] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)]" />
          {/* Secondary gradient orb */}
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-[radial-gradient(ellipse_at_center,hsl(260_80%_60%/0.05),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,hsl(260_80%_60%/0.08),transparent_70%)]" />
          {/* Mesh-like subtle grid */}
          <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        {/* ── Scrolling formula columns (Stripe end-roll effect) ── */}
        <div className="absolute inset-0 flex justify-between px-2 sm:px-4 pointer-events-none">
          <ScrollColumn items={SCROLL_FORMULAS.slice(0, 10)} speed={45} direction="up" className="w-24 sm:w-36 lg:w-48 opacity-25 sm:opacity-40 lg:opacity-60" />
          <ScrollColumn items={SCROLL_CODE_SNIPPETS.slice(0, 10)} speed={55} direction="down" className="w-36 lg:w-48 hidden md:block opacity-30 lg:opacity-40" />
          <ScrollColumn items={SCROLL_FORMULAS.slice(10)} speed={50} direction="up" className="w-36 lg:w-48 hidden md:block opacity-30 lg:opacity-40" />
          <ScrollColumn items={SCROLL_CODE_SNIPPETS.slice(10)} speed={40} direction="down" className="w-24 sm:w-36 lg:w-48 opacity-25 sm:opacity-40 lg:opacity-60" />
        </div>

        {/* ── Hero content ── */}
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 pt-20">
          <div className={`transition-all duration-1000 ease-out ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/[0.08] dark:bg-primary/[0.12] border border-primary/[0.12] mb-8">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary text-[12px] font-semibold tracking-wide">
                LaTeX × モダンUI
              </span>
            </div>

            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-bold tracking-[-0.03em] mb-6">
              <span className="block">プロ品質の文書を、</span>
              <span className="bg-gradient-to-r from-blue-600 via-violet-500 to-fuchsia-500 dark:from-blue-400 dark:via-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                驚くほど簡単に。
              </span>
            </h1>

            <p className="text-muted-foreground text-[17px] sm:text-[19px] leading-relaxed max-w-2xl mx-auto mb-10 font-light">
              Word感覚の直感的な操作で、LaTeX品質のPDFを生成。
              <br className="hidden sm:block" />
              数式・回路図・グラフ・化学式まで、すべてをカバー。
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <button
                onClick={() => {
                  const el = document.getElementById("templates-section");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group flex items-center gap-3 px-8 py-4 rounded-full bg-foreground text-background font-semibold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                テンプレートを選ぶ
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>

              {saved && (
                <button
                  onClick={handleResume}
                  className="group flex items-center gap-3 px-7 py-4 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  「{saved.metadata.title || "無題"}」を続ける
                  <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
            </div>
          </div>

          {/* ── Scroll indicator ── */}
          <div className={`mt-16 transition-all duration-1000 delay-500 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
              <span className="text-[11px] tracking-widest uppercase">Scroll</span>
              <div className="w-px h-8 bg-gradient-to-b from-muted-foreground/20 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━ Social proof / stats bar ━━ */}
      <section className="relative border-y border-foreground/[0.04] bg-foreground/[0.01] dark:bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "5+", label: "テンプレート" },
              { value: "LaTeX", label: "組版エンジン" },
              { value: "∞", label: "数式サポート" },
              { value: "1-Click", label: "PDF出力" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1 tracking-wide">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Templates Section ━━ */}
      <section id="templates-section" className="relative py-24">
        {/* Subtle section background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.03),transparent_70%)]" />

        <div
          ref={templatesFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${templatesFade.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              Templates
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              用途に合わせて、すぐスタート
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              プロが設計したテンプレートから選ぶだけ。白紙からも作成できます。
            </p>
          </div>

          {/* ━━ Tab Switcher (pill) ━━ */}
          <div className="flex justify-center mb-14">
            <div className="inline-flex p-1 rounded-full bg-foreground/[0.04] dark:bg-white/[0.06] border border-foreground/[0.06]">
              {(
                [
                  [
                    "templates",
                    "テンプレート",
                    <Layers key="t" className="h-3.5 w-3.5" />,
                  ],
                  [
                    "classes",
                    "白紙から作成",
                    <Pen key="c" className="h-3.5 w-3.5" />,
                  ],
                ] as const
              ).map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => setView(key as "templates" | "classes")}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 ${
                    view === key
                      ? "bg-foreground text-background shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ━━ Template Cards ━━ */}
          {view === "templates" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {contentTemplates.map((tmpl, idx) => (
                <div
                  key={tmpl.id}
                  className="group relative flex flex-col rounded-[20px] border border-foreground/[0.06] bg-card/80 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-primary/[0.08] hover:-translate-y-1.5 hover:border-foreground/[0.12]"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {/* ── Gradient header ── */}
                  <div
                    className={`relative h-44 bg-gradient-to-br ${
                      TEMPLATE_GRADIENT[tmpl.id] || tmpl.gradient
                    } flex items-center justify-center overflow-hidden`}
                  >
                    {/* Decorative shapes */}
                    <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white/[0.07] blur-3xl" />
                    <div className="absolute -bottom-6 -left-6 w-40 h-24 rounded-full bg-black/[0.04] blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/[0.03] blur-3xl" />

                    {/* Icon pill */}
                    <div className="relative z-10 h-16 w-16 rounded-2xl bg-white/[0.15] backdrop-blur-xl flex items-center justify-center text-white border border-white/[0.15] shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-700 ease-out">
                      {TEMPLATE_ICON[tmpl.id] || (
                        <FileText className="h-7 w-7" strokeWidth={1.5} />
                      )}
                    </div>

                    {/* Class badge */}
                    <span className="absolute top-3.5 left-3.5 text-[10px] font-mono font-medium text-white/50 bg-white/[0.08] backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/[0.08]">
                      {tmpl.documentClass}
                    </span>
                  </div>

                  {/* ── Body ── */}
                  <div className="flex-1 p-7 space-y-3">
                    <h3 className="text-[16px] font-semibold tracking-tight">
                      {tmpl.name}
                    </h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>

                  {/* ── Actions ── */}
                  <div className="px-7 pb-7 pt-0 flex gap-3">
                    <button
                      onClick={() => handleTemplateStart(tmpl, false)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-foreground text-background text-[13px] font-semibold hover:opacity-90 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-foreground/5"
                    >
                      <Sparkles className="h-4 w-4" />
                      サンプル付き
                    </button>
                    <button
                      onClick={() => handleTemplateStart(tmpl, true)}
                      className="flex items-center justify-center px-5 py-3.5 rounded-xl border border-foreground/[0.08] text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03] hover:border-foreground/[0.15] active:scale-[0.97] transition-all duration-200"
                    >
                      構成のみ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ━━ Blank Document View ━━ */}
          {view === "classes" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-14">
                {DOCUMENT_CLASSES.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.id)}
                    className={`group relative flex flex-col items-start p-7 rounded-[20px] border-2 transition-all duration-300 text-left ${
                      selectedClass === cls.id
                        ? "border-primary bg-primary/[0.03] shadow-xl shadow-primary/[0.06]"
                        : "border-foreground/[0.06] bg-card/80 backdrop-blur-xl hover:border-foreground/[0.12] hover:shadow-lg"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-xl">{cls.icon}</span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {cls.name}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold mb-1.5">
                      {cls.japanese}
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {cls.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {cls.features.slice(0, 3).map((f) => (
                        <span
                          key={f}
                          className="inline-block px-2 py-0.5 rounded-md text-[9px] bg-foreground/[0.04] text-muted-foreground font-medium"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    {selectedClass === cls.id && (
                      <div className="absolute top-5 right-5">
                        <FileCheck className="h-4.5 w-4.5 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleBlankStart}
                  className="group flex items-center gap-3 px-10 py-4.5 rounded-full bg-foreground text-background font-semibold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                >
                  白紙から始める
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ━━ Features Section ━━ */}
      <section className="relative py-28 overflow-hidden">
        {/* Background accents */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
        </div>

        <div
          ref={featuresFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${featuresFade.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <div className="text-center mb-16">
            <p className="text-primary text-[12px] font-semibold tracking-[0.2em] uppercase mb-4">
              Features
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              なぜ LaTeX PDF Maker？
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              複雑な環境構築なしで、プロフェッショナルな文書を
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Cpu className="h-5 w-5" strokeWidth={1.5} />,
                title: "自動パッケージ検出",
                desc: "コンポーネントに応じて必要なLaTeXパッケージを自動でロード",
                gradient: "from-blue-500 to-cyan-500",
              },
              {
                icon: <Sigma className="h-5 w-5" strokeWidth={1.5} />,
                title: "数式 & 回路図",
                desc: "amsmath・circuitikz・pgfplotsをGUIだけで操作可能",
                gradient: "from-violet-500 to-purple-500",
              },
              {
                icon: <Shield className="h-5 w-5" strokeWidth={1.5} />,
                title: "プロの組版品質",
                desc: "LaTeXエンジンが自動でカーニング・ハイフネーションを最適化",
                gradient: "from-amber-500 to-orange-500",
              },
              {
                icon: <Download className="h-5 w-5" strokeWidth={1.5} />,
                title: "即座にPDF出力",
                desc: "ブラウザで編集→ワンクリックで高品質PDFをダウンロード",
                gradient: "from-emerald-500 to-teal-500",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative p-7 rounded-[20px] bg-card/60 backdrop-blur-xl border border-foreground/[0.05] hover:border-foreground/[0.1] hover:shadow-xl transition-all duration-500"
              >
                {/* Icon with gradient background */}
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 text-white shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-500`}>
                  {f.icon}
                </div>
                <h4 className="text-[14px] font-semibold mb-2 tracking-tight">{f.title}</h4>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ CTA Section ━━ */}
      <section className="relative py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(var(--primary)/0.04),transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto text-center px-6">
          <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-5">
            さぁ、始めましょう
          </h2>
          <p className="text-muted-foreground text-[15px] mb-10 max-w-md mx-auto">
            テンプレートを選んで、あなただけの美しい文書を作成してください。
          </p>
          <button
            onClick={() => {
              const el = document.getElementById("templates-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="group inline-flex items-center gap-3 px-10 py-4.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-[15px] shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            テンプレートを見る
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </section>

      {/* ━━ Footer ━━ */}
      <footer className="border-t border-foreground/[0.05] py-10 text-center">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold tracking-tighter">Lx</span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight opacity-60">LaTeX PDF Maker</span>
          </div>
          <p className="text-[11px] text-muted-foreground/40 tracking-wide">
            Powered by pdfLaTeX, TikZ &amp; PGFPlots
          </p>
        </div>
      </footer>
    </div>
  );
}
