"use client";

/**
 * FigureEditor — Full-screen figure/diagram editor mode.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │ Header bar (title, TikZ toggle, Insert, Close)       │
 *   ├──────┬──────────────────────────────────┬─────────────┤
 *   │ Tool │          SVG Canvas              │ Properties  │
 *   │ bar  │   (grid, shapes, handles)        │  panel      │
 *   │ 240px│                                  │  200px      │
 *   ├──────┴──────────────────────────────────┴─────────────┤
 *   │ TikZ code panel (collapsible)                         │
 *   └────────────────────────────────────────────────────────┘
 */

import React, { useCallback, useMemo, useState } from "react";
import { useFigureStore } from "./figure-store";
import { FigureCanvas } from "./figure-canvas";
import { FigureToolbar } from "./figure-toolbar";
import { FigureProperties } from "./figure-properties";
import { generateTikZ, generateFullLatex } from "./tikz-generator";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import {
  X, Code2, ChevronDown, ChevronUp, ClipboardCopy, Check,
  ImagePlus, RotateCcw, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import { toast } from "sonner";

// ── Locale helper ───────────────────────────────────────────────

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

export function FigureEditor() {
  const isJa = useIsJa();

  const shapes = useFigureStore((s) => s.shapes);
  const connections = useFigureStore((s) => s.connections);
  const viewport = useFigureStore((s) => s.viewport);
  const setViewport = useFigureStore((s) => s.setViewport);
  const resetViewport = useFigureStore((s) => s.resetViewport);
  const resetAll = useFigureStore((s) => s.reset);
  const closeFigureEditor = useUIStore((s) => s.closeFigureEditor);

  const setLatex = useDocumentStore((s) => s.setLatex);
  const doc = useDocumentStore((s) => s.document);

  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── TikZ code generation ──────────────────────────────────────

  const tikzCode = useMemo(
    () => generateTikZ(shapes, connections),
    [shapes, connections]
  );

  const fullCode = useMemo(
    () => generateFullLatex(shapes, connections),
    [shapes, connections]
  );

  // ── Actions ───────────────────────────────────────────────────

  const handleInsert = useCallback(() => {
    if (!doc || shapes.length === 0) return;

    const code = `\n${fullCode}\n`;
    const currentLatex = doc.latex;

    // Find a good insertion point (before \end{document} if present)
    const endDocIdx = currentLatex.lastIndexOf("\\end{document}");
    let newLatex: string;
    if (endDocIdx >= 0) {
      newLatex = currentLatex.slice(0, endDocIdx) + code + "\n" + currentLatex.slice(endDocIdx);
    } else {
      newLatex = currentLatex + code;
    }

    setLatex(newLatex);
    toast.success(isJa ? "図を挿入しました" : "Figure inserted into document");
    closeFigureEditor();
    resetAll();
  }, [doc, shapes, fullCode, setLatex, closeFigureEditor, resetAll, isJa]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(isJa ? "TikZコードをコピーしました" : "TikZ code copied");
    });
  }, [fullCode, isJa]);

  const handleClose = useCallback(() => {
    if (shapes.length > 0 && !confirm(isJa ? "編集中の図を破棄しますか？" : "Discard current figure?")) return;
    closeFigureEditor();
    resetAll();
  }, [shapes.length, closeFigureEditor, resetAll, isJa]);

  const handleZoomIn = useCallback(() => {
    setViewport({ zoom: Math.min(5, viewport.zoom * 1.2) });
  }, [viewport.zoom, setViewport]);

  const handleZoomOut = useCallback(() => {
    setViewport({ zoom: Math.max(0.2, viewport.zoom / 1.2) });
  }, [viewport.zoom, setViewport]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f5f4f0] dark:bg-[#111110] animate-page-fade-in">

      {/* ══════════ HEADER ══════════ */}
      <header className="shrink-0 h-12 flex items-center px-3 gap-3 border-b border-foreground/[0.06] bg-background/90 backdrop-blur-md">

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
            <ImagePlus className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-foreground/80">
            {isJa ? "図エディタ" : "Figure Editor"}
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-foreground/[0.05] text-[10px] font-semibold text-foreground/40">
            {shapes.length} {isJa ? "個のオブジェクト" : shapes.length === 1 ? "object" : "objects"}
          </span>
        </div>

        {/* Center — zoom controls */}
        <div className="flex-1 flex items-center justify-center gap-1">
          <button onClick={handleZoomOut} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] transition-colors" title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className="text-[11px] font-mono text-foreground/40 w-12 text-center">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button onClick={handleZoomIn} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] transition-colors" title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button onClick={resetViewport} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] transition-colors" title={isJa ? "リセット" : "Reset view"}>
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          {/* Toggle TikZ code */}
          <button
            onClick={() => setShowCode(!showCode)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold transition-all ${
              showCode
                ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"
                : "text-foreground/50 hover:bg-foreground/[0.05] hover:text-foreground/70"
            }`}
          >
            <Code2 size={14} />
            <span>TikZ</span>
            {showCode ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {/* Copy TikZ */}
          <button
            onClick={handleCopy}
            disabled={shapes.length === 0}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold text-foreground/50 hover:bg-foreground/[0.05] hover:text-foreground/70 transition-all disabled:opacity-30"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <ClipboardCopy size={14} />}
            <span>{copied ? (isJa ? "コピー済" : "Copied") : (isJa ? "コピー" : "Copy")}</span>
          </button>

          {/* Insert button */}
          <button
            onClick={handleInsert}
            disabled={shapes.length === 0}
            className="flex items-center gap-2 h-8 px-5 rounded-full text-[12px] font-bold bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ImagePlus size={14} />
            <span>{isJa ? "文書に挿入" : "Insert into Document"}</span>
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
            title={isJa ? "閉じる" : "Close"}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ══════════ MAIN AREA ══════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left — toolbar */}
        <FigureToolbar />

        {/* Center — canvas */}
        <FigureCanvas />

        {/* Right — properties */}
        <FigureProperties />
      </div>

      {/* ══════════ TIKZ CODE PANEL ══════════ */}
      {showCode && (
        <div className="shrink-0 border-t border-foreground/[0.06] bg-background/90 backdrop-blur-md">
          <div className="h-[200px] overflow-auto p-3">
            <pre className="text-[11px] font-mono text-foreground/70 leading-relaxed whitespace-pre-wrap select-all">
              {fullCode || (isJa ? "% 図形を追加してください" : "% Add shapes to generate TikZ code")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
