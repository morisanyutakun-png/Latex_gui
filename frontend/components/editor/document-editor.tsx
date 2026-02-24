"use client";

import React, { useRef, useEffect, useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Block, BlockType, BLOCK_TYPES } from "@/lib/types";
import { MathRenderer } from "./math-editor";
import { SmartMathInput } from "./smart-math-input";
import { CircuitBlockEditor, DiagramBlockEditor, ChemistryBlockEditor, ChartBlockEditor } from "./engineering-editors";
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
      <DropdownMenuContent align="center" className="w-56 p-1.5 rounded-xl shadow-xl border-border/50">
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
  const sizes: Record<number, string> = { 1: "text-2xl", 2: "text-xl", 3: "text-lg" };

  return (
    <div>
      <AutoTextarea
        value={content.text}
        onChange={(text) => updateContent(block.id, { text })}
        placeholder={`見出し ${content.level}`}
        className={`${sizes[content.level]} font-bold leading-snug`}
        style={{
          fontFamily: block.style.fontFamily === "serif" ? '"Hiragino Mincho ProN", serif' : '"Hiragino Sans", sans-serif',
          textAlign: block.style.textAlign || "left",
          color: block.style.textColor || undefined,
        }}
      />
    </div>
  );
}

function ParagraphBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "paragraph" }>;

  return (
    <AutoTextarea
      value={content.text}
      onChange={(text) => updateContent(block.id, { text })}
      placeholder="テキストを入力..."
      className="text-sm leading-relaxed"
      style={{
        fontSize: block.style.fontSize ? `${block.style.fontSize}pt` : undefined,
        fontFamily: block.style.fontFamily === "serif" ? '"Hiragino Mincho ProN", serif' : '"Hiragino Sans", sans-serif',
        textAlign: block.style.textAlign || "left",
        fontWeight: block.style.bold ? "bold" : undefined,
        fontStyle: block.style.italic ? "italic" : undefined,
        color: block.style.textColor || undefined,
      }}
    />
  );
}

function MathBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "math" }>;
  const isEditing = editingBlockId === block.id;

  const handleSubmit = (latex: string) => {
    updateContent(block.id, { latex });
  };

  return (
    <div className="space-y-2">
      {/* Always show preview */}
      <div
        className={`flex justify-center py-3 px-4 rounded-lg transition-all cursor-pointer ${
          content.latex
            ? "hover:bg-violet-50/30 dark:hover:bg-violet-950/10"
            : "bg-muted/20"
        }`}
      >
        {content.latex ? (
          <MathRenderer latex={content.latex} displayMode={content.displayMode} />
        ) : (
          <span className="text-muted-foreground/30 text-sm italic flex items-center gap-2">
            <Sigma className="h-4 w-4" />
            ダブルクリックで数式入力
          </span>
        )}
      </div>

      {/* Editor panel */}
      {isEditing && (
        <div className="border rounded-xl p-3 bg-background shadow-sm" onClick={(e) => e.stopPropagation()}>
          <SmartMathInput
            onSubmit={handleSubmit}
            initialLatex={content.latex}
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
    <div className="space-y-0.5 pl-1">
      {content.items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-muted-foreground text-sm mt-0.5 w-5 text-right shrink-0 select-none">
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
            style={{
              fontFamily: block.style.fontFamily === "serif" ? '"Hiragino Mincho ProN", serif' : '"Hiragino Sans", sans-serif',
              color: block.style.textColor || undefined,
            }}
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
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {content.headers.map((h, i) => (
                <th key={i} className="border-b border-r border-border/40 last:border-r-0">
                  <input
                    value={h}
                    onChange={(e) => {
                      const newH = [...content.headers];
                      newH[i] = e.target.value;
                      updateContent(block.id, { headers: newH });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-transparent border-none outline-none"
                    placeholder={`列${i + 1}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/20">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-r border-border/30 last:border-r-0 last:border-b-0">
                    <input
                      value={cell}
                      onChange={(e) => {
                        const newRows = content.rows.map((r, i) =>
                          i === ri ? r.map((c, j) => (j === ci ? e.target.value : c)) : [...r],
                        );
                        updateContent(block.id, { rows: newRows });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-transparent border-none outline-none"
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
  return <hr className="my-2 border-border/60" />;
}

function CodeBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "code" }>;

  return (
    <div className="rounded-lg bg-slate-900 dark:bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50">
        <input
          value={content.language}
          onChange={(e) => updateContent(block.id, { language: e.target.value })}
          placeholder="言語"
          className="bg-transparent text-[10px] text-slate-400 border-none outline-none w-24"
        />
      </div>
      <textarea
        value={content.code}
        onChange={(e) => updateContent(block.id, { code: e.target.value })}
        placeholder="コードを入力..."
        className="w-full px-3 py-2 bg-transparent text-sm font-mono text-slate-200 border-none outline-none resize-y min-h-[60px]"
        rows={3}
      />
    </div>
  );
}

function QuoteBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const content = block.content as Extract<Block["content"], { type: "quote" }>;

  return (
    <div className="border-l-4 border-amber-400 pl-4 py-1 bg-amber-50/30 dark:bg-amber-950/10 rounded-r-lg">
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
            {document.blocks.map((block, index) => (
              <React.Fragment key={block.id}>
                <BlockWrapper block={block}>
                  <BlockEditor block={block} />
                </BlockWrapper>
              </React.Fragment>
            ))}

            {/* Empty state */}
            {document.blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-4xl">📝</div>
                <p className="text-muted-foreground/40 text-sm">ブロックを追加して始めましょう</p>
                <InsertMenu index={0} variant="button" />
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
