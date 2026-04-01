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
import { Terminal, PenLine, Bot, FileCode2, Globe, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// "document" = editor view; others = full-panel views
type View = "document" | "ai" | "latex" | "advanced";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const isMobile = useIsMobile();

  const doc = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore((s) => s.document?.advanced?.enabled ?? false);
  const router = useRouter();

  const [view, setView] = useState<View>("document");
  const [editMode, setEditMode] = useState(false); // shows EditToolbar when in document view
  const [mobileTab, setMobileTab] = useState<"ai" | "preview">("ai");

  useEffect(() => {
    if (!doc) router.push("/");
  }, [doc, router]);

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (advancedEnabled && !isMobile) setView("advanced");
  }, [advancedEnabled, isMobile]);

  if (!doc) return null;

  const isAIActive = view === "ai" || isChatLoading;

  // Activity bar item click handler
  const handleView = (v: View) => {
    if (v === "document") {
      setView("document");
      return;
    }
    // Toggle: clicking the active panel icon goes back to document
    setView((prev) => (prev === v ? "document" : v));
  };

  const handleEditToggle = () => {
    if (view !== "document") {
      // Switch to document view and enable edit mode
      setView("document");
      setEditMode(true);
    } else {
      setEditMode((v) => !v);
    }
  };

  /* ══════════════════════════════════════════════
     MOBILE LAYOUT
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
            className="text-muted-foreground/60 hover:text-foreground p-1.5 -ml-1 rounded"
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
     DESKTOP LAYOUT — single view at a time
  ══════════════════════════════════════════════ */

  type BarItem =
    | { kind: "view"; id: View; icon: React.ElementType; label: string; color: string; indicator: string }
    | { kind: "edit" }
    | { kind: "spacer" }
    | { kind: "sep" }
    | { kind: "lang" };

  const BAR: BarItem[] = [
    { kind: "view", id: "document", icon: FileText,   label: t("panel.document"), color: "text-sky-500 dark:text-sky-400",    indicator: "bg-sky-500"    },
    { kind: "view", id: "ai",       icon: Bot,        label: t("panel.ai"),       color: "text-violet-500 dark:text-violet-400", indicator: "bg-violet-500" },
    { kind: "view", id: "latex",    icon: FileCode2,  label: t("panel.latex"),    color: "text-slate-400",                       indicator: "bg-slate-400"  },
    { kind: "edit" },
    { kind: "spacer" },
    { kind: "sep" },
    { kind: "view", id: "advanced", icon: Terminal,   label: t("panel.advanced"), color: "text-amber-500 dark:text-amber-400",   indicator: "bg-amber-500"  },
    { kind: "lang" },
  ];

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background overflow-hidden">
      <AppHeader isAIActive={isAIActive} />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Main area — editor OR panel, no transition ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {view === "document" ? (
            <>
              {editMode && <EditToolbar />}
              <div className="flex-1 overflow-auto">
                <DocumentEditor />
              </div>
            </>
          ) : (
            /* Full-width panel — editor is completely absent */
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Panel title bar */}
              <div className={`flex items-center px-4 h-9 border-b border-border/20 shrink-0 select-none ${
                view === "ai"       ? "bg-violet-950/10 dark:bg-violet-950/20" :
                view === "advanced" ? "bg-amber-950/8 dark:bg-amber-950/15" : "bg-muted/10"
              }`}>
                {view === "ai" && (
                  <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-violet-500/60 to-violet-400/20 rounded-r" />
                )}
                <span className={`text-[10px] font-semibold uppercase tracking-widest flex-1 ${
                  view === "ai"       ? "text-violet-400/70" :
                  view === "advanced" ? "text-amber-500/70 font-mono" : "text-muted-foreground/50"
                }`}>
                  {view === "ai"       ? t("panel.ai") :
                   view === "latex"    ? t("panel.latex") :
                   view === "advanced" ? t("panel.advanced") : ""}
                </span>
                {view === "advanced" && advancedEnabled && (
                  <span className="mr-2 px-1.5 py-0.5 text-[8px] bg-amber-600 text-white rounded-full font-bold tracking-wide font-mono">
                    ACTIVE
                  </span>
                )}
                {/* Back to editor */}
                <button
                  onClick={() => setView("document")}
                  className="flex items-center gap-1 h-5 px-2 rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/60 transition-colors text-[10px] font-mono"
                  title={t("panel.back.editor")}
                >
                  <FileText className="h-3 w-3" />
                </button>
              </div>

              {/* Panel body */}
              <div className={`flex-1 min-h-0 ${
                view === "ai" || view === "latex"
                  ? "overflow-hidden flex flex-col"
                  : "overflow-y-auto p-4"
              }`}>
                {view === "ai"       && <AIChatPanel />}
                {view === "advanced" && <AdvancedModePanel />}
                {view === "latex"    && <LaTeXSourceViewer />}
              </div>
            </div>
          )}
        </div>

        {/* ── Activity bar ── */}
        <div className="w-10 flex flex-col items-center pt-1 pb-1 border-l border-border/20 bg-background/70 shrink-0">
          {BAR.map((item, i) => {
            if (item.kind === "spacer") return <div key={i} className="flex-1" />;
            if (item.kind === "sep")    return <div key={i} className="w-5 h-px bg-border/30 mb-1" />;

            if (item.kind === "lang") return (
              <button
                key="lang"
                onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
                title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
                className="h-10 w-full flex flex-col items-center justify-center gap-0.5 text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-muted/15 transition-all"
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="text-[7px] font-mono uppercase">{locale === "ja" ? "EN" : "JA"}</span>
              </button>
            );

            if (item.kind === "edit") return (
              <button
                key="edit"
                onClick={handleEditToggle}
                title={t("panel.edit")}
                className={`relative h-10 w-full flex items-center justify-center transition-all ${
                  editMode && view === "document"
                    ? "text-sky-500 dark:text-sky-400 bg-muted/30"
                    : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/15"
                }`}
              >
                {editMode && view === "document" && (
                  <span className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-sky-500 opacity-80" />
                )}
                <PenLine className="h-4 w-4" />
              </button>
            );

            // view item
            const isActive = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleView(item.id)}
                title={item.label}
                className={`relative h-10 w-full flex items-center justify-center transition-all ${
                  isActive
                    ? `${item.color} bg-muted/30`
                    : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/15"
                }`}
              >
                {isActive && (
                  <span className={`absolute left-0 inset-y-2 w-[2px] rounded-r-full ${item.indicator} opacity-80`} />
                )}
                <Icon className="h-4 w-4" />
                {item.id === "ai" && isChatLoading && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
                {item.id === "advanced" && advancedEnabled && !isActive && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
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
