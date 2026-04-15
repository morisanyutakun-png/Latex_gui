"use client";

/**
 * FigureEditor — Full-screen figure/diagram editor mode (v2).
 *
 * Changes from v1:
 *   - No zoom controls in header (canvas handles Ctrl+scroll & discrete steps)
 *   - Insert size selector: choose output scale when inserting into document
 *   - Keyboard shortcut hints
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
  ImagePlus, Keyboard, FileDown, Loader2, Layers, Command,
} from "lucide-react";
import { toast } from "sonner";
import { compileRawLatex, CompileError, formatCompileError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LayersPanel } from "./layers-panel";
import { CommandPalette } from "./command-palette";
import { HelpTip } from "./help-tip";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

// ── Insert size presets ─────────────────────────────────────────

interface SizePreset {
  label: string;
  labelJa: string;
  scale: string; // TikZ scale value or "none"
  description: string;
  descriptionJa: string;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: "Small",    labelJa: "小",  scale: "0.6",  description: "~5cm wide", descriptionJa: "約5cm幅" },
  { label: "Medium",   labelJa: "中",  scale: "0.8",  description: "~7cm wide", descriptionJa: "約7cm幅" },
  { label: "Original", labelJa: "原寸", scale: "none", description: "As drawn",  descriptionJa: "描画そのまま" },
  { label: "Large",    labelJa: "大",  scale: "1.2",  description: "~12cm wide", descriptionJa: "約12cm幅" },
  { label: "Full",     labelJa: "全幅", scale: "1.5",  description: "Full width", descriptionJa: "ページ全幅" },
];

export function FigureEditor() {
  const isJa = useIsJa();

  const shapes = useFigureStore((s) => s.shapes);
  const connections = useFigureStore((s) => s.connections);
  const resetAll = useFigureStore((s) => s.reset);
  const closeFigureEditor = useUIStore((s) => s.closeFigureEditor);

  const setLatex = useDocumentStore((s) => s.setLatex);
  const doc = useDocumentStore((s) => s.document);

  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedSize, setSelectedSize] = useState(2); // "Original" index
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const { t } = useI18n();

  // ── Cmd+K opens command palette ─────────────────────────────────

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── TikZ code ─────────────────────────────────────────────────

  const tikzCode = useMemo(
    () => generateTikZ(shapes, connections),
    [shapes, connections]
  );

  const fullCode = useMemo(
    () => generateFullLatex(shapes, connections),
    [shapes, connections]
  );

  // ── Insert with scale ─────────────────────────────────────────

  const scaledCode = useMemo(() => {
    const preset = SIZE_PRESETS[selectedSize];
    if (preset.scale === "none") return fullCode;
    // Wrap tikzpicture with scale option
    return fullCode.replace(
      "\\begin{tikzpicture}",
      `\\begin{tikzpicture}[scale=${preset.scale}, every node/.style={scale=${preset.scale}}]`
    );
  }, [fullCode, selectedSize]);

  const handleInsert = useCallback(() => {
    if (!doc || shapes.length === 0) return;

    const code = `\n\\begin{center}\n${scaledCode}\n\\end{center}\n`;
    const currentLatex = doc.latex;

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
  }, [doc, shapes, scaledCode, setLatex, closeFigureEditor, resetAll, isJa]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(scaledCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(isJa ? "TikZコードをコピーしました" : "TikZ code copied");
    });
  }, [scaledCode, isJa]);

  // ── PDF download (figure alone, standalone document) ─────────

  const handleDownloadPDF = useCallback(async () => {
    if (shapes.length === 0 || downloadingPdf) return;
    setDownloadingPdf(true);

    // Build a standalone document with just the figure, auto-cropped via preview environment
    const standaloneLatex = [
      "\\documentclass[preview, border=6pt, convert={true,outext=.pdf}]{standalone}",
      "\\usepackage{tikz}",
      "\\usepackage{circuitikz}",
      "\\usepackage{pgfplots}",
      "\\pgfplotsset{compat=newest}",
      "\\usetikzlibrary{decorations.pathmorphing}",
      "\\usetikzlibrary{decorations.pathreplacing}",
      "\\usetikzlibrary{arrows.meta}",
      "\\usetikzlibrary{shapes.geometric}",
      "\\usetikzlibrary{shapes.symbols}",
      "\\usetikzlibrary{automata, positioning}",
      "\\usetikzlibrary{calc}",
      "\\usepackage{amsmath, amssymb}",
      "\\begin{document}",
      scaledCode,
      "\\end{document}",
    ].join("\n");

    try {
      const blob = await compileRawLatex(standaloneLatex, "figure");
      const filename = `figure_${Date.now()}.pdf`;

      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as typeof window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: "PDF Document", accept: { "application/pdf": [".pdf"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success(isJa ? "PDFを保存しました" : "PDF saved");
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Fall through to download link fallback
        }
      }

      // Fallback: blob URL download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(isJa ? "PDFをダウンロードしました" : "PDF downloaded");
    } catch (err) {
      if (err instanceof CompileError) {
        const view = formatCompileError(err, t);
        toast.error(view.title, { duration: 10000, description: view.lines.join(" · ") });
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`${isJa ? "PDF生成失敗" : "PDF failed"}: ${msg}`);
      }
    } finally {
      setDownloadingPdf(false);
    }
  }, [shapes, scaledCode, downloadingPdf, isJa, t]);

  const handleClose = useCallback(() => {
    if (shapes.length > 0 && !confirm(isJa ? "編集中の図を破棄しますか？" : "Discard current figure?")) return;
    closeFigureEditor();
    resetAll();
  }, [shapes.length, closeFigureEditor, resetAll, isJa]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col animate-page-fade-in"
      style={{
        // Workspace background: soft neutral tone that clearly separates from both
        // white canvas and the light-grey toolbar/property panels.
        background:
          "radial-gradient(circle at 30% 20%, rgba(99,102,241,0.04), transparent 40%), " +
          "radial-gradient(circle at 80% 90%, rgba(236,72,153,0.03), transparent 50%), " +
          "linear-gradient(180deg, #e5e7ec 0%, #dfe0e6 100%)",
      }}
    >

      {/* ══════════ HEADER ══════════ */}
      <header
        className="shrink-0 h-12 flex items-center px-3 gap-3 relative"
        style={{
          background:
            "linear-gradient(90deg, rgba(59,130,246,0.06) 0%, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0.95) 70%, rgba(245,158,11,0.06) 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Rainbow accent strip at the very top — signals "creative tool" */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-violet-500 via-pink-500 via-amber-500 to-emerald-500 opacity-70" />

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
            <ImagePlus className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-foreground/80">
            {isJa ? "図エディタ" : "Figure Editor"}
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-foreground/[0.05] text-[10px] font-semibold text-foreground/40">
            {shapes.length} {isJa ? "個" : shapes.length === 1 ? "object" : "objects"}
          </span>
        </div>

        {/* Center — insert size selector */}
        <div className="flex-1 flex items-center justify-center gap-1">
          <span className="text-[10px] text-foreground/35 mr-1.5 font-medium">
            {isJa ? "挿入サイズ" : "Insert size"}:
          </span>
          {SIZE_PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => setSelectedSize(i)}
              title={isJa ? preset.descriptionJa : preset.description}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 ${
                selectedSize === i
                  ? "bg-teal-500/15 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/30"
                  : "text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.04]"
              }`}
            >
              {isJa ? preset.labelJa : preset.label}
            </button>
          ))}
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1.5">
          {/* Command palette (Cmd+K) */}
          <HelpTip title={isJa ? "コマンドパレット" : "Command palette"} kbd="⌘K"
            description={isJa ? "あらゆるツール・アクション・図形を検索して実行" : "Search and run any tool, action, or shape"}>
            <button
              onClick={() => setShowPalette(true)}
              className="flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-lg text-foreground/40 hover:text-foreground/65 hover:bg-foreground/[0.04] transition-colors"
            >
              <Command size={12} />
              <kbd className="text-[8.5px] font-mono bg-foreground/[0.06] px-1 py-px rounded">⌘K</kbd>
            </button>
          </HelpTip>

          {/* Layers toggle */}
          <HelpTip title={isJa ? "レイヤーパネル" : "Layers panel"}
            description={isJa ? "全図形の一覧・並び替え・ロック・表示切替" : "List, reorder, lock, and toggle visibility of all shapes"}>
            <button
              onClick={() => setShowLayers(!showLayers)}
              className={`p-1.5 rounded-lg transition-colors ${
                showLayers ? "text-teal-600 bg-teal-50 dark:bg-teal-500/10" : "text-foreground/30 hover:text-foreground/50 hover:bg-foreground/[0.04]"
              }`}
            >
              <Layers size={14} />
            </button>
          </HelpTip>

          {/* Shortcuts help */}
          <HelpTip title={isJa ? "ショートカットヘルプ" : "Keyboard shortcuts"}
            description={isJa ? "全キーボード操作の一覧を表示" : "Show the list of keyboard shortcuts"}>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={`p-1.5 rounded-lg transition-colors ${
              showShortcuts ? "text-teal-600 bg-teal-50 dark:bg-teal-500/10" : "text-foreground/30 hover:text-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            <Keyboard size={14} />
          </button>
          </HelpTip>

          {/* TikZ code toggle */}
          <HelpTip title={isJa ? "TikZコード表示" : "Show TikZ code"}
            description={isJa ? "生成されたTikZソースを下部に表示" : "Reveal the generated TikZ source at the bottom"}>
          <button
            onClick={() => setShowCode(!showCode)}
            className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
              showCode
                ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"
                : "text-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground/60"
            }`}
          >
            <Code2 size={12} />
            <span>TikZ</span>
          </button>
          </HelpTip>

          {/* Copy */}
          <HelpTip title={isJa ? "TikZをコピー" : "Copy TikZ"}
            description={isJa ? "生成コードをクリップボードにコピー" : "Copy the generated code to clipboard"}>
          <button
            onClick={handleCopy}
            disabled={shapes.length === 0}
            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold text-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground/60 transition-all disabled:opacity-30"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <ClipboardCopy size={12} />}
            <span>{copied ? (isJa ? "済" : "Done") : (isJa ? "コピー" : "Copy")}</span>
          </button>
          </HelpTip>

          {/* Download PDF (figure alone) */}
          <HelpTip title={isJa ? "図だけをPDF化" : "Figure → PDF"}
            description={isJa ? "現在の図を standalone PDFとしてダウンロード" : "Export just this figure as a standalone PDF"}>
          <button
            onClick={handleDownloadPDF}
            disabled={shapes.length === 0 || downloadingPdf}
            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold text-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {downloadingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
            <span>{downloadingPdf ? (isJa ? "生成中" : "...") : (isJa ? "PDF" : "PDF")}</span>
          </button>
          </HelpTip>

          <div className="w-px h-5 bg-foreground/[0.08] mx-0.5" />

          {/* Insert */}
          <HelpTip title={isJa ? "LaTeX文書に挿入" : "Insert into LaTeX document"}
            description={isJa ? "選んだサイズで図をエディタに挿入" : "Drop the figure into the editor at the chosen size"}>
          <button
            onClick={handleInsert}
            disabled={shapes.length === 0}
            className="flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-bold bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ImagePlus size={13} />
            <span>{isJa ? "挿入" : "Insert"}</span>
          </button>
          </HelpTip>

          {/* Close */}
          <HelpTip title={isJa ? "図エディタを閉じる" : "Close figure editor"}
            description={isJa ? "確認して戻る (編集中は警告)" : "Returns to the main editor (prompts if unsaved)"}>
          <button
            onClick={handleClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.04] transition-colors"
          >
            <X size={16} />
          </button>
          </HelpTip>
        </div>
      </header>

      {/* ══════════ SHORTCUTS PANEL ══════════ */}
      {showShortcuts && (
        <div className="shrink-0 border-b border-foreground/[0.06] bg-teal-50/50 dark:bg-teal-500/5 px-4 py-2">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] text-foreground/55">
            <span><kbd className="kbd">⌘K</kbd> {isJa ? "コマンドパレット" : "Command palette"}</span>
            <span><kbd className="kbd">V</kbd> {isJa ? "選択" : "Select"}</span>
            <span><kbd className="kbd">R</kbd> {isJa ? "四角" : "Rect"}</span>
            <span><kbd className="kbd">C</kbd> {isJa ? "円" : "Circle"}</span>
            <span><kbd className="kbd">L</kbd> {isJa ? "直線" : "Line"}</span>
            <span><kbd className="kbd">A</kbd> {isJa ? "矢印" : "Arrow"}</span>
            <span><kbd className="kbd">T</kbd> {isJa ? "文字" : "Text"}</span>
            <span><kbd className="kbd">Space</kbd>+{isJa ? "ドラッグ" : "drag"} = {isJa ? "パン" : "Pan"}</span>
            <span><kbd className="kbd">⌘</kbd>+{isJa ? "スクロール" : "scroll"} = {isJa ? "ズーム" : "Zoom"}</span>
            <span>{isJa ? "スクロール" : "scroll"} = {isJa ? "パン" : "Pan"}</span>
            <span><kbd className="kbd">↑↓←→</kbd> {isJa ? "微調整 (0.5mm)" : "Nudge 0.5mm"}</span>
            <span><kbd className="kbd">⇧</kbd>+{isJa ? "矢印" : "arrow"} = {isJa ? "5mm 移動" : "Move 5mm"}</span>
            <span><kbd className="kbd">⇧</kbd>+{isJa ? "クリック" : "click"} = {isJa ? "角度スナップ" : "Snap angle"}</span>
            <span><kbd className="kbd">Del</kbd> {isJa ? "削除" : "Delete"}</span>
            <span><kbd className="kbd">⌘Z</kbd> {isJa ? "元に戻す" : "Undo"}</span>
            <span><kbd className="kbd">⌘D</kbd> {isJa ? "複製" : "Duplicate"}</span>
            <span><kbd className="kbd">⌘A</kbd> {isJa ? "全選択" : "Select all"}</span>
            <span><kbd className="kbd">Esc</kbd> {isJa ? "解除" : "Cancel"}</span>
          </div>
        </div>
      )}

      {/* ══════════ MAIN AREA ══════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <FigureToolbar />
        <FigureCanvas />
        <FigureProperties />

        {/* Layers panel — overlays the canvas area */}
        <LayersPanel open={showLayers} onClose={() => setShowLayers(false)} />
      </div>

      {/* Command palette (Cmd+K) — full-screen modal overlay */}
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        onOpenLayers={() => { setShowLayers(true); setShowPalette(false); }}
        onFitToContent={() => {
          // Compute fit-to-content via store + dispatch a custom event for canvas to handle
          window.dispatchEvent(new Event("figure-editor:fit-content"));
        }}
        onZoomIn={() => window.dispatchEvent(new Event("figure-editor:zoom-in"))}
        onZoomOut={() => window.dispatchEvent(new Event("figure-editor:zoom-out"))}
        onResetZoom={() => useFigureStore.getState().resetViewport()}
      />

      {/* ══════════ TIKZ CODE PANEL ══════════ */}
      {showCode && (
        <div className="shrink-0 border-t border-foreground/[0.06] bg-background/90 backdrop-blur-md animate-slide-up">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-foreground/[0.04]">
            <span className="text-[10px] font-semibold text-foreground/40">
              {isJa ? "生成されたTikZコード" : "Generated TikZ Code"}
              {selectedSize !== 2 && (
                <span className="ml-2 text-teal-600 dark:text-teal-400">
                  (scale={SIZE_PRESETS[selectedSize].scale})
                </span>
              )}
            </span>
            <button onClick={() => setShowCode(false)} className="p-1 rounded text-foreground/30 hover:text-foreground/50">
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="h-[180px] overflow-auto px-3 py-2">
            <pre className="text-[11px] font-mono text-foreground/65 leading-relaxed whitespace-pre-wrap select-all">
              {scaledCode || (isJa ? "% 図形を追加してください" : "% Add shapes to generate TikZ code")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
