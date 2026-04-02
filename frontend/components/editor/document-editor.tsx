"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES, createBlock } from "@/lib/types";
import { MathRenderer } from "./math-editor";
import { JapaneseMathInput, type JapaneseMathInputHandle } from "./math-japanese-input";
import { CircuitBlockEditor, DiagramBlockEditor, ChemistryBlockEditor, ChartBlockEditor } from "./engineering-editors";
import { parseInlineText, getJapaneseSuggestions, parseJapanesemath, type JapaneseSuggestion } from "@/lib/math-japanese";
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

// Context passed down so block editors know if the global edit mode is on
const EditModeContext = React.createContext(false);

// ──── Block Wrapper — transparent wrapper with right-click context menu ────
function BlockWrapper({
  block,
  index: _index,
  children,
}: {
  block: Block;
  index: number;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { selectBlock, setEditingBlock, lastAIAction, setActiveGuideContext } = useUIStore();
  const { deleteBlock, duplicateBlock, moveBlock, convertBlock } = useDocumentStore();
  const editMode = React.useContext(EditModeContext);

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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-block-id={block.id}
          className="relative"
          onClick={(e) => {
            e.stopPropagation();
            if (editMode) {
              setEditingBlock(block.id);
              // ブロック種別に応じてサイドバーガイドを切替
              const t = block.content.type;
              const guideMap: Record<string, string> = { heading: "heading", list: "list", table: "table", code: "code", math: "math" };
              setActiveGuideContext((guideMap[t] || "general") as import("@/store/ui-store").GuideContext);
            }
            else selectBlock(block.id);
          }}
        >
          {isAIHighlighted && (
            <div className="absolute inset-0 rounded-sm bg-violet-400/5 animate-pulse pointer-events-none" />
          )}
          <div className="py-0">
            {children}
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
const AutoTextarea = React.forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}>(function AutoTextarea({
  value, onChange, placeholder, className = "", style, onKeyDown, autoFocus,
}, forwardedRef) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ref = (forwardedRef as React.RefObject<HTMLTextAreaElement>) ?? innerRef;

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value, ref]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      className={`w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 focus-visible:outline-none p-0 ${className}`}
      style={style}
      rows={1}
    />
  );
});

// ──── Block Editors by Type ────

function HeadingBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const deleteBlock = useDocumentStore((s) => s.deleteBlock);
  const { editingBlockId, selectBlock, setEditingBlock } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "heading" }>;
  const headingClass: Record<number, string> = { 1: "latex-heading-1", 2: "latex-heading-2", 3: "latex-heading-3" };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = editingBlockId === block.id;

  // Auto-focus when entering editing state
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.selectionStart = len;
      textareaRef.current.selectionEnd = len;
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);

    if (e.key === "Backspace" && content.text === "") {
      e.preventDefault();
      deleteBlock(block.id);
      if (idx > 0) { selectBlock(blocks[idx - 1].id); setEditingBlock(blocks[idx - 1].id); }
      return;
    }

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
      // Tab inserts math delimiters in the heading text
      const pos = el.selectionStart ?? 0;
      const text = content.text;
      const newText = text.slice(0, pos) + "$$" + text.slice(pos);
      updateContent(block.id, { text: newText });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = pos + 1;
          textareaRef.current.selectionEnd = pos + 1;
          textareaRef.current.focus();
        }
      }, 0);
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
        ref={textareaRef}
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

// ── レンダリング済みインラインテキスト表示（数式は常にKaTeX描画） ──
function RenderedInlineText({ text, style }: { text: string; style?: React.CSSProperties }) {
  const segments = parseInlineText(text);
  const hasMath = segments.some((s) => s.type === "math");
  if (!text) return <span className="text-muted-foreground/20 select-none">—</span>;
  if (!hasMath) return <span style={style}>{text}</span>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "math" && seg.latex ? (
          <span key={i} className="inline-block mx-0.5 align-middle">
            <MathRenderer latex={seg.latex} displayMode={false} />
          </span>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </>
  );
}

