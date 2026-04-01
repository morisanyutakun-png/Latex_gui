"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES, createBlock } from "@/lib/types";
import { MathRenderer } from "./math-editor";
import { JapaneseMathInput, MathWritingGuide, type JapaneseMathInputHandle } from "./math-japanese-input";
import { CircuitBlockEditor, DiagramBlockEditor, ChemistryBlockEditor, ChartBlockEditor } from "./engineering-editors";
import { parseInlineText, getInlineMathContext, getJapaneseSuggestions, parseJapanesemath, type JapaneseSuggestion } from "@/lib/math-japanese";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
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
} from "lucide-react";

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

// Category grouping for insert menu
const BLOCK_CATEGORIES = [
  { label: "基本", types: ["heading", "paragraph", "list", "table", "divider"] as BlockType[] },
  { label: "理工系", types: ["math", "circuit", "diagram", "chemistry", "chart"] as BlockType[] },
  { label: "メディア", types: ["image", "code", "quote"] as BlockType[] },
];

// ──── Insert Menu ────
function InsertMenu({ index, variant = "line" }: { index: number; variant?: "line" | "button" }) {
  const addBlock = useDocumentStore((s) => s.addBlock);
  const selectBlock = useUIStore((s) => s.selectBlock);
  const setEditingBlock = useUIStore((s) => s.setEditingBlock);

  const handleInsert = (type: BlockType) => {
    const id = addBlock(type, index);
    if (id) {
      selectBlock(id);
      if (type !== "divider") setEditingBlock(id);
    }
  };

  const trigger =
    variant === "line" ? (
      <div className="group/ins relative flex items-center h-[3px] z-10">
        <DropdownMenuTrigger asChild>
          <button className="absolute left-0 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border/0 text-primary/0 group-hover/ins:border-primary/30 group-hover/ins:text-primary/60 transition-all ml-9">
            <Plus className="h-2.5 w-2.5" />
          </button>
        </DropdownMenuTrigger>
        <div className="absolute inset-x-0 h-px bg-transparent group-hover/ins:bg-primary/10 transition-colors" />
      </div>
    ) : (
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 rounded-lg">
          <Plus className="h-3 w-3" />
          ブロックを追加
        </Button>
      </DropdownMenuTrigger>
    );

  return (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent align="center" className="w-64 p-1.5 rounded-xl shadow-xl border-border/50">
        {BLOCK_CATEGORIES.map((cat, ci) => (
          <React.Fragment key={cat.label}>
            {ci > 0 && <DropdownMenuSeparator className="my-1" />}
            <DropdownMenuLabel className="text-[9px] text-muted-foreground/60 font-medium px-2 py-0.5">
              {cat.label}
            </DropdownMenuLabel>
            <div className="grid grid-cols-3 gap-1">
              {cat.types.map((type) => {
                const info = BLOCK_TYPES.find((t) => t.type === type);
                if (!info) return null;
                const Icon = BLOCK_ICONS[info.type];
                return (
                  <DropdownMenuItem
                    key={info.type}
                    onClick={() => handleInsert(info.type)}
                    className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg cursor-pointer text-center focus:bg-primary/5"
                  >
                    <Icon className={`h-4 w-4 ${info.color}`} />
                    <span className="text-[10px] font-medium leading-none">{info.name}</span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </React.Fragment>
        ))}

      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ──── Block Wrapper — VS Code style ────
function BlockWrapper({
  block,
  index,
  children,
}: {
  block: Block;
  index: number;
  children: React.ReactNode;
}) {
  const { selectedBlockId, selectBlock, setEditingBlock } = useUIStore();
  const { deleteBlock, duplicateBlock, moveBlock } = useDocumentStore();
  const isSelected = selectedBlockId === block.id;

  const Icon = BLOCK_ICONS[block.content.type as BlockType] || Type;

  return (
    <div
      className={`group/block relative flex items-stretch transition-all duration-100
        ${isSelected
          ? "bg-primary/[0.05] dark:bg-primary/[0.08]"
          : "hover:bg-muted/20 dark:hover:bg-white/[0.025]"
        }`}
      onClick={(e) => { e.stopPropagation(); selectBlock(block.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); setEditingBlock(block.id); }}
    >
      {/* Left active indicator */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-100 ${
        isSelected ? "bg-primary/70" : "bg-transparent group-hover/block:bg-border/30"
      }`} />

      {/* Left gutter */}
      <div className="w-12 shrink-0 flex flex-col items-end pr-3 pt-[7px] pb-2 gap-0.5 select-none cursor-default">
        <span className={`text-[9px] font-mono tabular-nums leading-none transition-colors ${
          isSelected ? "text-primary/50" : "text-muted-foreground/20 group-hover/block:text-muted-foreground/35"
        }`}>
          {index + 1}
        </span>
      </div>

      {/* Block content */}
      <div className="flex-1 min-w-0 py-1.5 pr-16">
        {children}
      </div>

      {/* Right hover actions */}
      <div className={`absolute right-2 top-1.5 flex items-center gap-0.5 transition-opacity
        ${isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"}`}>
        <button
          className="p-1 rounded text-muted-foreground/25 hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }}
          title="上へ (Alt+↑)"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          className="p-1 rounded text-muted-foreground/25 hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }}
          title="下へ (Alt+↓)"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
        <button
          className="p-1 rounded text-muted-foreground/25 hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
          title="複製"
        >
          <Copy className="h-2.5 w-2.5" />
        </button>
        <button
          className="p-1 rounded text-muted-foreground/25 hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            deleteBlock(block.id);
            selectBlock(null);
          }}
          title="削除 (Del)"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

// ──── Auto-resize Textarea ────
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
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
      className={`w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 p-0 ${className}`}
      style={style}
      rows={1}
    />
  );
}

// ──── Block Editors by Type ────

function HeadingBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "heading" }>;
  const headingClass: Record<number, string> = { 1: "latex-heading-1", 2: "latex-heading-2", 3: "latex-heading-3" };

  return (
    <div>
      <AutoTextarea
        value={content.text}
        onChange={(text) => updateContent(block.id, { text })}
        placeholder={`見出し ${content.level}`}
        className={headingClass[content.level] || "latex-heading-1"}
        style={{
          textAlign: block.style.textAlign || "left",
          color: block.style.textColor || undefined,
        }}
      />
    </div>
  );
}

// Block type palette items for / command
const PALETTE_ITEMS = BLOCK_TYPES.filter((t) =>
  !["circuit", "diagram", "chemistry", "chart"].includes(t.type)
).concat(BLOCK_TYPES.filter((t) => ["circuit", "diagram", "chemistry", "chart"].includes(t.type)));

function ParagraphBlockEditor({ block }: { block: Block }) {
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

  const handleSelectPaletteItem = useCallback((type: BlockType) => {
    setShowPalette(false);
    setPaletteQuery("");
    if (type === "paragraph") return; // already a paragraph, nothing to do
    const blocks = document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);
    if (content.text === "" || content.text === "/") {
      // Current block is empty — convert in-place (history-tracked via convertBlock)
      convertBlock(block.id, createBlock(type).content);
      setTimeout(() => setEditingBlock(block.id), 50);
    } else {
      // Paragraph has content — insert a new block of the selected type after it
      const newId = addBlock(type, idx + 1);
      setTimeout(() => setEditingBlock(newId), 50);
    }
  }, [block.id, content.text, document, addBlock, convertBlock, setEditingBlock]);

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

    // Slash command palette: trigger when "/" typed in a paragraph
    if (text.startsWith("/")) {
      const query = text.slice(1);
      setShowPalette(true);
      setPaletteQuery(query);
      setPaletteIdx(0); // always reset index when query changes
      setShowSuggestions(false);
      return;
    } else if (showPalette) {
      setShowPalette(false);
      setPaletteQuery("");
      setPaletteIdx(0);
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
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        updateContent(block.id, { text: "" });
        return;
      }
    }

    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === " " || e.key === "Enter") {
      // スペースキーで候補を確定（IME風操作）
      if (showSuggestions && suggestions[selectedSuggIdx]) {
        e.preventDefault();
        insertSuggestion(suggestions[selectedSuggIdx]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [showPalette, filteredPalette, paletteIdx, handleSelectPaletteItem, showSuggestions, suggestions, selectedSuggIdx, insertSuggestion, block.id, updateContent]);

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
            placeholder="テキストを入力…"
            className="w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 px-0 py-0.5 text-[14px] leading-[1.8] placeholder:text-muted-foreground/25"
            style={baseStyle}
            rows={1}
          />

          {/* スラッシュコマンドパレット */}
          {showPalette && filteredPalette.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-xl shadow-xl max-h-52 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b">
                ブロックを選択 (↑↓ で移動、Enter で確定、Esc でキャンセル)
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
          placeholder="表のキャプション"
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
          <span className="text-[10px]">画像URL</span>
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
        placeholder="キャプション（任意）"
        className="h-8 text-xs rounded-lg"
      />
    </div>
  );
}

function DividerBlock() {
  return <hr className="latex-divider" />;
}

function CodeBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "code" }>;

  return (
    <div className="latex-code-block">
      <div className="flex items-center justify-between mb-1">
        <input
          value={content.language}
          onChange={(e) => updateContent(block.id, { language: e.target.value })}
          placeholder="言語"
          className="bg-transparent text-[10px] text-slate-500 border-none outline-none w-24"
        />
      </div>
      <textarea
        value={content.code}
        onChange={(e) => updateContent(block.id, { code: e.target.value })}
        placeholder="コードを入力..."
        className="w-full bg-transparent text-sm font-mono border-none outline-none resize-y min-h-[60px]"
        style={{ color: '#1a1a2e', lineHeight: '1.5' }}
        rows={3}
      />
    </div>
  );
}

function QuoteBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "quote" }>;

  return (
    <div className="latex-quote">
      <AutoTextarea
        value={content.text}
        onChange={(text) => updateContent(block.id, { text })}
        placeholder="引用テキスト..."
        className="text-sm italic leading-relaxed text-foreground/80"
      />
      <input
        value={content.attribution || ""}
        onChange={(e) => updateContent(block.id, { attribution: e.target.value })}
        placeholder="— 出典"
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

// ──── Main Document Editor ────
export function DocumentEditor() {
  const document = useDocumentStore((s) => s.document);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const selectBlock = useUIStore((s) => s.selectBlock);
  const setEditingBlock = useUIStore((s) => s.setEditingBlock);
  const zoom = useUIStore((s) => s.zoom);

  if (!document) return null;

  const handleQuickAdd = (type: BlockType) => {
    const id = addBlock(type, document.blocks.length);
    if (id) {
      selectBlock(id);
      if (type !== "divider") setEditingBlock(id);
    }
  };

  return (
    <div
      className="flex-1 overflow-auto bg-background"
      onClick={() => selectBlock(null)}
      style={{ fontSize: `${zoom * 100}%` }}
    >
      <div className="max-w-[720px] mx-auto py-10 px-0">

        {/* Empty state */}
        {document.blocks.length === 0 && (
          <div className="px-12 py-16 flex flex-col items-start gap-8 select-none">
            <div>
              <p className="text-[11px] font-mono text-muted-foreground/20 mb-2">{"// document.blocks.length === 0"}</p>
              <h2 className="text-2xl font-light text-foreground/30 tracking-tight">何を作りますか？</h2>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-3 group cursor-default">
                <span className="text-[10px] font-mono text-violet-400/50 w-22 shrink-0">▸ AI agent</span>
                <span className="text-muted-foreground/35">右パネルで「数学プリントを作って」と話しかける</span>
              </div>
              <div className="flex items-center gap-3 group cursor-default">
                <span className="text-[10px] font-mono text-muted-foreground/25 w-22 shrink-0">▸ / command</span>
                <span className="text-muted-foreground/35">テキストを入力してから <kbd className="text-[9px] border border-border/20 px-1 rounded font-mono bg-muted/30">/</kbd> でブロック変換</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(["paragraph", "heading", "math", "list"] as BlockType[]).map((t) => {
                const info = BLOCK_TYPES.find((b) => b.type === t);
                if (!info) return null;
                const Icon = BLOCK_ICONS[t];
                return (
                  <button
                    key={t}
                    onClick={(e) => { e.stopPropagation(); handleQuickAdd(t); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/25 bg-background text-xs text-muted-foreground/50 hover:text-foreground hover:border-primary/30 hover:bg-muted/20 transition-colors"
                  >
                    <Icon className={`h-3 w-3 ${info.color}`} />
                    {info.name}
                  </button>
                );
              })}
              <InsertMenu index={0} variant="button" />
            </div>

            <p className="text-[10px] font-mono text-muted-foreground/20">
              <kbd className="px-1 py-0.5 rounded border border-border/15 bg-muted/20">Ctrl+Z</kbd> undo ·{" "}
              <kbd className="px-1 py-0.5 rounded border border-border/15 bg-muted/20">Ctrl+S</kbd> save
            </p>
          </div>
        )}

        {/* Blocks */}
        {document.blocks.length > 0 && (
          <div className="pb-32">
            {document.blocks.map((block, idx) => (
              <React.Fragment key={block.id}>
                <InsertMenu index={idx} variant="line" />
                <BlockWrapper block={block} index={idx}>
                  <BlockEditor block={block} />
                </BlockWrapper>
              </React.Fragment>
            ))}
            <InsertMenu index={document.blocks.length} variant="line" />
            <div className="flex justify-start pl-10 mt-6">
              <InsertMenu index={document.blocks.length} variant="button" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
