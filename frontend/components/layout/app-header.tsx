"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Upload,
  FileDown,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";
import { generatePDF } from "@/lib/api";
import { downloadAsJSON, loadFromJSONFile } from "@/lib/storage";
import { toast } from "sonner";

export function AppHeader() {
  const { document, updateMetadata, undo, redo, past, future, setDocument } =
    useDocumentStore();
  const { isGenerating, setGenerating, zoom, setZoom } = useUIStore();

  if (!document) return null;

  const handleGeneratePDF = async () => {
    if (!document) return;
    setGenerating(true);
    try {
      const blob = await generatePDF(document);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(window.document.createElement("a"), {
        href: url,
        download: `${document.metadata.title || "document"}.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF を生成しました");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!document) return;
    downloadAsJSON(document, `${document.metadata.title || "document"}.json`);
    toast.success("JSONを保存しました");
  };

  const handleLoad = () => {
    const input = Object.assign(window.document.createElement("input"), {
      type: "file",
      accept: ".json",
    });
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const doc = await loadFromJSONFile(file);
        setDocument(doc);
        toast.success("ドキュメントを読み込みました");
      } catch {
        toast.error("ファイルの読み込みに失敗しました");
      }
    };
    input.click();
  };

  return (
    <header className="flex h-12 items-center gap-2 border-b bg-card px-3 shrink-0">
      {/* Title */}
      <Input
        value={document.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        placeholder="無題のドキュメント"
        className="h-8 w-48 border-transparent bg-transparent text-sm font-medium
                   hover:border-input focus:border-input"
      />

      <Separator orientation="vertical" className="h-5" />

      {/* Undo / Redo */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={undo}
        disabled={past.length === 0}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={redo}
        disabled={future.length === 0}
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-5" />

      {/* Zoom */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom - 0.1)}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom + 0.1)}>
        <ZoomIn className="h-4 w-4" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={handleLoad}>
        <Upload className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">開く</span>
      </Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={handleSave}>
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">保存</span>
      </Button>

      <Button
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleGeneratePDF}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        PDF生成
      </Button>

      <ThemeToggle />
    </header>
  );
}
