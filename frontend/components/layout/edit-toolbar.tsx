"use client";

/**
 * EditToolbar — モード対応フォーマットバー
 * 編集モード: sky blue テーマ
 * 数式モード: violet テーマ (isMathEditing)
 */

import React from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { Block } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Sigma, List as ListIcon, ListOrdered, Command,
  PenLine, Sparkles,
} from "lucide-react";

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

function useSelectedBlock(): Block | null {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  if (!selectedBlockId || !blocks) return null;
  return blocks.find((b) => b.id === selectedBlockId) ?? null;
}

function Sep() {
  return <div className="w-px h-4 bg-border/30 mx-1 shrink-0" />;
}

function Btn({
  active, onClick, title, disabled, children, mathMode,
}: {
  active?: boolean; onClick: () => void; title?: string;
  disabled?: boolean; children: React.ReactNode; mathMode?: boolean;
}) {
  const activeClass = mathMode
    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
    : "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors shrink-0
        ${active ? activeClass : "text-foreground/60 hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10"}
        ${disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
    >
      {children}
    </button>
  );
}

export function EditToolbar() {
  const { t } = useI18n();
  const block = useSelectedBlock();
  const { updateBlockStyle, updateBlockContent } = useDocumentStore();
  const { paperSize, setPaperSize, setGlobalPalette, isMathEditing } = useUIStore();

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

  // テーマカラー
  const theme = isMathEditing
    ? {
        bg: "bg-[rgba(245,243,255,0.82)] dark:bg-[rgba(18,12,30,0.88)]",
        badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-300/35 dark:border-violet-700/30",
        badgeGlow: "bg-violet-400",
        selectBorder: "border-violet-200/50 dark:border-violet-800/30 focus:border-violet-400/50",
        hint: "text-violet-400/60",
      }
    : {
        bg: "bg-[rgba(245,244,255,0.82)] dark:bg-[rgba(10,9,20,0.88)]",
        badge: "bg-indigo-500/8 text-indigo-600 dark:text-indigo-400 border border-indigo-300/30 dark:border-indigo-700/25",
        badgeGlow: "bg-indigo-400",
        selectBorder: "border-indigo-200/40 dark:border-indigo-800/25 focus:border-indigo-400/50",
        hint: "text-indigo-400/55",
      };

  return (
    <div className={`editor-toolbar flex items-center gap-1 px-3 h-10 shrink-0 transition-all duration-300 ${theme.bg}`}>

      {/* モードバッジ */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mr-1 shrink-0 transition-all duration-300 ${theme.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${theme.badgeGlow}`} />
        {isMathEditing
          ? <><Sigma className="h-3 w-3" /><span>数式モード</span></>
          : <><PenLine className="h-3 w-3" /><span>編集モード</span></>
        }
      </div>

      <Sep />

      {/* Font family */}
      <select
        value={style.fontFamily ?? "sans"}
        onChange={(e) => block && updateBlockStyle(block.id, { fontFamily: e.target.value as "serif" | "sans" })}
        disabled={!on}
        className={`h-7 px-2 rounded-md border bg-white/70 dark:bg-white/5 text-[12px] text-foreground/80 focus:outline-none cursor-pointer transition-colors disabled:opacity-30 shrink-0 ${theme.selectBorder}`}
      >
        <option value="sans">ゴシック</option>
        <option value="serif">明朝</option>
      </select>

      {/* Font size */}
      <select
        value={String(style.fontSize ?? 11)}
        onChange={(e) => block && updateBlockStyle(block.id, { fontSize: parseInt(e.target.value) })}
        disabled={!on}
        className={`h-7 w-14 px-1.5 rounded-md border bg-white/70 dark:bg-white/5 text-[12px] text-foreground/80 focus:outline-none cursor-pointer transition-colors disabled:opacity-30 shrink-0 ${theme.selectBorder}`}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}pt</option>
        ))}
      </select>

      <Sep />

      <Btn active={!!style.bold}      onClick={() => toggle("bold")}      title="太字 (Ctrl/⌘+B)"  disabled={!on} mathMode={isMathEditing}><Bold      className="h-3.5 w-3.5" /></Btn>
      <Btn active={!!style.italic}    onClick={() => toggle("italic")}    title="斜体"       disabled={!on} mathMode={isMathEditing}><Italic    className="h-3.5 w-3.5" /></Btn>
      <Btn active={!!style.underline} onClick={() => toggle("underline")} title="下線"       disabled={!on} mathMode={isMathEditing}><Underline className="h-3.5 w-3.5" /></Btn>

      <Sep />

      <Btn active={!style.textAlign || style.textAlign === "left"}  onClick={() => setAlign("left")}   title="左揃え"   disabled={!on} mathMode={isMathEditing}><AlignLeft   className="h-3.5 w-3.5" /></Btn>
      <Btn active={style.textAlign === "center"}                     onClick={() => setAlign("center")} title="中央揃え" disabled={!on} mathMode={isMathEditing}><AlignCenter className="h-3.5 w-3.5" /></Btn>
      <Btn active={style.textAlign === "right"}                      onClick={() => setAlign("right")}  title="右揃え"   disabled={!on} mathMode={isMathEditing}><AlignRight  className="h-3.5 w-3.5" /></Btn>

      {/* 見出しレベル（コンテキスト） */}
      {headingContent && (
        <>
          <Sep />
          <select
            value={String(headingContent.level)}
            onChange={(e) => block && updateBlockContent(block.id, { level: parseInt(e.target.value) as 1|2|3 })}
            className={`h-7 w-14 px-1.5 rounded-md border bg-white/70 dark:bg-white/5 text-[12px] text-foreground/80 focus:outline-none cursor-pointer shrink-0 ${theme.selectBorder}`}
          >
            <option value="1">H1</option>
            <option value="2">H2</option>
            <option value="3">H3</option>
          </select>
        </>
      )}

      {/* リストスタイル（コンテキスト） */}
      {listContent && (
        <>
          <Sep />
          <Btn active={listContent.style === "bullet"}   onClick={() => block && updateBlockContent(block.id, { style: "bullet" })}   title="箇条書き" disabled={!on} mathMode={isMathEditing}><ListIcon    className="h-3.5 w-3.5" /></Btn>
          <Btn active={listContent.style === "numbered"} onClick={() => block && updateBlockContent(block.id, { style: "numbered" })} title="番号付き" disabled={!on} mathMode={isMathEditing}><ListOrdered className="h-3.5 w-3.5" /></Btn>
        </>
      )}

      <Sep />

      {/* 文字色 */}
      <div className={`relative h-7 w-7 shrink-0 ${!on ? "opacity-30 pointer-events-none" : ""}`} title="文字色">
        <input
          type="color"
          value={style.textColor ?? "#1a1a1a"}
          onChange={(e) => block && updateBlockStyle(block.id, { textColor: e.target.value })}
          className="absolute inset-0 opacity-0 cursor-pointer w-7 h-7"
        />
        <div className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[12px] font-bold leading-none" style={{ color: style.textColor ?? undefined }}>A</span>
            <div className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: style.textColor ?? "currentColor" }} />
          </div>
        </div>
      </div>

      {/* 類題を生成 */}
      {on && (
        <>
          <Sep />
          <button
            onClick={() => {
              if (!block) return;
              const c = block.content as any;
              const text = c.text ?? c.formula ?? c.items?.join("\n") ?? c.code ?? "";
              if (!text) return;
              const prompt = `以下の問題の類題を3問作成し、元の問題の直後に追加してください。\n\n【元の問題】\n${text}`;
              useUIStore.getState().setPendingChatMessage(prompt);
            }}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-violet-500 dark:text-violet-400 bg-violet-500/10 border border-violet-300/30 dark:border-violet-700/30 hover:bg-violet-500/20 transition-colors shrink-0"
            title="類題を生成"
          >
            <Sparkles className="h-3 w-3" />
            <span>類題</span>
          </button>
        </>
      )}

      <div className="flex-1" />

      {/* 数式ヒント */}
      {!isMathEditing && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-mono ${theme.hint} select-none`}>Tab = $...$</span>
          <Sigma className={`h-3 w-3 ${theme.hint}`} />
        </div>
      )}

      {!on && !isMathEditing && (
        <span className="ml-2 text-[10px] text-muted-foreground/30 select-none font-medium hidden sm:inline">
          テキストをクリック
        </span>
      )}

      <Sep />

      {/* ブロック挿入 */}
      <button
        onClick={() => setGlobalPalette(true)}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-foreground/50 bg-white/60 dark:bg-white/5 border border-border/30 hover:text-foreground hover:bg-white/90 dark:hover:bg-white/10 transition-colors shrink-0"
        title="ブロックを挿入 (Ctrl/⌘+K)"
      >
        <Command className="h-3 w-3" />
        <span className="font-mono">K</span>
      </button>

      <Sep />

      {/* 用紙サイズ */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-muted-foreground/40 font-mono select-none hidden sm:inline">{t("toolbar.paper")}</span>
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value as PaperSize)}
          className={`h-7 px-2 rounded-md border bg-white/70 dark:bg-white/5 text-[11px] text-foreground/70 hover:text-foreground focus:outline-none cursor-pointer transition-colors font-mono ${theme.selectBorder}`}
        >
          {PAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
