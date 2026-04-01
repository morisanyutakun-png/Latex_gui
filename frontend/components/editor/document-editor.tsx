"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES, createBlock } from "@/lib/types";
import { MathRenderer } from "./math-editor";
import { JapaneseMathInput, MathWritingGuide, type JapaneseMathInputHandle } from "./math-japanese-input";
import { CircuitBlockEditor, DiagramBlockEditor, ChemistryBlockEditor, ChartBlockEditor } from "./engineering-editors";
import { parseInlineText, getInlineMathContext, getJapaneseSuggestions, parseJapanesemath, type JapaneseSuggestion } from "@/lib/math-japanese";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Heading,
  Type,
  Sigma,
  List,
  Table,
  ImageIcon,
  Minus,
  Code,
  Quote,
  Zap,
  GitBranch,
  FlaskConical,
  BarChart3,
  GripVertical,
  Search,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

// Icon mapper
const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  heading: Heading,
  paragraph: Type,
  math: Sigma,
  list: List,
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


// Block types that enter edit mode on single click
const TEXT_EDIT_TYPES: BlockType[] = ["paragraph", "heading", "list", "quote", "code"];

// drag-over shared state (module-level so sibling wrappers can read it)
let _dragOverIndex: number | null = null;
let _setDragOverIndexFns: Array<(v: number | null) => void> = [];
function setGlobalDragOver(v: number | null) {
  _dragOverIndex = v;
  _setDragOverIndexFns.forEach((fn) => fn(v));
}

