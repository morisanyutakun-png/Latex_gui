"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import {
  Download,
  Upload,
  FileDown,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Loader2,
  Home,
  Minus,
} from "lucide-react";
import { generatePDF } from "@/lib/api";
import { downloadAsJSON, loadFromJSONFile } from "@/lib/storage";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AppHeader() {
  const router = useRouter();
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

  const zoomPercent = Math.round(zoom * 100);

  return (
    <header className="flex h-12 items-center border-b bg-card/80 backdrop-blur-sm px-2 shrink-0 gap-1 z-40">
      {/* Home */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/")}
          >
            <Home className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">ホーム</TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Title */}
      <Input
        value={document.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        placeholder="無題のドキュメント"
        className="h-8 w-52 border-transparent bg-transparent text-sm font-semibold
                   hover:bg-accent/60 focus:bg-accent/80 focus:border-primary/30
                   rounded-lg transition-colors duration-150 px-2.5"
      />

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Undo / Redo */}
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={undo}
              disabled={past.length === 0}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">元に戻す (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={redo}
              disabled={future.length === 0}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">やり直す (⌘⇧Z)</TooltipContent>
        </Tooltip>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 px-1 py-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(zoom - 0.1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">縮小</TooltipContent>
        </Tooltip>
        <span className="text-[11px] font-medium text-muted-foreground w-10 text-center tabular-nums select-none">
          {zoomPercent}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(zoom + 0.1)}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">拡大</TooltipContent>
        </Tooltip>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* File actions */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleLoad}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">ファイルを開く</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleSave}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">JSON保存 (⌘S)</TooltipContent>
        </Tooltip>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* PDF Generate */}
      <Button
        size="sm"
        className="h-8 gap-2 px-4 rounded-lg font-semibold text-[13px]
                   bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary
                   shadow-sm hover:shadow-md transition-all duration-200"
        onClick={handleGeneratePDF}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        {isGenerating ? "生成中..." : "PDF 書き出し"}
      </Button>

      <ThemeToggle />
    </header>
  );
}