function ParagraphBlockEditor({ block }: { block: Block }) {
  const { t } = useI18n();
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const convertBlock = useDocumentStore((s) => s.convertBlock);
  const document = useDocumentStore((s) => s.document);
  const { editingBlockId, setEditingBlock, setMathEditing } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "paragraph" }>;
  const isEditing = editingBlockId === block.id;
  const editMode = React.useContext(EditModeContext);
  const showTextarea = editMode || isEditing;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── 数式変換モード ──
  // その行のtextareaに直接自然言語を書く。
  // parseJapanesemath でリアルタイム変換し、紙面にはレンダリング結果を表示。
  // Esc で確定終了（未確定テキストを $latex$ に変換して格納）。
  const [mathMode, setMathMode] = useState(false);
  // 数式モード開始時のテキスト位置（確定済みテキストの末尾）
  const [mathAnchor, setMathAnchor] = useState(0);

  // 未確定テキスト（mathAnchor以降）
  const composingText = mathMode ? content.text.slice(mathAnchor) : "";
  // リアルタイム変換結果
  const composingLatex = composingText ? parseJapanesemath(composingText) : "";
  // 候補リスト（補助）
  const mathSuggs = mathMode && composingText.length >= 1 ? getJapaneseSuggestions(composingText) : [];
  const [mathSuggIdx, setMathSuggIdx] = useState(0);
  // suggIdx がはみ出ないように
  const clampedSuggIdx = mathSuggs.length > 0 ? Math.min(mathSuggIdx, mathSuggs.length - 1) : 0;

  // Slash command palette state
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [slashPos, setSlashPos] = useState<number>(0);

  const filteredPalette = paletteQuery
    ? PALETTE_ITEMS.filter((b) =>
        b.name.includes(paletteQuery) || b.type.includes(paletteQuery) || b.description.includes(paletteQuery)
      )
    : PALETTE_ITEMS;

  // ── 数式モードに入る ──
  const enterMathMode = useCallback((anchor: number) => {
    setMathMode(true);
    setMathAnchor(anchor);
    setMathSuggIdx(0);
    setMathEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = anchor;
        textareaRef.current.selectionEnd = anchor;
        textareaRef.current.focus();
      }
    }, 0);
  }, [setMathEditing]);

  // ── 数式モード終了: 未確定テキストをLaTeXに変換して確定 ──
  const finishMathMode = useCallback(() => {
    const raw = content.text.slice(mathAnchor);
    if (raw.trim()) {
      const latex = parseJapanesemath(raw);
      const before = content.text.slice(0, mathAnchor);
      const newText = before + "$" + latex + "$";
      updateContent(block.id, { text: newText });
      setTimeout(() => {
        if (textareaRef.current) {
          const end = newText.length;
          textareaRef.current.selectionStart = end;
          textareaRef.current.selectionEnd = end;
          textareaRef.current.focus();
        }
      }, 0);
    }
    setMathMode(false);
    setMathSuggIdx(0);
    setMathEditing(false);
  }, [content.text, mathAnchor, block.id, updateContent, setMathEditing]);

  // ── 候補から確定（候補を選んで確定し、数式モードに留まる） ──
  const acceptSugg = useCallback((sugg: JapaneseSuggestion) => {
    const before = content.text.slice(0, mathAnchor);
    const newText = before + "$" + sugg.latex + "$";
    updateContent(block.id, { text: newText });
    const newAnchor = newText.length;
    setMathAnchor(newAnchor);
    setMathSuggIdx(0);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newAnchor;
        textareaRef.current.selectionEnd = newAnchor;
        textareaRef.current.focus();
      }
    }, 0);
  }, [content.text, mathAnchor, block.id, updateContent]);

  const handleSelectPaletteItem = useCallback((type: BlockType) => {
    setShowPalette(false);
    setPaletteQuery("");
    if (type === "paragraph") return;

    if (type === "math") {
      const cleanText = content.text.slice(0, slashPos) + content.text.slice(slashPos + 1 + paletteQuery.length);
      updateContent(block.id, { text: cleanText });
      enterMathMode(slashPos);
      return;
    }

    const blocks = document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);
    const cleanText = content.text.slice(0, slashPos) + content.text.slice(slashPos + 1 + paletteQuery.length);
    if (cleanText === "") {
      convertBlock(block.id, createBlock(type).content);
      setTimeout(() => setEditingBlock(block.id), 50);
    } else {
      updateContent(block.id, { text: cleanText });
      const newId = addBlock(type, idx + 1);
      setTimeout(() => setEditingBlock(newId), 50);
    }
  }, [block.id, content.text, slashPos, paletteQuery, document, addBlock, convertBlock, setEditingBlock, updateContent, enterMathMode]);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [content.text]);

  // Auto-focus
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      if (window.document.activeElement !== textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.selectionStart = len;
        textareaRef.current.selectionEnd = len;
      }
    }
    if (!isEditing && mathMode) { finishMathMode(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // suggIdx リセット
  useEffect(() => { setMathSuggIdx(0); }, [composingText]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const pos = e.target.selectionStart || 0;
    updateContent(block.id, { text });

    // 数式モード中は候補更新のみ（parseJapanesemathはrender時にリアルタイム実行）
    if (mathMode) return;

    // スラッシュパレット更新
    if (showPalette) {
      const query = text.slice(slashPos + 1, pos);
      if (text[slashPos] !== "/" || pos <= slashPos) {
        setShowPalette(false); setPaletteQuery(""); setPaletteIdx(0);
      } else {
        setPaletteQuery(query); setPaletteIdx(0);
      }
    }
  }, [block.id, updateContent, mathMode, showPalette, slashPos]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ── 数式モード中 ──
    if (mathMode) {
      // Esc → 現在の入力をLaTeX変換して確定、数式モード終了
      if (e.key === "Escape") {
        e.preventDefault();
        finishMathMode();
        return;
      }
      // Tab → 候補があれば候補から確定、なければリアルタイム変換で確定
      if (e.key === "Tab") {
        e.preventDefault();
        if (mathSuggs.length > 0) {
          acceptSugg(mathSuggs[clampedSuggIdx]);
        } else if (composingText.trim()) {
          // 候補なしでもparseJapanesemathで変換して確定
          const latex = parseJapanesemath(composingText);
          const before = content.text.slice(0, mathAnchor);
          const newText = before + "$" + latex + "$";
          updateContent(block.id, { text: newText });
          const newAnchor = newText.length;
          setMathAnchor(newAnchor);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = newAnchor;
              textareaRef.current.selectionEnd = newAnchor;
              textareaRef.current.focus();
            }
          }, 0);
        }
        return;
      }
      // Enter → 変換確定して数式モード終了
      if (e.key === "Enter") {
        e.preventDefault();
        finishMathMode();
        return;
      }
      // 候補ナビゲーション
      if (mathSuggs.length > 0 && e.key === "ArrowDown") { e.preventDefault(); setMathSuggIdx((i) => Math.min(i + 1, mathSuggs.length - 1)); return; }
      if (mathSuggs.length > 0 && e.key === "ArrowUp")   { e.preventDefault(); setMathSuggIdx((i) => Math.max(i - 1, 0)); return; }
      // その他はそのままtextareaに自然言語入力
      return;
    }

    // ── 通常モード ──
    if (e.key === "Backspace" && content.text === "" && !showPalette) {
      e.preventDefault();
      const blocks = useDocumentStore.getState().document?.blocks ?? [];
      const idx = blocks.findIndex((b) => b.id === block.id);
      useDocumentStore.getState().deleteBlock(block.id);
      const { setEditingBlock: setEdit } = useUIStore.getState();
      if (idx > 0) setEdit(blocks[idx - 1].id);
      return;
    }

    if (e.key === "/" && !showPalette) {
      const el = e.currentTarget;
      setSlashPos(el.selectionStart || 0);
      setTimeout(() => { setShowPalette(true); setPaletteIdx(0); setPaletteQuery(""); }, 0);
    }
    if (showPalette && filteredPalette.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx((i) => Math.min(i + 1, filteredPalette.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setPaletteIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter")     { e.preventDefault(); const item = filteredPalette[paletteIdx]; if (item) handleSelectPaletteItem(item.type); return; }
      if (e.key === "Escape")    { e.preventDefault(); setShowPalette(false); setPaletteQuery(""); return; }
    }

    // Tab → 数式モードに入る
    if (e.key === "Tab" && !showPalette) {
      e.preventDefault();
      enterMathMode(e.currentTarget.selectionStart ?? content.text.length);
      return;
    }

    // ブロック間移動
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
    if (e.key === "Enter" && !e.shiftKey && !showPalette) {
      e.preventDefault();
      const newId = addBlock("paragraph", idx + 1);
      if (newId) { sel(newId); setEdit(newId); }
      return;
    }
  }, [mathMode, mathSuggs, clampedSuggIdx, acceptSugg, finishMathMode, composingText, mathAnchor, showPalette, filteredPalette, paletteIdx, handleSelectPaletteItem, block.id, addBlock, content.text, enterMathMode, updateContent]);

  const baseStyle: React.CSSProperties = {
    fontSize: block.style.fontSize ? `${block.style.fontSize}pt` : undefined,
    fontFamily: block.style.fontFamily === "serif" ? '"Hiragino Mincho ProN", serif' : '"Hiragino Sans", sans-serif',
    textAlign: block.style.textAlign || "left",
    fontWeight: block.style.bold ? "bold" : undefined,
    fontStyle: block.style.italic ? "italic" : undefined,
    color: block.style.textColor || undefined,
  };

  // ── 紙面の表示内容を組み立て ──
  // 数式モード中: 確定済み部分(レンダリング済み) + 未確定の自然言語 + リアルタイム変換プレビュー
  // 通常モード: 全テキスト(レンダリング済み)
  const confirmedText = mathMode ? content.text.slice(0, mathAnchor) : content.text;

  return (
    <div className="relative">
      {showTextarea ? (
        <>
          {/* ── 紙面表示（常にレンダリング済み） ── */}
          <div
            className="px-0 py-0.5 text-[14px] leading-[1.8] min-h-[1.75em] cursor-text"
            style={baseStyle}
            onClick={() => textareaRef.current?.focus()}
          >
            {/* 確定済み部分 */}
            {confirmedText ? (
              <RenderedInlineText text={confirmedText} style={baseStyle} />
            ) : !mathMode ? (
              <span className="text-muted-foreground/20 select-none">{t("block.ph.paragraph")}</span>
            ) : null}

            {/* 数式モード: 未確定テキスト（入力中の自然言語）+ リアルタイム変換プレビュー */}
            {mathMode && (
              <>
                {composingText ? (
                  <>
                    <span className="text-violet-500/70 text-[12px] border-b border-dashed border-violet-400/40 mx-0.5">{composingText}</span>
                    {composingLatex && (
                      <span className="inline-block mx-1 align-middle">
                        <span className="inline-block px-1 py-0.5 rounded bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200/30 dark:border-violet-700/30">
                          <MathRenderer latex={composingLatex} displayMode={false} />
                        </span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-violet-400/40 text-[12px] mx-0.5">数式を入力...</span>
                )}
              </>
            )}
          </div>

          {/* ── textarea（数式モード中は入力用、通常時もテキスト入力用） ── */}
          <textarea
            ref={textareaRef}
            value={content.text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={mathMode ? "" : t("block.ph.paragraph")}
            className={`w-full resize-none overflow-hidden border-none outline-none focus:ring-0 px-0 py-0.5 ${
              mathMode
                ? "bg-transparent text-[13px] leading-[1.6] text-violet-600 dark:text-violet-400 caret-violet-500"
                : "bg-transparent text-[14px] leading-[1.8] text-transparent caret-foreground placeholder:text-muted-foreground/25"
            }`}
            style={mathMode ? {} : baseStyle}
            rows={1}
          />

          {/* ── 数式候補リスト ── */}
          {mathMode && mathSuggs.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-popover border border-violet-200/40 dark:border-violet-800/40 rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
              <div className="px-3 py-1 border-b border-border/10 flex items-center justify-between bg-violet-50/40 dark:bg-violet-950/20">
                <div className="flex items-center gap-1.5">
                  <Sigma className="h-3 w-3 text-violet-500" />
                  <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">数式変換</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/50">
                  <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[8px]">Tab</kbd> 確定</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[8px]">Enter</kbd> 確定&終了</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[8px]">Esc</kbd> 終了</span>
                </div>
              </div>
              {mathSuggs.slice(0, 6).map((sugg, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); acceptSugg(sugg); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    i === clampedSuggIdx ? "bg-violet-50/70 dark:bg-violet-950/25" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="min-w-[56px] flex justify-center">
                    <MathRenderer latex={sugg.latex} displayMode={false} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-medium text-foreground/80 truncate">{sugg.reading}</span>
                    <span className="text-[9px] text-muted-foreground/50">{sugg.category}</span>
                  </div>
                  {i === clampedSuggIdx && (
                    <span className="ml-auto text-[9px] font-mono text-violet-400/70">Tab</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── スラッシュコマンドパレット ── */}
          {!mathMode && showPalette && filteredPalette.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-xl shadow-xl max-h-52 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b">{t("cmd.palette.hint")}</div>
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
                  {item.type === "math" && (
                    <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[8px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300">モード</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── 非編集時: レンダリング表示のみ ── */
        <div className="px-0 py-0.5 text-[14px] leading-[1.8] min-h-[1.75em] cursor-text" style={baseStyle}>
          <RenderedInlineText text={content.text} style={baseStyle} />
        </div>
      )}
    </div>
  );
}

function MathBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId, setMathEditing } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "math" }>;
  const isEditing = editingBlockId === block.id;
  const mathInputRef = useRef<JapaneseMathInputHandle>(null);

  // 数式ブロック編集中は数式モード
  useEffect(() => {
    setMathEditing(isEditing);
    return () => { if (isEditing) setMathEditing(false); };
  }, [isEditing, setMathEditing]);

  const handleApply = useCallback((latex: string, sourceText: string) => {
    updateContent(block.id, { latex, sourceText });
  }, [block.id, updateContent]);

  return (
    <div className="space-y-0">
      {/* 数式レンダリング（既存ドキュメント後方互換） */}
      {content.latex ? (
        <div className="latex-display-math">
          <MathRenderer latex={content.latex} displayMode={content.displayMode} />
        </div>
      ) : !isEditing ? (
        <div className="py-2 text-center text-muted-foreground/30 text-xs select-none">
          クリックして数式を入力
        </div>
      ) : null}

      {/* 編集中: 最小限の入力欄のみ */}
      {isEditing && (
        <div className={`border rounded-lg p-2 bg-background/80 ${content.latex ? "border-t-0 rounded-t-none" : ""}`} onClick={(e) => e.stopPropagation()}>
          <JapaneseMathInput
            ref={mathInputRef}
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

    // 数式: paragraph を作って $$ を挿入（インライン数式モード）
    if (type === "math") {
      const blocks = useDocumentStore.getState().document?.blocks ?? [];
      const afterIdx = selectedBlockId
        ? blocks.findIndex((b) => b.id === selectedBlockId) + 1
        : blocks.length;
      const newId = addBlock("paragraph", afterIdx);
      if (newId) {
        useDocumentStore.getState().updateBlockContent(newId, { text: "$$" });
        selectBlock(newId);
        setEditingBlock(newId);
        useUIStore.getState().setMathEditing(true);
      }
      return;
    }

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
export function DocumentEditor({ editMode = false }: { editMode?: boolean }) {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const { addBlock: addNewBlock } = useDocumentStore();
  const { selectBlock, setEditingBlock } = useUIStore();
  const zoom = useUIStore((s) => s.zoom);
  const paperSize = useUIStore((s) => s.paperSize);

  const handleAddBlockAtEnd = () => {
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const id = addNewBlock("paragraph", blocks.length);
    if (id) { selectBlock(id); setEditingBlock(id); }
  };

  if (!document) return null;

  const paper = PAPER_SIZES[paperSize] ?? PAPER_SIZES.a4;

  return (
    <EditModeContext.Provider value={editMode}>
    <>
    <GlobalCommandPalette />
    {/* Canvas */}
    <div
      className="flex-1 overflow-auto bg-[#e8e8e8] dark:bg-[#1e1e1e]"
      onClick={() => selectBlock(null)}
    >
      <div className="py-10 flex flex-col items-center min-h-full">

        {/* Paper size label */}
        <div className="mb-2 text-[10px] font-mono text-[#aaa] dark:text-[#555] select-none self-start" style={{ marginLeft: `calc(50% - ${paper.w / 2}px)` }}>
          {paper.label}
        </div>

        {/* Paper card */}
        <div
          className={`latex-paper bg-white dark:bg-[#fafafa] flex-shrink-0 relative shadow-[0_4px_24px_rgba(0,0,0,0.18)] ${editMode ? "cursor-text" : ""}`}
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
          {/* Empty state */}
          {document.blocks.length === 0 && (
            editMode ? (
              <div
                className="flex flex-col items-start gap-2 py-6 cursor-text"
                onClick={handleAddBlockAtEnd}
              >
                <p className="text-[11px] font-mono text-gray-300 select-none">{t("editor.empty.comment")}</p>
                <p className="text-[14px] text-gray-300/60 select-none">{t("editor.editmode.hint")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 py-6 select-none pointer-events-none">
                <p className="text-[11px] font-mono text-gray-300">{t("editor.empty.comment")}</p>
                <h2 className="text-2xl font-light text-gray-300 tracking-tight">{t("editor.empty.h2")}</h2>
              </div>
            )
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

        <div className="h-16" />
      </div>
    </div>
    </>
    </EditModeContext.Provider>
  );
}
