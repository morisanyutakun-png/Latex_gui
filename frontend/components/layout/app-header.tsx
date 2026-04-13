"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { saveToLocalStorage, downloadAsJSON } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Save,
  Undo2,
  Redo2,
  FileDown,
  Sparkles,
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
  const { lastAIAction, isChatLoading } = useUIStore();
  const [indicatorVisible, setIndicatorVisible] = useState(false);
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

    if (fileHandleRef.current) {
      try {
        const writable = await fileHandleRef.current.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        toast.success(t("toast.saved"));
        return;
      } catch {
        fileHandleRef.current = null;
      }
    }

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

    downloadAsJSON(doc, defaultName);
    toast.success(t("toast.saved"));
  };

  const handleExportJSON = () => {
    downloadAsJSON(doc, `${doc.metadata.title || "document"}.json`);
    toast.success(t("toast.exported"));
  };

  return (
    <header className="editor-header relative flex items-center gap-2 px-3 h-12 sticky top-0 z-40 shrink-0">

      {/* Logo */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 group shrink-0"
        title={t("header.home")}
      >
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-all">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
          </svg>
        </div>
      </button>

      <div className="w-px h-5 bg-border/40 shrink-0" />

      {/* Document title — 大きく強調 */}
      <input
        value={doc.metadata.title}
        onChange={(e) => updateMetadata({ title: e.target.value })}
        className="h-9 px-3 text-[15px] font-bold bg-transparent border-2 border-transparent hover:border-border/30 focus:border-violet-400/50 focus:bg-violet-50/30 dark:focus:bg-violet-500/[0.06] focus:outline-none rounded-lg flex-1 min-w-0 max-w-md transition-all placeholder:text-muted-foreground/25 text-foreground/85"
        placeholder={t("header.title.placeholder")}
      />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={undo} disabled={past.length === 0} className="btn-icon h-8 w-8" title={t("header.undo")}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={redo} disabled={future.length === 0} className="btn-icon h-8 w-8" title={t("header.redo")}>
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Center — AI status */}
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

      {/* Save / Export */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={handleSave} className="btn-icon h-8 w-8" title={t("header.save.short")}>
          <Save className="h-4 w-4" />
        </button>
        <button onClick={handleExportJSON} className="btn-icon h-8 w-8" title={t("header.export.json.short")}>
          <FileDown className="h-4 w-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-border/40 shrink-0" />

      {/* Theme + User */}
      <div className="flex items-center gap-1 shrink-0">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
