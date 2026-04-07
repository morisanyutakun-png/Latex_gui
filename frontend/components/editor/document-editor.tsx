"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { compileRawLatex } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { FileText, Loader2, AlertTriangle, RefreshCw, Code2 } from "lucide-react";
import { VisualEditor } from "./visual-editor";

/**
 * DocumentEditor — メインの編集領域
 *
 * レイアウト:
 * ┌─ VisualEditor (常時表示) ─┬─ optional PDF iframe ─┬─ optional LaTeX textarea ─┐
 * │  contentEditable + KaTeX  │ (showPdfPanel)        │ (showSourcePanel)         │
 * └───────────────────────────┴───────────────────────┴───────────────────────────┘
 *
 * デフォルトは VisualEditor のみ。PDF / LaTeX ソースはツールバーから opt-in。
 */
export function DocumentEditor() {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const setLatex = useDocumentStore((s) => s.setLatex);
  const showSourcePanel = useUIStore((s) => s.showSourcePanel);
  const showPdfPanel = useUIStore((s) => s.showPdfPanel);

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
      {/* ── LaTeX source panel (opt-in, 左) ── */}
      {showSourcePanel && (
        <LatexSourcePanel latex={latex} onChange={setLatex} />
      )}

      {/* ── Visual editor (常時, 中央) ── */}
      <div className="flex flex-1 min-w-0 flex-col">
        <VisualEditor latex={latex} onChange={setLatex} />
      </div>

      {/* ── PDF preview panel (opt-in, 右) ── */}
      {showPdfPanel && (
        <PdfPreviewPanel latex={latex} title={document.metadata.title || "preview"} />
      )}
    </div>
  );
}

// ─────────────────────────────────────
// LatexSourcePanel — オプションの LaTeX ソース表示/編集
// ─────────────────────────────────────

interface LatexSourcePanelProps {
  latex: string;
  onChange: (latex: string) => void;
}

function LatexSourcePanel({ latex, onChange }: LatexSourcePanelProps) {
  const { t } = useI18n();
  return (
    <div className="flex w-[420px] shrink-0 flex-col border-r border-border/40 bg-background">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground/70">
          <Code2 className="h-3.5 w-3.5" />
          {t("doc.editor.source.label")}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {latex.length.toLocaleString()} chars
        </div>
      </div>
      <textarea
        value={latex}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 w-full resize-none border-0 bg-background px-4 py-3 font-mono text-[12.5px] leading-[1.55] text-foreground outline-none focus:ring-0"
        placeholder={"\\documentclass{article}\n\\begin{document}\n...\n\\end{document}"}
      />
    </div>
  );
}

// ─────────────────────────────────────
// PdfPreviewPanel — オプションのコンパイル済み PDF プレビュー
// ─────────────────────────────────────

interface PdfPreviewPanelProps {
  latex: string;
  title: string;
}

function PdfPreviewPanel({ latex, title }: PdfPreviewPanelProps) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
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
      const msg = e instanceof Error ? e.message : t("doc.editor.compile_error");
      setCompileError(msg);
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
    <div className="flex flex-1 min-w-0 max-w-[50%] flex-col border-l border-border/40 bg-muted/10">
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
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {compileError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-rose-50/90 p-6 text-center dark:bg-rose-950/40">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <div className="max-w-md text-sm text-rose-700 dark:text-rose-300">
              {compileError}
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
            title="LaTeX preview"
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
