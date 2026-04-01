"use client";

/**
 * EditToolbar — Collapsible Word-style editing toolbar.
 * Appears below AppHeader when "簡単編集" mode is active.
 * Provides block insertion + text formatting in one ribbon.
 */

import React from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  ChevronDown,
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Type, Heading, Sigma, List as ListIcon, Table, ImageIcon,
  Minus, Code, Quote, Zap, GitBranch, FlaskConical, BarChart3,
  ListOrdered, PenLine,
} from "lucide-react";

const BLOCK_ICONS: Partial<Record<BlockType, React.ElementType>> = {
  heading: Heading,
  paragraph: Type,
  math: Sigma,
  list: ListIcon,
  table: Table,
  image: ImageIcon,
  divider: Minus,
  code: Code,
  quote: Quote,
  circuit: Zap,
  diagram: GitBranch,
  chemistry: FlaskConical,
  chart: BarChart3,
};

// Blocks shown as quick-insert buttons in the ribbon
const RIBBON_BLOCKS: BlockType[] = [
  "paragraph", "heading", "math", "list", "table", "image", "code", "quote", "divider",
];

function useSelectedBlock(): Block | null {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  if (!selectedBlockId || !blocks) return null;
  return blocks.find((b) => b.id === selectedBlockId) ?? null;
}

function Divider() {
  return <div className="w-px h-4 bg-border/40 mx-1 shrink-0" />;
}

