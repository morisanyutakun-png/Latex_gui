"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES, createBlock, DESIGN_PRESETS, DesignPreset } from "@/lib/types";
import { MathRenderer } from "./math-editor";
import { JapaneseMathInput, type JapaneseMathInputHandle } from "./math-japanese-input";
import { CircuitBlockEditor, DiagramBlockEditor, ChemistryBlockEditor, ChartBlockEditor, BlockEditorToolbar } from "./engineering-editors";
import { parseInlineText, parseJapanesemath, highlightMathTokens, type MathTokenKind } from "@/lib/math-japanese";
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
  FileCode,
  Loader2,
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

// ブロック間移動時のフォーカス位置ヒント
// setEditingBlock 呼び出し直前にセットし、auto-focus effect で消費する
let _nextFocusHint: "start" | "end" = "end";

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
  latex: FileCode,
};


// ──── Block Insert Line — hover で現れるブロック挿入ボタン ────
function BlockInsertLine({ index }: { index: number }) {
  const addBlock = useDocumentStore((s) => s.addBlock);
  const setEditingBlock = useUIStore((s) => s.setEditingBlock);
  const setGlobalPalette = useUIStore((s) => s.setGlobalPalette);
  const selectBlock = useUIStore((s) => s.selectBlock);

  const handleAddParagraph = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = addBlock("paragraph", index);
    if (newId) {
      selectBlock(newId);
      setEditingBlock(newId);
    }
  };

  const handleOpenPalette = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 挿入位置のブロックを選択してからパレットを開く
    const blocks = useDocumentStore.getState().document?.blocks;
    if (blocks && index > 0 && blocks[index - 1]) {
      selectBlock(blocks[index - 1].id);
    }
    setGlobalPalette(true);
  };

  return (
    <div className="group/insert relative h-0 hover:h-2 -my-px flex items-center justify-center z-10 transition-[height] duration-100">
      {/* Hover line */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-primary/0 group-hover/insert:bg-primary/20 transition-colors" />
      {/* Buttons */}
      <div className="opacity-0 group-hover/insert:opacity-100 transition-opacity flex items-center gap-1 bg-background rounded-full shadow-sm border px-1 py-0.5">
        <button
          onClick={handleAddParagraph}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="段落を追加"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="5" y1="2" x2="5" y2="8"/><line x1="2" y1="5" x2="8" y2="5"/></svg>
          テキスト
        </button>
        <div className="w-px h-3 bg-border/50" />
        <button
          onClick={handleOpenPalette}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="ブロックを挿入 (⌘K)"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="5" y1="2" x2="5" y2="8"/><line x1="2" y1="5" x2="8" y2="5"/></svg>
          その他
        </button>
      </div>
    </div>
  );
}

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
              const t = block.content.type;
              const guideMap: Record<string, string> = { heading: "heading", list: "list", table: "table", code: "code", math: "math" };
              setActiveGuideContext((guideMap[t] || "general") as import("@/store/ui-store").GuideContext);
            }
            else selectBlock(block.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // ダブルクリックで常に編集モードに入る
            setEditingBlock(block.id);
            const t = block.content.type;
            const guideMap: Record<string, string> = { heading: "heading", list: "list", table: "table", code: "code", math: "math" };
            setActiveGuideContext((guideMap[t] || "general") as import("@/store/ui-store").GuideContext);
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
          <span className="ml-auto text-[10px] text-muted-foreground/50">Ctrl/⌘D</span>
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
    if (isEditing) {
      const tryFocus = () => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const pos = _nextFocusHint === "start" ? 0 : textareaRef.current.value.length;
          textareaRef.current.selectionStart = pos;
          textareaRef.current.selectionEnd = pos;
          _nextFocusHint = "end";
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(tryFocus));
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    const el = e.currentTarget;
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);

    if (e.key === "Backspace" && content.text === "") {
      e.preventDefault();
      deleteBlock(block.id);
      if (idx > 0) { _nextFocusHint = "end"; selectBlock(blocks[idx - 1].id); setEditingBlock(blocks[idx - 1].id); }
      return;
    }

    if (e.key === "ArrowUp" && el.selectionStart === 0) {
      e.preventDefault();
      if (idx > 0) { _nextFocusHint = "end"; selectBlock(blocks[idx - 1].id); setEditingBlock(blocks[idx - 1].id); }
      return;
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length) {
      e.preventDefault();
      if (idx < blocks.length - 1) { _nextFocusHint = "start"; selectBlock(blocks[idx + 1].id); setEditingBlock(blocks[idx + 1].id); }
      return;
    }
    if (e.key === "ArrowLeft" && el.selectionStart === 0) {
      e.preventDefault();
      if (idx > 0) { _nextFocusHint = "end"; selectBlock(blocks[idx - 1].id); setEditingBlock(blocks[idx - 1].id); }
      return;
    }
    if (e.key === "ArrowRight" && el.selectionStart === el.value.length) {
      e.preventDefault();
      if (idx < blocks.length - 1) { _nextFocusHint = "start"; selectBlock(blocks[idx + 1].id); setEditingBlock(blocks[idx + 1].id); }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      // Tab inserts inline math delimiters $...$ in the heading text
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
          fontFamily: block.style.fontFamily === "serif" ? '"Hiragino Mincho ProN", serif' : undefined,
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
  const { t, locale } = useI18n();
  const isJa = locale !== "en";
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
  const [mathMode, setMathMode] = useState(false);
  const [mathAnchor, setMathAnchor] = useState(0);
  // IME変換中フラグ（日本語入力中の誤変換防止）
  const [imeComposing, setImeComposing] = useState(false);
  // IME確定直後フラグ — Enter での改行を防止するためのガード
  const imeJustFinishedRef = useRef(false);
  // 数式モード中のカーソル位置（content.text 上の絶対位置）
  const [mathCursorPos, setMathCursorPos] = useState(0);

  // 未確定テキスト（mathAnchor以降）
  const composingText = mathMode ? content.text.slice(mathAnchor) : "";
  // リアルタイム変換結果（IME変換中はパースをスキップ）
  const composingLatex = composingText && !imeComposing ? parseJapanesemath(composingText) : "";
  // Command palette state (triggered by ;; double semicolon)
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [paletteAnchor, setPaletteAnchor] = useState<number>(0);

  const filteredPalette = paletteQuery
    ? PALETTE_ITEMS.filter((b) =>
        b.name.includes(paletteQuery) || b.type.includes(paletteQuery) || b.description.includes(paletteQuery)
      )
    : PALETTE_ITEMS;

  // ── 数式モードに入る ──
  const enterMathMode = useCallback((anchor: number) => {
    setMathMode(true);
    setMathAnchor(anchor);
    setMathEditing(true);
    setMathCursorPos(anchor);
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
    setMathEditing(false);
  }, [content.text, mathAnchor, block.id, updateContent, setMathEditing]);

  const handleSelectPaletteItem = useCallback((type: BlockType) => {
    setShowPalette(false);
    setPaletteQuery("");
    if (type === "paragraph") return;

    // ;; は既に除去済み。パレット表示中に追加入力されたクエリ部分のみ除去。
    const before = content.text.slice(0, paletteAnchor);
    const after = content.text.slice(paletteAnchor + paletteQuery.length);
    const cleanText = before + after;

    if (type === "math") {
      updateContent(block.id, { text: cleanText });
      setTimeout(() => enterMathMode(before.length), 0);
      return;
    }

    const blocks = document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);
    if (cleanText === "") {
      convertBlock(block.id, createBlock(type).content);
      setTimeout(() => setEditingBlock(block.id), 50);
    } else {
      updateContent(block.id, { text: cleanText });
      const newId = addBlock(type, idx + 1);
      setTimeout(() => setEditingBlock(newId), 50);
    }
  }, [block.id, content.text, paletteAnchor, paletteQuery, document, addBlock, convertBlock, setEditingBlock, updateContent, enterMathMode]);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [content.text]);

  // Auto-focus — isEditing変更時にtextareaにフォーカスを当てる
  useEffect(() => {
    if (isEditing) {
      const tryFocus = () => {
        if (textareaRef.current && window.document.activeElement !== textareaRef.current) {
          textareaRef.current.focus();
          const pos = _nextFocusHint === "start" ? 0 : textareaRef.current.value.length;
          textareaRef.current.selectionStart = pos;
          textareaRef.current.selectionEnd = pos;
          _nextFocusHint = "end";
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(tryFocus));
    }
    if (!isEditing && mathMode) { finishMathMode(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Auto-resize — 通常モードtextareaの高さ自動調整
  useEffect(() => {
    if (textareaRef.current && isEditing && !mathMode) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [content.text, isEditing, mathMode]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const pos = e.target.selectionStart || 0;
    updateContent(block.id, { text });

    // 数式モード中はカーソル位置を更新して終了
    if (mathMode) {
      setMathCursorPos(pos);
      return;
    }

    // ;; 検出 → コマンドパレットを開く（;; はテキストから除去）
    if (!showPalette && pos >= 2 && text.slice(pos - 2, pos) === ";;") {
      const cleanText = text.slice(0, pos - 2) + text.slice(pos);
      const anchor = pos - 2;
      updateContent(block.id, { text: cleanText });
      setPaletteAnchor(anchor);
      setTimeout(() => {
        setShowPalette(true);
        setPaletteIdx(0);
        setPaletteQuery("");
        // カーソルを ;; 除去後の位置に戻す
        if (textareaRef.current) {
          textareaRef.current.selectionStart = anchor;
          textareaRef.current.selectionEnd = anchor;
        }
      }, 0);
      return;
    }

    // パレット表示中: クエリ更新
    if (showPalette) {
      const query = text.slice(paletteAnchor, pos);
      if (pos < paletteAnchor) {
        setShowPalette(false); setPaletteQuery(""); setPaletteIdx(0);
      } else {
        setPaletteQuery(query); setPaletteIdx(0);
      }
    }
  }, [block.id, updateContent, mathMode, showPalette, paletteAnchor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ── IME変換中はキー処理をスキップ（日本語入力の干渉防止） ──
    if (e.nativeEvent.isComposing || e.key === "Process") return;

    // ── 数式モード中 ──
    if (mathMode) {
      // Esc → 未確定テキストを破棄して数式モード終了
      if (e.key === "Escape") {
        e.preventDefault();
        const before = content.text.slice(0, mathAnchor);
        updateContent(block.id, { text: before });
        setMathMode(false);
        setMathEditing(false);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = before.length;
            textareaRef.current.selectionEnd = before.length;
            textareaRef.current.focus();
          }
        }, 0);
        return;
      }
      // Tab → 変換確定して数式モード終了
      if (e.key === "Tab") {
        e.preventDefault();
        finishMathMode();
        return;
      }
      // Enter, 矢印キー → 通常の日本語入力と同じ動作（何も奪わない）
      // その他のキーもそのままtextareaに自然言語入力
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

    // ;; トリガーは handleChange で処理済み。ここではパレットのキーボード操作のみ。
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
      if (idx > 0) { _nextFocusHint = "end"; sel(blocks[idx - 1].id); setEdit(blocks[idx - 1].id); }
      return;
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length && !showPalette) {
      e.preventDefault();
      if (idx < blocks.length - 1) { _nextFocusHint = "start"; sel(blocks[idx + 1].id); setEdit(blocks[idx + 1].id); }
      return;
    }
    if (e.key === "ArrowLeft" && el.selectionStart === 0 && el.selectionEnd === 0 && !mathMode && !showPalette) {
      e.preventDefault();
      if (idx > 0) { _nextFocusHint = "end"; sel(blocks[idx - 1].id); setEdit(blocks[idx - 1].id); }
      return;
    }
    if (e.key === "ArrowRight" && el.selectionStart === el.value.length && el.selectionEnd === el.value.length && !mathMode && !showPalette) {
      e.preventDefault();
      if (idx < blocks.length - 1) { _nextFocusHint = "start"; sel(blocks[idx + 1].id); setEdit(blocks[idx + 1].id); }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !showPalette) {
      // IME確定直後のEnterは改行として扱わない（日本語入力の確定Enterと区別）
      if (imeJustFinishedRef.current) {
        imeJustFinishedRef.current = false;
        return;
      }
      e.preventDefault();
      const newId = addBlock("paragraph", idx + 1);
      if (newId) { sel(newId); setEdit(newId); }
      return;
    }
  }, [mathMode, finishMathMode, mathAnchor, showPalette, filteredPalette, paletteIdx, handleSelectPaletteItem, block.id, addBlock, content.text, enterMathMode, updateContent, setMathEditing]);

  // fontSize を 8〜24pt にクランプして異常な大きさを防止
  const clampedFontSize = block.style.fontSize
    ? Math.max(8, Math.min(24, block.style.fontSize))
    : undefined;
  const baseStyle: React.CSSProperties = {
    fontSize: clampedFontSize ? `${clampedFontSize}pt` : undefined,
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

  // フォーカス状態を追跡 — 実際にtextareaにフォーカスがある時のみカーソル表示
  const [hasFocus, setHasFocus] = useState(false);
  const showCursor = showTextarea && isEditing && hasFocus;

  // IDE風トークンハイライトの色マップ
  const TOKEN_COLORS: Record<MathTokenKind, string> = {
    variable:  "text-cyan-500 dark:text-cyan-400",           // 変数 → シアン
    number:    "text-orange-500 dark:text-orange-400",        // 数字 → オレンジ
    operator:  "text-pink-500 dark:text-pink-400",            // 演算子 → ピンク
    unary:     "text-emerald-500 dark:text-emerald-400",      // 単項 → グリーン
    ternary:   "text-purple-500 dark:text-purple-400",        // 三項 → パープル
    greek:     "text-teal-500 dark:text-teal-400",            // ギリシャ → ティール
    structure: "text-yellow-600 dark:text-yellow-400",        // 構造語 → イエロー
    text:      "text-foreground/70",                          // その他 → デフォルト
  };

  // 数式モード中のカーソル位置（composingText 内のオフセット）
  const localCursorOffset = mathMode ? Math.max(0, Math.min(mathCursorPos - mathAnchor, composingText.length)) : composingText.length;
  // カーソル前後でテキストを分割してそれぞれハイライト
  const beforeCursor = mathMode && composingText ? composingText.slice(0, localCursorOffset) : "";
  const afterCursor  = mathMode && composingText ? composingText.slice(localCursorOffset) : "";
  const tokensBeforeCursor = mathMode && beforeCursor && !imeComposing ? highlightMathTokens(beforeCursor) : [];
  const tokensAfterCursor  = mathMode && afterCursor  && !imeComposing ? highlightMathTokens(afterCursor)  : [];

  // 通常編集モード（数式モードでない）では直接textareaを表示してネイティブ編集
  const showDirectTextarea = showTextarea && isEditing && !mathMode;

  return (
    <div className="relative">
      {/* ── 通常編集モード: 直接 textarea を表示（選択・カーソル操作がネイティブに動く） ── */}
      {showDirectTextarea ? (
        /* 数式の有無に関わらず常に可視 textarea — クリックでカーソル位置が決まり、選択や細部編集が可能。
           編集中は raw な $...$ を表示し、編集終了後に KaTeX でレンダリングされる */
        <textarea
          ref={textareaRef}
          value={content.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { setImeComposing(true); imeJustFinishedRef.current = false; }}
          onCompositionEnd={() => { setImeComposing(false); imeJustFinishedRef.current = true; setTimeout(() => { imeJustFinishedRef.current = false; }, 300); }}
          onFocus={() => setHasFocus(true)}
          onBlur={() => setHasFocus(false)}
          placeholder={isJa ? "テキストを入力... (Tab で数式モード)" : "Type text... (Tab for math)"}
          className="w-full resize-none overflow-hidden bg-transparent border-none outline-none focus:ring-0 focus-visible:outline-none p-0 py-0.5 text-[14px] leading-[1.8] min-h-[1.75em]"
          style={baseStyle}
          rows={1}
        />
      ) : (
      /* ── 表示モード / 数式モード: レンダリング済み表示 ── */
      <div
        className={`px-0 py-0.5 text-[14px] leading-[1.8] min-h-[1.75em] cursor-text`}
        style={baseStyle}
        onClick={() => {
          if (!showTextarea) {
            setEditingBlock(block.id);
          }
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
      >
        {/* 確定済みテキスト（数式はKaTeX描画） */}
        {confirmedText ? (
          <RenderedInlineText text={confirmedText} style={baseStyle} />
        ) : !mathMode && !isEditing ? (
          <span className="text-muted-foreground/20 select-none">—</span>
        ) : null}

        {/* 数式モード 上段: LaTeXレンダリング結果 */}
        {mathMode && composingLatex && !imeComposing && (
          <span className="inline-block mx-0.5 align-middle">
            <MathRenderer latex={composingLatex} displayMode={false} />
          </span>
        )}
        {mathMode && imeComposing && composingText && (
          <span className="text-violet-500/60">{composingText}</span>
        )}
        {mathMode && composingText && !imeComposing && !composingLatex && (
          <span className="text-violet-500/60">{composingText}</span>
        )}

        {/* 擬似カーソル（数式モード時のみ） */}
        {showCursor && mathMode && (
          <span className="inline-block w-[2px] h-[1.1em] align-middle animate-[cursor-blink_1s_step-end_infinite] bg-violet-500" />
        )}
      </div>
      )}

      {/* ── 数式モード 下段: 自然言語入力 (IDE風シンタックスハイライト) ── */}
      {mathMode && (
        <div className="relative mt-0.5 rounded-lg border border-violet-300/30 dark:border-violet-700/30 bg-gray-950/[0.03] dark:bg-gray-950/40 overflow-hidden">
          {/* ヘッダー: モード表示 + キーバインド */}
          <div className="flex items-center justify-between px-2.5 py-1 border-b border-violet-200/20 dark:border-violet-800/20 bg-violet-50/30 dark:bg-violet-950/20">
            <div className="flex items-center gap-1.5">
              <Sigma className="h-3 w-3 text-violet-500" />
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                {isJa ? "数式モード" : "Math mode"}
              </span>
              <span className="hidden sm:inline text-[9px] text-muted-foreground/30 ml-2">
                {isJa ? "例: a たす b、ルート x、x^2+1" : "e.g. a plus b, sqrt x, x^2+1"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/40">
              <span><kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/30 text-[8px]">Tab</kbd> {isJa ? "終了" : "exit"}</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/30 text-[8px]">Esc</kbd> {isJa ? "破棄" : "cancel"}</span>
            </div>
          </div>

          {/* IDE風コード行: シンタックスハイライト表示（カーソル位置連動） */}
          <div className="px-3 py-2 font-mono text-[13px] leading-relaxed min-h-[2em] flex items-center flex-wrap gap-0">
            {/* 行番号風 */}
            <span className="text-[10px] text-muted-foreground/20 mr-2 select-none font-mono">1</span>
            {imeComposing ? (
              /* IME変換中はそのまま表示 */
              <span className="text-foreground/50">{composingText}</span>
            ) : composingText ? (
              /* カーソル前のトークン */
              <>
                {tokensBeforeCursor.map((tok, i) => (
                  <span key={`b${i}`} className={`${TOKEN_COLORS[tok.kind]} ${tok.kind !== "text" ? "font-medium" : ""}`}>
                    {tok.text}
                  </span>
                ))}
                {/* カーソル（位置連動） */}
                <span className="inline-block w-[1.5px] h-[1.1em] bg-violet-500 animate-[cursor-blink_1s_step-end_infinite] mx-px align-middle" />
                {/* カーソル後のトークン */}
                {tokensAfterCursor.map((tok, i) => (
                  <span key={`a${i}`} className={`${TOKEN_COLORS[tok.kind]} ${tok.kind !== "text" ? "font-medium" : ""}`}>
                    {tok.text}
                  </span>
                ))}
              </>
            ) : (
              /* 未入力: カーソルのみ（プレースホルダーは非表示） */
              <span className="inline-block w-[1.5px] h-[1.1em] bg-violet-500 animate-[cursor-blink_1s_step-end_infinite] align-middle" />
            )}
          </div>
        </div>
      )}

      {/* ── textarea（数式モード時のみ隠蔽 — キー入力のみ受け取る） ── */}
      {showTextarea && mathMode && (
        <textarea
          ref={textareaRef}
          value={content.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={() => { if (textareaRef.current) setMathCursorPos(textareaRef.current.selectionStart); }}
          onSelect={() => { if (textareaRef.current) setMathCursorPos(textareaRef.current.selectionStart); }}
          onCompositionStart={() => { setImeComposing(true); imeJustFinishedRef.current = false; }}
          onCompositionEnd={() => {
            setImeComposing(false);
            imeJustFinishedRef.current = true;
            setTimeout(() => { imeJustFinishedRef.current = false; }, 300);
            if (textareaRef.current) setMathCursorPos(textareaRef.current.selectionStart);
          }}
          onFocus={() => setHasFocus(true)}
          onBlur={() => setHasFocus(false)}
          className="sr-only"
          rows={1}
        />
      )}

      {/* ── コマンドパレット (;; トリガー) ── */}
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
                <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[8px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300">{isJa ? "モード" : "mode"}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MathBlockEditor({ block }: { block: Block }) {
  const { locale } = useI18n();
  const isJa = locale === "ja";
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId, setMathEditing, selectBlock, setEditingBlock } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "math" }>;
  const isEditing = editingBlockId === block.id;
  const mathInputRef = useRef<JapaneseMathInputHandle>(null);

  // 数式ブロック編集中は数式モード
  useEffect(() => {
    setMathEditing(isEditing);
    return () => { if (isEditing) setMathEditing(false); };
  }, [isEditing, setMathEditing]);

  // 矢印キーなどで isEditing になった時に自動フォーカス
  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => mathInputRef.current?.focus());
    }
  }, [isEditing]);

  const handleApply = useCallback((latex: string, sourceText: string) => {
    updateContent(block.id, { latex, sourceText });
  }, [block.id, updateContent]);

  const handleNavigateOut = useCallback((dir: "prev" | "next") => {
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const idx = blocks.findIndex((b) => b.id === block.id);
    if (dir === "prev" && idx > 0) {
      _nextFocusHint = "end";
      selectBlock(blocks[idx - 1].id);
      setEditingBlock(blocks[idx - 1].id);
    } else if (dir === "next" && idx < blocks.length - 1) {
      _nextFocusHint = "start";
      selectBlock(blocks[idx + 1].id);
      setEditingBlock(blocks[idx + 1].id);
    }
  }, [block.id, selectBlock, setEditingBlock]);

  return (
    <div className="space-y-0">
      {/* 数式レンダリング（既存ドキュメント後方互換） */}
      {content.latex ? (
        <div className="latex-display-math">
          <MathRenderer latex={content.latex} displayMode={content.displayMode} />
        </div>
      ) : !isEditing ? (
        <div className="py-2 text-center text-muted-foreground/30 text-xs select-none">
          {isJa ? "クリックして数式を入力" : "Click to enter math"}
        </div>
      ) : null}

      {/* 編集中: 最小限の入力欄のみ */}
      {isEditing && (
        <div className={`border rounded-lg p-2 bg-background/80 ${content.latex ? "border-t-0 rounded-t-none" : ""}`} onClick={(e) => e.stopPropagation()}>
          <JapaneseMathInput
            ref={mathInputRef}
            onApply={handleApply}
            initialSourceText={content.sourceText || ""}
            onNavigateOut={handleNavigateOut}
          />
        </div>
      )}
    </div>
  );
}

function ListItemEditor({ item, index, blockId, content }: {
  item: string; index: number; blockId: string;
  content: Extract<Block["content"], { type: "list" }>;
}) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMath = item.includes("$");

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="flex items-start gap-2 group">
      <span className="text-sm mt-0.5 w-5 text-right shrink-0 select-none text-foreground/70">
        {content.style === "numbered" ? `${index + 1}.` : "•"}
      </span>
      {!editing && hasMath ? (
        <div
          className="flex-1 text-sm py-0.5 cursor-text min-h-[1.5em]"
          onClick={() => setEditing(true)}
        >
          <RenderedInlineText text={item} />
        </div>
      ) : (
        <input
          ref={inputRef}
          value={item}
          onChange={(e) => {
            const newItems = [...content.items];
            newItems[index] = e.target.value;
            updateContent(blockId, { items: newItems });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const newItems = [...content.items];
              newItems.splice(index + 1, 0, "");
              updateContent(blockId, { items: newItems });
            }
            if (e.key === "Backspace" && !item && content.items.length > 1) {
              e.preventDefault();
              const newItems = content.items.filter((_, j) => j !== index);
              updateContent(blockId, { items: newItems });
            }
          }}
          onBlur={() => { if (hasMath) setEditing(false); }}
          placeholder={`項目 ${index + 1}`}
          className="flex-1 bg-transparent border-none outline-none text-sm py-0.5 focus:ring-0"
        />
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
        <ListItemEditor
          key={i}
          item={item}
          index={i}
          blockId={block.id}
          content={content}
        />
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

/**
 * LaTeX ブロックから編集可能なテキストセグメントを抽出する。
 * LaTeX コマンド/環境はそのまま保持し、テキスト部分だけを編集可能にする。
 */
function _extractLatexSegments(code: string): { type: "text" | "command"; value: string; start: number; end: number }[] {
  const segments: { type: "text" | "command"; value: string; start: number; end: number }[] = [];
  // テキストとコマンドを交互に分割
  const regex = /(\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^}]*\})*|\\[^a-zA-Z]|\{|\}|%[^\n]*|\$[^$]+\$|\\\[[\s\S]*?\\\])/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      const text = code.slice(lastIndex, match.index);
      if (text.trim()) {
        segments.push({ type: "text", value: text, start: lastIndex, end: match.index });
      }
    }
    segments.push({ type: "command", value: match[0], start: match.index, end: regex.lastIndex });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < code.length) {
    const remaining = code.slice(lastIndex);
    if (remaining.trim()) {
      segments.push({ type: "text", value: remaining, start: lastIndex, end: code.length });
    }
  }
  return segments;
}

