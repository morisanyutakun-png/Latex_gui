"use client";

import React from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Heading,
  Type,
  Sigma,
  List as ListIcon,
  Table,
  ImageIcon,
  Minus,
  Code,
  Quote,
  ListOrdered,
  ChevronDown,
} from "lucide-react";

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  heading: Heading,
  paragraph: Type,
  math: Sigma,
  list: ListIcon,
  table: Table,
  image: ImageIcon,
  divider: Minus,
  code: Code,
  quote: Quote,
};

// Helper: get the currently selected block
function useSelectedBlock(): Block | null {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  if (!selectedBlockId || !blocks) return null;
  return blocks.find((b) => b.id === selectedBlockId) || null;
}

// ──── Toolbar Button ────
function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-md text-xs transition-colors
        ${active ? "bg-primary/10 text-primary" : "text-foreground/60 hover:bg-muted hover:text-foreground"}
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}

// ──── Toolbar Select ────
function ToolbarSelect({
  value,
  onChange,
  options,
  className = "w-20",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`h-7 rounded-md border border-border/50 bg-transparent text-xs px-1.5 
        text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/30
        disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Toolbar() {
  const block = useSelectedBlock();
  const { updateBlockStyle, updateBlockContent, addBlock } = useDocumentStore();
  const { selectBlock, setEditingBlock } = useUIStore();
  const hasBlock = !!block;

  const style = block?.style || {};

  const toggleStyle = (key: "bold" | "italic" | "underline") => {
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

  // Heading level
  const headingContent = block?.content.type === "heading" ? (block.content as { level: number }) : null;

  // List style
  const listContent = block?.content.type === "list" ? (block.content as { style: string }) : null;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 bg-background/80 backdrop-blur-sm flex-wrap">
      {/* Font Family */}
      <ToolbarSelect
        value={style.fontFamily || "sans"}
        onChange={(v) => block && updateBlockStyle(block.id, { fontFamily: v as "serif" | "sans" })}
        options={[
          { value: "sans", label: "ゴシック" },
          { value: "serif", label: "明朝体" },
        ]}
        className="w-[4.5rem]"
        disabled={!hasBlock}
      />

      {/* Font Size */}
      <ToolbarSelect
        value={String(style.fontSize || 11)}
        onChange={(v) => block && updateBlockStyle(block.id, { fontSize: parseInt(v) })}
        options={[
          { value: "9", label: "9" },
          { value: "10", label: "10" },
          { value: "11", label: "11" },
          { value: "12", label: "12" },
          { value: "14", label: "14" },
          { value: "16", label: "16" },
          { value: "18", label: "18" },
          { value: "24", label: "24" },
        ]}
        className="w-12"
        disabled={!hasBlock}
      />

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Bold / Italic / Underline */}
      <ToolbarButton active={style.bold} onClick={() => toggleStyle("bold")} title="太字 (Ctrl+B)" disabled={!hasBlock}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton active={style.italic} onClick={() => toggleStyle("italic")} title="斜体 (Ctrl+I)" disabled={!hasBlock}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton active={style.underline} onClick={() => toggleStyle("underline")} title="下線 (Ctrl+U)" disabled={!hasBlock}>
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Text Color */}
      <div className="relative" title="文字色">
        <input
          type="color"
          value={style.textColor || "#000000"}
          onChange={(e) => block && updateBlockStyle(block.id, { textColor: e.target.value })}
          className="absolute inset-0 opacity-0 cursor-pointer w-7 h-7"
          disabled={!hasBlock}
        />
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${!hasBlock ? "opacity-30" : "hover:bg-muted cursor-pointer"}`}>
          <div className="flex flex-col items-center gap-0">
            <span className="text-xs font-bold leading-none" style={{ color: style.textColor || undefined }}>A</span>
            <div className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: style.textColor || "currentColor" }} />
          </div>
        </div>
      </div>

      {/* Background Color */}
      <div className="relative" title="背景色">
        <input
          type="color"
          value={style.backgroundColor || "#ffffff"}
          onChange={(e) => block && updateBlockStyle(block.id, { backgroundColor: e.target.value })}
          className="absolute inset-0 opacity-0 cursor-pointer w-7 h-7"
          disabled={!hasBlock}
        />
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${!hasBlock ? "opacity-30" : "hover:bg-muted cursor-pointer"}`}>
          <div className="h-4 w-4 rounded border border-border/50" style={{ backgroundColor: style.backgroundColor || "#ffffff" }} />
        </div>
      </div>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Alignment */}
      <ToolbarButton active={style.textAlign === "left" || !style.textAlign} onClick={() => setAlign("left")} title="左揃え" disabled={!hasBlock}>
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton active={style.textAlign === "center"} onClick={() => setAlign("center")} title="中央揃え" disabled={!hasBlock}>
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton active={style.textAlign === "right"} onClick={() => setAlign("right")} title="右揃え" disabled={!hasBlock}>
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Heading Level (visible when heading selected) */}
      {headingContent && (
        <>
          <ToolbarSelect
            value={String(headingContent.level)}
            onChange={(v) => block && updateBlockContent(block.id, { level: parseInt(v) as 1 | 2 | 3 })}
            options={[
              { value: "1", label: "H1" },
              { value: "2", label: "H2" },
              { value: "3", label: "H3" },
            ]}
            className="w-14"
          />
          <Separator orientation="vertical" className="mx-1 h-5" />
        </>
      )}

      {/* List Style (visible when list selected) */}
      {listContent && (
        <>
          <ToolbarButton
            active={listContent.style === "bullet"}
            onClick={() => block && updateBlockContent(block.id, { style: "bullet" })}
            title="箇条書き"
          >
            <ListIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={listContent.style === "numbered"}
            onClick={() => block && updateBlockContent(block.id, { style: "numbered" })}
            title="番号付きリスト"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <Separator orientation="vertical" className="mx-1 h-5" />
        </>
      )}

      {/* Insert Block Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-foreground/60 hover:bg-muted hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" />
            挿入
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 p-1.5 rounded-xl">
          <div className="grid grid-cols-3 gap-1">
            {BLOCK_TYPES.map((info) => {
              const Icon = BLOCK_ICONS[info.type];
              return (
                <DropdownMenuItem
                  key={info.type}
                  onClick={() => handleInsertBlock(info.type)}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg cursor-pointer"
                >
                  <Icon className={`h-4 w-4 ${info.color}`} />
                  <span className="text-[10px] font-medium">{info.name}</span>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
