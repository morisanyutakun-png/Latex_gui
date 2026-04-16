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
  ImagePlus, Keyboard, FileDown, Loader2, Layers, Command, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { compileRawLatex, CompileError, formatCompileError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LayersPanel } from "./layers-panel";
import { CommandPalette } from "./command-palette";
import { HelpTip } from "./help-tip";

// ── Insert size presets ─────────────────────────────────────────

interface SizePreset {
  label: string;
  labelJa: string;
  scale: string; // TikZ scale value or "none"
  description: string;
  descriptionJa: string;
}

/**
 * Guarantee a minimal compile-able LaTeX document structure.
 *
 * If any of `\documentclass`, `\begin{document}`, `\end{document}` is missing
 * from `src`, add the missing parts without touching existing content. This
 * protects figure insertion against starting from (or accidentally landing in)
 * a stripped-down document where lualatex would otherwise fail with
 * "Missing \begin{document}".
 */
function ensureDocumentStructure(src: string): string {
  let out = src;

  const hasDocClass = /\\documentclass\b/.test(out);
  const hasBeginDoc = /\\begin\{document\}/.test(out);
  const hasEndDoc = /\\end\{document\}/.test(out);

  // If all three exist the doc is structurally valid — leave untouched.
  if (hasDocClass && hasBeginDoc && hasEndDoc) return out;

  // 1. Prepend \documentclass if missing.
  if (!hasDocClass) {
    out = "\\documentclass[11pt,a4paper]{article}\n\\usepackage{tikz}\n" + out;
  }

  // 2. Ensure \begin{document} exists. Inserted either right after the
  //    preamble (heuristically: after the last \usepackage/\usetikzlibrary/
  //    \definecolor/\tikzset/\pgfplotsset/\hypersetup/\geometry line) or
  //    right after \documentclass.
  if (!/\\begin\{document\}/.test(out)) {
    const preambleEndRe = /((?:^|\n)\s*\\(?:usepackage|usetikzlibrary|pgfplotsset|definecolor|tikzset|hypersetup|geometry|newcommand|renewcommand|DeclareMathOperator)\b[^\n]*\n)(?![\s\S]*(?:\\usepackage|\\usetikzlibrary|\\pgfplotsset|\\definecolor|\\tikzset|\\hypersetup|\\geometry|\\newcommand|\\renewcommand|\\DeclareMathOperator))/;
    const m = out.match(preambleEndRe);
    if (m && m.index !== undefined) {
      const insertAt = m.index + m[0].length;
      out = out.slice(0, insertAt) + "\n\\begin{document}\n" + out.slice(insertAt);
    } else {
      const docClassMatch = out.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/);
      if (docClassMatch && docClassMatch.index !== undefined) {
        const at = docClassMatch.index + docClassMatch[0].length;
        out = out.slice(0, at) + "\n\\begin{document}\n" + out.slice(at);
      } else {
        out = "\\begin{document}\n" + out;
      }
    }
  }

  // 3. Append \end{document} if missing.
  if (!/\\end\{document\}/.test(out)) {
    out = out.replace(/\n*$/, "") + "\n\\end{document}\n";
  }

  return out;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: "Small",    labelJa: "小",  scale: "0.6",  description: "~5cm wide", descriptionJa: "約5cm幅" },
  { label: "Medium",   labelJa: "中",  scale: "0.8",  description: "~7cm wide", descriptionJa: "約7cm幅" },
  { label: "Original", labelJa: "原寸", scale: "none", description: "As drawn",  descriptionJa: "描画そのまま" },
  { label: "Large",    labelJa: "大",  scale: "1.2",  description: "~12cm wide", descriptionJa: "約12cm幅" },
  { label: "Full",     labelJa: "全幅", scale: "1.5",  description: "Full width", descriptionJa: "ページ全幅" },
];

