"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { TEMPLATES, createFromTemplate } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FileText, ArrowRight, Sparkles } from "lucide-react";

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);

  const handleSelect = (templateId: string) => {
    const doc = createFromTemplate(templateId);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-background to-indigo-50 dark:from-violet-950/20 dark:via-background dark:to-indigo-950/20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-500/20">
            Lx
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              LaTeX PDF Maker
            </h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">美しい文書を、誰でも簡単に</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-12">
        {/* Hero */}
        <section className="text-center pt-8 pb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            LaTeX品質のPDFをGUIで作成
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            テンプレートを選んで
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              始めよう
            </span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            数式・表・見出しなど、LaTeXの強みを活かした美しいPDFをブラウザ上で作成
          </p>
        </section>

        {/* Resume saved */}
        {saved && (
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleResume}
              className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white dark:bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <FileText className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">
                  「{saved.metadata.title || "無題"}」を続ける
                </p>
                <p className="text-[10px] text-muted-foreground">前回の作業を再開</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        )}

        {/* Template Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleSelect(tmpl.id)}
              className="group relative flex flex-col rounded-2xl border border-border/40 bg-white dark:bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Gradient preview */}
              <div
                className={`h-32 ${tmpl.gradient} flex items-center justify-center relative overflow-hidden`}
              >
                <span className="text-4xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {tmpl.icon}
                </span>
                {/* Decorative shapes */}
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 blur-sm" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10 blur-sm" />
              </div>

              {/* Info */}
              <div className="p-4 text-left">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                  {tmpl.name}
                  <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  {tmpl.description}
                </p>
              </div>

              {/* Accent line */}
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${tmpl.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
            </button>
          ))}
        </div>

        {/* Features */}
        <section className="mt-16 grid grid-cols-3 gap-6">
          {[
            { emoji: "📐", title: "美しい数式", desc: "LaTeXの数式をそのままPDFに" },
            { emoji: "🎨", title: "統一されたレイアウト", desc: "プロフェッショナルな文書品質" },
            { emoji: "⚡", title: "即座にPDF", desc: "ブラウザ上で編集→即ダウンロード" },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="text-2xl mb-2">{f.emoji}</div>
              <h4 className="text-sm font-semibold mb-0.5">{f.title}</h4>
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
