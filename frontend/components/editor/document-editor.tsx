"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { compileRawLatex, CompileError, formatCompileError } from "@/lib/api";
import { useResizePanel } from "@/hooks/use-resize-panel";
import { useI18n } from "@/lib/i18n";
import { FileText, Loader2, AlertTriangle, RefreshCw, Code2, X } from "lucide-react";
import { VisualEditor } from "./visual-editor";
import { LatexCodeEditor } from "./latex-code-editor";

/**
 * DocumentEditor — メインの編集領域
 *
 * レイアウト:
 * ┌─ optional Source ─┬─ VisualEditor (常時) ─┬─ optional PDF ─┐
 * │ (showSourcePanel) │  contentEditable + KaTeX │ (showPdfPanel) │
 * └───────────────────┴───────────────────────┴────────────────┘
 *
 * デフォルトは VisualEditor のみ。両側パネルはツールバー (表示メニュー) から opt-in。
 * 両側パネルは resize ハンドル付きで幅を自由に調整できる。
 */
export function DocumentEditor() {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const setLatex = useDocumentStore((s) => s.setLatex);
  const showSourcePanel = useUIStore((s) => s.showSourcePanel);
  const showPdfPanel = useUIStore((s) => s.showPdfPanel);
  const setShowSourcePanel = useUIStore((s) => s.setShowSourcePanel);
  const setShowPdfPanel = useUIStore((s) => s.setShowPdfPanel);

  const sourcePanel = useResizePanel({
    side: "left",
    minWidth: 300,
    maxWidth: 720,
    defaultWidth: 420,
    storageKey: "eddivom-source-panel-width",
  });

  const pdfPanel = useResizePanel({
    side: "right",
    minWidth: 320,
    maxWidth: 800,
    defaultWidth: 480,
    storageKey: "eddivom-pdf-panel-width",
  });

  const latex = document?.latex ?? "";

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("doc.editor.no_document")}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* ── Source panel (opt-in, 左, リサイズ可) ── */}
      {showSourcePanel && (
        <>
          <LatexSourcePanel
            latex={latex}
            onChange={setLatex}
            width={sourcePanel.width}
            onClose={() => setShowSourcePanel(false)}
          />
          <div
            className={`resize-handle ${sourcePanel.isDragging ? "is-dragging" : ""}`}
            onMouseDown={sourcePanel.handleMouseDown}
          />
        </>
      )}

      {/* ── Visual editor (常時, 中央, flex で残りを埋める) ── */}
      <div className="flex flex-1 min-w-0 flex-col">
        <VisualEditor latex={latex} onChange={setLatex} template={document.template} />
      </div>

      {/* ── PDF preview panel (opt-in, 右, リサイズ可) ── */}
      {showPdfPanel && (
        <>
          <div
            className={`resize-handle ${pdfPanel.isDragging ? "is-dragging" : ""}`}
            onMouseDown={pdfPanel.handleMouseDown}
          />
          <PdfPreviewPanel
            latex={latex}
            title={document.metadata.title || "preview"}
            width={pdfPanel.width}
            onClose={() => setShowPdfPanel(false)}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────
// LatexSourcePanel — 上級者向けのソースパネル (左側固定、リサイズ可)
// ─────────────────────────────────────

interface LatexSourcePanelProps {
  latex: string;
  onChange: (latex: string) => void;
  width: number;
  onClose: () => void;
}

function LatexSourcePanel({ latex, onChange, width, onClose }: LatexSourcePanelProps) {
  const { t } = useI18n();
  return (
    <div
      className="flex shrink-0 flex-col bg-background"
      style={{ width }}
    >
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground/70">
          <Code2 className="h-3.5 w-3.5" />
          {t("doc.editor.source.label")}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {latex.length.toLocaleString()} chars
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            title={t("panel.close")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <LatexCodeEditor
          value={latex}
          onChange={onChange}
          placeholder={"\\documentclass{article}\n\\begin{document}\n...\n\\end{document}"}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// PdfPreviewPanel — オプションのコンパイル済み PDF プレビュー (右側、リサイズ可)
// ─────────────────────────────────────

interface PdfPreviewPanelProps {
  latex: string;
  title: string;
  width: number;
  onClose: () => void;
}

/** Structured error returned by compileRawLatex, already split into title/lines */
interface CompileErrorView {
  title: string;
  lines: string[];
  hint?: string;
}

function PdfPreviewPanel({ latex, title, width, onClose }: PdfPreviewPanelProps) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<CompileErrorView | null>(null);
  const compileSeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCompile = useCallback(async (source: string) => {
    if (!source.trim()) {
      setPreviewUrl(null);
      setCompileError(null);
      setCompiling(false);
      return;
    }
    const seq = ++compileSeqRef.current;
    setCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileRawLatex(source, title);
      if (seq !== compileSeqRef.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setCompileError(null);
    } catch (e) {
      if (seq !== compileSeqRef.current) return;
      // Phase 2: 構造化された CompileError を i18n でローカライズ
      if (e instanceof CompileError) {
        setCompileError(formatCompileError(e, t));
      } else if (e instanceof Error) {
        setCompileError({ title: t("error.compile"), lines: [e.message] });
      } else {
        setCompileError({ title: t("error.compile"), lines: [t("doc.editor.compile_error")] });
      }
    } finally {
      if (seq === compileSeqRef.current) setCompiling(false);
    }
  }, [title, t]);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => runCompile(latex), 600);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [latex, runCompile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualCompile = () => runCompile(latex);

  return (
    <div
      className="flex shrink-0 flex-col bg-muted/10"
      style={{ width }}
    >
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground/70">
          <FileText className="h-3.5 w-3.5" />
          {t("doc.editor.preview.label")}
        </div>
        <div className="flex items-center gap-2">
          {compiling && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("doc.editor.compiling")}
            </span>
          )}
          <button
            onClick={handleManualCompile}
            className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            title={t("doc.editor.recompile")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            title={t("panel.close")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {compileError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-rose-50/90 p-6 text-center dark:bg-rose-950/40 overflow-auto">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <div className="max-w-md space-y-2">
              <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {compileError.title}
              </div>
              <div className="text-xs text-rose-700/90 dark:text-rose-300/90 space-y-1 text-left">
                {compileError.lines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
              {compileError.hint && (
                <div className="text-[11px] italic text-rose-600/80 dark:text-rose-400/80 pt-1 border-t border-rose-300/40 dark:border-rose-700/40">
                  {compileError.hint}
                </div>
              )}
            </div>
            <button
              onClick={handleManualCompile}
              className="rounded-md bg-rose-500 px-3 py-1 text-xs font-medium text-white hover:bg-rose-600"
            >
              {t("doc.editor.retry")}
            </button>
          </div>
        )}
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="Preview"
            className="h-full w-full border-0"
          />
        ) : !compileError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {compiling ? t("doc.editor.pdf.generating") : t("doc.editor.empty_preview")}
          </div>
        )}
      </div>
    </div>
  );
}
