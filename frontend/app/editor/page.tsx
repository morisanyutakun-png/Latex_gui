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
import { Code2, Factory, Bot, FileCode2, X } from "lucide-react";

type SidebarTab = "ai" | "advanced" | "batch" | "latex";

interface TabMeta {
  label: string;
  icon: React.ElementType;
  activeColor: string;
  indicatorColor: string;
}

const TAB_META: Record<SidebarTab, TabMeta> = {
  ai:       { label: "AI AGENT",       icon: Bot,      activeColor: "text-violet-500 dark:text-violet-400", indicatorColor: "bg-violet-500" },
  advanced: { label: "ADVANCED",       icon: Code2,    activeColor: "text-purple-500 dark:text-purple-400", indicatorColor: "bg-purple-500" },
  batch:    { label: "BATCH PRODUCER", icon: Factory,  activeColor: "text-amber-500 dark:text-amber-400",   indicatorColor: "bg-amber-500"  },
  latex:    { label: "LATEX SOURCE",   icon: FileCode2,activeColor: "text-slate-500 dark:text-slate-400",   indicatorColor: "bg-slate-400"  },
};

const TAB_ORDER: SidebarTab[] = ["ai", "advanced", "batch", "latex"];

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const document = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore((s) => s.document?.advanced?.enabled ?? false);
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");

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

  const activeMeta = TAB_META[activeTab];

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background overflow-hidden">
      <AppHeader />
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
              <div className="flex items-center px-3 h-9 border-b border-border/20 bg-muted/10 shrink-0 select-none">
                <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest flex-1">
                  {activeMeta.label}
                </span>
                {activeTab === "advanced" && advancedEnabled && (
                  <span className="mr-2 px-1.5 py-0.5 text-[8px] bg-purple-600 text-white rounded-full font-bold tracking-wide">
                    ON
                  </span>
                )}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="パネルを閉じる"
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
                {activeTab === "batch"    && <BatchProducer embedded />}
                {activeTab === "latex"    && <LaTeXSourceViewer />}
              </div>
            </div>
          )}
        </div>

        {/* ── Activity bar — VS Code-style right-side icon strip ── */}
        <div className="w-10 flex flex-col items-center pt-1 pb-2 border-l border-border/20 bg-background/70 shrink-0">
          {TAB_ORDER.map((tab) => {
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
                {/* Active indicator — left edge of activity bar (facing the panel) */}
                {isActive && (
                  <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full ${meta.indicatorColor} opacity-80`} />
                )}
                <Icon className="h-4 w-4" />
                {/* Advanced mode dot */}
                {tab === "advanced" && advancedEnabled && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
