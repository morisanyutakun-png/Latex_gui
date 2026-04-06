"use client";

import React from "react";
import {
  X, FileCode2, FlaskConical, BarChart3, GitBranch, Zap, Code2, Command, Check,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { HEAVY_BLOCK_TYPES, BlockType } from "@/lib/types";
import { tokenize, KIND_CLASS } from "@/lib/latex-syntax";
import {
  ChemistryBlockControls,
  ChartBlockControls,
  CircuitBlockControls,
  DiagramBlockControls,
} from "./engineering-editors";
import { LaTeXBlockControls, CommandPaletteContent } from "./document-editor";
import { LaTeXSourceViewer } from "./latex-source-viewer";

const HEAVY_BLOCK_LABEL: Record<string, string> = {
  chemistry: "化学式",
  chart: "グラフ",
  circuit: "回路図",
  diagram: "ダイアグラム",
  latex: "LaTeX",
};

const HEAVY_BLOCK_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  chemistry: FlaskConical,
  chart: BarChart3,
  circuit: Zap,
  diagram: GitBranch,
  latex: Code2,
};

const HEAVY_BLOCK_ACCENT: Record<string, string> = {
  chemistry: "text-lime-600 dark:text-lime-400",
  chart: "text-rose-600 dark:text-rose-400",
  circuit: "text-cyan-600 dark:text-cyan-400",
  diagram: "text-indigo-600 dark:text-indigo-400",
  latex: "text-fuchsia-600 dark:text-fuchsia-400",
};

/**
 * Refined OMR-style header for the LeftReviewPanel.
 * Neutral background, subtle border, mode icon + label on the left,
 * optional context info, action buttons + close X on the right.
 */
function PanelHeader({
  Icon,
  iconAccent,
  label,
  context,
  onClose,
  rightAction,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  iconAccent: string;
  label: string;
  context?: string;
  onClose: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="h-12 border-b border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${iconAccent}`} />
        <span className="text-sm font-medium text-foreground/90 truncate">{label}</span>
        {context && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{context}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightAction}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * OMR-style section label — subtle bar that delineates content areas
 * inside the body (matches the "入力ファイル" / "抽出結果" labels in OMRSplitView).
 */
function SectionLabel({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2 border-b border-border/20 bg-muted/30 flex items-center justify-between shrink-0">
      <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        {children}
      </span>
      {meta && (
        <span className="text-[10px] text-muted-foreground">{meta}</span>
      )}
    </div>
  );
}

function HighlightedSource({ source }: { source: string }) {
  const tokens = tokenize(source);
  return (
    <pre className="text-[12px] leading-relaxed font-mono whitespace-pre overflow-x-auto p-4">
      {tokens.map((tok, i) => (
        <span key={i} className={KIND_CLASS[tok.kind]}>{tok.text}</span>
      ))}
    </pre>
  );
}

export function LeftReviewPanel() {
  const editingBlockId = useUIStore((s) => s.editingBlockId);
  const latexInspectSource = useUIStore((s) => s.latexInspectSource);
  const latexSourceViewerOpen = useUIStore((s) => s.latexSourceViewerOpen);
  const showGlobalPalette = useUIStore((s) => s.showGlobalPalette);
  const closeLeftPanel = useUIStore((s) => s.closeLeftPanel);
  const blocks = useDocumentStore((s) => s.document?.blocks ?? []);

  // Priority: command-palette → block-edit → latex-inspect → latex-source

  if (showGlobalPalette) {
    return (
      <div className="h-full flex flex-col min-w-0 bg-background">
        <PanelHeader
          Icon={Command}
          iconAccent="text-indigo-500"
          label="ブロック挿入"
          context="Cmd+K"
          onClose={closeLeftPanel}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <CommandPaletteContent />
        </div>
      </div>
    );
  }

  if (editingBlockId !== null) {
    const block = blocks.find((b) => b.id === editingBlockId);
    if (block && HEAVY_BLOCK_TYPES.has(block.content.type as BlockType)) {
      const blockType = block.content.type;
      const Icon = HEAVY_BLOCK_ICON[blockType] || Code2;
      const label = HEAVY_BLOCK_LABEL[blockType] || blockType;
      const accent = HEAVY_BLOCK_ACCENT[blockType] || "text-amber-500";

      return (
        <div className="h-full flex flex-col min-w-0 bg-background">
          <PanelHeader
            Icon={Icon}
            iconAccent={accent}
            label="ブロック編集"
            context={label}
            onClose={closeLeftPanel}
            rightAction={
              <button
                onClick={closeLeftPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                確定
              </button>
            }
          />
          <SectionLabel meta={`ID: ${block.id.slice(0, 8)}`}>プロパティ</SectionLabel>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="max-w-[640px] mx-auto p-4">
              {blockType === "chemistry" && <ChemistryBlockControls block={block} />}
              {blockType === "chart" && <ChartBlockControls block={block} />}
              {blockType === "circuit" && <CircuitBlockControls block={block} />}
              {blockType === "diagram" && <DiagramBlockControls block={block} />}
              {blockType === "latex" && <LaTeXBlockControls block={block} />}
            </div>
          </div>
        </div>
      );
    }
  }

  if (latexInspectSource !== null) {
    const lineCount = latexInspectSource.split("\n").length;
    return (
      <div className="h-full flex flex-col min-w-0 bg-background">
        <PanelHeader
          Icon={FileCode2}
          iconAccent="text-violet-500"
          label="LaTeX ソース"
          context="AI 参照結果"
          onClose={closeLeftPanel}
          rightAction={
            <button
              onClick={closeLeftPanel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              確定
            </button>
          }
        />
        <SectionLabel meta={`${lineCount} 行`}>コード</SectionLabel>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <HighlightedSource source={latexInspectSource} />
        </div>
      </div>
    );
  }

  if (latexSourceViewerOpen) {
    // LaTeXSourceViewer's own toolbar serves as the panel header (with close X built in).
    return (
      <div className="h-full flex flex-col min-w-0 bg-background">
        <LaTeXSourceViewer onClose={closeLeftPanel} />
      </div>
    );
  }

  return null;
}
