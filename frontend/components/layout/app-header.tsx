"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { generatePDF, CompileError, formatCompileError } from "@/lib/api";
import { saveToLocalStorage, downloadAsJSON } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Save,
  Undo2,
  Redo2,
  FileDown,
  Loader2,
  Sparkles,
  Printer,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  isAIActive?: boolean;
}

export function AppHeader({ isAIActive = false }: AppHeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { document: doc, updateMetadata, undo, redo, past, future } = useDocumentStore();
  const { isGenerating, setGenerating, lastAIAction, isChatLoading } = useUIStore();
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const omrFileRef = useRef<HTMLInputElement>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);

  useEffect(() => {
    if (!lastAIAction) return;
    setIndicatorVisible(true);
    const timer = setTimeout(() => setIndicatorVisible(false), 8_000);
    return () => clearTimeout(timer);
  }, [lastAIAction]);

  if (!doc) return null;

  const handleSave = async () => {
    saveToLocalStorage(doc);
    const jsonStr = JSON.stringify(doc, null, 2);
    const defaultName = `${doc.metadata.title || "document"}.json`;

    // If we already have a file handle, overwrite silently
    if (fileHandleRef.current) {
      try {
        const writable = await fileHandleRef.current.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        toast.success(t("toast.saved"));
        return;
      } catch {
        // Handle lost, fall through to picker
        fileHandleRef.current = null;
      }
    }

    // Try File System Access API for native save dialog
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: "JSON Document", accept: { "application/json": [".json"] } }],
        });
        fileHandleRef.current = handle;
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        toast.success(t("toast.saved"));
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }

    // Fallback: download
    downloadAsJSON(doc, defaultName);
    toast.success(t("toast.saved"));
  };

  const handleExportJSON = () => {
    downloadAsJSON(doc, `${doc.metadata.title || "document"}.json`);
    toast.success(t("toast.exported"));
  };


  const handleOMRFromToolbar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc) return;
    e.target.value = "";

    // OMR split-view モードを開く
    const sourceUrl = URL.createObjectURL(file);
    useUIStore.getState().openOMR(sourceUrl, file.name);
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
      // Phase 2: 構造化された CompileError は i18n でローカライズ
      if (err instanceof CompileError) {
        const view = formatCompileError(err, t);
        const description = view.lines.length > 0 ? view.lines.join(" · ") : undefined;
        // ネットワーク系は再試行ヒントを別 description で出す
        if (err.code === "network_timeout" || err.code === "network_unreachable") {
          toast.error(view.title, {
            duration: 10000,
            description: description ? `${description} — ${t("toast.pdf.retry")}` : t("toast.pdf.retry"),
          });
        } else {
          toast.error(view.title, { duration: 10000, description });
        }
      } else {
        const message = err instanceof Error ? err.message : t("header.pdf.error.unknown");
        toast.error(`${t("toast.pdf.fail")}: ${message}`, { duration: 8000 });
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
      className="editor-header relative flex items-center gap-2 px-3 h-12 sticky top-0 z-40 shrink-0"
    >

      {/* Logo + Back — matches LP nav */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-3 group shrink-0 mr-0.5"
        title={t("header.home")}
      >
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-all">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight text-foreground/80 group-hover:text-foreground transition-colors hidden sm:inline">Eddivom</span>
      </button>

      <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

      {/* Title */}
      <input
        value={doc.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        className={`h-8 px-2.5 text-sm font-medium bg-transparent border border-transparent hover:border-border/40 focus:border-primary/30 focus:bg-accent/30 focus:outline-none rounded-lg w-52 sm:w-64 transition-all placeholder:text-muted-foreground/20 ${
          isAIActive ? "text-foreground/80" : "text-foreground/70"
        }`}
        placeholder={t("header.title.placeholder")}
      />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={undo}
          disabled={past.length === 0}
          className="btn-icon h-8 w-8"
          title={t("header.undo")}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          className="btn-icon h-8 w-8"
          title={t("header.redo")}
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Center — AI status (LP-aligned: blue→violet gradient) */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-2">
        {isAIActive && isChatLoading ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/[0.10] to-violet-500/[0.10] text-foreground/70 text-xs font-medium border border-violet-500/[0.18] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            <span>{t("header.ai.thinking")}</span>
          </div>
        ) : lastAIAction && indicatorVisible ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-foreground/70 text-xs font-medium animate-in fade-in duration-300 max-w-sm overflow-hidden shadow-sm">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            <span className="truncate">{lastAIAction.description}</span>
          </div>
        ) : null}
      </div>

      {/* Actions — file operations */}
      <div className="flex items-center gap-0.5 px-1 py-1 rounded-lg">
        <button
          onClick={handleSave}
          className="btn-icon h-8 w-8"
          title={t("header.save.short")}
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          onClick={handleExportJSON}
          className="btn-icon h-8 w-8"
          title={t("header.export.json.short")}
        >
          <FileDown className="h-4 w-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

      {/* Tools */}
      <div className="flex items-center gap-1">
        {/* OMR — 画像/PDF読み取り（メイン CTA） */}
        <input ref={omrFileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={handleOMRFromToolbar} />
        <button
          onClick={() => omrFileRef.current?.click()}
          disabled={isGenerating}
          className="group relative flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm hover:shadow-[0_0_10px_rgba(16,185,129,0.35)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.97] shrink-0 overflow-hidden"
          title={t("header.scan.tooltip")}
        >
          {/* subtle shimmer */}
          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 pointer-events-none" />
          <ScanLine className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {t("header.scan.label")}
          </span>
        </button>

        <ThemeToggle />

        <UserMenu />
      </div>

      {/* PDF export — matches LP "Get started" CTA */}
      <button
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="flex items-center gap-2 h-8 px-5 rounded-full bg-foreground text-background text-[13px] font-semibold shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] ml-1 shrink-0"
      >
        {isGenerating ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>{t("header.pdf.generating")}</span></>
        ) : (
          <><Printer className="h-3.5 w-3.5" /><span>{t("header.pdf.export")}</span></>
        )}
      </button>

      {/* PDF Save As ダイアログ（showSaveFilePicker 非対応ブラウザ用） */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowSaveDialog(false); setPdfBlob(null); }}>
          <div
            className="bg-background rounded-xl border p-6 w-[380px] space-y-4 animate-scale-in"
            style={{ boxShadow: "var(--shadow-float)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold">{t("header.pdf.dialog.title")}</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">{t("header.pdf.dialog.filename")}</label>
              <input
                value={pdfFilename}
                onChange={(e) => setPdfFilename(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePDF(); }}
                className="w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowSaveDialog(false); setPdfBlob(null); }}
                className="px-4 py-2 text-xs rounded-lg border hover:bg-muted transition-all font-medium"
              >
                {t("header.pdf.dialog.cancel")}
              </button>
              <button
                onClick={handleSavePDF}
                className="px-5 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all font-semibold shadow-sm"
              >
                {t("header.pdf.dialog.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
