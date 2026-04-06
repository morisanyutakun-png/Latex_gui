"use client";

import React from "react";
import { X, FileCode2, FlaskConical, BarChart3, GitBranch, Zap, Code2 } from "lucide-react";
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
import { LaTeXBlockControls } from "./document-editor";

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
    <pre className="text-xs leading-relaxed font-mono whitespace-pre overflow-x-auto p-3">
      {tokens.map((tok, i) => (
        <span key={i} className={KIND_CLASS[tok.kind]}>{tok.text}</span>
      ))}
    </pre>
  );
}

export function LeftReviewPanel() {
  const editingBlockId = useUIStore((s) => s.editingBlockId);
  const latexInspectSource = useUIStore((s) => s.latexInspectSource);
  const closeLeftPanel = useUIStore((s) => s.closeLeftPanel);
  const blocks = useDocumentStore((s) => s.document?.blocks ?? []);

  // LaTeX inspect mode takes priority
  if (latexInspectSource !== null) {
    return (
      <div className="h-full flex flex-col min-w-0">
        {/* Header */}
        <div className="relative flex items-center px-3 h-9 border-b border-foreground/[0.04] shrink-0 select-none bg-violet-50/50 dark:bg-violet-950/20">
          <div className="absolute left-0 top-0 h-full w-[2px] bg-violet-500 rounded-r shadow-sm shadow-current" />
          <FileCode2 className="h-3.5 w-3.5 text-violet-500 mr-1.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] flex-1 text-violet-600 dark:text-violet-300">
            LaTeX ソース確認
          </span>
          <button
            onClick={closeLeftPanel}
            className="h-6 w-6 flex items-center justify-center rounded-md text-foreground/15 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-all duration-200"
            title="閉じる"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-background">
          <HighlightedSource source={latexInspectSource} />
        </div>
        {/* Footer */}
        <div className="shrink-0 border-t border-foreground/[0.06] px-3 py-2 bg-muted/30">
          <button
            onClick={closeLeftPanel}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
          >
            確定
          </button>
        </div>
      </div>
    );
  }

  // Block-edit mode: only for heavy blocks
  if (editingBlockId !== null) {
    const block = blocks.find((b) => b.id === editingBlockId);
    if (!block || !HEAVY_BLOCK_TYPES.has(block.content.type as BlockType)) return null;

    const blockType = block.content.type;
    const Icon = HEAVY_BLOCK_ICON[blockType] || Code2;
    const label = HEAVY_BLOCK_LABEL[blockType] || blockType;

    return (
      <div className="h-full flex flex-col min-w-0">
        {/* Header */}
        <div className="relative flex items-center px-3 h-9 border-b border-foreground/[0.04] shrink-0 select-none bg-amber-50/40 dark:bg-amber-950/20">
          <div className="absolute left-0 top-0 h-full w-[2px] bg-amber-500 rounded-r shadow-sm shadow-current" />
          <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mr-1.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] flex-1 text-amber-700 dark:text-amber-300">
            ブロック編集 — {label}
          </span>
          <button
            onClick={closeLeftPanel}
            className="h-6 w-6 flex items-center justify-center rounded-md text-foreground/15 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-all duration-200"
            title="閉じる"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 py-3">
          {blockType === "chemistry" && <ChemistryBlockControls block={block} />}
          {blockType === "chart" && <ChartBlockControls block={block} />}
          {blockType === "circuit" && <CircuitBlockControls block={block} />}
          {blockType === "diagram" && <DiagramBlockControls block={block} />}
          {blockType === "latex" && <LaTeXBlockControls block={block} />}
        </div>
      </div>
    );
  }

  return null;
}