// ──── Block Wrapper — click-to-edit, drag-and-drop, context menu ────
function BlockWrapper({
  block,
  index,
  children,
}: {
  block: Block;
  index: number;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { selectedBlockId, selectBlock, setEditingBlock, lastAIAction } = useUIStore();
  const { deleteBlock, duplicateBlock, moveBlock, reorderToIndex, convertBlock } = useDocumentStore();
  const isSelected = selectedBlockId === block.id;
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Register for global drag-over updates
  useEffect(() => {
    _setDragOverIndexFns.push(setDragOver);
    return () => { _setDragOverIndexFns = _setDragOverIndexFns.filter((f) => f !== setDragOver); };
  }, []);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!lastAIAction?.blockIds.includes(block.id)) return;
    const rem = 10_000 - (Date.now() - lastAIAction.timestamp);
    if (rem <= 0) return;
    const timer = setTimeout(() => forceUpdate((n) => n + 1), rem);
    return () => clearTimeout(timer);
  }, [lastAIAction, block.id]);

  const isAIHighlighted =
    lastAIAction !== null &&
    lastAIAction.blockIds.includes(block.id) &&
    Date.now() - lastAIAction.timestamp < 10_000;

  const isDropTarget = dragOver === index && !isDragging;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-block-id={block.id}
          className={`group/block relative transition-all duration-75 rounded-sm
            ${isSelected ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"}
            ${isDragging ? "opacity-40" : ""}
            ${isDropTarget ? "ring-1 ring-primary/30" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            selectBlock(block.id);
            if (TEXT_EDIT_TYPES.includes(block.content.type)) setEditingBlock(block.id);
          }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditingBlock(block.id); }}
          onDragOver={(e) => { e.preventDefault(); setGlobalDragOver(index); }}
          onDragLeave={() => setGlobalDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            const fromId = e.dataTransfer.getData("blockId");
            if (fromId && fromId !== block.id) reorderToIndex(fromId, index);
            setGlobalDragOver(null);
          }}
        >
          {/* Drop indicator line */}
          {isDropTarget && (
            <div className="absolute top-0 left-3 right-3 h-0.5 bg-primary/50 rounded-full pointer-events-none" />
          )}

          {/* Left selection / AI indicator */}
          <div className={`absolute left-0 top-0.5 bottom-0.5 w-[2px] rounded-full transition-all duration-300 ${
            isSelected ? "bg-primary/70" : isAIHighlighted ? "bg-violet-400/80" : "bg-transparent"
          }`} />

          {/* Drag handle — left edge, hover only */}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("blockId", block.id);
              e.dataTransfer.effectAllowed = "move";
              setIsDragging(true);
            }}
            onDragEnd={() => { setIsDragging(false); setGlobalDragOver(null); }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-[-18px] top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 cursor-grab active:cursor-grabbing transition-opacity p-1"
            title={t("block.move.up")}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/30" />
          </div>

          {/* Block content */}
          <div className="py-0.5 pl-3 pr-20">
            {children}
          </div>

          {/* Right hover actions */}
          <div className={`absolute right-1 top-0.5 flex items-center gap-0.5 transition-opacity
            ${isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"}`}>
            <button
              className="p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }}
              title={t("block.move.up")}
            ><ChevronUp className="h-3 w-3" /></button>
            <button
              className="p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }}
              title={t("block.move.down")}
            ><ChevronDown className="h-3 w-3" /></button>
            <button
              className="p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
              title={t("block.duplicate")}
            ><Copy className="h-3 w-3" /></button>
            <button
              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); selectBlock(null); }}
              title={t("block.delete")}
            ><Trash2 className="h-3 w-3" /></button>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Right-click context menu */}
      <ContextMenuContent className="w-48 rounded-xl p-1">
        <ContextMenuItem onClick={() => moveBlock(block.id, "up")} className="text-xs gap-2">
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />{t("ctx.move.up")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => moveBlock(block.id, "down")} className="text-xs gap-2">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />{t("ctx.move.down")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateBlock(block.id)} className="text-xs gap-2">
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />{t("ctx.duplicate")}
          <span className="ml-auto text-[10px] text-muted-foreground/50">⌘D</span>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-xs gap-2">
            <Type className="h-3.5 w-3.5 text-muted-foreground" />{t("ctx.change.type")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44 rounded-xl p-1">
            {BLOCK_TYPES.map((info) => {
              const Icon = BLOCK_ICONS[info.type];
              return (
                <ContextMenuItem
                  key={info.type}
                  onClick={() => convertBlock(block.id, createBlock(info.type).content)}
                  className="text-xs gap-2"
                >
                  <Icon className={`h-3.5 w-3.5 ${info.color}`} />{info.name}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => { deleteBlock(block.id); selectBlock(null); }}
          className="text-xs gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" />{t("ctx.delete")}
          <span className="ml-auto text-[10px] text-muted-foreground/50">⌫</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ──── Auto-resize Textarea ────
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  style,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      className={`w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 p-0 ${className}`}
      style={style}
      rows={1}
    />
  );
}

// ──── Block Editors by Type ────

function HeadingBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const { selectBlock, setEditingBlock } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "heading" }>;
  const headingClass: Record<number, string> = { 1: "latex-heading-1", 2: "latex-heading-2", 3: "latex-heading-3" };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);

    if (e.key === "ArrowUp" && el.selectionStart === 0) {
      e.preventDefault();
      if (idx > 0) { selectBlock(blocks[idx - 1].id); setEditingBlock(blocks[idx - 1].id); }
      return;
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length) {
      e.preventDefault();
      if (idx < blocks.length - 1) { selectBlock(blocks[idx + 1].id); setEditingBlock(blocks[idx + 1].id); }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const newId = addBlock("paragraph", idx + 1);
      if (newId) { selectBlock(newId); setEditingBlock(newId); }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const newId = addBlock("paragraph", idx + 1);
      if (newId) { selectBlock(newId); setEditingBlock(newId); }
    }
  };

  return (
    <div>
      <AutoTextarea
        value={content.text}
        onChange={(text) => updateContent(block.id, { text })}
        placeholder={`H${content.level}`}
        className={headingClass[content.level] || "latex-heading-1"}
        style={{
          textAlign: block.style.textAlign || "left",
          color: block.style.textColor || undefined,
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

// Block type palette items for / command
const PALETTE_ITEMS = BLOCK_TYPES.filter((t) =>
  !["circuit", "diagram", "chemistry", "chart"].includes(t.type)
).concat(BLOCK_TYPES.filter((t) => ["circuit", "diagram", "chemistry", "chart"].includes(t.type)));

function ParagraphBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const convertBlock = useDocumentStore((s) => s.convertBlock);
  const document = useDocumentStore((s) => s.document);
  const { editingBlockId, setEditingBlock } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "paragraph" }>;
  const isEditing = editingBlockId === block.id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestions, setSuggestions] = useState<JapaneseSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggIdx, setSelectedSuggIdx] = useState(0);

  // Slash command palette state
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);

  const filteredPalette = paletteQuery
    ? PALETTE_ITEMS.filter((t) =>
        t.name.includes(paletteQuery) ||
        t.type.includes(paletteQuery) ||
        t.description.includes(paletteQuery)
      )
    : PALETTE_ITEMS;

  // Track where the slash was typed so we can clean it up
  const [slashPos, setSlashPos] = useState<number>(0);

  const handleSelectPaletteItem = useCallback((type: BlockType) => {
    setShowPalette(false);
    setPaletteQuery("");
    if (type === "paragraph") return;
    const blocks = document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);
    // Remove the "/" that triggered the palette
    const cleanText = content.text.slice(0, slashPos) + content.text.slice(slashPos + 1 + paletteQuery.length);
    if (cleanText === "") {
      convertBlock(block.id, createBlock(type).content);
      setTimeout(() => setEditingBlock(block.id), 50);
    } else {
      updateContent(block.id, { text: cleanText });
      const newId = addBlock(type, idx + 1);
      setTimeout(() => setEditingBlock(newId), 50);
    }
  }, [block.id, content.text, slashPos, paletteQuery, document, addBlock, convertBlock, setEditingBlock, updateContent]);

  // インライン数式コンテキスト検出
  const mathCtx = getInlineMathContext(content.text, cursorPos);
  const isInMathMode = !!(mathCtx?.inMath);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [content.text]);

  // 入力中に候補を更新
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const pos = e.target.selectionStart || 0;
    updateContent(block.id, { text });
    setCursorPos(pos);

    // Slash command palette: trigger when "/" typed anywhere in paragraph
    if (showPalette) {
      // Update query based on text after the slash position
      const query = text.slice(slashPos + 1, pos);
      if (text[slashPos] !== "/" || pos <= slashPos) {
        setShowPalette(false);
        setPaletteQuery("");
        setPaletteIdx(0);
      } else {
        setPaletteQuery(query);
        setPaletteIdx(0);
        setShowSuggestions(false);
        return;
      }
    }

    // $の中にいるなら候補を表示
    const ctx = getInlineMathContext(text, pos);
    if (ctx && ctx.inMath && ctx.mathContent.length > 0) {
      const suggs = getJapaneseSuggestions(ctx.mathContent);
      setSuggestions(suggs);
      setShowSuggestions(suggs.length > 0);
      setSelectedSuggIdx(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [block.id, updateContent, showPalette]);

  // カーソル移動追跡
  const handleSelect = useCallback(() => {
    if (textareaRef.current) {
      setCursorPos(textareaRef.current.selectionStart || 0);
    }
  }, []);

  // 候補挿入
  const insertSuggestion = useCallback((sugg: JapaneseSuggestion) => {
    const ctx = getInlineMathContext(content.text, cursorPos);
    if (!ctx) return;

    // 最後の単語を候補で置換
    const mathContent = ctx.mathContent;
    const lastWordMatch = mathContent.match(/[\s　]?([^\s　]*)$/);
    const lastWord = lastWordMatch ? lastWordMatch[1] : "";
    const before = mathContent.slice(0, mathContent.length - lastWord.length);

    // 日本語の読みを挿入（ユーザーにはLaTeXを見せない）
    const newMathContent = before + sugg.reading;

    // テキスト全体を再構成
    const textBefore = content.text.slice(0, ctx.mathStart + 1); // $ を含む
    const textAfter = content.text.slice(ctx.mathEnd);
    const hasClosingDollar = content.text[ctx.mathEnd - 1] === "$";
    const newText = textBefore + newMathContent + (hasClosingDollar ? "" : "") + textAfter;

    updateContent(block.id, { text: newText });
    setShowSuggestions(false);

    // カーソル位置更新
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = ctx.mathStart + 1 + newMathContent.length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  }, [content.text, cursorPos, block.id, updateContent]);

  // 候補のキーボード操作
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // "/" key pressed → open slash palette
    if (e.key === "/" && !showPalette && !showSuggestions) {
      const el = e.currentTarget;
      setSlashPos(el.selectionStart || 0);
      // let the char be typed first, then open palette
      setTimeout(() => { setShowPalette(true); setPaletteIdx(0); setPaletteQuery(""); }, 0);
    }

    // Slash command palette navigation
    if (showPalette && filteredPalette.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIdx((i) => Math.min(i + 1, filteredPalette.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIdx((i) => Math.max(i - 1, 0));
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredPalette[paletteIdx];
        if (item) handleSelectPaletteItem(item.type);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPalette(false);
        setPaletteQuery("");
        return;
      }
    }

    // Math suggestions
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggIdx((i) => Math.max(i - 1, 0));
        return;
      } else if (e.key === " " || e.key === "Enter") {
        if (suggestions[selectedSuggIdx]) {
          e.preventDefault();
          insertSuggestion(suggestions[selectedSuggIdx]);
          return;
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }

    // Block navigation
    const el = e.currentTarget;
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);
    const { selectBlock: sel, setEditingBlock: setEdit } = useUIStore.getState();

    if (e.key === "ArrowUp" && el.selectionStart === 0 && el.selectionEnd === 0 && !showPalette) {
      e.preventDefault();
      if (idx > 0) { sel(blocks[idx - 1].id); setEdit(blocks[idx - 1].id); }
      return;
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length && !showPalette) {
      e.preventDefault();
      if (idx < blocks.length - 1) { sel(blocks[idx + 1].id); setEdit(blocks[idx + 1].id); }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const newId = addBlock("paragraph", idx + 1);
      if (newId) { sel(newId); setEdit(newId); }
      return;
    }
  }, [showPalette, filteredPalette, paletteIdx, handleSelectPaletteItem, showSuggestions, suggestions, selectedSuggIdx, insertSuggestion, slashPos, addBlock, block.id]);

  // インラインプレビュー（テキスト+数式が混在）— $$を非表示にしてレンダリング
  const segments = parseInlineText(content.text);
  const hasMath = segments.some((s) => s.type === "math");

  const baseStyle: React.CSSProperties = {
    fontSize: block.style.fontSize ? `${block.style.fontSize}pt` : undefined,
    fontFamily: block.style.fontFamily === "serif" ? '"Hiragino Mincho ProN", serif' : '"Hiragino Sans", sans-serif',
    textAlign: block.style.textAlign || "left",
    fontWeight: block.style.bold ? "bold" : undefined,
    fontStyle: block.style.italic ? "italic" : undefined,
    color: block.style.textColor || undefined,
  };

  return (
    <div className={`relative rounded-lg transition-all duration-200 ${
      isEditing && isInMathMode
        ? "bg-violet-50/80 dark:bg-violet-950/30 ring-1 ring-violet-300/50 dark:ring-violet-700/50"
        : isEditing
        ? "bg-blue-50/30 dark:bg-blue-950/10"
        : ""
    }`}>
      {/* テキスト入力エリア（編集時のみ表示） */}
      {isEditing && (
        <>
          <textarea
            ref={textareaRef}
            value={content.text}
            onChange={handleChange}
            onSelect={handleSelect}
            onKeyDown={(e) => {
              // ⌘+Shift+M / Ctrl+Shift+M で数式モード切替
              // ⌘+Shift+M / Ctrl+Shift+M で数式モード切替
              if (e.key === "m" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault();
                const el = textareaRef.current;
                if (!el) return;
                const pos = el.selectionStart || 0;
                const text = content.text;

                // すでに数式モード内なら閉じる
                const ctx = getInlineMathContext(text, pos);
                if (ctx && ctx.inMath) {
                  // 閉じ$がない場合は追加
                  if (!text.slice(ctx.mathStart + 1).includes("$")) {
                    const newText = text.slice(0, text.length) + "$";
                    updateContent(block.id, { text: newText });
                    setTimeout(() => {
                      if (textareaRef.current) {
                        const newPos = newText.length;
                        textareaRef.current.selectionStart = newPos;
                        textareaRef.current.selectionEnd = newPos;
                        textareaRef.current.focus();
                        setCursorPos(newPos);
                      }
                    }, 0);
                  }
                  return;
                }

                // 数式モード開始 - $...$を挿入してカーソルを間に
                const before = text.slice(0, pos);
                const after = text.slice(pos);
                const newText = before + "$$" + after;
                updateContent(block.id, { text: newText });
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.selectionStart = pos + 1;
                    textareaRef.current.selectionEnd = pos + 1;
                    textareaRef.current.focus();
                    setCursorPos(pos + 1);
                  }
                }, 0);
                return;
              }
              handleKeyDown(e);
            }}
            placeholder={t("block.ph.paragraph")}
            className="w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 px-0 py-0.5 text-[14px] leading-[1.8] placeholder:text-muted-foreground/25"
            style={baseStyle}
            rows={1}
          />

          {/* スラッシュコマンドパレット */}
          {showPalette && filteredPalette.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-xl shadow-xl max-h-52 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b">
                {t("cmd.palette.hint")}
              </div>
              {filteredPalette.slice(0, 10).map((item, i) => (
                <button
                  key={item.type}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${
                    i === paletteIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelectPaletteItem(item.type); }}
                >
                  <span className={`shrink-0 text-[10px] font-medium ${item.color}`}>{item.name}</span>
                  <span className="text-muted-foreground text-[10px]">{item.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* 候補ドロップダウン（$の中で入力中に表示） */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {suggestions.map((sugg, i) => (
                <button
                  key={i}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2.5 transition-colors ${
                    i === selectedSuggIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); insertSuggestion(sugg); }}
                >
                  <span className="text-muted-foreground w-14 shrink-0 text-[10px]">{sugg.category}</span>
                  <span className="font-medium">{sugg.reading}</span>
                  <span className="ml-auto"><MathRenderer latex={sugg.latex} displayMode={false} /></span>
                </button>
              ))}
            </div>
          )}

          {/* 数式ライブプレビュー */}
          {isInMathMode && mathCtx && mathCtx.mathContent && (
            <div className="mx-2 mb-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-violet-50/40 dark:bg-violet-950/15 border border-violet-200/30 dark:border-violet-800/30">
              <span className="text-[8px] font-mono text-violet-400/70 shrink-0">∑</span>
              <div className="flex-1 flex justify-start overflow-hidden">
                <MathRenderer latex={parseJapanesemath(mathCtx.mathContent)} displayMode={false} />
              </div>
            </div>
          )}
        </>
      )}

      {/* 非編集時のレンダリング表示（$$は非表示、数式はKaTeXレンダリング） */}
      {!isEditing && (
        <div className="px-0 py-0.5 text-[14px] leading-[1.8] min-h-[1.75em] cursor-text" style={baseStyle}>
          {content.text ? (
            hasMath ? (
              segments.map((seg, i) =>
                seg.type === "math" && seg.latex ? (
                  <span key={i} className="inline-block mx-0.5 align-middle">
                    <MathRenderer latex={seg.latex} displayMode={false} />
                  </span>
                ) : (
                  <span key={i}>{seg.content}</span>
                )
              )
            ) : (
              <span>{content.text}</span>
            )
          ) : (
            <span className="text-muted-foreground/20 select-none">—</span>
          )}
        </div>
      )}
    </div>
  );
}

function MathBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "math" }>;
  const isEditing = editingBlockId === block.id;
  const [showGuide, setShowGuide] = useState(true);
  const mathInputRef = useRef<JapaneseMathInputHandle>(null);

  const handleApply = useCallback((latex: string, sourceText: string) => {
    updateContent(block.id, { latex, sourceText });
  }, [block.id, updateContent]);

  const handleTryExample = useCallback((input: string) => {
    mathInputRef.current?.setInput(input);
    mathInputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-0">
      {/* 数式プレビュー — 入力欄のすぐ上に配置 */}
      <div
        className={`transition-all cursor-pointer ${
          content.latex
            ? isEditing
              ? "latex-display-math border-b border-violet-200/50 dark:border-violet-800/50 pb-2 mb-0"
              : "latex-display-math"
            : isEditing
            ? ""
            : "flex justify-center py-6 px-4 bg-gradient-to-r from-violet-50/60 to-emerald-50/30 dark:from-violet-950/20 dark:to-emerald-950/10 rounded-xl border-2 border-dashed border-violet-200/50 dark:border-violet-800/40"
        }`}
      >
        {content.latex ? (
          <MathRenderer latex={content.latex} displayMode={content.displayMode} />
        ) : !isEditing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Sigma className="h-5 w-5 text-violet-400/60" />
              <span className="text-muted-foreground/50 text-sm font-medium">数式ブロック</span>
            </div>
            <span className="text-muted-foreground/30 text-xs">ダブルクリックして日本語で数式を入力</span>
            {/* パイプラインミニ図 */}
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground/30 mt-1">
              <span className="px-1 py-0.5 rounded bg-emerald-100/40 dark:bg-emerald-900/10">日本語入力</span>
              <span>→</span>
              <span className="px-1 py-0.5 rounded bg-violet-100/40 dark:bg-violet-900/10">LaTeX変換</span>
              <span>→</span>
              <span className="px-1 py-0.5 rounded bg-blue-100/40 dark:bg-blue-900/10">美しい数式</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 入力欄 */}
      {isEditing && (
        <>
          {/* 独立書き方ガイド（入力欄の上、独立領域） */}
          {showGuide ? (
            <MathWritingGuide
              onTryExample={handleTryExample}
              onClose={() => setShowGuide(false)}
              className="mb-1"
            />
          ) : (
            <button
              onClick={() => setShowGuide(true)}
              className="mb-1 px-2 py-0.5 rounded-lg text-[9px] text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors flex items-center gap-1"
            >
              <Sigma className="h-2.5 w-2.5" />ルール表示
            </button>
          )}
          <div className={`border rounded-xl p-3 bg-background shadow-md ${content.latex ? "border-t-0 rounded-t-none" : ""}`} onClick={(e) => e.stopPropagation()}>
            <JapaneseMathInput
              ref={mathInputRef}
              onApply={handleApply}
              initialSourceText={content.sourceText || ""}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ListBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "list" }>;

  return (
    <div className="latex-list">
      {content.items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-sm mt-0.5 w-5 text-right shrink-0 select-none text-foreground/70">
            {content.style === "numbered" ? `${i + 1}.` : "•"}
          </span>
          <input
            value={item}
            onChange={(e) => {
              const newItems = [...content.items];
              newItems[i] = e.target.value;
              updateContent(block.id, { items: newItems });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const newItems = [...content.items];
                newItems.splice(i + 1, 0, "");
                updateContent(block.id, { items: newItems });
              }
              if (e.key === "Backspace" && !item && content.items.length > 1) {
                e.preventDefault();
                const newItems = content.items.filter((_, j) => j !== i);
                updateContent(block.id, { items: newItems });
              }
            }}
            placeholder={`項目 ${i + 1}`}
            className="flex-1 bg-transparent border-none outline-none text-sm py-0.5 focus:ring-0"
          />
        </div>
      ))}
      <button
        onClick={() => updateContent(block.id, { items: [...content.items, ""] })}
        className="text-[10px] text-transparent hover:text-muted-foreground/50 transition-colors ml-7 mt-1"
      >
        + 追加
      </button>
    </div>
  );
}

function TableBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const pushHistory = useDocumentStore((s) => s._pushHistory);
  const content = block.content as Extract<Block["content"], { type: "table" }>;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="latex-table w-full">
          <thead>
            <tr>
              {content.headers.map((h, i) => (
                <th key={i}>
                  <input
                    value={h}
                    onChange={(e) => {
                      const newH = [...content.headers];
                      newH[i] = e.target.value;
                      updateContent(block.id, { headers: newH });
                    }}
                    className="w-full px-2 py-1 text-xs font-semibold bg-transparent border-none outline-none"
                    placeholder={`列${i + 1}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      value={cell}
                      onChange={(e) => {
                        const newRows = content.rows.map((r, i) =>
                          i === ri ? r.map((c, j) => (j === ci ? e.target.value : c)) : [...r],
                        );
                        updateContent(block.id, { rows: newRows });
                      }}
                      className="w-full px-2 py-1 text-xs bg-transparent border-none outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {content.caption !== undefined && (
        <input
          value={content.caption || ""}
          onChange={(e) => updateContent(block.id, { caption: e.target.value })}
          placeholder={t("block.ph.table.caption")}
          className="text-xs text-muted-foreground bg-transparent border-none outline-none w-full text-center"
        />
      )}
      <div className="flex gap-1 justify-center opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={() => {
            pushHistory();
            updateContent(block.id, {
              rows: [...content.rows, content.headers.map(() => "")],
            });
          }}
          className="text-[10px] px-2 py-0.5 rounded bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
        >
          + 行
        </button>
        <button
          onClick={() => {
            pushHistory();
            updateContent(block.id, {
              headers: [...content.headers, `列${content.headers.length + 1}`],
              rows: content.rows.map((r: string[]) => [...r, ""]),
            });
          }}
          className="text-[10px] px-2 py-0.5 rounded bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
        >
          + 列
        </button>
      </div>
    </div>
  );
}

function ImageBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "image" }>;

  return (
    <div className="space-y-2">
      {content.url ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.url} alt={content.caption} className="max-h-60 rounded-lg object-contain" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-muted-foreground/10 bg-muted/10 text-muted-foreground/20 gap-1.5">
          <ImageIcon className="h-6 w-6" />
          <span className="text-[10px]">{t("block.ph.image.url")}</span>
        </div>
      )}
      <Input
        value={content.url}
        onChange={(e) => updateContent(block.id, { url: e.target.value })}
        placeholder="https://example.com/image.png"
        className="h-8 text-xs rounded-lg"
      />
      <Input
        value={content.caption}
        onChange={(e) => updateContent(block.id, { caption: e.target.value })}
        placeholder={t("block.ph.caption")}
        className="h-8 text-xs rounded-lg"
      />
    </div>
  );
}

function DividerBlock() {
  return <hr className="latex-divider" />;
}

function CodeBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "code" }>;

  return (
    <div className="latex-code-block">
      <div className="flex items-center justify-between mb-1">
        <input
          value={content.language}
          onChange={(e) => updateContent(block.id, { language: e.target.value })}
          placeholder={t("block.ph.code.lang")}
          className="bg-transparent text-[10px] text-slate-500 border-none outline-none w-24"
        />
      </div>
      <textarea
        value={content.code}
        onChange={(e) => updateContent(block.id, { code: e.target.value })}
        placeholder={t("block.ph.code.body")}
        className="w-full bg-transparent text-sm font-mono border-none outline-none resize-y min-h-[60px]"
        style={{ color: '#1a1a2e', lineHeight: '1.5' }}
        rows={3}
      />
    </div>
  );
}

function QuoteBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "quote" }>;

  return (
    <div className="latex-quote">
      <AutoTextarea
        value={content.text}
        onChange={(text) => updateContent(block.id, { text })}
        placeholder={t("block.ph.quote")}
        className="text-sm italic leading-relaxed text-foreground/80"
      />
      <input
        value={content.attribution || ""}
        onChange={(e) => updateContent(block.id, { attribution: e.target.value })}
        placeholder={t("block.ph.quote.src")}
        className="bg-transparent border-none outline-none text-xs text-muted-foreground/60 mt-1 w-full"
      />
    </div>
  );
}

// ──── Block Editor Switch ────
function BlockEditor({ block }: { block: Block }) {
  switch (block.content.type) {
    case "heading":   return <HeadingBlockEditor block={block} />;
    case "paragraph": return <ParagraphBlockEditor block={block} />;
    case "math":      return <MathBlockEditor block={block} />;
    case "list":      return <ListBlockEditor block={block} />;
    case "table":     return <TableBlockEditor block={block} />;
    case "image":     return <ImageBlockEditor block={block} />;
    case "divider":   return <DividerBlock />;
    case "code":      return <CodeBlockEditor block={block} />;
    case "quote":     return <QuoteBlockEditor block={block} />;
    case "circuit":   return <CircuitBlockEditor block={block} />;
    case "diagram":   return <DiagramBlockEditor block={block} />;
    case "chemistry": return <ChemistryBlockEditor block={block} />;
    case "chart":     return <ChartBlockEditor block={block} />;
    default:          return null;
  }
}

// Paper size definitions (width in px at 96dpi)
const PAPER_SIZES: Record<string, { w: number; label: string }> = {
  a4:     { w: 794,  label: "A4" },
  a3:     { w: 1123, label: "A3" },
  b5:     { w: 669,  label: "B5" },
  letter: { w: 816,  label: "Letter" },
};

// ──── Global Command Palette (Cmd+K) ────
function GlobalCommandPalette() {
  const { t } = useI18n();
  const { showGlobalPalette, setGlobalPalette, selectedBlockId, selectBlock, setEditingBlock } = useUIStore();
  const { addBlock } = useDocumentStore();
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? BLOCK_TYPES.filter((b) =>
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.type.includes(query.toLowerCase()) ||
        b.description.toLowerCase().includes(query.toLowerCase())
      )
    : BLOCK_TYPES;

  useEffect(() => {
    if (showGlobalPalette) {
      setQuery("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showGlobalPalette]);

  const handleSelect = (type: BlockType) => {
    setGlobalPalette(false);
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const afterIdx = selectedBlockId
      ? blocks.findIndex((b) => b.id === selectedBlockId) + 1
      : blocks.length;
    const newId = addBlock(type, afterIdx);
    if (newId) { selectBlock(newId); if (TEXT_EDIT_TYPES.includes(type)) setEditingBlock(newId); }
  };

  if (!showGlobalPalette) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]"
      onClick={() => setGlobalPalette(false)}
    >
      <div
        className="w-[480px] bg-background border border-border/40 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/20">
          <Search className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (filtered[idx]) handleSelect(filtered[idx].type); }
              else if (e.key === "Escape") { e.preventDefault(); setGlobalPalette(false); }
            }}
            placeholder={t("cmd.palette.search")}
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/30"
          />
          <span className="text-[10px] font-mono text-muted-foreground/30 shrink-0">Esc</span>
        </div>
        {/* Block list */}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((info, i) => {
            const Icon = BLOCK_ICONS[info.type];
            return (
              <button
                key={info.type}
                onClick={() => handleSelect(info.type)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                  i === idx ? "bg-primary/8 text-primary" : "hover:bg-muted/40"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${info.color}`} />
                <span className="font-medium text-[13px]">{info.name}</span>
                <span className="text-muted-foreground/50 text-[11px] ml-1">{info.description}</span>
              </button>
            );
          })}
        </div>
        {/* Hint */}
        <div className="px-4 py-2 border-t border-border/10 text-[10px] text-muted-foreground/30 font-mono">
          {t("cmd.palette.hint")}
        </div>
      </div>
    </div>
  );
}

