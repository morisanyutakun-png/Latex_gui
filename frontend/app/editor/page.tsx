"use client";

import { AppHeader } from "@/components/layout/app-header";
import { EditToolbar } from "@/components/layout/edit-toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { PricingModal } from "@/components/pricing-modal";
import { ScoringPanel } from "@/components/editor/scoring-panel";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useResizePanel } from "@/hooks/use-resize-panel";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createDefaultDocument } from "@/lib/types";
import { Sparkles, Globe, FileText, X, ClipboardCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EditorHints } from "@/components/layout/editor-hints";
import { OMRSplitView } from "@/components/omr/omr-split-view";

type SidebarTab = "ai" | "scoring";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const isMobile = useIsMobile();

  const doc = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");
  const { width: sidebarWidth, isDragging, handleMouseDown } = useResizePanel();

  const [mobileTab, setMobileTab] = useState<"ai" | "preview">("ai");

  // Handle ?new=1 from login redirect — create blank document
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1" && !doc) {
      setDocument(createDefaultDocument("blank", ""));
      window.history.replaceState({}, "", "/editor");
    }
  }, [doc, setDocument]);

  useEffect(() => {
    if (!doc) router.push("/");
  }, [doc, router]);

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  if (!doc) return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-surface-0 overflow-hidden animate-page-fade-in">
      <div className="flex items-center gap-3 px-3 h-12 border-b border-border/40 bg-background/80 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-muted animate-skeleton-pulse" />
        <div className="h-5 w-24 rounded bg-muted animate-skeleton-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-24 rounded-full bg-muted animate-skeleton-pulse" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col items-center py-10">
          <div className="w-[700px] max-w-full space-y-4 px-4">
            <div className="h-8 w-2/3 rounded bg-muted animate-skeleton-pulse" />
            <div className="h-4 w-full rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-4 w-5/6 rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-20 w-full rounded-lg bg-muted/40 animate-skeleton-pulse mt-6" />
          </div>
        </div>
        <div className="w-11 border-l border-foreground/[0.04] bg-background/50 dark:bg-surface-0/60" />
      </div>
      <div className="h-6 bg-surface-1 dark:bg-surface-0 border-t border-border/30" />
    </div>
  );

  const isAIActive = (sidebarOpen && activeTab === "ai") || isChatLoading;

  const handleTabClick = (tab: SidebarTab) => {
    if (sidebarOpen && activeTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveTab(tab);
    }
  };

  const panelMeta: Record<SidebarTab, { label: string; bg: string; textColor: string; indicator: string }> = {
    ai:      { label: "EddivomAI", bg: "bg-amber-950/5 dark:bg-amber-950/15", textColor: "text-amber-500/80 font-semibold tracking-wide", indicator: "bg-gradient-to-b from-amber-500/70 to-amber-400/30" },
    scoring: { label: t("side.scoring.label"), bg: "bg-emerald-950/8 dark:bg-emerald-950/15", textColor: "text-emerald-400/80", indicator: "bg-gradient-to-b from-emerald-500/60 to-emerald-400/20" },
  };

  /* ══════════ MOBILE ══════════ */
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        <header className="flex items-center gap-2 px-3 h-12 border-b shrink-0 transition-colors duration-300 border-border/20 bg-background">
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

        <PricingModal />
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
                {tab === "ai" ? <Sparkles className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                <span>{tab === "ai" ? t("mobile.tab.ai") : t("mobile.tab.preview")}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ══════════ DESKTOP ══════════ */
  const meta = panelMeta[activeTab];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f4f0] dark:bg-[#111110]">
      <OMRSplitView />

      <AppHeader isAIActive={isAIActive} />

      <EditToolbar />

      <EditorHints />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden min-w-0">
          <DocumentEditor />
        </div>

        {sidebarOpen && (
          <div
            className={`resize-handle ${isDragging ? "is-dragging" : ""}`}
            onMouseDown={handleMouseDown}
          />
        )}

        <div className="flex flex-shrink-0 sidebar-card bg-[#f9f9f8] dark:bg-[#111110] overflow-hidden shadow-[-1px_0_0_0_hsl(var(--border)/0.4)]">
          <div
            className="overflow-hidden flex flex-col panel-depth"
            style={{
              width: sidebarOpen ? sidebarWidth : 0,
              transition: isDragging ? "none" : "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {sidebarOpen && (
              <div className="h-full flex flex-col min-w-0" style={{ width: sidebarWidth }}>
                {activeTab !== "ai" && (
                  <div className={`relative flex items-center px-3 h-9 border-b border-foreground/[0.04] shrink-0 select-none ${meta.bg}`}>
                    {meta.indicator && (
                      <div className={`absolute left-0 top-0 h-full w-[2px] ${meta.indicator} rounded-r shadow-sm shadow-current`} />
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] flex-1 ${meta.textColor}`}>
                      {meta.label}
                    </span>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="h-6 w-6 flex items-center justify-center rounded-md text-foreground/15 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-all duration-200"
                      title={t("panel.close")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className={`flex-1 min-h-0 animate-slide-in-right ${
                  activeTab === "ai" || activeTab === "scoring" ? "overflow-hidden flex flex-col" : "overflow-y-auto scrollbar-thin"
                }`} key={activeTab}>
                  {activeTab === "ai" && <AIChatPanel />}
                  {activeTab === "scoring" && <ScoringPanel />}
                </div>
              </div>
            )}
          </div>

          <div className="activity-bar w-11 flex flex-col items-center pt-2 pb-2 gap-0.5 border-l border-foreground/[0.05] bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
            {(() => {
              const isActive = sidebarOpen && activeTab === "ai";
              return (
                <button onClick={() => handleTabClick("ai")} title={t("side.tooltip.ai")}
                  className={`relative h-10 w-full flex items-center justify-center transition-all duration-200 ${
                    isActive ? "" : "text-foreground/25 hover:text-amber-500/80 hover:bg-amber-50/50 dark:hover:bg-amber-500/10 rounded-lg mx-0.5"
                  }`}
                >
                  {isActive ? (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/30 transition-all duration-200">
                      <Sparkles className="h-[15px] w-[15px] text-white" />
                    </div>
                  ) : (
                    <Sparkles className="h-[17px] w-[17px]" />
                  )}
                  {isChatLoading && (
                    <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full animate-pulse ring-2 ${
                      isActive ? "bg-white ring-amber-600/60" : "bg-amber-500 ring-surface-0/80"
                    }`} />
                  )}
                </button>
              );
            })()}

            {(() => {
              const isActive = sidebarOpen && activeTab === "scoring";
              return (
                <button onClick={() => handleTabClick("scoring")} title={t("side.tooltip.scoring")}
                  className={`activity-btn-glow relative h-10 w-full flex items-center justify-center rounded-lg mx-0.5 transition-all duration-200 ${
                    isActive ? "text-emerald-500 dark:text-emerald-400 bg-foreground/[0.05]" : "text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.04]"
                  }`}
                >
                  {isActive && <span className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-emerald-500 shadow-[0_0_8px_-1px_currentColor] transition-all duration-300" />}
                  <ClipboardCheck className={`h-[17px] w-[17px] transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                </button>
              );
            })()}

            <div className="flex-1" />

            <button
              onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
              title={locale === "ja" ? t("side.tooltip.lang.toEn") : t("side.tooltip.lang.toJa")}
              className="h-9 w-full flex flex-col items-center justify-center gap-0.5 rounded-lg mx-0.5 text-foreground/15 hover:text-foreground/40 hover:bg-foreground/[0.04] transition-all duration-200"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[7px] font-mono uppercase tracking-wider">{locale === "ja" ? "EN" : "JA"}</span>
            </button>
          </div>
        </div>
      </div>

      <StatusBar />
      <PricingModal />
    </div>
  );
}
