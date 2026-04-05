"use client";

import { useEffect, useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType } from "@/lib/types";
import {
  Heading, Type, Sigma, List, Table, ImageIcon,
  Minus, Code, Quote, Zap, GitBranch, FlaskConical, BarChart3, FileCode, X,
} from "lucide-react";

const OUTLINE_ICONS: Record<BlockType, React.ElementType> = {
  heading: Heading, paragraph: Type, math: Sigma, list: List,
  table: Table, image: ImageIcon, divider: Minus, code: Code,
  quote: Quote, circuit: Zap, diagram: GitBranch,
  chemistry: FlaskConical, chart: BarChart3, latex: FileCode,
};

function getPreview(block: Block): string {
  const c = block.content;
  switch (c.type) {
    case "heading":   return c.text || "(空の見出し)";
    case "paragraph": return (c.text || "(空のテキスト)").slice(0, 45);
    case "math":      return c.latex ? `$${c.latex.slice(0, 28)}$` : "(空の数式)";
    case "list":      return c.items[0] ? c.items[0].slice(0, 45) : "(空のリスト)";
    case "table":     return c.headers.join(" · ").slice(0, 45);
    case "code":      return c.language ? `[${c.language}]` : "[コード]";
    case "quote":     return (c.text || "").slice(0, 45);
    case "chemistry": return c.formula.slice(0, 30) || "(化学式)";
    case "chart":     return `[${c.chartType}グラフ]`;
    case "circuit":   return "[回路図]";
    case "diagram":   return `[${c.diagramType}]`;
    case "image":     return c.caption || c.url || "[画像]";
    case "divider":   return "──────────";
    default:          return "";
  }
}

function getIndent(block: Block): number {
  if (block.content.type !== "heading") return 0;
  return block.content.level - 1;
}

function scrollToBlock(blockId: string) {
  const el = document.querySelector(`[data-block-id="${blockId}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function DocumentOutline() {
  const blocks = useDocumentStore((s) => s.document?.blocks ?? []);
  const { isOutlineOpen, setOutlineOpen, lastAIAction } = useUIStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastAIAction) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lastAIAction]);

  if (!isOutlineOpen) return null;

  return (
    <div className="absolute top-10 right-10 z-50 w-72 max-h-[72vh] flex flex-col bg-background border border-border/40 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.16)] animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest flex-1">
          ドキュメント構成
        </span>
        <span className="text-[10px] text-muted-foreground/40 font-mono">
          {blocks.length}ブロック
        </span>
        <button
          onClick={() => setOutlineOpen(false)}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/60 transition-colors ml-1"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Block list */}
      <div className="overflow-y-auto flex-1 py-1">
        {blocks.length === 0 && (
          <p className="text-[11px] text-muted-foreground/35 text-center py-8 select-none">
            ブロックがありません
          </p>
        )}
        {blocks.map((block, idx) => {
          const Icon = OUTLINE_ICONS[block.content.type as BlockType] ?? Type;
          const indent = getIndent(block);
          const isHeading = block.content.type === "heading";
          const isAINew =
            lastAIAction !== null &&
            lastAIAction.blockIds.includes(block.id) &&
            now - lastAIAction.timestamp < 10_000;

          return (
            <button
              key={block.id}
              onClick={() => scrollToBlock(block.id)}
              style={{ paddingLeft: `${12 + indent * 14}px` }}
              className={`w-full flex items-center gap-2 py-1.5 pr-3 text-left hover:bg-muted/40 transition-colors group ${
                isAINew ? "bg-violet-50/60 dark:bg-violet-950/20" : ""
              }`}
            >
              {/* Line number */}
              <span className="text-[8px] font-mono text-muted-foreground/20 w-4 shrink-0 text-right">
                {idx + 1}
              </span>
              <Icon className={`h-3 w-3 shrink-0 ${
                isHeading ? "text-blue-500" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
              }`} />
              <span className={`text-[11px] truncate leading-tight ${
                isHeading ? "font-semibold text-foreground/80" : "text-muted-foreground/55"
              }`}>
                {getPreview(block)}
              </span>
              {isAINew && (
                <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-violet-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer — AI summary */}
      {lastAIAction && (
        <div className="border-t border-border/20 px-3 py-2 shrink-0 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
          <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium truncate">
            AI: {lastAIAction.description}
          </p>
        </div>
      )}
    </div>
  );
}