// ──── Main Document Editor ────
export function DocumentEditor() {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const selectBlock = useUIStore((s) => s.selectBlock);
  const zoom = useUIStore((s) => s.zoom);
  const paperSize = useUIStore((s) => s.paperSize);

  if (!document) return null;

  const paper = PAPER_SIZES[paperSize] ?? PAPER_SIZES.a4;

  return (
    <>
    <GlobalCommandPalette />
    {/* Canvas — gray background like Google Docs / Word */}
    <div
      className="flex-1 overflow-auto bg-[#e8e8e8] dark:bg-[#1e1e1e]"
      onClick={() => selectBlock(null)}
    >
      <div className="py-10 flex flex-col items-center min-h-full">

        {/* Paper size label */}
        <div className="mb-2 text-[10px] font-mono text-[#aaa] dark:text-[#555] select-none self-start" style={{ marginLeft: `calc(50% - ${paper.w / 2}px)` }}>
          {paper.label} — {paper.w}px
        </div>

        {/* Paper card */}
        <div
          className="bg-white dark:bg-[#fafafa] shadow-[0_4px_24px_rgba(0,0,0,0.18)] flex-shrink-0 relative"
          style={{
            width: paper.w,
            minHeight: Math.round(paper.w * 1.4142),
            padding: "64px 72px 80px",
            zoom: zoom,
            color: "#1a1a1a",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Empty state — inside paper */}
          {document.blocks.length === 0 && (
            <div className="flex flex-col items-start gap-3 py-6 select-none pointer-events-none">
              <p className="text-[11px] font-mono text-gray-300">{t("editor.empty.comment")}</p>
              <h2 className="text-2xl font-light text-gray-300 tracking-tight">{t("editor.empty.h2")}</h2>
            </div>
          )}

          {/* Blocks */}
          {document.blocks.length > 0 && (
            <div>
              {document.blocks.map((block, idx) => (
                <BlockWrapper key={block.id} block={block} index={idx}>
                  <BlockEditor block={block} />
                </BlockWrapper>
              ))}
            </div>
          )}
        </div>

        {/* Bottom spacing */}
        <div className="h-16" />
      </div>
    </div>
    </>
  );
}
