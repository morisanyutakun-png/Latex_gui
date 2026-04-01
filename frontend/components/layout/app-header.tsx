"use client";

import React, { useEffect, useState } from "react";
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
  LayoutList,
  Plus,
  RefreshCw,
  Trash2 as Trash2Icon,
  Sparkles,
  Bot,
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
  const { t } = useI18n();
  const router = useRouter();
  const { document: doc, updateMetadata, undo, redo, past, future } = useDocumentStore();
  const { isGenerating, setGenerating, lastAIAction, toggleOutline, isOutlineOpen, isChatLoading } = useUIStore();
  const [indicatorVisible, setIndicatorVisible] = useState(false);

  useEffect(() => {
    if (!lastAIAction) return;
    setIndicatorVisible(true);
    const t = setTimeout(() => setIndicatorVisible(false), 8_000);
    return () => clearTimeout(t);
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
      toast.success(t("toast.pdf.done"));
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

  return (
    <header
      className={`relative flex items-center gap-1.5 px-3 h-10 border-b sticky top-0 z-40 shrink-0 transition-all duration-300 ${
        isAIActive
          ? "border-violet-500/25 bg-violet-950/12 dark:bg-violet-950/25"
          : "border-border/20 bg-background"
      }`}
    >
      {/* AI mode — bottom gradient line */}
      {isAIActive && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent pointer-events-none" />
      )}

      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
        title={t("header.home")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      {/* Separator */}
      <div className="w-px h-4 bg-border/30 mx-0.5 shrink-0" />

      {/* Title */}
      <input
        value={doc.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        className={`h-7 px-2 text-sm font-medium bg-transparent border border-transparent hover:border-border/40 focus:border-primary/40 focus:outline-none rounded w-52 transition-colors placeholder:text-muted-foreground/25 ${
          isAIActive ? "text-violet-100 dark:text-violet-100" : "text-foreground/70"
        }`}
        placeholder={t("header.untitled")}
      />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 ml-0.5">
        <button
          onClick={undo}
          disabled={past.length === 0}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title={t("header.undo")}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title={t("header.redo")}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Center — AI mode indicator / last action */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {isAIActive && isChatLoading ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 text-[11px] font-medium animate-pulse">
            <Bot className="h-3 w-3 shrink-0" />
            <span className="font-mono">AI thinking…</span>
          </div>
        ) : lastAIAction && indicatorVisible ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 text-[11px] font-medium animate-in fade-in duration-300 max-w-sm overflow-hidden">
            <Sparkles className="h-3 w-3 shrink-0" />
            <span className="truncate">{lastAIAction.description}</span>
            <OpCountIcons counts={lastAIAction.opCounts} />
          </div>
        ) : null}
      </div>

      {/* File actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleSave}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
          title={t("header.save")}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleExportJSON}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
          title={t("header.export")}
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleImportJSON}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
          title={t("header.import")}
        >
          <FileUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-border/30 mx-1 shrink-0" />

      {/* Outline toggle */}
      <button
        onClick={toggleOutline}
        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
          isOutlineOpen
            ? "text-violet-500 dark:text-violet-400 bg-violet-500/10"
            : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/60"
        }`}
        title={t("header.outline")}
      >
        <LayoutList className="h-3.5 w-3.5" />
      </button>

      <ThemeToggle />

      {/* PDF button */}
      <button
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="flex items-center gap-1.5 h-7 px-3.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] ml-1 shrink-0"
      >
        {isGenerating ? (
          <><Loader2 className="h-3 w-3 animate-spin" />{t("header.generating")}</>
        ) : (
          <><Download className="h-3 w-3" />{t("header.pdf")}</>
        )}
      </button>

      {/* Floating outline panel */}
      <DocumentOutline />
    </header>
  );
}
