"use client";

import { AppHeader } from "@/components/layout/app-header";
import { EditToolbar } from "@/components/layout/edit-toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AdvancedModePanel } from "@/components/editor/advanced-mode";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { LaTeXSourceViewer } from "@/components/editor/latex-source-viewer";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Terminal, PenLine, Bot, FileCode2, Globe, FileText, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type SidebarTab = "ai" | "advanced" | "latex";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const isMobile = useIsMobile();

  const doc = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore((s) => s.document?.advanced?.enabled ?? false);
  const router = useRouter();

  // Desktop state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");
  const [editMode, setEditMode] = useState(false);

  // Mobile state
  const [mobileTab, setMobileTab] = useState<"ai" | "preview">("ai");

  useEffect(() => {
    if (!doc) router.push("/");
  }, [doc, router]);

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (advancedEnabled && !isMobile) {
      setSidebarOpen(true);
      setActiveTab("advanced");
    }
  }, [advancedEnabled, isMobile]);

  if (!doc) return null;

  const isAIActive = (sidebarOpen && activeTab === "ai") || isChatLoading;

  const handleTabClick = (tab: SidebarTab) => {
    if (sidebarOpen && activeTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveTab(tab);
    }
  };

  /* ══════════════════════════════════════════════
     MOBILE — AI chat or document preview
  ══════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        <header className={`flex items-center gap-2 px-3 h-12 border-b shrink-0 transition-colors duration-300 ${
          mobileTab === "ai" || isChatLoading
            ? "border-violet-500/25 bg-violet-950/15 dark:bg-violet-950/30"
            : "border-border/20 bg-background"
        }`}>
          <button
            onClick={() => router.push("/")}
            className="text-muted-foreground/60 p-1.5 -ml-1 rounded"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 text-sm font-medium text-foreground/70 truncate">
            {doc.metadata.title || t("header.untitled")}
          </span>
          <button
            onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground border border-border/30 hover:bg-muted/40 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="uppercase font-mono">{locale}</span>
          </button>
          {isChatLoading && <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />}
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === "ai" ? (
            <div className="h-full overflow-hidden flex flex-col"><AIChatPanel /></div>
          ) : (
            <div className="h-full overflow-auto"><DocumentEditor /></div>
          )}
        </div>

        <div className="flex border-t border-border/20 bg-background/95 backdrop-blur-sm shrink-0">
          {(["ai", "preview"] as const).map((tab) => {
            const isActive = mobileTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  isActive
                    ? tab === "ai" ? "text-violet-500 dark:text-violet-400" : "text-sky-500 dark:text-sky-400"
                    : "text-muted-foreground/50"
                }`}
              >
                {tab === "ai" ? <Bot className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                <span>{tab === "ai" ? t("mobile.tab.ai") : t("mobile.tab.preview")}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     DESKTOP — VSCode-style: editor + panel side by side
  ══════════════════════════════════════════════ */
  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background overflow-hidden">
      <AppHeader isAIActive={isAIActive} />

      {/* Edit toolbar — shown when edit mode is on */}
      {editMode && <EditToolbar />}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Document editor — always visible on desktop ── */}
        <div className="flex-1 overflow-auto min-w-0">
          <DocumentEditor />
        </div>

        {/* ── Right panel ── */}
        <div className={`border-l border-border/20 overflow-hidden bg-background/95 backdrop-blur-sm flex-shrink-0 flex flex-col ${sidebarOpen ? "w-96" : "w-0"}`}>
          {sidebarOpen && (
            <div className="w-96 h-full flex flex-col">
              {/* Panel title bar */}
              <div className={`relative flex items-center px-3 h-9 border-b border-border/20 shrink-0 select-none ${
                activeTab === "ai"       ? "bg-violet-950/10 dark:bg-violet-950/20" :
                activeTab === "advanced" ? "bg-amber-950/8 dark:bg-amber-950/15" : "bg-muted/10"
              }`}>
                {activeTab === "ai" && (
                  <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-violet-500/60 to-violet-400/20 rounded-r" />
                )}
                <span className={`text-[10px] font-semibold uppercase tracking-widest flex-1 ${
                  activeTab === "ai"       ? "text-violet-400/70" :
                  activeTab === "advanced" ? "text-amber-500/70 font-mono" : "text-muted-foreground/50"
                }`}>
                  {activeTab === "ai" ? t("panel.ai") : activeTab === "latex" ? t("panel.latex") : t("panel.advanced")}
                </span>
                {activeTab === "advanced" && advancedEnabled && (
                  <span className="mr-2 px-1.5 py-0.5 text-[8px] bg-amber-600 text-white rounded-full font-bold tracking-wide font-mono">ACTIVE</span>
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
              <div className={`flex-1 min-h-0 ${
                activeTab === "ai" || activeTab === "latex" ? "overflow-hidden flex flex-col" : "overflow-y-auto p-4"
              }`}>
                {activeTab === "ai"       && <AIChatPanel />}
                {activeTab === "advanced" && <AdvancedModePanel />}
                {activeTab === "latex"    && <LaTeXSourceViewer />}
              </div>
            </div>
          )}
        </div>

        {/* ── Activity bar (right edge) ── */}
        <div className="w-10 flex flex-col items-center pt-1 pb-1 border-l border-border/20 bg-background/70 shrink-0">
          {/* AI */}
          {(["ai", "latex"] as SidebarTab[]).map((tab) => {
            const Icon = tab === "ai" ? Bot : FileCode2;
            const color = tab === "ai" ? "text-violet-500 dark:text-violet-400" : "text-slate-400";
            const ind   = tab === "ai" ? "bg-violet-500" : "bg-slate-400";
            const label = tab === "ai" ? t("panel.ai") : t("panel.latex");
            const isActive = sidebarOpen && activeTab === tab;
            return (
              <button key={tab} onClick={() => handleTabClick(tab)} title={label}
                className={`relative h-10 w-full flex items-center justify-center transition-all ${
                  isActive ? `${color} bg-muted/30` : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/15"
                }`}
              >
                {isActive && <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full ${ind} opacity-80`} />}
                <Icon className="h-4 w-4" />
                {tab === "ai" && isChatLoading && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </button>
            );
          })}

          {/* Edit mode toggle */}
          <button
            onClick={() => setEditMode((v) => !v)}
            title={t("panel.edit")}
            className={`relative h-10 w-full flex items-center justify-center transition-all ${
              editMode ? "text-sky-500 dark:text-sky-400 bg-muted/30" : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/15"
            }`}
          >
            {editMode && <span className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-sky-500 opacity-80" />}
            <PenLine className="h-4 w-4" />
          </button>

          <div className="flex-1" />
          <div className="w-5 h-px bg-border/30 mb-1" />

          {/* Advanced — extension at bottom */}
          {(() => {
            const isActive = sidebarOpen && activeTab === "advanced";
            return (
              <button onClick={() => handleTabClick("advanced")} title={`${t("panel.advanced")} — LaTeX拡張`}
                className={`relative h-10 w-full flex items-center justify-center transition-all ${
                  isActive ? "text-amber-500 dark:text-amber-400 bg-muted/30" : "text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-muted/15"
                }`}
              >
                {isActive && <span className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-amber-500 opacity-80" />}
                <Terminal className="h-3.5 w-3.5" />
                {advancedEnabled && !isActive && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })()}

          {/* Language */}
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
