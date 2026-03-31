"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { generatePDF } from "@/lib/api";
import { saveToLocalStorage, downloadAsJSON, loadFromJSONFile } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ArrowLeft,
  Download,
  FileUp,
  Save,
  Undo2,
  Redo2,
  FileDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export function AppHeader() {
  const router = useRouter();
  const { document: doc, updateMetadata, undo, redo, past, future } = useDocumentStore();
  const { isGenerating, setGenerating } = useUIStore();

  if (!doc) return null;

  const handleSave = () => {
    saveToLocalStorage(doc);
    toast.success("保存しました");
  };

  const handleExportJSON = () => {
    downloadAsJSON(doc, `${doc.metadata.title || "document"}.json`);
    toast.success("JSONエクスポート完了");
  };

  const handleImportJSON = () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const loaded = await loadFromJSONFile(file);
        useDocumentStore.getState().setDocument(loaded);
        toast.success("読み込みました");
      } catch {
        toast.error("読み込み失敗");
      }
    };
    input.click();
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const blob = await generatePDF(doc);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${doc.metadata.title || "document"}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF生成完了");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      if (message.includes("接続できません") || message.includes("起動中")) {
        toast.error(message, { duration: 10000, description: "数秒待ってから再試行してください" });
      } else {
        toast.error(`PDF生成失敗: ${message}`, { duration: 8000 });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <header className="flex items-center gap-1.5 px-3 h-10 border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-40 shrink-0">
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        title="ホームへ"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      {/* Logo pill */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/40 border border-border/30">
        <span className="text-[9px] font-bold tracking-tighter text-primary/80 font-mono">Lx</span>
      </div>

      {/* Title — monospace feel */}
      <input
        value={doc.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        className="h-6 px-2 text-[13px] font-medium bg-transparent border border-transparent hover:border-border/40 focus:border-primary/40 focus:outline-none rounded text-foreground/80 w-44 transition-colors"
        placeholder="無題のドキュメント"
      />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 ml-1">
        <button
          onClick={undo}
          disabled={past.length === 0}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="元に戻す (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="やり直し (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* File actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleSave}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="保存 (Ctrl+S)"
        >
          <Save className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleExportJSON}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="JSONエクスポート"
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleImportJSON}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="JSONインポート"
        >
          <FileUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-border/40 mx-1" />

      <ThemeToggle />

      {/* PDF button */}
      <button
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="flex items-center gap-1.5 h-7 px-3.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] ml-1"
      >
        {isGenerating ? (
          <><Loader2 className="h-3 w-3 animate-spin" />生成中…</>
        ) : (
          <><Download className="h-3 w-3" />PDF</>
        )}
      </button>
    </header>
  );
}
