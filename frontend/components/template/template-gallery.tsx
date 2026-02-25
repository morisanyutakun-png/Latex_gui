"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { DOCUMENT_CLASSES, LaTeXDocumentClass } from "@/lib/types";
import { TEMPLATES, createFromTemplate, type TemplateDefinition } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FileText, ArrowRight, Sparkles, FileCheck, FileEdit, Layout } from "lucide-react";

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [view, setView] = useState<"templates" | "classes">("templates");
  const [selectedClass, setSelectedClass] = useState<LaTeXDocumentClass>("article");

  // テンプレートからサンプル付きで開始
  const handleTemplateStart = (tmpl: TemplateDefinition, blank: boolean) => {
    const doc = createFromTemplate(tmpl.id, blank);
    setDocument(doc);
    router.push("/editor");
  };

  // ドキュメントクラスのみ選択して白紙で開始
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

  // テンプレート（blankを除外して表示）
  const contentTemplates = TEMPLATES.filter((t) => t.id !== "blank");

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
            <p className="text-[10px] text-muted-foreground -mt-0.5">テンプレートを選んで、すぐに編集開始</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-12">
        {/* Hero */}
        <section className="text-center pt-6 pb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            高品質なPDFをGUIで作成
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            テンプレートを選んで
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              始めよう
            </span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            サンプル入りのテンプレートから始めるか、白紙で自由に作成できます。
          </p>
        </section>

        {/* Resume saved */}
        {saved && (
          <div className="mb-6 flex justify-center">
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

        {/* View Toggle */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setView("templates")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === "templates"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Layout className="h-4 w-4" />
            テンプレートから始める
          </button>
          <button
            onClick={() => setView("classes")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === "classes"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <FileEdit className="h-4 w-4" />
            白紙から始める
          </button>
        </div>

        {/* テンプレート選択ビュー */}
        {view === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contentTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="group relative flex flex-col rounded-2xl border border-border/40 bg-white dark:bg-card overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
              >
                {/* Gradient header */}
                <div className={`h-24 bg-gradient-to-br ${tmpl.gradient} flex items-center justify-center`}>
                  <span className="text-4xl drop-shadow-md">{tmpl.icon}</span>
                </div>
                {/* Content */}
                <div className="flex-1 p-4 space-y-2">
                  <h3 className="text-base font-bold">{tmpl.name}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{tmpl.description}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${tmpl.accentColor}`} />
                    <span className="text-[10px] text-muted-foreground">{tmpl.documentClass}</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="p-3 pt-0 flex gap-2">
                  <button
                    onClick={() => handleTemplateStart(tmpl, false)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <Sparkles className="h-3 w-3" />
                    サンプル付きで開始
                  </button>
                  <button
                    onClick={() => handleTemplateStart(tmpl, true)}
                    className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  >
                    <FileEdit className="h-3 w-3" />
                    構成のみ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 白紙ビュー（ドキュメントクラス選択） */}
        {view === "classes" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {DOCUMENT_CLASSES.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`group relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                    selectedClass === cls.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border/40 bg-white dark:bg-card hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{cls.icon}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {cls.name}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mb-0.5">{cls.japanese}</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{cls.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cls.features.slice(0, 3).map((f) => (
                      <span key={f} className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-muted/60 text-muted-foreground">
                        {f}
                      </span>
                    ))}
                  </div>
                  {selectedClass === cls.id && (
                    <div className="absolute top-2 right-2">
                      <FileCheck className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleBlankStart}
                className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all"
              >
                <span>白紙から始める</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </>
        )}

        {/* Features */}
        <section className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { emoji: "📐", title: "自動設定", desc: "コンポーネントを挿入すると必要な設定が自動で適用" },
            { emoji: "⚡", title: "回路図・図表", desc: "テンプレートから選ぶだけで回路図やグラフを追加" },
            { emoji: "🎨", title: "崩れないレイアウト", desc: "Wordの微調整地獄から解放" },
            { emoji: "🚀", title: "即座にPDF", desc: "ブラウザで編集→高品質PDFダウンロード" },
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
