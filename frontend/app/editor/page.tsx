"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Toolbar } from "@/components/layout/toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AdvancedModePanel } from "@/components/editor/advanced-mode";
import { BatchProducer } from "@/components/editor/batch-producer";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { LaTeXSourceViewer } from "@/components/editor/latex-source-viewer";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useDocumentStore } from "@/store/document-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Code2,
  Factory,
  PanelRightClose,
  Bot,
  FileCode2,
} from "lucide-react";

type SidebarTab = "ai" | "advanced" | "batch" | "latex";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const document = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore(
    (s) => s.document?.advanced?.enabled ?? false
  );
  const router = useRouter();

  // AI panel open by default
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");

  // Redirect to home if no document loaded
  useEffect(() => {
    if (!document) {
      router.push("/");
    }
  }, [document, router]);

  // Warm up backend (Koyeb cold start)
  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  // Auto-open Advanced tab when advanced mode is toggled on
  useEffect(() => {
    if (advancedEnabled) {
      setSidebarOpen(true);
      setActiveTab("advanced");
    }
  }, [advancedEnabled]);

  if (!document) return null;

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background overflow-hidden">
      <AppHeader />
      <Toolbar />

      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Main editor */}
        <div className="flex-1 overflow-auto">
          <DocumentEditor />
        </div>

        {/* ── Sidebar toggle button (when closed) ── */}
        {!sidebarOpen && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5">
            <button
              onClick={() => { setSidebarOpen(true); setActiveTab("ai"); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all
                border border-violet-200 dark:border-violet-800 bg-background/90 backdrop-blur-sm shadow-sm
                hover:bg-violet-50 dark:hover:bg-violet-950/30"
              title="AIエージェントを開く"
            >
              <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveTab("advanced"); }}
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all
                border bg-background/90 backdrop-blur-sm shadow-sm
                ${advancedEnabled
                  ? "border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  : "border-border/30 hover:bg-muted hover:border-border/60"}`}
              title="上級者モード"
            >
              <Code2 className={`h-3.5 w-3.5 ${advancedEnabled ? "text-purple-500" : "text-muted-foreground"}`} />
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveTab("batch"); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all
                border border-amber-200 dark:border-amber-800 bg-background/90 backdrop-blur-sm shadow-sm
                hover:bg-amber-50 dark:hover:bg-amber-950/30"
              title="教材工場"
            >
              <Factory className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveTab("latex"); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all
                border border-slate-200 dark:border-slate-700 bg-background/90 backdrop-blur-sm shadow-sm
                hover:bg-slate-50 dark:hover:bg-slate-900"
              title="LaTeXソース"
            >
              <FileCode2 className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>
        )}

        {/* ── Right sidebar panel ── */}
        <div
          className={`
            border-l border-border/20 overflow-hidden bg-background/95 backdrop-blur-sm
            transition-all duration-300 ease-out flex-shrink-0 flex flex-col
            ${sidebarOpen ? "w-[26rem] opacity-100" : "w-0 opacity-0"}
          `}
        >
          {sidebarOpen && (
            <div className="animate-in fade-in duration-200 min-w-[25rem] flex flex-col h-full">
              {/* Tab header */}
              <div className="flex items-center border-b border-border/30 bg-muted/20 flex-shrink-0">
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-all whitespace-nowrap
                    ${activeTab === "ai"
                      ? "text-violet-700 dark:text-violet-300 border-b-2 border-violet-500 bg-violet-50/50 dark:bg-violet-950/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                  <Bot className="h-3 w-3" />
                  AIエージェント
                </button>
                <button
                  onClick={() => setActiveTab("advanced")}
                  className={`flex items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-all whitespace-nowrap
                    ${activeTab === "advanced"
                      ? "text-purple-700 dark:text-purple-300 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                  <Code2 className="h-3 w-3" />
                  {advancedEnabled && (
                    <span className="px-1 py-0 text-[7px] bg-purple-600 text-white rounded-full">ON</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("batch")}
                  className={`flex items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-all whitespace-nowrap
                    ${activeTab === "batch"
                      ? "text-amber-700 dark:text-amber-300 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                  <Factory className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setActiveTab("latex")}
                  className={`flex items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-all whitespace-nowrap
                    ${activeTab === "latex"
                      ? "text-slate-700 dark:text-slate-300 border-b-2 border-slate-500 bg-slate-50/50 dark:bg-slate-900/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                  <FileCode2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="px-2 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  title="パネルを閉じる"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Tab content */}
              <div className={`flex-1 min-h-0 ${activeTab === "ai" || activeTab === "latex" ? "overflow-hidden flex flex-col" : "overflow-y-auto p-4"}`}>
                {activeTab === "ai" && <AIChatPanel />}
                {activeTab === "advanced" && <AdvancedModePanel />}
                {activeTab === "batch" && <BatchProducer embedded />}
                {activeTab === "latex" && <LaTeXSourceViewer />}
              </div>
            </div>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
