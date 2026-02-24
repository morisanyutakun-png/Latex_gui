"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { TEMPLATES, TemplateDefinition, createFromTemplate } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, ArrowRight, Sparkles, Beaker, Cpu, GraduationCap, LayoutGrid, FileCheck, FilePlus2 } from "lucide-react";

const CATEGORIES = [
  { id: "all", name: "すべて", icon: LayoutGrid },
  { id: "general", name: "一般", icon: FileText },
  { id: "engineering", name: "工学", icon: Cpu },
  { id: "science", name: "理学", icon: Beaker },
  { id: "education", name: "教育", icon: GraduationCap },
] as const;

// ──── CSS Document Preview Thumbnail ────
// Shows a miniature visual of what the document structure looks like

function TemplatePreview({ tmpl }: { tmpl: TemplateDefinition }) {
  // Analyze block types to generate a visual preview
  const blocks = tmpl.blocks();
  const maxLines = 12;
  const previewLines: { type: string; width: string; height: string; indent?: boolean; color?: string }[] = [];

  for (const block of blocks) {
    if (previewLines.length >= maxLines) break;
    const c = block.content;
    switch (c.type) {
      case "heading":
        previewLines.push({
          type: "heading",
          width: c.level === 1 ? "70%" : c.level === 2 ? "55%" : "45%",
          height: c.level === 1 ? "6px" : "4px",
          color: c.level === 1 ? "bg-slate-600" : "bg-slate-500",
        });
        break;
      case "paragraph":
        previewLines.push({ type: "text", width: "95%", height: "3px", color: "bg-slate-300" });
        if (previewLines.length < maxLines) previewLines.push({ type: "text", width: "80%", height: "3px", color: "bg-slate-300" });
        break;
      case "math":
        previewLines.push({ type: "math", width: "60%", height: "8px", color: "bg-violet-300" });
        break;
      case "table":
        previewLines.push({ type: "table", width: "90%", height: "14px", color: "bg-orange-200" });
        break;
      case "list":
        for (let j = 0; j < Math.min(c.items.length, 3); j++) {
          if (previewLines.length >= maxLines) break;
          previewLines.push({ type: "list", width: "75%", height: "3px", indent: true, color: "bg-emerald-300" });
        }
        break;
      case "divider":
        previewLines.push({ type: "divider", width: "100%", height: "1px", color: "bg-slate-400" });
        break;
      case "circuit":
      case "diagram":
      case "chart":
        previewLines.push({ type: "figure", width: "70%", height: "16px", color: "bg-cyan-200" });
        break;
      case "chemistry":
        previewLines.push({ type: "chem", width: "50%", height: "8px", color: "bg-lime-300" });
        break;
      case "code":
        previewLines.push({ type: "code", width: "85%", height: "14px", color: "bg-slate-200" });
        break;
      case "image":
        previewLines.push({ type: "image", width: "60%", height: "16px", color: "bg-pink-200" });
        break;
      default:
        break;
    }
  }

  return (
    <div className="w-full h-full bg-white rounded-sm shadow-inner p-2 flex flex-col gap-[3px] overflow-hidden">
      {previewLines.map((line, i) => (
        <div
          key={i}
          className={`rounded-[1px] ${line.color} shrink-0 ${line.type === "math" || line.type === "chem" || line.type === "figure" || line.type === "image" ? "mx-auto" : ""}`}
          style={{
            width: line.width,
            height: line.height,
            marginLeft: line.indent ? "8px" : undefined,
            opacity: 0.8 - (i * 0.02),
          }}
        />
      ))}
    </div>
  );
}

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);

  const handleStart = (templateId: string, blank: boolean) => {
    const doc = createFromTemplate(templateId, blank);
    setDocument(doc);
    setSelectedTemplate(null);
    router.push("/editor");
  };

  const handleTemplateClick = (tmpl: TemplateDefinition) => {
    if (tmpl.id === "blank") {
      // Blank template — just go straight to editor
      handleStart("blank", false);
    } else {
      setSelectedTemplate(tmpl);
    }
  };

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) {
      setDocument(doc);
      router.push("/editor");
    }
  };

  const saved = typeof window !== "undefined" ? loadFromLocalStorage() : null;

  const filteredTemplates = activeCategory === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory);

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
            <p className="text-[10px] text-muted-foreground -mt-0.5">入力するだけで、整ったPDFができる</p>
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
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            数式・回路図・グラフ・化学式など、理工学系の文書を誰でも簡単に。
            <br />
            <span className="text-xs">書くことに集中するだけで、仕上がりはプロっぽい。</span>
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

        {/* Category Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-white dark:bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-3 w-3" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTemplates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleTemplateClick(tmpl)}
              className="group relative flex flex-col rounded-2xl border border-border/40 bg-white dark:bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Document Preview Thumbnail */}
              <div
                className={`h-28 p-2 bg-gradient-to-br ${tmpl.gradient} relative overflow-hidden flex items-center justify-center`}
              >
                <div className="w-[80px] h-[100px] transform group-hover:scale-105 transition-transform duration-300 relative">
                  <TemplatePreview tmpl={tmpl} />
                </div>
                {/* Decorative shapes */}
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 blur-sm" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10 blur-sm" />
              </div>

              {/* Info */}
              <div className="p-3 text-left">
                <h3 className="text-xs font-semibold mb-0.5 flex items-center gap-1.5">
                  {tmpl.icon} {tmpl.name}
                  <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  {tmpl.description}
                </p>
              </div>

              {/* Accent line */}
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tmpl.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
            </button>
          ))}
        </div>

        {/* Template Selection Dialog */}
        <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTemplate?.icon} {selectedTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                テンプレートの使い方を選んでください
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => handleStart(selectedTemplate.id, false)}
                  className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <FileCheck className="h-5 w-5 text-violet-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold mb-0.5">見本付きで始める</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      サンプルデータ入り。
                      <br />
                      お手本を見ながら編集
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleStart(selectedTemplate.id, true)}
                  className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FilePlus2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold mb-0.5">空で始める</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      構造だけ。
                      <br />
                      自分の内容をすぐに書ける
                    </p>
                  </div>
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Features */}
        <section className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { emoji: "📐", title: "数式オートコンプリート", desc: "// で分数、\\ でコマンド補完。LaTeX級の速度で誰でも書ける" },
            { emoji: "⚡", title: "回路図・図表", desc: "テンプレートから回路図やグラフを生成" },
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

        {/* Dual audience message */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-card border border-border/40">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">👤 はじめての方へ</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• LaTeXを覚える必要はありません</li>
              <li>• テンプレートを選んで中身を入れるだけ</li>
              <li>• レイアウトを頑張らなくても見た目が整います</li>
              <li>• Wordで時間が溶ける部分だけ置き換えられます</li>
            </ul>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-card border border-border/40">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">🛠 エンジニアの方へ</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• GUI入力→構造化JSON→LaTeX生成の基盤</li>
              <li>• PDF品質の安定性と再現性を保証</li>
              <li>• テンプレート運用・差し込み一括生成に拡張可能</li>
              <li>• 非エンジニアにLaTeXの恩恵を配るレイヤー</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
