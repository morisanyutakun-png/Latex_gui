"use client";

/**
 * EditToolbar — slim formatting bar for diff-style micro-edits.
 * Appears above the editor when edit mode is toggled.
 * Intended for tweaking AI-generated content: font, size, color, style.
 * No block insertion (that's the AI's job).
 */

import React from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Sigma, List as ListIcon, ListOrdered,
} from "lucide-react";

function useSelectedBlock(): Block | null {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  if (!selectedBlockId || !blocks) return null;
  return blocks.find((b) => b.id === selectedBlockId) ?? null;
}

function Sep() {
  return <div className="w-px h-3.5 bg-border/40 mx-1 shrink-0" />;
}

function Btn({ active, onClick, title, disabled, children }: {
  active?: boolean; onClick: () => void; title?: string;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center h-6 w-6 rounded transition-colors shrink-0
        ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
        ${disabled ? "opacity-25 cursor-not-allowed pointer-events-none" : ""}`}
    >
      {children}
    </button>
  );
}

export function EditToolbar() {
  const { t } = useI18n();
  const block = useSelectedBlock();
  const { updateBlockStyle, updateBlockContent } = useDocumentStore();

  const style = block?.style ?? {};
  const on = !!block;

  const toggle = (key: "bold" | "italic" | "underline") => {
    if (!block) return;
    updateBlockStyle(block.id, { [key]: !style[key] });
  };

  const setAlign = (textAlign: "left" | "center" | "right") => {
    if (!block) return;
    updateBlockStyle(block.id, { textAlign });
  };

  const headingContent = block?.content.type === "heading" ? (block.content as { level: number }) : null;
  const listContent   = block?.content.type === "list"    ? (block.content as { style: string })  : null;

  return (
    <div className="flex items-center gap-0.5 px-3 h-8 border-b border-border/15 bg-muted/5 shrink-0">
      {/* Font family */}
      <select
        value={style.fontFamily ?? "sans"}
        onChange={(e) => block && updateBlockStyle(block.id, { fontFamily: e.target.value as "serif" | "sans" })}
        disabled={!on}
        className="h-6 px-1.5 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors disabled:opacity-25 shrink-0"
      >
        <option value="sans">{t("toolbar.gothic")}</option>
        <option value="serif">{t("toolbar.mincho")}</option>
      </select>

      {/* Font size */}
      <select
        value={String(style.fontSize ?? 11)}
        onChange={(e) => block && updateBlockStyle(block.id, { fontSize: parseInt(e.target.value) })}
        disabled={!on}
        className="h-6 w-11 px-1 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground focus:outline-none focus:border-primary/40 cursor-pointer transition-colors disabled:opacity-25 shrink-0"
      >
        {[9, 10, 11, 12, 14, 16, 18, 24].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <Sep />

      <Btn active={!!style.bold}      onClick={() => toggle("bold")}      title="太字 (Ctrl+B)" disabled={!on}><Bold      className="h-3 w-3" /></Btn>
      <Btn active={!!style.italic}    onClick={() => toggle("italic")}    title="斜体"           disabled={!on}><Italic    className="h-3 w-3" /></Btn>
      <Btn active={!!style.underline} onClick={() => toggle("underline")} title="下線"           disabled={!on}><Underline className="h-3 w-3" /></Btn>

      <Sep />

      <Btn active={!style.textAlign || style.textAlign === "left"}  onClick={() => setAlign("left")}   title="左揃え"   disabled={!on}><AlignLeft   className="h-3 w-3" /></Btn>
      <Btn active={style.textAlign === "center"}                     onClick={() => setAlign("center")} title="中央揃え" disabled={!on}><AlignCenter className="h-3 w-3" /></Btn>
      <Btn active={style.textAlign === "right"}                      onClick={() => setAlign("right")}  title="右揃え"   disabled={!on}><AlignRight  className="h-3 w-3" /></Btn>

      {/* Heading level — contextual */}
      {headingContent && (
        <>
          <Sep />
          <select
            value={String(headingContent.level)}
            onChange={(e) => block && updateBlockContent(block.id, { level: parseInt(e.target.value) as 1|2|3 })}
            className="h-6 w-12 px-1 rounded border border-border/40 bg-transparent text-[11px] text-muted-foreground focus:outline-none focus:border-primary/40 cursor-pointer shrink-0"
          >
            <option value="1">H1</option>
            <option value="2">H2</option>
            <option value="3">H3</option>
          </select>
        </>
      )}

      {/* List style — contextual */}
      {listContent && (
        <>
          <Sep />
          <Btn active={listContent.style === "bullet"}   onClick={() => block && updateBlockContent(block.id, { style: "bullet" })}   title="箇条書き" disabled={!on}><ListIcon    className="h-3 w-3" /></Btn>
          <Btn active={listContent.style === "numbered"} onClick={() => block && updateBlockContent(block.id, { style: "numbered" })} title="番号付き" disabled={!on}><ListOrdered className="h-3 w-3" /></Btn>
        </>
      )}

      <Sep />

      {/* Text color */}
      <div className={`relative h-6 w-6 shrink-0 ${!on ? "opacity-25 pointer-events-none" : ""}`} title="文字色">
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

      <div className="flex-1" />

      {/* Math mode hint */}
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded text-[9px] font-mono text-muted-foreground/35 bg-muted/20 border border-border/25 select-none shrink-0">
        <Sigma className="h-2.5 w-2.5" />
        Tab
      </span>

      {!on && (
        <span className="ml-2 text-[9px] text-muted-foreground/25 select-none font-mono hidden sm:inline">
          {t("toolbar.hint")}
        </span>
      )}
    </div>
  );
}
