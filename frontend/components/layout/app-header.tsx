"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { generatePDF } from "@/lib/api";
import { saveToLocalStorage, downloadAsJSON, loadFromJSONFile } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ArrowLeft,
  Download,
  FileUp,
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  FileDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export function AppHeader() {
  const router = useRouter();
  const { document: doc, updateMetadata, undo, redo } = useDocumentStore();
  const { isGenerating, setGenerating, zoom, setZoom } = useUIStore();

  if (!doc) return null;

  const handleSave = () => {
    saveToLocalStorage(doc);
    toast.success("保存しました");
  };

  const handleExportJSON = () => {
    downloadAsJSON(doc, `${doc.metadata.title || "document"}.json`);
    toast.success("JSONファイルをダウンロードしました");
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
        toast.success("ファイルを読み込みました");
      } catch {
        toast.error("ファイルの読み込みに失敗しました");
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
      toast.success("PDFを生成しました");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      console.error("PDF生成エラー:", message);
      if (message.includes("接続できません") || message.includes("リクエストに失敗")) {
        toast.error(message, { duration: 8000 });
      } else {
        toast.error(`PDF生成に失敗: ${message}`, { duration: 6000 });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <header className="flex items-center gap-2 px-4 h-12 border-b border-border/30 glass sticky top-0 z-40">
      {/* Back */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-xl hover:bg-secondary/60 transition-colors"
        onClick={() => router.push("/")}
        title="ホームに戻る"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Logo */}
      <div className="h-6 w-6 rounded-[7px] bg-foreground flex items-center justify-center mr-0.5">
        <span className="text-background text-[9px] font-bold tracking-tighter leading-none">Lx</span>
      </div>

      {/* Title */}
      <Input
        value={doc.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        className="h-7 w-48 text-sm font-medium border-transparent hover:border-border/50 focus:border-primary/40 bg-transparent rounded-lg"
        placeholder="無題のドキュメント"
      />

      <Separator orientation="vertical" className="mx-1.5 h-4 opacity-30" />

      {/* Undo / Redo */}
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={undo} title="元に戻す (Ctrl+Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={redo} title="やり直し (Ctrl+Y)">
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-1.5 h-4 opacity-30" />

      {/* Zoom */}
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} title="縮小">
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <span className="text-[10px] text-muted-foreground w-8 text-center select-none tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setZoom(Math.min(2, zoom + 0.1))} title="拡大">
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* File actions */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleSave} title="保存 (Ctrl+S)">
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleExportJSON} title="JSONエクスポート">
          <FileDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleImportJSON} title="JSONインポート">
          <FileUp className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1.5 h-4 opacity-30" />

      <ThemeToggle />

      {/* PDF Export button — Apple premium dark */}
      <Button
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="h-8 px-5 rounded-full bg-foreground hover:opacity-90 text-background text-xs font-semibold gap-1.5 shadow-sm hover:shadow-lg active:scale-[0.97] transition-all duration-150 ml-1.5"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            生成中…
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            PDF出力
          </>
        )}
      </Button>
    </header>
  );
}
