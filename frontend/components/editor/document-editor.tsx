"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDocumentStore } from "@/store/document-store";
import { compileRawLatex } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { FileText, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

interface DocumentEditorProps {
  /** Kept for backwards compatibility with the page layout */
  editMode?: boolean;
}

/**
 * Raw LaTeX editor + live PDF preview.
 *
 * 左: シンプルな <textarea> ベース raw LaTeX エディタ
 * 右: 自動コンパイル PDF プレビュー（600ms デバウンス）
 */
export function DocumentEditor(_props: DocumentEditorProps) {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const setLatex = useDocumentStore((s) => s.setLatex);

  const latex = document?.latex ?? "";

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
      const blob = await compileRawLatex(source, document?.metadata.title || "preview");
      if (seq !== compileSeqRef.current) return; // stale
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
      if (seq === compileSeqRef.current) {
        setCompiling(false);
      }
    }
  }, [document?.metadata.title]);

  // Debounced auto-compile
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runCompile(latex);
    }, 600);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [latex, runCompile]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualCompile = () => {
    runCompile(latex);
  };

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("doc.editor.no_document")}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* ── Left: Raw LaTeX editor ── */}
      <div className="flex flex-1 min-w-0 flex-col border-r border-border/40">
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground/70">
            <FileText className="h-3.5 w-3.5" />
            {t("doc.editor.source.label")}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {latex.length.toLocaleString()} chars
          </div>
        </div>
        <textarea
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full resize-none border-0 bg-background px-4 py-3 font-mono text-[12.5px] leading-[1.55] text-foreground outline-none focus:ring-0"
          placeholder={"\\documentclass{article}\n\\begin{document}\n...\n\\end{document}"}
        />
      </div>

      {/* ── Right: Live PDF preview ── */}
      <div className="flex flex-1 min-w-0 flex-col bg-muted/10">
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-1.5">
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
    </div>
  );
}
