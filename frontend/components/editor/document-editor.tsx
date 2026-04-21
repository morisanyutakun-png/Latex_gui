"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { compileRawLatex, CompileError, formatCompileError } from "@/lib/api";
import { useResizePanel } from "@/hooks/use-resize-panel";
import { useI18n } from "@/lib/i18n";
import { FileText, Loader2, AlertTriangle, RefreshCw, Code2, X, PenLine } from "lucide-react";
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
  const showVisualPanel = useUIStore((s) => s.showVisualPanel);
  const setShowSourcePanel = useUIStore((s) => s.setShowSourcePanel);
  const setShowPdfPanel = useUIStore((s) => s.setShowPdfPanel);
  const setShowVisualPanel = useUIStore((s) => s.setShowVisualPanel);

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

      {/* ── Visual editor (中央, flex で残りを埋める) — ユーザーは非表示にできる ── */}
      {showVisualPanel ? (
        <div className="flex flex-1 min-w-0 flex-col">
          <VisualEditor latex={latex} onChange={setLatex} template={document.template} />
        </div>
      ) : (
        <VisualHiddenPlaceholder onRestore={() => setShowVisualPanel(true)} />
      )}

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
// VisualHiddenPlaceholder — VisualEditor を非表示にしているときの中央の枠
// ─────────────────────────────────────
// Source / PDF パネルが開いていれば flex-1 で隙間を吸収する役割も兼ねる。
// 中央に小さなカードを浮かべ、再表示ボタンでワンクリックで戻せるようにする。

function VisualHiddenPlaceholder({ onRestore }: { onRestore: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 min-w-0 items-center justify-center bg-gradient-to-br from-amber-50/30 via-background to-sky-50/20 dark:from-amber-500/[0.02] dark:via-background dark:to-sky-500/[0.02]">
      <div className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm max-w-xs text-center">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400/80 to-teal-500/70 flex items-center justify-center shadow-sm">
          <PenLine className="h-5 w-5 text-white" />
        </div>
        <div className="space-y-1">
          <p className="text-[12.5px] font-semibold text-foreground/75">
            {t("doc.editor.visual.hidden.title")}
          </p>
          <p className="text-[11px] text-foreground/50 leading-relaxed">
            {t("doc.editor.visual.hidden.hint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onRestore}
          className="mt-1 inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11.5px] font-semibold text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm hover:scale-[1.03] active:scale-[0.98] transition-transform"
        >
          <PenLine className="h-3 w-3" />
          {t("doc.editor.visual.hidden.restore")}
        </button>
      </div>
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

  // runCompile は毎 render の依存 (title/t) で再生成されていた。
  // これを debounce useEffect の deps に入れると、親の再描画で毎回タイマ
  // がリセットされて 600ms が永遠にリセットされ「コンパイルが始まらない」
  // 症状を引き起こす。ref を介して最新値を参照することで deps から外す。
  const titleRef = useRef(title);
  titleRef.current = title;
  const tRef = useRef(t);
  tRef.current = t;

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
      const blob = await compileRawLatex(source, titleRef.current);
      if (seq !== compileSeqRef.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setCompileError(null);
    } catch (e) {
      if (seq !== compileSeqRef.current) return;
      const tt = tRef.current;
      // Phase 2: 構造化された CompileError を i18n でローカライズ
      if (e instanceof CompileError) {
        setCompileError(formatCompileError(e, tt));
      } else if (e instanceof Error) {
        setCompileError({ title: tt("error.compile"), lines: [e.message] });
      } else {
        setCompileError({ title: tt("error.compile"), lines: [tt("doc.editor.compile_error")] });
      }
    } finally {
      if (seq === compileSeqRef.current) setCompiling(false);
    }
  }, []);

  // 初回マウントフラグ。プレビューパネルを開いた瞬間にコンパイルを開始し、
  // 600ms 待たずに PDF を出す (UX)。以降の変更は通常通り debounce する。
  const hasCompiledOnceRef = useRef(false);
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const delay = hasCompiledOnceRef.current ? 600 : 0;
    debounceTimerRef.current = setTimeout(() => {
      hasCompiledOnceRef.current = true;
      runCompile(latex);
    }, delay);
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
          <>
            {/* Safari は <iframe src="blob:...pdf"> を白紙にすることがある。
                <object> なら Safari 独自の PDF ビューアが発動しやすく、
                未対応ブラウザでは内側の <iframe> フォールバックが描画される。 */}
            <object
              data={previewUrl}
              type="application/pdf"
              className="h-full w-full"
              aria-label="PDF preview"
            >
              <iframe
                src={previewUrl}
                title="Preview"
                className="h-full w-full border-0"
              />
            </object>
            {/* どうしても inline 表示できない環境用のダウンロードリンクを右下に常設 */}
            <a
              href={previewUrl}
              download="preview.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-foreground/80 text-background px-2 py-1 text-[10px] font-medium shadow-md hover:bg-foreground"
              title="PDFをダウンロード / 新しいタブで開く"
            >
              PDF
            </a>
          </>
        ) : !compileError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {compiling ? t("doc.editor.pdf.generating") : t("doc.editor.empty_preview")}
          </div>
        )}
      </div>
    </div>
  );
}
