"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { ZoomIn, ZoomOut, Maximize, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

export function StatusBar() {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const blockCount = useDocumentStore((s) => s.document?.blocks.length ?? 0);
  const selectedId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  const { zoom, setZoom, zoomFitMode, setZoomFitMode, paperSize, setPaperSize } = useUIStore();

  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const paperMenuRef = useRef<HTMLDivElement>(null);

  const selectedBlock = selectedId && blocks ? blocks.find((b) => b.id === selectedId) : null;
  const selectedIdx = selectedId && blocks ? blocks.findIndex((b) => b.id === selectedId) : -1;

  const typeLabel = selectedBlock
    ? (BLOCK_TYPE_LABELS[selectedBlock.content.type]?.[isJa ? "ja" : "en"] ?? selectedBlock.content.type)
    : null;

  // Close menus on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) setShowZoomMenu(false);
      if (paperMenuRef.current && !paperMenuRef.current.contains(e.target as Node)) setShowPaperMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentPaperLabel = PAPER_OPTIONS.find((p) => p.value === paperSize)?.label ?? "A4";
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="status-bar-accent editor-statusbar flex items-center justify-between h-[22px] px-2 shrink-0 select-none text-foreground/50">
      {/* Left — block info (VSCode-style) */}
      <div className="flex items-center gap-0 text-[11px] font-mono">
        <span className="px-1.5 h-full flex items-center text-primary-foreground/90 bg-primary/80 text-[10px] font-semibold tracking-wide">
          {blockCount} {isJa ? "要素" : "el"}
        </span>
        {selectedBlock && selectedIdx >= 0 && typeLabel && (
          <>
            <span className="breadcrumb-sep">/</span>
            <span className="px-1.5 text-foreground/40 hover:text-foreground/60 transition-colors cursor-default">
              Ln {selectedIdx + 1}
            </span>
            <span className="breadcrumb-sep">·</span>
            <span className="px-1.5 text-foreground/40 hover:text-foreground/60 transition-colors cursor-default">
              {typeLabel}
            </span>
          </>
        )}
      </div>

      {/* Right — paper size + zoom controls */}
      <div className="flex items-center gap-1">
        {/* Paper size selector */}
        <div className="relative" ref={paperMenuRef}>
          <button
            onClick={() => { setShowPaperMenu(!showPaperMenu); setShowZoomMenu(false); }}
            className="flex items-center gap-1 px-2 h-5 rounded text-[11px] font-mono text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors"
          >
            {currentPaperLabel}
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {showPaperMenu && (
            <div className="absolute bottom-full right-0 mb-1 py-1 rounded-lg border border-border/40 bg-popover shadow-lg shadow-black/20 min-w-[100px] animate-scale-in z-50">
              {PAPER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setPaperSize(opt.value); setShowPaperMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                    paperSize === opt.value
                      ? "text-primary bg-primary/10 font-semibold"
                      : "text-foreground/60 hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-3.5 bg-foreground/[0.08] mx-0.5" />

        {/* Fit to page toggle */}
        <button
          onClick={() => setZoomFitMode(!zoomFitMode)}
          className={`flex items-center gap-1 px-1.5 h-5 rounded text-[11px] font-mono transition-colors ${
            zoomFitMode
              ? "text-primary bg-primary/10"
              : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06]"
          }`}
          title={isJa ? "ページ全体を表示" : "Fit to page"}
        >
          <Maximize className="h-3 w-3" />
          <span className="hidden sm:inline">{isJa ? "全体" : "Fit"}</span>
        </button>

        <div className="w-px h-3.5 bg-foreground/[0.08] mx-0.5" />

        {/* Zoom controls */}
        <button
          onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
          className="h-5 w-5 flex items-center justify-center rounded text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors"
          title={isJa ? "縮小" : "Zoom out"}
        >
          <ZoomOut className="h-3 w-3" />
        </button>

        {/* Zoom percentage with dropdown */}
        <div className="relative" ref={zoomMenuRef}>
          <button
            onClick={() => { setShowZoomMenu(!showZoomMenu); setShowPaperMenu(false); }}
            className="flex items-center gap-0.5 px-1.5 h-5 rounded text-[11px] font-mono text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors tabular-nums min-w-[42px] justify-center"
          >
            {zoomPercent}%
            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
          </button>
          {showZoomMenu && (
            <div className="absolute bottom-full right-0 mb-1 py-1 rounded-lg border border-border/40 bg-popover shadow-lg shadow-black/20 min-w-[100px] animate-scale-in z-50">
              {/* Fit option */}
              <button
                onClick={() => { setZoomFitMode(true); setShowZoomMenu(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors flex items-center gap-2 ${
                  zoomFitMode
                    ? "text-primary bg-primary/10 font-semibold"
                    : "text-foreground/60 hover:bg-accent"
                }`}
              >
                <Maximize className="h-3 w-3" />
                {isJa ? "全体表示" : "Fit page"}
              </button>
              <div className="h-px bg-border/30 my-1" />
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setZoom(preset / 100); setShowZoomMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                    !zoomFitMode && zoomPercent === preset
                      ? "text-primary bg-primary/10 font-semibold"
                      : "text-foreground/60 hover:bg-accent"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          className="h-5 w-5 flex items-center justify-center rounded text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors"
          title={isJa ? "拡大" : "Zoom in"}
        >
          <ZoomIn className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