export function FigureEditor() {
  const { locale, setLocale, t } = useI18n();
  const isJa = locale === "ja";

  const shapes = useFigureStore((s) => s.shapes);
  const connections = useFigureStore((s) => s.connections);
  const resetAll = useFigureStore((s) => s.reset);
  const closeFigureEditor = useUIStore((s) => s.closeFigureEditor);
  const setShowPdfPanel = useUIStore((s) => s.setShowPdfPanel);

  const setLatex = useDocumentStore((s) => s.setLatex);
  const doc = useDocumentStore((s) => s.document);

  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedSize, setSelectedSize] = useState(2); // "Original" index
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  // New: caption text (empty → no \caption{} wrapper)
  const [caption, setCaption] = useState("");
  // New: insertion position — "end" (before \end{document}), "top" (after \begin{document}), "cursor"
  const [insertPos, setInsertPos] = useState<"end" | "top" | "cursor">("end");
  // Marker of the last inserted figure (so re-insert replaces it)
  const lastMarkerRef = React.useRef<string | null>(null);


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

    // Generate a unique marker so the block can be located & replaced later
    const marker = lastMarkerRef.current ?? `eddivom-fig-${Date.now().toString(36)}`;
    const beginMark = `% ${marker}-begin`;
    const endMark   = `% ${marker}-end`;

    // ── Separate preamble commands from body ──────────────────────
    // scaledCode from generateFullLatex() may contain `% Required packages:` + \usepackage / \usetikzlibrary lines
    // These CANNOT appear inside \begin{figure}/\begin{center}; they must go in the document preamble.
    const preambleLines: string[] = [];
    const bodyLines: string[] = [];
    let inHeader = true; // we only treat preamble-looking lines as preamble until the first body line
    for (const line of scaledCode.split("\n")) {
      const trimmed = line.trim();
      if (inHeader && (
          trimmed.startsWith("\\usepackage") ||
          trimmed.startsWith("\\usetikzlibrary") ||
          trimmed.startsWith("\\pgfplotsset") ||
          trimmed.startsWith("\\definecolor") ||
          trimmed.startsWith("\\tikzset"))) {
        preambleLines.push(trimmed);
      } else if (inHeader && (trimmed.startsWith("% Required packages:") || trimmed === "")) {
        // skip header comment and blank lines within the extracted preamble section
        continue;
      } else {
        inHeader = false;
        bodyLines.push(line);
      }
    }
    const bodyOnly = bodyLines.join("\n").trim();

    // Build the figure block: if a caption is set, use figure environment with caption BELOW;
    // otherwise use \begin{center}. Either way, body is wrapped with markers for re-editing.
    const captionTrim = caption.trim();
    const labelRef = captionTrim ? `fig:${marker}` : "";
    const body = captionTrim
      ? [
          "\\begin{figure}[h]",
          "\\centering",
          bodyOnly,
          `\\caption{${captionTrim}}`,
          `\\label{${labelRef}}`,
          "\\end{figure}",
        ].join("\n")
      : `\\begin{center}\n${bodyOnly}\n\\end{center}`;

    const block = `\n${beginMark}\n${body}\n${endMark}\n`;
    let currentLatex = doc.latex;

    // ── Self-heal: if a prior insertion dropped `\usetikzlibrary` into the
    // preamble without loading `\usepackage{tikz}`, those lines will error
    // out as undefined control sequences. Promote a `\usepackage{tikz}` to
    // right after `\documentclass` when needed, BEFORE we compute the
    // "missing" diff below so we don't double-inject.
    {
      const preambleEnd = currentLatex.indexOf("\\begin{document}");
      const preambleBefore = preambleEnd >= 0 ? currentLatex.slice(0, preambleEnd) : currentLatex;
      const hasUseTikzLib = /\\usetikzlibrary\{/.test(preambleBefore);
      // Match \usepackage{tikz} as its own package (not \usepackage{tikz-cd} etc.)
      const tikzLoadRe = /\\usepackage(?:\[[^\]]*\])?\{[^}]*\btikz\b[^}]*\}/;
      if (hasUseTikzLib && !tikzLoadRe.test(preambleBefore)) {
        const docClassRe = /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/;
        const dcMatch = currentLatex.match(docClassRe);
        if (dcMatch && dcMatch.index !== undefined) {
          const insertAt = dcMatch.index + dcMatch[0].length;
          currentLatex = currentLatex.slice(0, insertAt) + "\n\\usepackage{tikz}" + currentLatex.slice(insertAt);
        }
      }
    }

    // ── Ensure required packages are present in the document preamble ──
    // Order matters: `\usepackage{tikz}` must be LOADED before any
    // `\usetikzlibrary{...}` — otherwise \usetikzlibrary is undefined and
    // lualatex surfaces the cascading failure as "Missing \begin{document}".
    // Strategy: split the incoming preamble into two buckets and inject them
    // in different positions so the ordering invariant always holds, even
    // when the document already contains a previously-inserted tikz block.
    const docBeginIdx = currentLatex.indexOf("\\begin{document}");
    if (docBeginIdx >= 0 && preambleLines.length > 0) {
      const preambleSection = currentLatex.slice(0, docBeginIdx);
      const missing = preambleLines.filter((p) => !preambleSection.includes(p));
      if (missing.length > 0) {
        // Bucket A: `\usepackage{...}` lines → must come right after
        //   \documentclass, before any \usetikzlibrary.
        // Bucket B: `\usetikzlibrary{...}` / `\pgfplotsset` / `\definecolor` /
        //   `\tikzset` → go right before \begin{document}.
        const isPackage = (l: string) => l.startsWith("\\usepackage");
        const packages = missing.filter(isPackage);
        const otherPreamble = missing.filter((l) => !isPackage(l));
        const blockMark = "% Added by figure editor — required TikZ packages";
        const hasBlockMark = preambleSection.includes(blockMark);

        // Inject \usepackage lines right after \documentclass{...}.
        if (packages.length > 0) {
          const docClassRe = /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/;
          const m = currentLatex.match(docClassRe);
          if (m && m.index !== undefined) {
            const insertAt = m.index + m[0].length;
            const pkgBlock = "\n" + packages.join("\n");
            currentLatex = currentLatex.slice(0, insertAt) + pkgBlock + currentLatex.slice(insertAt);
          } else {
            // No \documentclass found — fall back to pre-\begin{document} spot.
            otherPreamble.unshift(...packages);
          }
        }

        // Inject \usetikzlibrary / pgfplotsset / etc. right before \begin{document}
        // (re-resolve docBeginIdx because we may have shifted the string above).
        if (otherPreamble.length > 0) {
          const newDocBeginIdx = currentLatex.indexOf("\\begin{document}");
          if (newDocBeginIdx >= 0) {
            const injection = (hasBlockMark ? "" : `${blockMark}\n`) + otherPreamble.join("\n") + "\n";
            currentLatex = currentLatex.slice(0, newDocBeginIdx) + injection + currentLatex.slice(newDocBeginIdx);
          }
        }
      }
    }

    // 1. If a previous marker exists in the doc, REPLACE that block (re-insert behavior)
    const existingBegin = currentLatex.indexOf(beginMark);
    const existingEnd = existingBegin >= 0 ? currentLatex.indexOf(endMark, existingBegin) : -1;
    if (existingBegin >= 0 && existingEnd >= 0) {
      const before = currentLatex.slice(0, existingBegin).replace(/\n$/, "");
      const after = currentLatex.slice(existingEnd + endMark.length).replace(/^\n/, "");
      currentLatex = ensureDocumentStructure(before + block + after);
      setLatex(currentLatex);
      lastMarkerRef.current = marker;
      setShowPdfPanel(true);
      closeFigureEditor();
      toast.success(isJa ? "図を更新しました (サイズ反映)" : "Figure updated (new size applied)");
      return;
    }

    // 2. Otherwise insert at the chosen position
    let newLatex: string;
    if (insertPos === "top") {
      const beginDocIdx = currentLatex.indexOf("\\begin{document}");
      if (beginDocIdx >= 0) {
        const afterBegin = currentLatex.indexOf("\n", beginDocIdx);
        const insertAt = afterBegin >= 0 ? afterBegin + 1 : beginDocIdx + "\\begin{document}".length;
        newLatex = currentLatex.slice(0, insertAt) + block + currentLatex.slice(insertAt);
      } else {
        newLatex = block + currentLatex;
      }
    } else if (insertPos === "cursor") {
      // Best-effort: insert at the end of the first blank line after middle of doc,
      // or before \end{document} if no better position. Real cursor tracking needs editor integration.
      const endDocIdx = currentLatex.lastIndexOf("\\end{document}");
      if (endDocIdx >= 0) {
        newLatex = currentLatex.slice(0, endDocIdx) + block + "\n" + currentLatex.slice(endDocIdx);
      } else {
        newLatex = currentLatex + block;
      }
    } else {
      // "end" — before \end{document}
      const endDocIdx = currentLatex.lastIndexOf("\\end{document}");
      if (endDocIdx >= 0) {
        newLatex = currentLatex.slice(0, endDocIdx) + block + "\n" + currentLatex.slice(endDocIdx);
      } else {
        newLatex = currentLatex + block;
      }
    }

    // ── Post-insertion structural self-heal ───────────────────────────
    // Guarantee the result has \documentclass, \begin{document}, \end{document}
    // even if the starting doc was broken (empty / missing structure). Without
    // this, a figure inserted into a stripped-down doc compiles as an orphan
    // block and lualatex errors with "Missing \begin{document}".
    newLatex = ensureDocumentStructure(newLatex);

    setLatex(newLatex);
    lastMarkerRef.current = marker;
    // Auto-open PDF preview so user immediately sees the rendered result
    setShowPdfPanel(true);
    // Close the figure editor to reveal the preview — shapes remain in memory
    closeFigureEditor();
    toast.success(isJa
      ? "図を挿入 — プレビュー画面を開きました (再編集は図アイコンから)"
      : "Figure inserted — preview opened (re-edit via the figure icon)");
    // Keep shapes in memory (don't resetAll) so user can reopen & adjust size / caption
  }, [doc, shapes, scaledCode, caption, insertPos, setLatex, setShowPdfPanel, closeFigureEditor, isJa]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(scaledCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(isJa ? "TikZコードをクリップボードにコピーしました" : "TikZ source copied to clipboard");
    });
  }, [scaledCode, isJa]);

  // ── PDF download (figure alone, standalone document) ─────────

  const handleDownloadPDF = useCallback(async () => {
    if (shapes.length === 0 || downloadingPdf) return;
    setDownloadingPdf(true);

    // ── Separate scaledCode into preamble + body ─────────────────
    // generateFullLatex() prefixes the tikz body with `% Required packages:` + \usepackage lines.
    // Those MUST live in the preamble, never inside \begin{document}, otherwise LaTeX errors with
    // "Missing \begin{document}".
    const extraPreamble: string[] = [];
    const bodyLines: string[] = [];
    let inHeader = true;
    for (const line of scaledCode.split("\n")) {
      const trimmed = line.trim();
      if (inHeader && (
          trimmed.startsWith("\\usepackage") ||
          trimmed.startsWith("\\usetikzlibrary") ||
          trimmed.startsWith("\\pgfplotsset") ||
          trimmed.startsWith("\\definecolor") ||
          trimmed.startsWith("\\tikzset"))) {
        extraPreamble.push(trimmed);
      } else if (inHeader && (trimmed.startsWith("% Required packages:") || trimmed === "")) {
        continue;
      } else {
        inHeader = false;
        bodyLines.push(line);
      }
    }
    const bodyCode = bodyLines.join("\n").trim();

    // Build a standalone document with just the figure, auto-cropped via preview environment
    const basePreamble = [
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
      "\\usetikzlibrary{shapes.arrows}",
      "\\usetikzlibrary{automata, positioning}",
      "\\usetikzlibrary{calc}",
      "\\usetikzlibrary{patterns}",
      "\\usepackage{amsmath, amssymb}",
    ];
    // Merge any extra preamble lines (deduplicated)
    const mergedPreamble = Array.from(new Set([...basePreamble, ...extraPreamble]));

    const standaloneLatex = [
      ...mergedPreamble,
      "\\begin{document}",
      bodyCode,
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
          toast.success(isJa ? "PDFを保存しました" : "PDF saved to disk");
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
      toast.success(isJa ? "PDFをダウンロードしました" : "PDF download complete");
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
    // If shapes exist AND have NOT been inserted yet → warn (first-time discard)
    // If already inserted (lastMarkerRef set), closing just hides the editor;
    //   shapes persist in memory so user can reopen & re-edit.
    if (shapes.length > 0 && !lastMarkerRef.current) {
      if (!confirm(isJa ? "編集中の図を破棄しますか？ (挿入していません)" : "Discard unsaved figure? (not yet inserted)")) return;
      resetAll();
    }
    // When already inserted, we keep shapes in memory → reopening the editor restores them
    closeFigureEditor();
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
          {/* Language toggle (JA / EN) */}
          <HelpTip
            title={isJa ? "言語を切り替え" : "Switch language"}
            description={isJa ? "日本語 ↔ English を即座に切替 (設定は保存される)" : "Toggle between Japanese and English (saved to preferences)"}
          >
            <button
              onClick={() => setLocale(isJa ? "en" : "ja")}
              className="flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-bold font-mono text-foreground/50 hover:text-foreground/85 hover:bg-foreground/[0.04] border border-foreground/[0.08] transition-colors"
            >
              <Globe size={11} />
              <span className="tracking-wider">{isJa ? "JA" : "EN"}</span>
            </button>
          </HelpTip>

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
            <span>{copied ? (isJa ? "済" : "Copied!") : (isJa ? "コピー" : "Copy TikZ")}</span>
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
            <span>{downloadingPdf ? (isJa ? "生成中…" : "Generating…") : "PDF"}</span>
          </button>
          </HelpTip>

          <div className="w-px h-5 bg-foreground/[0.08] mx-0.5" />

          {/* Insert position selector */}
          <HelpTip title={isJa ? "挿入位置" : "Insert position"}
            description={isJa ? "図を文書のどこに入れるか選択" : "Choose where in the document to place the figure"}>
            <select
              value={insertPos}
              onChange={(e) => setInsertPos(e.target.value as "end" | "top" | "cursor")}
              className="h-7 pl-2 pr-6 text-[10px] rounded-lg border border-foreground/[0.08] bg-white/70 dark:bg-white/5 font-semibold text-foreground/65 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all"
            >
              <option value="end">{isJa ? "末尾" : "End"}</option>
              <option value="top">{isJa ? "先頭" : "Top"}</option>
              <option value="cursor">{isJa ? "カーソル前" : "Cursor"}</option>
            </select>
          </HelpTip>

          {/* Insert */}
          <HelpTip title={lastMarkerRef.current ? (isJa ? "図を更新" : "Update figure") : (isJa ? "LaTeX文書に挿入" : "Insert into LaTeX document")}
            description={lastMarkerRef.current
              ? (isJa ? "挿入済みの図をこの設定で更新 (サイズ・キャプション反映)" : "Replace the previously inserted figure with these settings")
              : (isJa ? "選んだサイズ・位置で図をエディタに挿入" : "Drop the figure into the editor at the chosen size & position")}>
          <button
            onClick={handleInsert}
            disabled={shapes.length === 0}
            className="flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-bold bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ImagePlus size={13} />
            <span>{lastMarkerRef.current ? (isJa ? "更新" : "Update figure") : (isJa ? "挿入" : "Insert figure")}</span>
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

      {/* ══════════ CAPTION BAR ══════════ */}
      {shapes.length > 0 && (
        <div className="shrink-0 border-b border-foreground/[0.06] bg-gradient-to-r from-teal-50/40 to-cyan-50/20 dark:from-teal-500/5 dark:to-cyan-500/5 px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 shrink-0">
            {isJa ? "キャプション" : "Caption"}
          </span>
          <HelpTip
            title={isJa ? "図の説明文" : "Figure caption"}
            description={isJa
              ? "入力すると figure 環境で挿入され、キャプションが図の下に配置されます (LaTeX慣例)"
              : "If set, the figure is wrapped in a figure environment with caption BELOW (LaTeX convention)"}
            side="bottom"
          >
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={isJa ? "図の下に表示されます (空欄なら図のみ)" : "Shown below the figure (leave empty for no caption)"}
              className="flex-1 h-6 px-2 text-[11px] rounded-md border border-teal-500/20 bg-white/80 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500/50 transition-all placeholder:text-foreground/30"
            />
          </HelpTip>
          {caption && (
            <span className="text-[9px] text-foreground/40 font-mono shrink-0">
              {isJa ? "fig:ref → " : "fig:ref → "}<code className="text-teal-600 dark:text-teal-400">{lastMarkerRef.current ? `fig:${lastMarkerRef.current}` : "…"}</code>
            </span>
          )}
        </div>
      )}

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
        onResetZoom={() => window.dispatchEvent(new Event("figure-editor:reset-center"))}
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
