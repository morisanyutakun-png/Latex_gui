"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Toolbar } from "@/components/layout/toolbar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AdvancedModePanel } from "@/components/editor/advanced-mode";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useDocumentStore } from "@/store/document-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Code2, PanelRightClose, PanelRightOpen } from "lucide-react";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const document = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore(
    (s) => s.document?.advanced?.enabled ?? false
  );
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 上級者モードが有効化されたらサイドバーを自動展開
  useEffect(() => {
    if (advancedEnabled) setSidebarOpen(true);
  }, [advancedEnabled]);

  // Redirect to home if no document loaded
  useEffect(() => {
    if (!document) {
      router.push("/");
    }
  }, [document, router]);

  // エディタを開いた瞬間にバックエンド (Koyeb) を起こす
  useEffect(() => {
    const warmup = async () => {
      try {
        await fetch("/api/health", { signal: AbortSignal.timeout(15000) });
      } catch {
        // 失敗しても問題ない — PDF生成時にリトライされる
      }
    };
    warmup();
  }, []);

  if (!document) return null;

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background">
      <AppHeader />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* メインエディタ */}
        <div className="flex-1 overflow-auto">
          <DocumentEditor />
        </div>

        {/* サイドバー トグルボタン (常に表示) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`
            absolute top-3 z-20 h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300
            border border-border/30 bg-background/80 backdrop-blur-sm
            hover:bg-muted hover:border-border/60 shadow-sm
            ${sidebarOpen ? "right-[calc(18rem+0.75rem)]" : "right-3"}
          `}
          title={sidebarOpen ? "パネルを閉じる" : "上級者モード"}
        >
          {sidebarOpen ? (
            <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Code2
              className={`h-3.5 w-3.5 ${
                advancedEnabled
                  ? "text-purple-500"
                  : "text-muted-foreground"
              }`}
            />
          )}
        </button>

        {/* サイドバー: 上級者モード (スライドイン) */}
        <div
          className={`
            border-l border-border/20 overflow-y-auto bg-background/95 backdrop-blur-sm
            transition-all duration-300 ease-out flex-shrink-0
            ${
              sidebarOpen
                ? "w-72 p-3 opacity-100"
                : "w-0 p-0 opacity-0 overflow-hidden"
            }
          `}
        >
          {sidebarOpen && (
            <div className="animate-in fade-in duration-200 min-w-[16.5rem]">
              <AdvancedModePanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
