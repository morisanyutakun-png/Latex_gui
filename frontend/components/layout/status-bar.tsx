"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { ZoomIn, ZoomOut } from "lucide-react";

const BLOCK_TYPE_LABELS: Record<string, { ja: string; en: string }> = {
  paragraph: { ja: "テキスト", en: "Text" },
  heading:   { ja: "見出し",   en: "Heading" },
  math:      { ja: "数式",     en: "Math" },
  list:      { ja: "リスト",   en: "List" },
  table:     { ja: "表",       en: "Table" },
  image:     { ja: "画像",     en: "Image" },
  divider:   { ja: "区切り線", en: "Divider" },
  code:      { ja: "コード",   en: "Code" },
  quote:     { ja: "引用",     en: "Quote" },
  circuit:   { ja: "回路図",   en: "Circuit" },
  diagram:   { ja: "図",       en: "Diagram" },
  chemistry: { ja: "化学式",   en: "Chemistry" },
  chart:     { ja: "グラフ",   en: "Chart" },
};

export function StatusBar() {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const blockCount = useDocumentStore((s) => s.document?.blocks.length ?? 0);
  const selectedId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  const { zoom, setZoom } = useUIStore();

  const selectedBlock = selectedId && blocks ? blocks.find((b) => b.id === selectedId) : null;
  const selectedIdx = selectedId && blocks ? blocks.findIndex((b) => b.id === selectedId) : -1;

  const typeLabel = selectedBlock
    ? (BLOCK_TYPE_LABELS[selectedBlock.content.type]?.[isJa ? "ja" : "en"] ?? selectedBlock.content.type)
    : null;

  return (
    <div className="flex items-center justify-between h-5 px-3 shrink-0 select-none bg-primary text-primary-foreground/70">
      {/* Left */}
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span className="text-primary-foreground/50">
          {blockCount} {isJa ? "要素" : "elements"}
        </span>
        {selectedBlock && selectedIdx >= 0 && typeLabel && (
          <span className="text-primary-foreground/40">
            {selectedIdx + 1}行目 · {typeLabel}
          </span>
        )}
      </div>

      {/* Right — zoom */}
      <div className="flex items-center gap-1 text-[10px] font-mono text-primary-foreground/50">
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          className="hover:text-primary-foreground transition-colors px-0.5"
          title={isJa ? "縮小" : "Zoom out"}
        >
          <ZoomOut className="h-2.5 w-2.5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-8 text-center hover:text-primary-foreground transition-colors tabular-nums"
          title={isJa ? "100%にリセット" : "Reset zoom"}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          className="hover:text-primary-foreground transition-colors px-0.5"
          title={isJa ? "拡大" : "Zoom in"}
        >
          <ZoomIn className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
