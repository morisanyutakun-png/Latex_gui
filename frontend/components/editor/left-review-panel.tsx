"use client";

import React from "react";
import {
  X, FileCode2, FlaskConical, BarChart3, GitBranch, Zap, Code2, Command,
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

/**
 * Reusable header bar for the LeftReviewPanel.
 * Square corners, thick border to match the squared design language.
 */
function PanelHeader({
  Icon, label, accent, onClose,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: { text: string; bg: string; bar: string };
  onClose: () => void;
}) {
  return (
    <div className={`relative flex items-center px-4 h-11 border-b-[3px] border-foreground/15 shrink-0 select-none ${accent.bg}`}>
      <div className={`absolute left-0 top-0 h-full w-[3px] ${accent.bar}`} />
      <Icon className={`h-4 w-4 ${accent.text} mr-2`} />
      <span className={`text-[11px] font-bold uppercase tracking-[0.18em] flex-1 ${accent.text}`}>
        {label}
      </span>
      <button
        onClick={onClose}
        className="h-7 w-7 flex items-center justify-center rounded-none text-foreground/30 hover:text-foreground/80 hover:bg-foreground/[0.08] border-2 border-transparent hover:border-foreground/15 transition-all"
        title="閉じる"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function LeftReviewPanel() {
  const editingBlockId = useUIStore((s) => s.editingBlockId);
  const latexInspectSource = useUIStore((s) => s.latexInspectSource);
  const latexSourceViewerOpen = useUIStore((s) => s.latexSourceViewerOpen);
  const showGlobalPalette = useUIStore((s) => s.showGlobalPalette);
  const closeLeftPanel = useUIStore((s) => s.closeLeftPanel);
  const blocks = useDocumentStore((s) => s.document?.blocks ?? []);

  // Priority order:
  // 1. command-palette (user just pressed Cmd+K)
  // 2. block-edit (user is editing a heavy block)
  // 3. latex-inspect (AI surfaced a LaTeX source via tool call)
  // 4. latex-source (user opened the LaTeX source viewer from the activity bar)

  if (showGlobalPalette) {
    return (
      <div className="h-full flex flex-col min-w-0">
        <PanelHeader
          Icon={Command}
          label="ブロック挿入"
          accent={{
            text: "text-indigo-700 dark:text-indigo-300",
            bg: "bg-indigo-50/60 dark:bg-indigo-950/30",
            bar: "bg-indigo-500",
          }}
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

      return (
        <div className="h-full flex flex-col min-w-0">
          <PanelHeader
            Icon={Icon}
            label={`ブロック編集 — ${label}`}
            accent={{
              text: "text-amber-700 dark:text-amber-300",
              bg: "bg-amber-50/60 dark:bg-amber-950/30",
              bar: "bg-amber-500",
            }}
            onClose={closeLeftPanel}
          />
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-4">
            {blockType === "chemistry" && <ChemistryBlockControls block={block} />}
            {blockType === "chart" && <ChartBlockControls block={block} />}
            {blockType === "circuit" && <CircuitBlockControls block={block} />}
            {blockType === "diagram" && <DiagramBlockControls block={block} />}
            {blockType === "latex" && <LaTeXBlockControls block={block} />}
          </div>
        </div>
      );
    }
  }

  if (latexInspectSource !== null) {
    return (
      <div className="h-full flex flex-col min-w-0">
        <PanelHeader
          Icon={FileCode2}
          label="LaTeX ソース確認 (AI)"
          accent={{
            text: "text-violet-700 dark:text-violet-300",
            bg: "bg-violet-50/60 dark:bg-violet-950/30",
            bar: "bg-violet-500",
          }}
          onClose={closeLeftPanel}
        />
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-background">
          <HighlightedSource source={latexInspectSource} />
        </div>
        <div className="shrink-0 border-t-[3px] border-foreground/15 px-4 py-3 bg-muted/30">
          <button
            onClick={closeLeftPanel}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white bg-violet-600 hover:bg-violet-700 border-2 border-violet-700 transition-colors"
          >
            確定
          </button>
        </div>
      </div>
    );
  }

  if (latexSourceViewerOpen) {
    return (
      <div className="h-full flex flex-col min-w-0">
        <PanelHeader
          Icon={FileCode2}
          label="LaTeX ソース"
          accent={{
            text: "text-slate-700 dark:text-slate-300",
            bg: "bg-slate-100/80 dark:bg-slate-900/50",
            bar: "bg-slate-500",
          }}
          onClose={closeLeftPanel}
        />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <LaTeXSourceViewer />
        </div>
      </div>
    );
  }

  return null;
}
