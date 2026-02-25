"use client";

import React, { useState } from "react";
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
} from "lucide-react";

/* ── Premium icon mapping (clean line icons — no emoji) ── */
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

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [view, setView] = useState<"templates" | "classes">("templates");
  const [selectedClass, setSelectedClass] =
    useState<LaTeXDocumentClass>("article");

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
    <div className="min-h-screen bg-background">
      {/* ━━ Navigation Bar ━━ */}
      <nav className="sticky top-0 z-50 glass border-b border-border/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-11">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-[7px] bg-foreground flex items-center justify-center">
              <span className="text-background text-[9px] font-bold tracking-tighter leading-none">
                Lx
              </span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight opacity-90">
              LaTeX PDF Maker
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* ━━ Hero ━━ */}
      <section className="relative overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.06),transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto text-center pt-24 pb-16 px-6">
          <p className="text-primary text-[13px] font-semibold tracking-wider uppercase mb-4">
            Choose a Template
          </p>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] font-bold tracking-tight mb-5">
            プロ品質のPDFを、
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              もっと簡単に。
            </span>
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed max-w-lg mx-auto">
            Word感覚で編集して、LaTeX品質のPDFをワンクリックでダウンロード。
            <br className="hidden sm:block" />
            数式・回路図・グラフ・化学式にフル対応。
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 pb-24">
        {/* ━━ Resume ━━ */}
        {saved && (
          <div className="mb-12 flex justify-center">
            <button
              onClick={handleResume}
              className="group flex items-center gap-4 pl-5 pr-4 py-3.5 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/25 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left mr-2">
                <p className="text-[13px] font-semibold leading-tight">
                  「{saved.metadata.title || "無題"}」を続ける
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  前回の編集を再開
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        )}

        {/* ━━ Tab Switcher (pill) ━━ */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1 rounded-full bg-secondary/50 dark:bg-secondary/30 border border-border/30">
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
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium transition-all duration-200 ${
                  view === key
                    ? "bg-background text-foreground shadow-sm border border-border/40"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contentTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="group relative flex flex-col rounded-3xl border border-border/30 bg-card overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-primary/[0.06] hover:-translate-y-1 hover:border-border/60"
              >
                {/* ── Gradient header with ghost icon ── */}
                <div
                  className={`relative h-40 bg-gradient-to-br ${
                    TEMPLATE_GRADIENT[tmpl.id] || tmpl.gradient
                  } flex items-center justify-center overflow-hidden`}
                >
                  {/* Decorative light blobs */}
                  <div className="absolute top-3 right-6 w-28 h-28 rounded-full bg-white/[0.08] blur-2xl" />
                  <div className="absolute -bottom-4 -left-4 w-36 h-20 rounded-full bg-black/[0.06] blur-2xl" />

                  {/* Frosted icon */}
                  <div className="relative z-10 h-14 w-14 rounded-2xl bg-white/[0.18] backdrop-blur-md flex items-center justify-center text-white border border-white/[0.18] shadow-lg group-hover:scale-105 transition-transform duration-500">
                    {TEMPLATE_ICON[tmpl.id] || (
                      <FileText className="h-7 w-7" strokeWidth={1.5} />
                    )}
                  </div>

                  {/* Class badge */}
                  <span className="absolute top-3 left-3 text-[10px] font-mono font-medium text-white/60 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                    {tmpl.documentClass}
                  </span>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 p-6 space-y-2.5">
                  <h3 className="text-base font-semibold tracking-tight">
                    {tmpl.name}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>

                {/* ── Actions ── */}
                <div className="px-6 pb-6 pt-0 flex gap-2.5">
                  <button
                    onClick={() => handleTemplateStart(tmpl, false)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-foreground text-background text-[13px] font-semibold hover:opacity-90 active:scale-[0.97] transition-all duration-150"
                  >
                    <Sparkles className="h-4 w-4" />
                    サンプル付き
                  </button>
                  <button
                    onClick={() => handleTemplateStart(tmpl, true)}
                    className="flex items-center justify-center px-4 py-3 rounded-2xl border border-border/50 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 active:scale-[0.97] transition-all duration-150"
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-12">
              {DOCUMENT_CLASSES.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`group relative flex flex-col items-start p-6 rounded-3xl border-2 transition-all duration-200 text-left ${
                    selectedClass === cls.id
                      ? "border-primary bg-primary/[0.03] shadow-lg shadow-primary/[0.05]"
                      : "border-border/30 bg-card hover:border-border/60 hover:shadow-sm"
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
                        className="inline-block px-2 py-0.5 rounded-md text-[9px] bg-secondary/60 text-muted-foreground font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  {selectedClass === cls.id && (
                    <div className="absolute top-4 right-4">
                      <FileCheck className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleBlankStart}
                className="group flex items-center gap-3 px-8 py-4 rounded-full bg-foreground text-background font-semibold text-sm shadow-lg hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                白紙から始める
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </>
        )}

        {/* ━━ Features ━━ */}
        <section className="mt-32 mb-12">
          <p className="text-center text-[11px] font-bold text-muted-foreground tracking-[0.25em] uppercase mb-14">
            Why LaTeX PDF Maker
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: (
                  <Cpu className="h-5 w-5 text-primary" strokeWidth={1.5} />
                ),
                title: "自動パッケージ検出",
                desc: "コンポーネントに応じて必要なLaTeXパッケージを自動でロード",
              },
              {
                icon: (
                  <Sigma
                    className="h-5 w-5 text-primary"
                    strokeWidth={1.5}
                  />
                ),
                title: "数式 & 回路図",
                desc: "amsmath・circuitikz・pgfplotsをGUIだけで操作可能",
              },
              {
                icon: (
                  <Layers
                    className="h-5 w-5 text-primary"
                    strokeWidth={1.5}
                  />
                ),
                title: "プロの組版品質",
                desc: "LaTeXエンジンが自動でカーニング・ハイフネーションを最適化",
              },
              {
                icon: (
                  <Download
                    className="h-5 w-5 text-primary"
                    strokeWidth={1.5}
                  />
                ),
                title: "即座にPDF出力",
                desc: "ブラウザで編集→ワンクリックで高品質PDFをダウンロード",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-3xl bg-card border border-border/30 hover:border-border/60 hover:shadow-md transition-all duration-300"
              >
                <div className="h-11 w-11 rounded-2xl bg-primary/[0.08] flex items-center justify-center mb-4 group-hover:bg-primary/[0.12] transition-colors duration-300">
                  {f.icon}
                </div>
                <h4 className="text-[13px] font-semibold mb-1.5">{f.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ━━ Footer ━━ */}
      <footer className="border-t border-border/30 py-8 text-center">
        <p className="text-[11px] text-muted-foreground/60 tracking-wide">
          LaTeX PDF Maker &mdash; Powered by pdfLaTeX, TikZ &amp; PGFPlots
        </p>
      </footer>
    </div>
  );
}
