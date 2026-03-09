"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Toolbar } from "@/components/layout/toolbar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AdvancedModePanel } from "@/components/editor/advanced-mode";
import { BatchProducer } from "@/components/editor/batch-producer";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useDocumentStore } from "@/store/document-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Code2,
  Factory,
  PanelRightClose,
  FileText,
  Pen,
  Layers,
  ArrowRight,
  Download,
  Sparkles,
  BookOpen,
} from "lucide-react";

type SidebarTab = "advanced" | "batch";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const document = useDocumentStore((s) => s.document);
  const advancedEnabled = useDocumentStore(
    (s) => s.document?.advanced?.enabled ?? false
  );
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("advanced");

  // 上級者モードが有効化されたらサイドバーを自動展開
  useEffect(() => {
    if (advancedEnabled) {
      setSidebarOpen(true);
      setActiveTab("advanced");
    }
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

  const templateLabel =
    document.settings.documentClass === "article" ? "論文/レポート" :
    document.settings.documentClass === "report" ? "報告書" :
    document.settings.documentClass === "book" ? "書籍" :
    document.settings.documentClass === "beamer" ? "スライド" :
    document.settings.documentClass === "letter" ? "手紙" :
    document.settings.documentClass === "jlreq" ? "日本語文書" :
    document.settings.documentClass;

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background">
      <AppHeader />
      <Toolbar />

      {/* ═══ パイプラインステータスバー ═══ */}
      <div className="flex items-center justify-center gap-0 px-4 py-1.5 border-b border-border/20 bg-gradient-to-r from-blue-50/40 via-emerald-50/30 to-amber-50/40 dark:from-blue-950/10 dark:via-emerald-950/10 dark:to-amber-950/10">
        <PipelineStep
          icon={<Layers className="h-3 w-3" />}
          label="テンプレート選択"
          sublabel={templateLabel}
          color="blue"
          active={true}
          step={1}
        />
        <PipelineArrow />
        <PipelineStep
          icon={<Pen className="h-3 w-3" />}
          label="GUI入力"
          sublabel={`${document.blocks.length} ブロック編集中`}
          color="emerald"
          active={true}
          step={2}
        />
        <PipelineArrow />
        <PipelineStep
          icon={<FileText className="h-3 w-3" />}
          label="LaTeX生成"
          sublabel="自動変換"
          color="violet"
          active={document.blocks.length > 0}
          step={3}
        />
        <PipelineArrow />
        <PipelineStep
          icon={<Download className="h-3 w-3" />}
          label="PDF出力"
          sublabel="ヘッダーから実行"
          color="amber"
          active={false}
          step={4}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* メインエディタ */}
        <div className="flex-1 overflow-auto">
          <DocumentEditor />
        </div>

        {/* ═══ 右パネル タブボタン群 (常に表示) ═══ */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5">
          {/* パネル開閉ボタン */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200
                border border-border/30 bg-background/90 backdrop-blur-sm
                hover:bg-muted hover:border-border/60 shadow-sm"
              title="パネルを閉じる"
            >
              <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          {!sidebarOpen && (
            <>
              <button
                onClick={() => { setSidebarOpen(true); setActiveTab("advanced"); }}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200
                  border bg-background/90 backdrop-blur-sm shadow-sm
                  ${advancedEnabled
                    ? "border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                    : "border-border/30 hover:bg-muted hover:border-border/60"
                  }`}
                title="上級者モード"
              >
                <Code2 className={`h-3.5 w-3.5 ${advancedEnabled ? "text-purple-500" : "text-muted-foreground"}`} />
              </button>
              <button
                onClick={() => { setSidebarOpen(true); setActiveTab("batch"); }}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200
                  border border-amber-200 dark:border-amber-800 bg-background/90 backdrop-blur-sm shadow-sm
                  hover:bg-amber-50 dark:hover:bg-amber-950/30"
                title="教材工場"
              >
                <Factory className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </button>
            </>
          )}
        </div>

        {/* ═══ 右サイドパネル (タブ切替式) ═══ */}
        <div
          className={`
            border-l border-border/20 overflow-hidden bg-background/95 backdrop-blur-sm
            transition-all duration-300 ease-out flex-shrink-0 flex flex-col
            ${sidebarOpen ? "w-[22rem] opacity-100" : "w-0 opacity-0"}
          `}
        >
          {sidebarOpen && (
            <div className="animate-in fade-in duration-200 min-w-[21rem] flex flex-col h-full">
              {/* ── タブヘッダー ── */}
              <div className="flex border-b border-border/30 bg-muted/20 flex-shrink-0">
                <button
                  onClick={() => setActiveTab("advanced")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-all
                    ${activeTab === "advanced"
                      ? "text-purple-700 dark:text-purple-300 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                  <Code2 className="h-3 w-3" />
                  上級者モード
                  {advancedEnabled && (
                    <span className="px-1 py-0 text-[7px] bg-purple-600 text-white rounded-full">
                      ON
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("batch")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-all
                    ${activeTab === "batch"
                      ? "text-amber-700 dark:text-amber-300 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                  <Factory className="h-3 w-3" />
                  教材工場
                </button>
              </div>

              {/* ── タブコンテンツ ── */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "advanced" && <AdvancedModePanel />}
                {activeTab === "batch" && <BatchProducer embedded />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── パイプラインステップ ── */
function PipelineStep({ icon, label, sublabel, color, active, step }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: "emerald" | "blue" | "violet" | "amber";
  active: boolean;
  step: number;
}) {
  const colors = {
    emerald: active
      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
      : "bg-muted/30 text-muted-foreground/50 border-border/30",
    blue: active
      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
      : "bg-muted/30 text-muted-foreground/50 border-border/30",
    violet: active
      ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800"
      : "bg-muted/30 text-muted-foreground/50 border-border/30",
    amber: active
      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
      : "bg-muted/30 text-muted-foreground/50 border-border/30",
  };

  const stepColors = {
    emerald: active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground/50",
    blue: active ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground/50",
    violet: active ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground/50",
    amber: active ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground/50",
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all ${colors[color]}`}>
      <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold ${stepColors[color]}`}>
        {step}
      </span>
      {icon}
      <div className="flex flex-col leading-none">
        <span className="font-semibold text-[10px]">{label}</span>
        <span className="text-[8px] opacity-70 mt-0.5">{sublabel}</span>
      </div>
    </div>
  );
}

function PipelineArrow() {
  return <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-1 shrink-0" />;
}
