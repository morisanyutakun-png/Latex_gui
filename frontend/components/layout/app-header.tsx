"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { generatePDF } from "@/lib/api";
import { saveToLocalStorage, downloadAsJSON, loadFromJSONFile } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ArrowLeft,
  FileUp,
  Save,
  Undo2,
  Redo2,
  FileDown,
  Loader2,
  LayoutList,
  Plus,
  RefreshCw,
  Trash2 as Trash2Icon,
  Sparkles,
  Bot,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { DocumentOutline } from "@/components/layout/document-outline";
import { LastAIAction } from "@/store/ui-store";

function OpCountIcons({ counts }: { counts: LastAIAction["opCounts"] }) {
  return (
    <span className="flex items-center gap-1 ml-1">
      {counts.added > 0 && (
        <span className="flex items-center gap-0.5 text-emerald-400">
          <Plus className="h-2.5 w-2.5" />
          <span className="text-[9px] tabular-nums font-mono">{counts.added}</span>
        </span>
      )}
      {counts.updated > 0 && (
        <span className="flex items-center gap-0.5 text-sky-400 ml-0.5">
          <RefreshCw className="h-2.5 w-2.5" />
          <span className="text-[9px] tabular-nums font-mono">{counts.updated}</span>
        </span>
      )}
      {counts.deleted > 0 && (
        <span className="flex items-center gap-0.5 text-red-400 ml-0.5">
          <Trash2Icon className="h-2.5 w-2.5" />
          <span className="text-[9px] tabular-nums font-mono">{counts.deleted}</span>
        </span>
      )}
    </span>
  );
}

interface AppHeaderProps {
  isAIActive?: boolean;
}

export function AppHeader({ isAIActive = false }: AppHeaderProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { document: doc, updateMetadata, undo, redo, past, future } = useDocumentStore();
  const { isGenerating, setGenerating, lastAIAction, toggleOutline, isOutlineOpen, isChatLoading } = useUIStore();
  const [indicatorVisible, setIndicatorVisible] = useState(false);

  const isJa = locale !== "en";

  useEffect(() => {
    if (!lastAIAction) return;
    setIndicatorVisible(true);
    const timer = setTimeout(() => setIndicatorVisible(false), 8_000);
    return () => clearTimeout(timer);
  }, [lastAIAction]);

  if (!doc) return null;

  const handleSave = () => {
    saveToLocalStorage(doc);
    toast.success(t("toast.saved"));
  };

  const handleExportJSON = () => {
    downloadAsJSON(doc, `${doc.metadata.title || "document"}.json`);
    toast.success(t("toast.exported"));
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
        toast.success(t("toast.imported"));
      } catch {
        toast.error(t("toast.import.fail"));
      }
    };
    input.click();
  };

  // PDF保存ダイアログ（ファイル名入力）
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const blob = await generatePDF(doc);
      const defaultName = `${doc.metadata.title || "document"}.pdf`;

      // File System Access API が使えるなら OS のSave Asダイアログ
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{
              description: "PDF Document",
              accept: { "application/pdf": [".pdf"] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success(t("toast.pdf.done"));
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          // showSaveFilePicker が失敗 → アプリ内ダイアログにフォールバック
        }
      }

      // フォールバック: アプリ内でファイル名入力ダイアログを表示
      setPdfBlob(blob);
      setPdfFilename(defaultName);
      setShowSaveDialog(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      if (message.includes("接続できません") || message.includes("起動中")) {
        toast.error(message, { duration: 10000, description: t("toast.pdf.retry") });
      } else {
        toast.error(`PDF生成失敗: ${message}`, { duration: 8000 });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePDF = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = pdfFilename || "document.pdf";
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPdfBlob(null);
    setShowSaveDialog(false);
    toast.success(t("toast.pdf.done"));
  };

  return (
    <header
      className="relative flex items-center gap-1.5 px-3 h-11 border-b border-foreground/[0.06] bg-background/80 backdrop-blur-xl sticky top-0 z-40 shrink-0"
    >

      {/* Logo + Back */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 group shrink-0 mr-1"
        title={t("header.home")}
      >
        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm shadow-blue-500/20 group-hover:shadow-blue-500/40 group-hover:scale-105 transition-all">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
            <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
          </svg>
        </div>
        <ArrowLeft className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
      </button>

      <div className="w-px h-4 bg-foreground/[0.06] mx-0.5 shrink-0" />

      {/* Title */}
      <input
        value={doc.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        className={`h-7 px-2 text-[13px] font-medium bg-transparent border border-transparent hover:border-border/30 focus:border-primary/30 focus:outline-none rounded-md w-48 sm:w-56 transition-colors placeholder:text-muted-foreground/20 ${
          isAIActive ? "text-foreground/80" : "text-foreground/70"
        }`}
        placeholder={isJa ? "無題の教材" : "Untitled worksheet"}
      />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={undo}
          disabled={past.length === 0}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title={t("header.undo")}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title={t("header.redo")}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Center — AI status */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-2">
        {isAIActive && isChatLoading ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/15 to-indigo-500/15 text-violet-500 dark:text-violet-300 text-[11px] font-medium animate-pulse border border-violet-500/10">
            <Bot className="h-3 w-3 shrink-0" />
            <span>{isJa ? "AIが考え中…" : "AI thinking…"}</span>
          </div>
        ) : lastAIAction && indicatorVisible ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/8 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 text-[11px] font-medium animate-in fade-in duration-300 max-w-sm overflow-hidden">
            <Sparkles className="h-3 w-3 shrink-0" />
            <span className="truncate">{lastAIAction.description}</span>
            <OpCountIcons counts={lastAIAction.opCounts} />
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleSave}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
          title={isJa ? "保存" : "Save"}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleExportJSON}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
          title={isJa ? "JSON書き出し" : "Export JSON"}
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleImportJSON}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
          title={isJa ? "ファイルを開く" : "Open file"}
        >
          <FileUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-foreground/[0.06] mx-1 shrink-0" />

      <button
        onClick={toggleOutline}
        className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
          isOutlineOpen
            ? "text-primary bg-primary/10"
            : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/50"
        }`}
        title={isJa ? "構成を表示" : "Show outline"}
      >
        <LayoutList className="h-3.5 w-3.5" />
      </button>

      <ThemeToggle />

      {/* PDF export — Canva-style prominent button */}
      <button
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="flex items-center gap-2 h-7 px-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white text-[12px] font-semibold hover:from-blue-500 hover:to-violet-500 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] ml-1 shrink-0"
      >
        {isGenerating ? (
          <><Loader2 className="h-3 w-3 animate-spin" /><span>{isJa ? "生成中…" : "Generating…"}</span></>
        ) : (
          <><Printer className="h-3 w-3" /><span>{isJa ? "PDF出力" : "Export PDF"}</span></>
        )}
      </button>

      <DocumentOutline />

      {/* PDF Save As ダイアログ（showSaveFilePicker 非対応ブラウザ用） */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => { setShowSaveDialog(false); setPdfBlob(null); }}>
          <div
            className="bg-background rounded-xl shadow-2xl border p-5 w-[360px] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold">{isJa ? "PDFを保存" : "Save PDF"}</h3>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{isJa ? "ファイル名" : "Filename"}</label>
              <input
                value={pdfFilename}
                onChange={(e) => setPdfFilename(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePDF(); }}
                className="w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowSaveDialog(false); setPdfBlob(null); }}
                className="px-3 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors"
              >
                {isJa ? "キャンセル" : "Cancel"}
              </button>
              <button
                onClick={handleSavePDF}
                className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
              >
                {isJa ? "保存" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