/**
 * LaTeX コードから人間が読めるテキストを抽出する（プレーンテキスト変換）。
 */
function _latexToPlainText(code: string): string {
  let text = code;
  // 環境の開始・終了タグを除去
  text = text.replace(/\\begin\{[^}]+\}(\[[^\]]*\])?/g, "");
  text = text.replace(/\\end\{[^}]+\}/g, "");
  // よく使うコマンドからテキストを抽出
  text = text.replace(/\\textbf\{([^}]*)\}/g, "$1");
  text = text.replace(/\\textit\{([^}]*)\}/g, "$1");
  text = text.replace(/\\underline\{([^}]*)\}/g, "$1");
  text = text.replace(/\\textcolor(?:\[[^\]]*\])?\{[^}]*\}\{([^}]*)\}/g, "$1");
  text = text.replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "");
  text = text.replace(/\\(?:bfseries|itshape|sffamily|ttfamily|rmfamily|gtfamily)\b/g, "");
  text = text.replace(/\\(?:color|textcolor)\{[^}]*\}/g, "");
  text = text.replace(/\\(?:vspace|hspace)\{[^}]*\}/g, " ");
  text = text.replace(/\\(?:noindent|centering|raggedright|raggedleft)\b/g, "");
  text = text.replace(/\\(?:hrule|rule)\{[^}]*\}\{[^}]*\}/g, "");
  text = text.replace(/\\rule\{[^}]*\}/g, "");
  text = text.replace(/\\item\b/g, "• ");
  text = text.replace(/\\\\(\s*)/g, "\n");
  text = text.replace(/\\columnbreak/g, "");
  // 残りのコマンドを除去
  text = text.replace(/\\[a-zA-Z]+\*/g, "");
  text = text.replace(/\\[a-zA-Z]+/g, "");
  // 残りの括弧を除去
  text = text.replace(/[{}]/g, "");
  // 連続空白を整理
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function LaTeXBlockEditor({ block }: { block: Block }) {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const setEditingBlock = useUIStore((s) => s.setEditingBlock);
  const content = block.content as Extract<Block["content"], { type: "latex" }>;
  const editMode = React.useContext(EditModeContext);

  return (
    <div className="rounded-md overflow-hidden">
      {/* Preview only — full editor lives in LeftReviewPanel */}
      <div
        className="cursor-pointer group relative"
        onClick={() => {
          if (editMode) setEditingBlock(block.id);
        }}
      >
        <LaTeXPreview code={content.code} caption={content.caption} />
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingBlock(block.id); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-colors"
          >
            <Type className="h-3 w-3" />
            {isJa ? "編集" : "Edit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LaTeXBlockControls({ block }: { block: Block }) {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const deleteBlock = useDocumentStore((s) => s.deleteBlock);
  const content = block.content as Extract<Block["content"], { type: "latex" }>;

  // 2モード: visual (プレーンテキスト) / code (生LaTeX). デフォルトはvisual。
  const [mode, setMode] = React.useState<"visual" | "code">("visual");

  const plainText = React.useMemo(() => _latexToPlainText(content.code), [content.code]);

  const handleVisualChange = React.useCallback((newText: string) => {
    const segments = _extractLatexSegments(content.code);
    const textSegments = segments.filter(s => s.type === "text");

    if (textSegments.length === 0) {
      updateContent(block.id, { code: newText });
      return;
    }

    let newCode = content.code;
    const oldPlain = _latexToPlainText(content.code);
    if (oldPlain !== newText) {
      const newLines = newText.split("\n");
      if (!newText.trim()) {
        updateContent(block.id, { code: "" });
        return;
      }
      let textIdx = 0;
      for (const seg of textSegments) {
        const segText = seg.value.trim();
        if (segText && textIdx < newLines.length) {
          const replacement = newLines.find(l => l.trim().includes(segText.slice(0, 10))) || seg.value;
          if (replacement !== seg.value) {
            newCode = newCode.slice(0, seg.start) + replacement + newCode.slice(seg.end);
          }
          textIdx++;
        }
      }
      if (newCode !== content.code) {
        updateContent(block.id, { code: newCode });
      }
    }
  }, [content.code, block.id, updateContent]);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [content.code, plainText, mode]);

  React.useEffect(() => {
    if (textareaRef.current) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [mode]);

  return (
    <div className="rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-fuchsia-100/50 dark:bg-fuchsia-900/20 border border-fuchsia-300/30 dark:border-fuchsia-700/30 border-b-0 rounded-t-md">
        <div className="flex items-center gap-1.5">
          <FileCode className="h-3 w-3 text-fuchsia-500/70" />
          <span className="text-[10px] font-mono font-semibold text-fuchsia-600/70 dark:text-fuchsia-400/60 uppercase tracking-wider">LaTeX</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("visual")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              mode === "visual"
                ? "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 font-medium"
                : "text-fuchsia-500/50 hover:text-fuchsia-500 hover:bg-fuchsia-500/10"
            }`}
          >
            {isJa ? "テキスト編集" : "Visual"}
          </button>
          <button
            onClick={() => setMode("code")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              mode === "code"
                ? "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 font-medium"
                : "text-fuchsia-500/50 hover:text-fuchsia-500 hover:bg-fuchsia-500/10"
            }`}
          >
            {isJa ? "LaTeXコード" : "Code"}
          </button>
          <div className="w-px h-3 bg-fuchsia-300/30 mx-1" />
          <button
            onClick={() => { deleteBlock(block.id); }}
            className="text-[10px] px-1.5 py-0.5 rounded text-red-400/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title={isJa ? "このブロックを削除" : "Delete block"}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <div className="border border-fuchsia-300/30 dark:border-fuchsia-700/30 border-t-0">
          <textarea
            ref={textareaRef}
            value={plainText}
            onChange={(e) => handleVisualChange(e.target.value)}
            placeholder={isJa ? "テキストを編集..." : "Edit text..."}
            className="w-full bg-white/50 dark:bg-zinc-950/30 border-none outline-none resize-none min-h-[60px] px-3 py-2 text-sm leading-[1.8] focus:ring-0 focus-visible:outline-none"
            rows={1}
          />
        </div>
      ) : (
        <div className="border border-fuchsia-300/30 dark:border-fuchsia-700/30 bg-fuchsia-50/20 dark:bg-fuchsia-950/10 border-t-0">
          <textarea
            ref={textareaRef}
            value={content.code}
            onChange={(e) => updateContent(block.id, { code: e.target.value })}
            placeholder="\\begin{tcolorbox}&#10;  LaTeXコードを直接入力...&#10;\\end{tcolorbox}"
            className="w-full bg-transparent text-xs font-mono border-none outline-none resize-none min-h-[80px] px-3 py-2 text-fuchsia-900 dark:text-fuchsia-100 placeholder:text-fuchsia-300/40 focus:ring-0 focus-visible:outline-none"
            style={{ lineHeight: '1.6' }}
            rows={6}
          />
        </div>
      )}

      <div className="px-2 pt-2">
        <BlockEditorToolbar blockId={block.id} accentClass="bg-fuchsia-600" />
      </div>
    </div>
  );
}