function FmtBtn({
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
      className={`inline-flex items-center justify-center h-6 w-6 rounded text-xs transition-colors shrink-0
        ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
        ${disabled ? "opacity-25 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

interface EditToolbarProps {
  isExpanded: boolean;
  onCollapse: () => void;
}

export function EditToolbar({ isExpanded, onCollapse }: EditToolbarProps) {
  const { t } = useI18n();
  const block = useSelectedBlock();
  const { updateBlockStyle, updateBlockContent, addBlock } = useDocumentStore();
  const { selectBlock, setEditingBlock } = useUIStore();

  const style = block?.style ?? {};

  const toggle = (key: "bold" | "italic" | "underline") => {
    if (!block) return;
    updateBlockStyle(block.id, { [key]: !style[key] });
  };

  const setAlign = (textAlign: "left" | "center" | "right") => {
    if (!block) return;
    updateBlockStyle(block.id, { textAlign });
  };

  const handleInsert = (type: BlockType) => {
    const blocks = useDocumentStore.getState().document?.blocks;
    const selectedId = useUIStore.getState().selectedBlockId;
    let insertIndex = blocks?.length ?? 0;
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

  const headingContent = block?.content.type === "heading"
    ? (block.content as { level: number })
    : null;
  const listContent = block?.content.type === "list"
    ? (block.content as { style: string })
    : null;

  if (!isExpanded) {
    // Collapsed: thin strip with label only
    return (
      <div
        className="flex items-center gap-2 px-3 h-6 border-b border-border/15 bg-muted/5 shrink-0 cursor-pointer hover:bg-muted/10 transition-colors select-none"
        onClick={onCollapse}
        title={t("edit.toolbar.expand")}
      >
        <PenLine className="h-2.5 w-2.5 text-sky-500" />
        <span className="text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-widest font-mono">
          {t("edit.toolbar.title")}
        </span>
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="flex flex-col border-b border-border/20 bg-background/98 shrink-0">
      {/* ── Row 1: Insert ── */}
      <div className="flex items-center gap-0.5 px-3 h-8 border-b border-border/10 bg-muted/5">
        {/* Title / collapse */}
        <button
          onClick={onCollapse}
          className="flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors font-mono uppercase tracking-wider shrink-0"
          title={t("edit.toolbar.collapse")}
        >
          <PenLine className="h-3 w-3" />
          {t("edit.toolbar.title")}
          <ChevronDown className="h-2.5 w-2.5 opacity-60 rotate-180" />
        </button>

        <Divider />

        {/* Quick insert strip */}
        <span className="text-[8px] text-muted-foreground/30 font-mono uppercase tracking-wider mr-1 shrink-0">
          {t("edit.toolbar.insert")}
        </span>
        {RIBBON_BLOCKS.map((type) => {
          const info = BLOCK_TYPES.find((b) => b.type === type);
          if (!info) return null;
          const Icon = BLOCK_ICONS[type];
          if (!Icon) return null;
          return (
            <button
              key={type}
              onClick={() => handleInsert(type)}
              title={`${info.name}を挿入`}
              className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            >
              <Icon className={`h-3 w-3 ${info.color}`} />
              <span className="hidden md:inline">{info.name}</span>
            </button>
          );
        })}

        {/* Math shortcut badge */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 h-5 px-2 rounded text-[9px] font-mono text-muted-foreground/40 bg-muted/30 border border-border/30 select-none">
            <Sigma className="h-2.5 w-2.5" />
            Tab →&nbsp;数式
          </span>
        </div>
      </div>

      {/* ── Row 2: Format ── */}
      <div className="flex items-center gap-0.5 px-3 h-8">
        <span className="text-[8px] text-muted-foreground/30 font-mono uppercase tracking-wider mr-1 shrink-0">
          {t("edit.toolbar.format")}
        </span>

        {/* Font family */}
        <select
          value={style.fontFamily ?? "sans"}
          onChange={(e) => block && updateBlockStyle(block.id, { fontFamily: e.target.value as "serif" | "sans" })}
          disabled={!block}
          className="h-6 px-1.5 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors disabled:opacity-25 shrink-0"
        >
          <option value="sans">{t("toolbar.gothic")}</option>
          <option value="serif">{t("toolbar.mincho")}</option>
        </select>

        {/* Font size */}
        <select
          value={String(style.fontSize ?? 11)}
          onChange={(e) => block && updateBlockStyle(block.id, { fontSize: parseInt(e.target.value) })}
          disabled={!block}
          className="h-6 w-12 px-1 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors disabled:opacity-25 shrink-0"
        >
          {[9, 10, 11, 12, 14, 16, 18, 24].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <Divider />

        {/* B I U */}
        <FmtBtn active={!!style.bold} onClick={() => toggle("bold")} title="太字 (Ctrl+B)" disabled={!block}>
          <Bold className="h-3 w-3" />
        </FmtBtn>
        <FmtBtn active={!!style.italic} onClick={() => toggle("italic")} title="斜体" disabled={!block}>
          <Italic className="h-3 w-3" />
        </FmtBtn>
        <FmtBtn active={!!style.underline} onClick={() => toggle("underline")} title="下線" disabled={!block}>
          <Underline className="h-3 w-3" />
        </FmtBtn>

        <Divider />

        {/* Alignment */}
        <FmtBtn active={!style.textAlign || style.textAlign === "left"} onClick={() => setAlign("left")} title="左揃え" disabled={!block}>
          <AlignLeft className="h-3 w-3" />
        </FmtBtn>
        <FmtBtn active={style.textAlign === "center"} onClick={() => setAlign("center")} title="中央揃え" disabled={!block}>
          <AlignCenter className="h-3 w-3" />
        </FmtBtn>
        <FmtBtn active={style.textAlign === "right"} onClick={() => setAlign("right")} title="右揃え" disabled={!block}>
          <AlignRight className="h-3 w-3" />
        </FmtBtn>

        {/* Heading level */}
        {headingContent && (
          <>
            <Divider />
            <select
              value={String(headingContent.level)}
              onChange={(e) => block && updateBlockContent(block.id, { level: parseInt(e.target.value) as 1 | 2 | 3 })}
              className="h-6 w-12 px-1 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer shrink-0"
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
            <FmtBtn active={listContent.style === "bullet"} onClick={() => block && updateBlockContent(block.id, { style: "bullet" })} title="箇条書き" disabled={!block}>
              <ListIcon className="h-3 w-3" />
            </FmtBtn>
            <FmtBtn active={listContent.style === "numbered"} onClick={() => block && updateBlockContent(block.id, { style: "numbered" })} title="番号付き" disabled={!block}>
              <ListOrdered className="h-3 w-3" />
            </FmtBtn>
          </>
        )}

        <Divider />

        {/* Text color */}
        <div className={`relative h-6 w-6 shrink-0 ${!block ? "opacity-25 pointer-events-none" : ""}`} title="文字色">
          <input
            type="color"
            value={style.textColor ?? "#000000"}
            onChange={(e) => block && updateBlockStyle(block.id, { textColor: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
          />
          <div className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 transition-colors">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold leading-none" style={{ color: style.textColor ?? undefined }}>A</span>
              <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: style.textColor ?? "currentColor" }} />
            </div>
          </div>
        </div>

        {!block && (
          <span className="ml-3 text-[10px] text-muted-foreground/25 select-none font-mono">
            {t("toolbar.hint")}
          </span>
        )}

        <div className="flex-1" />

        {/* Block type badge */}
        {block && (
          <span className="text-[9px] text-muted-foreground/30 font-mono px-2 py-0.5 rounded bg-muted/30 select-none shrink-0">
            {block.content.type}
          </span>
        )}
      </div>
    </div>
  );
}
