"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { DOCUMENT_CLASSES, LaTeXDocumentClass } from "@/lib/types";
import { TEMPLATES, createFromTemplate, type TemplateDefinition } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FileText, ArrowRight, Sparkles, FileCheck, FileEdit, Layout, ChevronRight } from "lucide-react";

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [view, setView] = useState<"templates" | "classes">("templates");
  const [selectedClass, setSelectedClass] = useState<LaTeXDocumentClass>("article");

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

  const saved = typeof window !== "undefined" ? loadFromLocalStorage() : null;
  const contentTemplates = TEMPLATES.filter((t) => t.id !== "blank");

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation Bar ── */}
      <nav className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-12">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center text-background text-[10px] font-bold tracking-tighter">
              Lx
            </div>
            <span className="text-sm font-semibold tracking-tight">LaTeX PDF Maker</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent dark:from-primary/[0.06]" />
        <div className="relative max-w-3xl mx-auto text-center pt-20 pb-14 px-6">
          <p className="text-primary text-sm font-semibold tracking-wide mb-3">
            テンプレートを選んですぐに開始
          </p>
          <h1 className="text-[2.5rem] leading-[1.1] font-bold tracking-tight mb-4">
            プロ品質のPDFを、
            <br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              もっと簡単に。
            </span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            Word感覚で編集して、LaTeX品質のPDFをブラウザからダウンロード。
            数式・回路図・グラフにも対応。
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        {/* ── Resume Card ── */}
        {saved && (
          <div className="mb-10 flex justify-center">
            <button
              onClick={handleResume}
              className="group flex items-center gap-4 px-6 py-4 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">
                  「{saved.metadata.title || "無題"}」を続ける
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">前回の作業を再開</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
            </button>
          </div>
        )}

        {/* ── Tab Switcher ── */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1 rounded-full bg-secondary/60 dark:bg-secondary/40">
            <button
              onClick={() => setView("templates")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                view === "templates"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layout className="h-4 w-4" />
              テンプレート
            </button>
            <button
              onClick={() => setView("classes")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                view === "classes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileEdit className="h-4 w-4" />
              白紙から
            </button>
          </div>
        </div>

        {/* ── Templates Grid ── */}
        {view === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {contentTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="group relative flex flex-col rounded-2xl border border-border/50 bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 hover:border-border"
              >
                {/* Visual header */}
                <div className={`h-28 bg-gradient-to-br ${tmpl.gradient} relative flex items-center justify-center`}>
                  <span className="text-5xl opacity-90 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">
                    {tmpl.icon}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                </div>

                {/* Content */}
                <div className="flex-1 p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold">{tmpl.name}</h3>
                    <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                      {tmpl.documentClass}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.description}</p>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex gap-2">
                  <button
                    onClick={() => handleTemplateStart(tmpl, false)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all duration-150"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    サンプル付きで開始
                  </button>
                  <button
                    onClick={() => handleTemplateStart(tmpl, true)}
                    className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-[0.98] transition-all duration-150"
                  >
                    構成のみ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Blank Document View ── */}
        {view === "classes" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              {DOCUMENT_CLASSES.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`group relative flex flex-col items-start p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
                    selectedClass === cls.id
                      ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/5"
                      : "border-border/40 bg-card hover:border-border hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-xl">{cls.icon}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{cls.name}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{cls.japanese}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{cls.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {cls.features.slice(0, 3).map((f) => (
                      <span key={f} className="inline-block px-2 py-0.5 rounded-md text-[9px] bg-secondary/60 text-muted-foreground font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                  {selectedClass === cls.id && (
                    <div className="absolute top-3 right-3">
                      <FileCheck className="h-4.5 w-4.5 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleBlankStart}
                className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 hover:opacity-90 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                白紙から始める
                <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-0.5 transition-transform duration-200" />
              </button>
            </div>
          </>
        )}

        {/* ── Features ── */}
        <section className="mt-24 mb-8">
          <h3 className="text-center text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-10">
            特長
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { emoji: "📐", title: "自動設定", desc: "コンポーネントを挿入すると必要な設定が自動で適用" },
              { emoji: "⚡", title: "回路図・図表", desc: "テンプレートから選ぶだけで回路図やグラフを追加" },
              { emoji: "🎨", title: "崩れない", desc: "LaTeXの組版品質でレイアウトが常に美しい" },
              { emoji: "🚀", title: "即座にPDF", desc: "ブラウザで編集→高品質PDFダウンロード" },
            ].map((f) => (
              <div key={f.title} className="text-center group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">{f.emoji}</div>
                <h4 className="text-sm font-semibold mb-1">{f.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          LaTeX PDF Maker — Powered by XeLaTeX, TikZ, and PGFPlots
        </p>
      </footer>
    </div>
  );
}
