"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { DOCUMENT_CLASSES, DocumentModel, DEFAULT_SETTINGS, LaTeXDocumentClass } from "@/lib/types";
import { loadFromLocalStorage } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FileText, ArrowRight, Sparkles, FileCheck } from "lucide-react";

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [selectedClass, setSelectedClass] = useState<LaTeXDocumentClass>("article");

  const handleStart = () => {
    const doc: DocumentModel = {
      template: "blank",
      metadata: { title: "", author: "" },
      settings: { ...DEFAULT_SETTINGS, documentClass: selectedClass },
      blocks: [],
    };
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
            <p className="text-[10px] text-muted-foreground -mt-0.5">白紙から始めて、挿入で組み立てる</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-12">
        {/* Hero */}
        <section className="text-center pt-8 pb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            LaTeX品質のPDFをGUIで作成
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            ドキュメントクラスを選んで
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              始めよう
            </span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            白紙のドキュメントから始めて、挿入メニューからコンポーネントを追加。
            <br />
            <span className="text-xs">必要なパッケージはバックエンドが自動で宣言します。</span>
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

        {/* Document Class Selection */}
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
                <span className="text-xs font-mono text-muted-foreground">
                  \\documentclass{"{" + cls.id + "}"}
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

        {/* Start Button */}
        <div className="flex justify-center">
          <button
            onClick={handleStart}
            className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all"
          >
            <span>白紙から始める</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Features */}
        <section className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { emoji: "📐", title: "自動パッケージ宣言", desc: "コンポーネントを挿入すると必要なパッケージが自動で追加" },
            { emoji: "⚡", title: "回路図・図表", desc: "挿入メニューから回路図やグラフを追加" },
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
