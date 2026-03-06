"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES } from "@/lib/types";
import { MathRenderer } from "./math-editor";
import { JapaneseMathInput } from "./math-japanese-input";
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
  GripVertical,
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
      <div className="group/ins relative flex items-center justify-center h-2 -my-1 z-10 cursor-pointer">
        <div className="absolute inset-x-0 h-px bg-transparent group-hover/ins:bg-primary/20 transition-colors" />
        <DropdownMenuTrigger asChild>
          <button className="relative flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border/60 text-muted-foreground/0 group-hover/ins:text-primary group-hover/ins:border-primary/40 transition-all shadow-sm hover:shadow">
            <Plus className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
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

// ──── Block Wrapper ────
function BlockWrapper({
  block,
  children,
}: {
  block: Block;
  children: React.ReactNode;
}) {
  const { selectedBlockId, selectBlock, setEditingBlock } = useUIStore();
  const { deleteBlock, duplicateBlock, moveBlock } = useDocumentStore();
  const isSelected = selectedBlockId === block.id;

  return (
    <div
      className={`group/block relative transition-all duration-150`}
      onClick={(e) => {
        e.stopPropagation();
        selectBlock(block.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingBlock(block.id);
      }}
    >
      {/* Left actions — only on hover */}
      {isSelected && (
        <div className="absolute -left-10 top-0 bottom-0 flex flex-col items-center gap-0.5 pt-1 opacity-0 group-hover/block:opacity-100 transition-opacity">
          <button className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground cursor-grab">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }}
            title="上へ"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }}
            title="下へ"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
            title="複製"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            className="p-0.5 rounded text-destructive/40 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              deleteBlock(block.id);
              selectBlock(null);
            }}
            title="削除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Block content */}
      <div className="py-1 px-1">{children}</div>
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

function ParagraphBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "paragraph" }>;
  const isEditing = editingBlockId === block.id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestions, setSuggestions] = useState<JapaneseSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggIdx, setSelectedSuggIdx] = useState(0);

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
  }, [block.id, updateContent]);

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
  }, [showSuggestions, suggestions, selectedSuggIdx, insertSuggestion]);

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
      {/* モードインジケーター */}
      {isEditing && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-medium rounded-t-lg transition-all ${
          isInMathMode
            ? "bg-gradient-to-r from-violet-100/90 to-fuchsia-50/50 dark:from-violet-900/40 dark:to-fuchsia-950/20 text-violet-600 dark:text-violet-400"
            : "bg-blue-50/50 dark:bg-blue-950/20 text-blue-500/60 dark:text-blue-400/40"
        }`}>
          {isInMathMode ? (
            <>
              <Sigma className="h-3 w-3" />
              <span className="font-bold text-[10px]">数式モード</span>
              <span className="mx-1 text-violet-300">|</span>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[7px] bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">1項</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[7px] bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">2項</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[7px] bg-violet-100/80 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">3項</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[7px] bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">括弧</span>
              </div>
              <span className="ml-auto text-violet-400/60 text-[8px]">⇧⌘M で閉じる</span>
            </>
          ) : (
            <>
              <Type className="h-2.5 w-2.5" />
              <span>テキストモード</span>
              <span className="ml-auto text-muted-foreground/40">⇧⌘M で数式モード</span>
            </>
          )}
        </div>
      )}

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
            placeholder="テキストを入力... (⇧⌘M で数式モード切替)"
            className="w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 p-2 text-sm leading-relaxed"
            style={baseStyle}
            rows={1}
          />

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

          {/* インライン数式ヒント + ライブプレビュー（数式モード中） */}
          {isInMathMode && mathCtx && (
            <div className="mx-2 mb-1 space-y-1">
              {mathCtx.mathContent && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-50/60 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-fuchsia-950/10 border border-violet-200/50 dark:border-violet-800/50">
                  <span className="text-[9px] text-violet-500 font-semibold shrink-0">プレビュー</span>
                  <div className="flex-1 flex justify-center overflow-auto">
                    <MathRenderer latex={parseJapanesemath(mathCtx.mathContent)} displayMode={false} />
                  </div>
                </div>
              )}
              <div className="px-2 py-1.5 rounded-lg bg-violet-50/40 dark:bg-violet-900/20 text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-1.5 flex-wrap">
                <Sigma className="h-3 w-3 shrink-0" />
                <span className="shrink-0">入力例:</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px]">ルートx</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px]">a/b</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-violet-100/80 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[9px]">から〜まで</span>
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px]">かっこa+b</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* 非編集時のレンダリング表示（$$は非表示、数式はKaTeXレンダリング） */}
      {!isEditing && (
        <div className="px-2 py-1 text-sm leading-relaxed min-h-[1.5em]" style={baseStyle}>
          {content.text ? (
            hasMath ? (
              // 数式を含む場合：テキスト+数式をレンダリング（$$は非表示）
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
              // テキストのみ
              <span>{content.text}</span>
            )
          ) : (
            <span className="text-muted-foreground/30 italic">ダブルクリックで編集</span>
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

  const handleApply = useCallback((latex: string, sourceText: string) => {
    updateContent(block.id, { latex, sourceText });
  }, [block.id, updateContent]);

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
          </div>
        ) : null}
      </div>

      {/* 入力欄 — プレビュー直下（隙間なし） */}
      {isEditing && (
        <div className={`border rounded-xl p-3 bg-background shadow-md ${content.latex ? "border-t-0 rounded-t-none" : ""}`} onClick={(e) => e.stopPropagation()}>
          <JapaneseMathInput
            onApply={handleApply}
            initialSourceText={content.sourceText || ""}
          />
        </div>
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
          <span className="text-sm mt-0.5 w-5 text-right shrink-0 select-none" style={{ color: '#1a1a2e' }}>
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
  const selectBlock = useUIStore((s) => s.selectBlock);
  const zoom = useUIStore((s) => s.zoom);

  if (!document) return null;

  const pageWidthMm = 210;
  const marginLeftMm = document.settings.margins.left;
  const marginRightMm = document.settings.margins.right;
  const contentWidthMm = pageWidthMm - marginLeftMm - marginRightMm;

  return (
    <div
      className="flex-1 overflow-auto bg-muted/30"
      onClick={() => selectBlock(null)}
    >
      <div className="flex justify-center py-8 px-4">
        {/* A4 Page */}
        <div
          className="document-page bg-white dark:bg-white rounded shadow-2xl shadow-black/10 relative"
          style={{
            width: `${pageWidthMm * zoom * 3.78}px`, // mm → px conversion at ~96dpi
            minHeight: `${297 * zoom * 3.78}px`,
            padding: `${document.settings.margins.top * zoom * 3.78}px ${marginRightMm * zoom * 3.78}px ${document.settings.margins.bottom * zoom * 3.78}px ${marginLeftMm * zoom * 3.78}px`,
          }}
        >
          <div className="relative" style={{ maxWidth: `${contentWidthMm * zoom * 3.78}px` }}>
            {document.blocks.map((block) => (
              <React.Fragment key={block.id}>
                <BlockWrapper block={block}>
                  <BlockEditor block={block} />
                </BlockWrapper>
              </React.Fragment>
            ))}

            {/* Empty state — 初心者フレンドリー */}
            {document.blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-5">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-100 to-emerald-100 dark:from-violet-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                  <span className="text-3xl">📝</span>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-foreground/60 text-sm font-medium">文書を作成しましょう</p>
                  <p className="text-muted-foreground/40 text-xs max-w-[240px]">
                    下のボタンからブロックを追加。見出し・本文・数式・表など自由に組み合わせられます
                  </p>
                </div>
                <InsertMenu index={0} variant="button" />
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground/30">
                  <span className="flex items-center gap-1">📄 見出し・本文</span>
                  <span className="flex items-center gap-1">∑ 数式（日本語入力）</span>
                  <span className="flex items-center gap-1">📊 表・画像</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating add button — below the page */}
        {document.blocks.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <InsertMenu index={document.blocks.length} variant="button" />
          </div>
        )}
      </div>
    </div>
  );
}