function LaTeXPreview({ code, caption }: { code: string; caption?: string }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastKeyRef = React.useRef("");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 文書全体の advanced プリアンブルを取得 — latex ブロックの単体プレビューも
  // 文書全体コンパイルと同じ環境で動かすために必須。
  // (これがないと、AI が update_advanced で追加した \newcommand を使うブロックが
  //  必ず "Unknown compilation error" になる)
  const advanced = useDocumentStore((s) => s.document?.advanced);
  const customPreamble = advanced?.enabled ? advanced.customPreamble || "" : "";
  const customCommands = advanced?.enabled ? advanced.customCommands || [] : [];

  const fetchPreview = React.useCallback(async (c: string) => {
    if (!c.trim()) { setSvg(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { previewBlockSVG } = await import("@/lib/api");
      const result = await previewBlockSVG(
        c,
        "latex",
        caption || "",
        customPreamble,
        customCommands,
      );
      setSvg(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "プレビュー取得に失敗");
      setSvg(null);
    } finally {
      setLoading(false);
    }
  }, [caption, customPreamble, customCommands]);

  React.useEffect(() => {
    // プリアンブル/マクロが変わった場合も再フェッチする
    const key = code + "\u0000" + customPreamble + "\u0000" + customCommands.join("\u0001");
    if (key === lastKeyRef.current) return;
    const isInitial = lastKeyRef.current === "";
    lastKeyRef.current = key;
    if (timerRef.current) clearTimeout(timerRef.current);
    // 初回マウント時は即座にプレビュー取得、以降は1秒デバウンス
    const delay = isInitial ? 100 : 1000;
    timerRef.current = setTimeout(() => fetchPreview(code), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [code, customPreamble, customCommands, fetchPreview]);

  if (!code.trim()) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground/30 text-xs border border-dashed border-fuchsia-300/20 dark:border-fuchsia-700/20 rounded-md">
        <FileCode className="h-4 w-4 mr-2" />
        LaTeXコードが入力されるとプレビューが表示されます
      </div>
    );
  }

  return (
    <div className="relative bg-white dark:bg-zinc-950 rounded-md border border-border/30 overflow-hidden min-h-[64px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-fuchsia-500" />
        </div>
      )}
      {svg ? (
        // SVG は自然サイズで中央配置。max-width は 100% で抑えるが、強制ストレッチ
        // (h-auto) はしない — 中身が小さい場合に縦に間延びしないようにする。
        <div
          className="flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:max-h-[480px] [&>svg]:h-auto [&>svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : error ? (
        <div className="py-3 px-3 flex items-start gap-2 bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-amber-400">
          <FileCode className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug break-words">{error}</p>
            <button
              onClick={() => fetchPreview(code)}
              className="text-[11px] font-medium text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
            >
              再試行
            </button>
          </div>
        </div>
      ) : !loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground/30">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : null}
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
    case "latex":     return <LaTeXBlockEditor block={block} />;
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
// ブロックカテゴリ定義
const PALETTE_CATEGORIES = [
  {
    label: "基本",
    color: "text-slate-500",
    types: ["heading", "paragraph", "divider"],
  },
  {
    label: "コンテンツ",
    color: "text-blue-500",
    types: ["list", "table", "quote", "code", "image"],
  },
  {
    label: "数式・理系",
    color: "text-violet-500",
    types: ["math", "chemistry"],
  },
  {
    label: "図形・グラフ",
    color: "text-indigo-500",
    types: ["circuit", "diagram", "chart"],
  },
];

/**
 * Render-only command palette body. Renders inside the LeftReviewPanel.
 * The fullscreen modal version is no longer used — palette content lives in the left sidebar.
 */
export function CommandPaletteContent() {
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
    // 数式: paragraph を作って数式モードに入る
    if (type === "math") {
      const blocks = useDocumentStore.getState().document?.blocks ?? [];
      const afterIdx = selectedBlockId
        ? blocks.findIndex((b) => b.id === selectedBlockId) + 1
        : blocks.length;
      const newId = addBlock("paragraph", afterIdx);
      setGlobalPalette(false);
      if (newId) {
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
    setGlobalPalette(false);
    if (newId) { selectBlock(newId); setEditingBlock(newId); }
  };

  // カテゴリ表示 or フラット検索
  const showCategories = !query;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Search header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b-[3px] border-foreground/15 bg-muted/30 shrink-0">
        <Search className="h-[18px] w-[18px] text-muted-foreground/60 shrink-0" />
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
          placeholder="ブロックを検索…　リスト、数式、表、コード…"
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/40 font-medium"
        />
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border/40 text-muted-foreground/60 shrink-0">Esc</kbd>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
          {showCategories ? (
            /* カテゴリ別グリッド表示 */
            <div className="p-3 space-y-4">
              {PALETTE_CATEGORIES.map((cat) => {
                const items = cat.types.map((t) => BLOCK_TYPES.find((b) => b.type === t)!).filter(Boolean);
                const globalIdx = BLOCK_TYPES.findIndex; // unused
                return (
                  <div key={cat.label}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${cat.color}`}>{cat.label}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {items.map((info) => {
                        const Icon = BLOCK_ICONS[info.type];
                        const flatIdx = filtered.findIndex((b) => b.type === info.type);
                        const isSelected = flatIdx === idx;
                        return (
                          <button
                            key={info.type}
                            onClick={() => handleSelect(info.type)}
                            onMouseEnter={() => setIdx(flatIdx)}
                            className={`flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "border-primary/30 bg-primary/8 shadow-sm"
                                : "border-border/20 hover:border-border/40 hover:bg-muted/40"
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-primary/15" : "bg-muted/60"
                            }`}>
                              <Icon className={`h-3.5 w-3.5 ${info.color}`} />
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold text-foreground/80 leading-none">{info.name}</p>
                              <p className="text-[9px] text-muted-foreground/50 mt-0.5 leading-tight">{info.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 検索結果フラットリスト */
            <div className="py-1.5">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground/40 py-8">「{query}」に一致するブロックはありません</p>
              ) : filtered.map((info, i) => {
                const Icon = BLOCK_ICONS[info.type];
                return (
                  <button
                    key={info.type}
                    onClick={() => handleSelect(info.type)}
                    onMouseEnter={() => setIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === idx ? "bg-primary/8" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      i === idx ? "bg-primary/15" : "bg-muted/60"
                    }`}>
                      <Icon className={`h-4 w-4 ${info.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold leading-none ${i === idx ? "text-primary" : "text-foreground/80"}`}>{info.name}</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">{info.description}</p>
                    </div>
                    {i === idx && (
                      <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono shrink-0">↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t-[3px] border-foreground/15 bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground/50 font-mono shrink-0">
        <span><kbd className="px-1 rounded bg-muted border border-border/30">↑↓</kbd> 移動</span>
        <span><kbd className="px-1 rounded bg-muted border border-border/30">↵</kbd> 挿入</span>
        <span><kbd className="px-1 rounded bg-muted border border-border/30">Esc</kbd> 閉じる</span>
        <span className="ml-auto opacity-60">;; でもインラインで開けます</span>
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
  const zoomFitMode = useUIStore((s) => s.zoomFitMode);
  const paperSize = useUIStore((s) => s.paperSize);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fit-to-width: auto-calculate zoom so the paper width fits the canvas (scroll vertically)
  useEffect(() => {
    if (!zoomFitMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paper = PAPER_SIZES[paperSize] ?? PAPER_SIZES.a4;
    const horizontalPadding = 160;

    const calculateFitZoom = () => {
      const rect = canvas.getBoundingClientRect();
      const availableWidth = rect.width - horizontalPadding;
      if (availableWidth <= 0) return;

      const fitZoom = availableWidth / paper.w;
      // Word-like: never upscale beyond 100%, only shrink when canvas is narrow
      const clamped = Math.max(0.3, Math.min(1.0, Math.round(fitZoom * 100) / 100));

      const currentZoom = useUIStore.getState().zoom;
      if (Math.abs(clamped - currentZoom) > 0.005) {
        useUIStore.setState({ zoom: clamped });
      }
    };

    calculateFitZoom();

    const observer = new ResizeObserver(calculateFitZoom);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [zoomFitMode, paperSize]);

  const handleAddBlockAtEnd = () => {
    const blocks = useDocumentStore.getState().document?.blocks ?? [];
    const id = addNewBlock("paragraph", blocks.length);
    if (id) { selectBlock(id); setEditingBlock(id); }
  };

  if (!document) return null;

  const paper = PAPER_SIZES[paperSize] ?? PAPER_SIZES.a4;
  const design = document.settings.paperDesign;
  // プリセットが指定されていればプリセットのカラーを優先
  const activePreset = (() => {
    const presetId = design?.designPreset;
    if (!presetId || presetId === "none") return null;
    return DESIGN_PRESETS.find((p) => p.id === presetId) ?? null;
  })();
  const paperBg = activePreset?.colors.background ?? design?.paperColor ?? "#ffffff";
  const accentColor = activePreset?.colors.primary ?? design?.accentColor ?? "#4f46e5";
  const secondaryColor = activePreset?.colors.secondary ?? accentColor;

  // テーマベースの背景パターン
  const themeBackground = (() => {
    const theme = design?.theme || "plain";
    switch (theme) {
      case "grid":
        return `linear-gradient(${accentColor}08 1px, transparent 1px), linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)`;
      case "lined":
        return `repeating-linear-gradient(transparent, transparent 27px, ${accentColor}12 27px, ${accentColor}12 28px)`;
      case "dot-grid":
        return `radial-gradient(circle, ${accentColor}15 0.8px, transparent 0.8px)`;
      default:
        return undefined;
    }
  })();
  const themeBgSize = (() => {
    const theme = design?.theme || "plain";
    if (theme === "grid") return "28px 28px";
    if (theme === "dot-grid") return "20px 20px";
    return undefined;
  })();

  return (
    <EditModeContext.Provider value={editMode}>
    <>
    {/* Canvas */}
    <div
      ref={canvasRef}
      className="flex-1 overflow-auto editor-canvas"
      onClick={() => selectBlock(null)}
    >
      <div className="flex flex-col items-center py-8">

        {/* Paper size label */}
        <div className="mb-3 editor-paper-label self-start" style={{ marginLeft: `calc(50% - ${paper.w / 2}px)` }}>
          {paper.label}
        </div>

        {/* Paper card */}
        <div
          className={`latex-paper editor-paper flex-shrink-0 relative ${editMode ? "cursor-text" : ""}`}
          style={{
            width: paper.w,
            minHeight: Math.round(paper.w * 1.4142),
            padding: "64px 72px 80px",
            zoom: zoom,
            fontSize: "14px",
            color: activePreset?.colors.text ?? "#1a1a1a",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif',
            backgroundColor: paperBg,
            backgroundImage: themeBackground,
            backgroundSize: themeBgSize,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Preset decorations: gradient header stripe */}
          {activePreset && activePreset.style.gradientHeader && (
            <div className="absolute top-0 left-0 right-0 h-[5px]" style={{
              background: `linear-gradient(to right, ${accentColor}, ${secondaryColor})`,
              opacity: 0.9,
            }} />
          )}
          {/* Preset decorations: side stripe */}
          {activePreset && activePreset.style.sideStripe && (
            <div className="absolute top-0 left-0 bottom-0" style={{ width: "5px" }}>
              <div className="absolute inset-0" style={{ width: "3.5px", backgroundColor: accentColor, opacity: 0.7 }} />
              <div className="absolute top-0 bottom-0 right-0" style={{ width: "1.5px", backgroundColor: secondaryColor, opacity: 0.3 }} />
            </div>
          )}
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
              {editMode && <BlockInsertLine index={0} />}
              {document.blocks.map((block, idx) => (
                <React.Fragment key={block.id}>
                  <BlockWrapper block={block} index={idx}>
                    <BlockEditor block={block} />
                  </BlockWrapper>
                  {editMode && <BlockInsertLine index={idx + 1} />}
                </React.Fragment>
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
