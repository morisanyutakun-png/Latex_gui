"use client";

/**
 * Toolbar — slim contextual format bar.
 * Shows formatting controls when a block is selected.
 * Block insertion is handled by EditToolbar (簡単編集).
 */

import React from "react";
import { useI18n } from "@/lib/i18n";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { Block, BlockType } from "@/lib/types";
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  List as ListIcon, ListOrdered,
} from "lucide-react";

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

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

export function Toolbar() {
  const { t } = useI18n();
  const block = useSelectedBlock();
  const { updateBlockStyle, updateBlockContent } = useDocumentStore();
  const { paperSize, setPaperSize } = useUIStore();

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

  const headingContent = block?.content.type === "heading" ? (block.content as { level: number }) : null;
  const listContent = block?.content.type === "list" ? (block.content as { style: string }) : null;

  return (
    <div className="flex items-center gap-0.5 px-3 h-8 border-b border-border/20 bg-background shrink-0">
      {/* Contextual controls — only when block selected */}
      {hasBlock ? (
        <>
          {/* Font family */}
          <select
            value={style.fontFamily || "sans"}
            onChange={(e) => block && updateBlockStyle(block.id, { fontFamily: e.target.value as "serif" | "sans" })}
            className="h-6 px-1.5 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors"
          >
            <option value="sans">{t("toolbar.gothic")}</option>
            <option value="serif">{t("toolbar.mincho")}</option>
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

          {/* Text color */}
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

          <div className="flex-1" />

          {/* Block type badge */}
          <span className="text-[9px] text-muted-foreground/30 font-mono px-2 py-0.5 rounded bg-muted/30 select-none mr-1">
            {block.content.type}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-muted-foreground/25 select-none font-mono">
          {t("toolbar.hint")}
        </span>
      )}

      {!hasBlock && <div className="flex-1" />}

      {/* Paper size selector */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] text-muted-foreground/30 font-mono select-none">{t("toolbar.paper")}</span>
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value as PaperSize)}
          className="h-5 px-1.5 rounded border border-border/30 bg-transparent text-[10px] text-muted-foreground/60 hover:text-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors font-mono"
        >
          {PAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
