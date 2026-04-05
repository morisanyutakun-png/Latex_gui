"use client";

import { AppHeader } from "@/components/layout/app-header";
import { EditToolbar } from "@/components/layout/edit-toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AdvancedModePanel } from "@/components/editor/advanced-mode";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { PricingModal } from "@/components/pricing-modal";
import { LaTeXSourceViewer } from "@/components/editor/latex-source-viewer";
import { EditGuidePanel } from "@/components/editor/edit-guide-panel";
import { MathReferencePanel } from "@/components/editor/math-reference-panel";
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
import { Terminal, Sparkles, FileCode2, Globe, FileText, X, BookOpen, Sigma, ClipboardCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EditorHints } from "@/components/layout/editor-hints";

type SidebarTab = "ai" | "advanced" | "latex" | "guide" | "math" | "scoring";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isJa = locale !== "en";
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const isMathEditing = useUIStore((s) => s.isMathEditing);
  const activeGuideContext = useUIStore((s) => s.activeGuideContext);
  const isMobile = useIsMobile();

  const doc = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const advancedEnabled = useDocumentStore((s) => s.document?.advanced?.enabled ?? false);
  const router = useRouter();

  // Desktop state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");
  const { width: sidebarWidth, isDragging, handleMouseDown } = useResizePanel();

  // Mobile state
  const [mobileTab, setMobileTab] = useState<"ai" | "preview">("ai");

  // Handle ?new=1 from login redirect — create blank document
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1" && !doc) {
      setDocument(createDefaultDocument("blank", []));
      // Clean URL
      window.history.replaceState({}, "", "/editor");
    }
  }, [doc, setDocument]);

  useEffect(() => {
    if (!doc) router.push("/");
  }, [doc, router]);

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  // advancedEnabled が変わってもサイドバーを自動で切り替えない
  // ユーザーが手動でタブを選択する

  // 類題作成などでpendingChatMessageがセットされた場合も
  // サイドバーを自動で開かない（ユーザーが手動でAIタブを開く）
  const pendingChatMessage = useUIStore((s) => s.pendingChatMessage);

  // 数式編集コンテキストが変わってもガイドパネルを自動切替しない

  if (!doc) return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-surface-0 overflow-hidden animate-page-fade-in">
      {/* Skeleton header */}
      <div className="flex items-center gap-3 px-3 h-12 border-b border-border/40 bg-background/80 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-muted animate-skeleton-pulse" />
        <div className="h-5 w-24 rounded bg-muted animate-skeleton-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-24 rounded-full bg-muted animate-skeleton-pulse" />
      </div>
      {/* Skeleton body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col items-center py-10">
          <div className="w-[700px] max-w-full space-y-4 px-4">
            <div className="h-8 w-2/3 rounded bg-muted animate-skeleton-pulse" />
            <div className="h-4 w-full rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-4 w-5/6 rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-4 w-4/5 rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-20 w-full rounded-lg bg-muted/40 animate-skeleton-pulse mt-6" />
            <div className="h-4 w-3/4 rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-4 w-full rounded bg-muted/60 animate-skeleton-pulse" />
          </div>
        </div>
        <div className="w-11 border-l border-foreground/[0.04] bg-background/50 dark:bg-surface-0/60">
          <div className="flex flex-col items-center gap-2 pt-3">
            <div className="h-6 w-6 rounded bg-muted animate-skeleton-pulse" />
            <div className="h-6 w-6 rounded bg-muted animate-skeleton-pulse" />
            <div className="h-6 w-6 rounded bg-muted animate-skeleton-pulse" />
          </div>
        </div>
      </div>
      {/* Skeleton status bar */}
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

  // パネルタイトルと色設定
  const panelMeta: Record<SidebarTab, { label: string; bg: string; textColor: string; indicator: string }> = {
    ai:       { label: "EddivomAI",                                    bg: "bg-slate-900/5 dark:bg-surface-1/60",    textColor: "text-indigo-400/80 font-semibold tracking-wide", indicator: "bg-gradient-to-b from-indigo-500/70 to-violet-500/30" },
    advanced: { label: isJa ? "LaTeX拡張"      : "LaTeX Extensions", bg: "bg-amber-950/8 dark:bg-amber-950/15",   textColor: "text-amber-500/70 font-mono", indicator: "bg-amber-400" },
    latex:    { label: isJa ? "LaTeXソース"    : "LaTeX Source",     bg: "bg-muted/10",                           textColor: "text-muted-foreground/50",    indicator: "" },
    guide:    { label: isJa ? "編集ガイド"      : "Editing Guide",    bg: "bg-sky-950/8 dark:bg-sky-950/15",       textColor: "text-sky-400/80",             indicator: "bg-gradient-to-b from-sky-500/60 to-sky-400/20" },
    math:     { label: isJa ? "数式入力ガイド"  : "Math Reference",   bg: "bg-violet-950/10 dark:bg-violet-950/20", textColor: "text-violet-400/80",         indicator: "bg-gradient-to-b from-violet-500/60 to-violet-400/20" },
    scoring:  { label: isJa ? "採点"            : "Scoring",          bg: "bg-emerald-950/8 dark:bg-emerald-950/15", textColor: "text-emerald-400/80",       indicator: "bg-gradient-to-b from-emerald-500/60 to-emerald-400/20" },
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
            <div className="h-full overflow-auto"><DocumentEditor editMode={true} /></div>
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

  /* ══════════════════════════════════════════════
     DESKTOP — VSCode-style: editor + panel side by side
  ══════════════════════════════════════════════ */
  const meta = panelMeta[activeTab];

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-surface-0 overflow-hidden">
      {/* Header — spans full width */}
      <AppHeader isAIActive={isAIActive} />

      {/* Edit toolbar — always visible */}
      <EditToolbar />

      {/* Inline editing hints */}
      <EditorHints />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Document editor — always editable ── */}
        <div className="flex-1 overflow-auto min-w-0">
          <DocumentEditor editMode={true} />
        </div>

        {/* ── Resize handle ── */}
        {sidebarOpen && (
          <div
            className={`resize-handle ${isDragging ? "is-dragging" : ""}`}
            onMouseDown={handleMouseDown}
          />
        )}

        {/* ── Sidebar (panel + activity bar) ── */}
        <div className="flex flex-shrink-0 border-l border-foreground/[0.06] bg-background/95 dark:bg-surface-1/95 backdrop-blur-2xl">
          {/* Panel content */}
          <div
            className="overflow-hidden flex flex-col panel-depth"
            style={{
              width: sidebarOpen ? sidebarWidth : 0,
              transition: isDragging ? "none" : "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {sidebarOpen && (
              <div className="h-full flex flex-col min-w-0" style={{ width: sidebarWidth }}>
                {/* Panel title bar — ai タブはチャットパネル自身がヘッダーを持つため非表示 */}
                {activeTab !== "ai" && (
                  <div className={`relative flex items-center px-3 h-9 border-b border-foreground/[0.04] shrink-0 select-none ${meta.bg}`}>
                    {meta.indicator && (
                      <div className={`absolute left-0 top-0 h-full w-[2px] ${meta.indicator} rounded-r shadow-sm shadow-current`} />
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] flex-1 ${meta.textColor}`}>
                      {meta.label}
                    </span>
                    {activeTab === "advanced" && advancedEnabled && (
                      <span className="mr-2 px-1.5 py-0.5 text-[8px] bg-amber-500 text-white rounded font-bold tracking-wider font-mono shadow-sm shadow-amber-500/20">ON</span>
                    )}
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="h-6 w-6 flex items-center justify-center rounded-md text-foreground/15 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-all duration-200"
                      title={t("panel.close")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {/* Panel body */}
                <div className={`flex-1 min-h-0 animate-slide-in-right ${
                  activeTab === "ai" || activeTab === "latex" || activeTab === "scoring" ? "overflow-hidden flex flex-col" : "overflow-y-auto scrollbar-thin"
                }`} key={activeTab}>
                  {activeTab === "ai"       && <AIChatPanel />}
                  {activeTab === "advanced" && <AdvancedModePanel />}
                  {activeTab === "latex"    && <LaTeXSourceViewer />}
                  {activeTab === "guide"    && <EditGuidePanel context={activeGuideContext} />}
                  {activeTab === "math"     && <MathReferencePanel />}
                  {activeTab === "scoring"  && <ScoringPanel />}
                </div>
              </div>
            )}
          </div>

          {/* Activity bar — right edge */}
          <div className="activity-bar w-11 flex flex-col items-center pt-2 pb-2 gap-0.5 border-l border-foreground/[0.04] bg-surface-1/60 dark:bg-surface-0/70 shrink-0">
          {/* Main tabs */}
          {(["ai", "latex", "scoring"] as SidebarTab[]).map((tab) => {
            const Icon = tab === "ai" ? Sparkles : tab === "scoring" ? ClipboardCheck : FileCode2;
            const color = tab === "ai" ? "text-indigo-500 dark:text-indigo-400" : tab === "scoring" ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400";
            const ind   = tab === "ai" ? "bg-indigo-500" : tab === "scoring" ? "bg-emerald-500" : "bg-slate-400";
            const label = tab === "ai"
              ? (isJa ? "AIアシスタント" : "AI Assistant")
              : tab === "scoring"
              ? (isJa ? "採点" : "Scoring")
              : (isJa ? "LaTeXソース" : "LaTeX Source");
            const isActive = sidebarOpen && activeTab === tab;
            return (
              <button key={tab} onClick={() => handleTabClick(tab)} title={label}
                className={`activity-btn-glow relative h-10 w-full flex items-center justify-center rounded-lg mx-0.5 transition-all duration-200 ${
                  isActive ? `${color} bg-foreground/[0.05] ${tab === "ai" ? "active" : ""}` : "text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.04]"
                }`}
              >
                {isActive && <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full ${ind} shadow-[0_0_8px_-1px_currentColor] transition-all duration-300`} />}
                <Icon className={`h-[17px] w-[17px] transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                {tab === "ai" && isChatLoading && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-400 animate-pulse ring-2 ring-surface-0/80" />
                )}
              </button>
            );
          })}

          {/* Guide / Math */}
          <button
            onClick={() => handleTabClick(isMathEditing ? "math" : "guide")}
            title={isMathEditing
              ? (isJa ? "数式入力ガイド" : "Math reference")
              : (isJa ? "編集ガイド" : "Editing guide")}
            className={`activity-btn-glow relative h-10 w-full flex items-center justify-center rounded-lg mx-0.5 transition-all duration-200 ${
              sidebarOpen && (activeTab === "guide" || activeTab === "math")
                ? isMathEditing ? "text-violet-500 bg-foreground/[0.05]" : "text-sky-500 bg-foreground/[0.05]"
                : "text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            {sidebarOpen && (activeTab === "guide" || activeTab === "math") && (
              <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full transition-all duration-300 ${isMathEditing ? "bg-violet-500 shadow-[0_0_8px_-1px_theme(colors.violet.500)]" : "bg-sky-400 shadow-[0_0_8px_-1px_theme(colors.sky.400)]"}`} />
            )}
            {isMathEditing
              ? <Sigma className="h-4 w-4" />
              : <BookOpen className="h-4 w-4" />
            }
          </button>

          <div className="flex-1" />
          <div className="w-5 h-px bg-foreground/[0.04] mb-0.5" />

          {/* LaTeX拡張 */}
          {(() => {
            const isActive = sidebarOpen && activeTab === "advanced";
            return (
              <button
                onClick={() => handleTabClick("advanced")}
                title={isJa ? "LaTeX拡張（上級者向け）" : "LaTeX Extensions (advanced)"}
                className={`activity-btn-glow relative h-10 w-full flex items-center justify-center rounded-lg mx-0.5 transition-all duration-200 ${
                  isActive ? "text-amber-500 dark:text-amber-400 bg-foreground/[0.05]" : "text-foreground/15 hover:text-foreground/40 hover:bg-foreground/[0.04]"
                }`}
              >
                {isActive && <span className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-amber-500 shadow-[0_0_8px_-1px_theme(colors.amber.500)] transition-all duration-300" />}
                <Terminal className="h-4 w-4" />
                {advancedEnabled && !isActive && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-surface-0/80" />
                )}
              </button>
            );
          })()}

          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
            title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
            className="h-9 w-full flex flex-col items-center justify-center gap-0.5 rounded-lg mx-0.5 text-foreground/15 hover:text-foreground/40 hover:bg-foreground/[0.04] transition-all duration-200"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="text-[7px] font-mono uppercase tracking-wider">{locale === "ja" ? "EN" : "JA"}</span>
          </button>
          </div>{/* end activity bar */}
        </div>{/* end sidebar column */}
      </div>{/* end flex-1 */}

      <StatusBar />
      <PricingModal />
    </div>
  );
}
