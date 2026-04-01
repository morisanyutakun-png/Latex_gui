"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Toolbar } from "@/components/layout/toolbar";
import { EditToolbar } from "@/components/layout/edit-toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AdvancedModePanel } from "@/components/editor/advanced-mode";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { LaTeXSourceViewer } from "@/components/editor/latex-source-viewer";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Terminal, PenLine, Bot, FileCode2, X, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type SidebarTab = "ai" | "advanced" | "latex";

interface TabMeta {
  label: string;
  icon: React.ElementType;
  activeColor: string;
  indicatorColor: string;
}

const MAIN_TABS: SidebarTab[] = ["ai", "latex"];

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isChatLoading = useUIStore((s) => s.isChatLoading);

  const TAB_META: Record<SidebarTab, TabMeta> = {
    ai:       { label: t("panel.ai"),       icon: Bot,       activeColor: "text-violet-500 dark:text-violet-400", indicatorColor: "bg-violet-500" },
    advanced: { label: t("panel.advanced"), icon: Terminal,  activeColor: "text-amber-500 dark:text-amber-400",   indicatorColor: "bg-amber-500"  },
    latex:    { label: t("panel.latex"),    icon: FileCode2, activeColor: "text-slate-500 dark:text-slate-400",   indicatorColor: "bg-slate-400"  },
  };

  const document = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore((s) => s.document?.advanced?.enabled ?? false);
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");
  const [editToolbarExpanded, setEditToolbarExpanded] = useState(false);

  useEffect(() => {
    if (!document) router.push("/");
  }, [document, router]);

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (advancedEnabled) {
      setSidebarOpen(true);
      setActiveTab("advanced");
    }
  }, [advancedEnabled]);

  if (!document) return null;

  const handleActivityClick = (tab: SidebarTab) => {
    if (sidebarOpen && activeTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveTab(tab);
    }
  };

  const isAIActive = (sidebarOpen && activeTab === "ai") || isChatLoading;
  const activeMeta = TAB_META[activeTab];

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background overflow-hidden">
      <AppHeader isAIActive={isAIActive} />

      {/* Edit toolbar — collapsible, shown when edit mode toggled */}
      <EditToolbar
        isExpanded={editToolbarExpanded}
        onCollapse={() => setEditToolbarExpanded(false)}
      />

      {/* Contextual format bar — no insert button */}
      <Toolbar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Main editor ── */}
        <div className="flex-1 overflow-auto min-w-0">
          <DocumentEditor />
        </div>

        {/* ── Panel content ── */}
        <div
          className={`
            border-l border-border/20 overflow-hidden bg-background/95 backdrop-blur-sm
            flex-shrink-0 flex flex-col transition-all duration-200 ease-out
            ${sidebarOpen ? "w-96" : "w-0"}
          `}
        >
          {sidebarOpen && (
            <div className="w-96 h-full flex flex-col animate-in fade-in duration-150">
              {/* Panel title bar */}
              <div className={`flex items-center px-3 h-9 border-b border-border/20 shrink-0 select-none transition-colors ${
                activeTab === "ai"
                  ? "bg-violet-950/10 dark:bg-violet-950/20"
                  : activeTab === "advanced"
                    ? "bg-amber-950/8 dark:bg-amber-950/15"
                    : "bg-muted/10"
              }`}>
                {activeTab === "ai" && (
                  <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-violet-500/60 to-violet-400/20 rounded-r" />
                )}
                <span className={`text-[10px] font-semibold uppercase tracking-widest flex-1 ${
                  activeTab === "ai"
                    ? "text-violet-400/70"
                    : activeTab === "advanced"
                      ? "text-amber-500/70 font-mono"
                      : "text-muted-foreground/50"
                }`}>
                  {activeMeta.label}
                </span>
                {activeTab === "advanced" && advancedEnabled && (
                  <span className="mr-2 px-1.5 py-0.5 text-[8px] bg-amber-600 text-white rounded-full font-bold tracking-wide font-mono">
                    ACTIVE
                  </span>
                )}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/60 transition-colors"
                  title={t("panel.close")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Panel body */}
              <div
                className={`flex-1 min-h-0 ${
                  activeTab === "ai" || activeTab === "latex"
                    ? "overflow-hidden flex flex-col"
                    : "overflow-y-auto p-4"
                }`}
              >
                {activeTab === "ai"       && <AIChatPanel />}
                {activeTab === "advanced" && <AdvancedModePanel />}
                {activeTab === "latex"    && <LaTeXSourceViewer />}
              </div>
            </div>
          )}
        </div>

        {/* ── Activity bar — IDE-style right-side icon strip ── */}
        <div className="w-10 flex flex-col items-center pt-1 pb-1 border-l border-border/20 bg-background/70 shrink-0">
          {/* Main tabs */}
          {MAIN_TABS.map((tab) => {
            const meta = TAB_META[tab];
            const Icon = meta.icon;
            const isActive = sidebarOpen && activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleActivityClick(tab)}
                title={meta.label}
                className={`relative h-10 w-full flex items-center justify-center transition-all ${
                  isActive
                    ? `${meta.activeColor} bg-muted/30`
                    : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/15"
                }`}
              >
                {isActive && (
                  <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full ${meta.indicatorColor} opacity-80`} />
                )}
                <Icon className="h-4 w-4" />
                {tab === "ai" && isChatLoading && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </button>
            );
          })}

          {/* Easy Edit toggle — toggles collapsible editing toolbar */}
          <button
            onClick={() => setEditToolbarExpanded((v) => !v)}
            title={t("panel.edit")}
            className={`relative h-10 w-full flex items-center justify-center transition-all ${
              editToolbarExpanded
                ? "text-sky-500 dark:text-sky-400 bg-muted/30"
                : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/15"
            }`}
          >
            {editToolbarExpanded && (
              <span className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-sky-500 opacity-80" />
            )}
            <PenLine className="h-4 w-4" />
          </button>

          <div className="flex-1" />

          {/* Thin separator before extension */}
          <div className="w-5 h-px bg-border/30 mb-1" />

          {/* Advanced mode — extension-style at bottom */}
          {(() => {
            const meta = TAB_META["advanced"];
            const Icon = meta.icon;
            const isActive = sidebarOpen && activeTab === "advanced";
            return (
              <button
                onClick={() => handleActivityClick("advanced")}
                title={`${meta.label} — LaTeX拡張`}
                className={`relative h-10 w-full flex items-center justify-center transition-all ${
                  isActive
                    ? `${meta.activeColor} bg-muted/30`
                    : "text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-muted/15"
                }`}
              >
                {isActive && (
                  <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full ${meta.indicatorColor} opacity-80`} />
                )}
                <Icon className="h-3.5 w-3.5" />
                {advancedEnabled && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })()}

          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
            title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
            className="h-10 w-full flex flex-col items-center justify-center gap-0.5 text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-muted/15 transition-all"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="text-[7px] font-mono uppercase">{locale === "ja" ? "EN" : "JA"}</span>
          </button>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
