"use client";

/**
 * ContextualToolbar — VS Code style floating toolbar.
 * Appears as a slim bar only when a block is selected.
 * No Word-like ribbon. Just contextual actions.
 */

import React from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Plus, ChevronDown,
  Heading, Type, Sigma, List as ListIcon, Table, ImageIcon,
  Minus, Code, Quote, ListOrdered, Zap, GitBranch, FlaskConical, BarChart3,
} from "lucide-react";

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  heading: Heading, paragraph: Type, math: Sigma, list: ListIcon,
  table: Table, image: ImageIcon, divider: Minus, code: Code, quote: Quote,
  circuit: Zap, diagram: GitBranch, chemistry: FlaskConical, chart: BarChart3,
};

const BLOCK_CATEGORIES = [
  { label: "基本", types: ["heading", "paragraph", "list", "table", "divider"] as BlockType[] },
  { label: "理工系", types: ["math", "circuit", "diagram", "chemistry", "chart"] as BlockType[] },
  { label: "メディア", types: ["image", "code", "quote"] as BlockType[] },
];

function useSelectedBlock(): Block | null {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  if (!selectedBlockId || !blocks) return null;
  return blocks.find((b) => b.id === selectedBlockId) || null;
}

function Btn({
  active, onClick, children, title, disabled,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode;
  title?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center h-6 w-6 rounded text-xs transition-colors
        ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
        ${disabled ? "opacity-25 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-border/50 mx-0.5" />;
}

export function Toolbar() {
  const block = useSelectedBlock();
  const { updateBlockStyle, updateBlockContent, addBlock } = useDocumentStore();
  const { selectBlock, setEditingBlock } = useUIStore();

  const style = block?.style || {};
  const hasBlock = !!block;

  const toggle = (key: "bold" | "italic" | "underline") => {
    if (!block) return;
    updateBlockStyle(block.id, { [key]: !style[key] });
  };

  const setAlign = (textAlign: "left" | "center" | "right") => {
    if (!block) return;
    updateBlockStyle(block.id, { textAlign });
  };

  const handleInsertBlock = (type: BlockType) => {
    const blocks = useDocumentStore.getState().document?.blocks;
    const selectedId = useUIStore.getState().selectedBlockId;
    let insertIndex = blocks?.length || 0;
    if (selectedId && blocks) {
      const idx = blocks.findIndex((b) => b.id === selectedId);
      if (idx >= 0) insertIndex = idx + 1;
    }
    const id = addBlock(type, insertIndex);
    if (id) {
      selectBlock(id);
      if (type !== "divider") setEditingBlock(id);
    }
  };

  const headingContent = block?.content.type === "heading" ? (block.content as { level: number }) : null;
  const listContent = block?.content.type === "list" ? (block.content as { style: string }) : null;

  return (
    <div className="flex items-center gap-0.5 px-3 h-8 border-b border-border/30 bg-background/80 backdrop-blur-sm shrink-0">
      {/* Insert block — always visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-medium">
            <Plus className="h-3 w-3" />
            挿入
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 p-1.5 rounded-xl shadow-xl">
          {BLOCK_CATEGORIES.map((cat, ci) => (
            <React.Fragment key={cat.label}>
              {ci > 0 && <DropdownMenuSeparator className="my-1" />}
              <DropdownMenuLabel className="text-[9px] text-muted-foreground/50 font-medium px-2 py-0.5 uppercase tracking-wider">
                {cat.label}
              </DropdownMenuLabel>
              <div className="grid grid-cols-3 gap-0.5">
                {cat.types.map((type) => {
                  const info = BLOCK_TYPES.find((t) => t.type === type);
                  if (!info) return null;
                  const Icon = BLOCK_ICONS[info.type];
                  return (
                    <DropdownMenuItem
                      key={info.type}
                      onClick={() => handleInsertBlock(info.type)}
                      className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg cursor-pointer text-center focus:bg-primary/5"
                    >
                      <Icon className={`h-3.5 w-3.5 ${info.color}`} />
                      <span className="text-[9px] font-medium leading-none">{info.name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Contextual controls — only when block selected */}
      {hasBlock && (
        <>
          <Divider />

          {/* Font family */}
          <select
            value={style.fontFamily || "sans"}
            onChange={(e) => block && updateBlockStyle(block.id, { fontFamily: e.target.value as "serif" | "sans" })}
            className="h-6 px-1.5 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors"
          >
            <option value="sans">ゴシック</option>
            <option value="serif">明朝体</option>
          </select>

          {/* Font size */}
          <select
            value={String(style.fontSize || 11)}
            onChange={(e) => block && updateBlockStyle(block.id, { fontSize: parseInt(e.target.value) })}
            className="h-6 w-10 px-1 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors"
          >
            {[9,10,11,12,14,16,18,24].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <Divider />

          {/* B I U */}
          <Btn active={style.bold} onClick={() => toggle("bold")} title="太字 (Ctrl+B)">
            <Bold className="h-3 w-3" />
          </Btn>
          <Btn active={style.italic} onClick={() => toggle("italic")} title="斜体">
            <Italic className="h-3 w-3" />
          </Btn>
          <Btn active={style.underline} onClick={() => toggle("underline")} title="下線">
            <Underline className="h-3 w-3" />
          </Btn>

          <Divider />

          {/* Alignment */}
          <Btn active={!style.textAlign || style.textAlign === "left"} onClick={() => setAlign("left")} title="左揃え">
            <AlignLeft className="h-3 w-3" />
          </Btn>
          <Btn active={style.textAlign === "center"} onClick={() => setAlign("center")} title="中央揃え">
            <AlignCenter className="h-3 w-3" />
          </Btn>
          <Btn active={style.textAlign === "right"} onClick={() => setAlign("right")} title="右揃え">
            <AlignRight className="h-3 w-3" />
          </Btn>

          {/* Heading level */}
          {headingContent && (
            <>
              <Divider />
              <select
                value={String(headingContent.level)}
                onChange={(e) => block && updateBlockContent(block.id, { level: parseInt(e.target.value) as 1 | 2 | 3 })}
                className="h-6 w-12 px-1 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="1">H1</option>
                <option value="2">H2</option>
                <option value="3">H3</option>
              </select>
            </>
          )}

          {/* List style */}
          {listContent && (
            <>
              <Divider />
              <Btn active={listContent.style === "bullet"} onClick={() => block && updateBlockContent(block.id, { style: "bullet" })} title="箇条書き">
                <ListIcon className="h-3 w-3" />
              </Btn>
              <Btn active={listContent.style === "numbered"} onClick={() => block && updateBlockContent(block.id, { style: "numbered" })} title="番号付き">
                <ListOrdered className="h-3 w-3" />
              </Btn>
            </>
          )}

          {/* Text / bg color */}
          <Divider />
          <div className="relative h-6 w-6" title="文字色">
            <input
              type="color"
              value={style.textColor || "#000000"}
              onChange={(e) => block && updateBlockStyle(block.id, { textColor: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
            />
            <div className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 transition-colors">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-bold leading-none" style={{ color: style.textColor || undefined }}>A</span>
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: style.textColor || "currentColor" }} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Slash hint */}
      {!hasBlock && (
        <span className="ml-2 text-[11px] text-muted-foreground/40 select-none font-mono">
          / でブロック挿入 · Shift+クリックで複数選択
        </span>
      )}

      <div className="flex-1" />

      {/* Block type indicator */}
      {hasBlock && block && (
        <span className="text-[10px] text-muted-foreground/40 font-mono px-2 select-none">
          {block.content.type}
        </span>
      )}
    </div>
  );
}
