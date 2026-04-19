"use client";

/**
 * EditToolbar — テンプレート選択 + 書式 + PDF保存（唯一のPDFボタン）。
 * PDFプレビュー・ソース確認・画像読取はサイドバーに任せる。
 */

import { useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { generatePDF, CompileError, formatCompileError } from "@/lib/api";
import { createFromTemplate, TEMPLATES } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { TemplatePicker } from "@/components/editor/template-picker";
import { FormattingToolbar } from "@/components/editor/formatting-toolbar";
import { Download, Loader2, Printer, PenTool } from "lucide-react";
import { toast } from "sonner";
import { usePlanStore } from "@/store/plan-store";

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

export function EditToolbar() {
  const { t, locale } = useI18n();
  const isJa = locale !== "en";
  const document = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const { paperSize, setPaperSize } = useUIStore();
  const { isGenerating, setGenerating } = useUIStore();
  const openFigureEditor = useUIStore((s) => s.openFigureEditor);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");

  const handleTemplateChange = (id: string) => {
    if (!id) return;
    // LP:「全テンプレート利用可」は Pro+。Pro 未満が tier:"pro" を選んだら pricing 誘導。
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl?.tier === "pro") {
      const check = usePlanStore.getState().checkFeature("allTemplates");
      if (!check.allowed) {
        usePlanStore.getState().setShowPricing(true);
        return;
      }
    }
    if (document && document.latex.trim() && !confirm(t("edit.toolbar.template.confirm_overwrite"))) return;
    setDocument(createFromTemplate(id, locale));
  };

  const detectBrowserNoteKey = (): string => {
    if (typeof navigator === "undefined") return "header.pdf.dialog.note.generic";
    const ua = navigator.userAgent;
    const isSafari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
    const isFirefox = /Firefox\//.test(ua);
    if (isSafari) return "header.pdf.dialog.note.safari";
    if (isFirefox) return "header.pdf.dialog.note.firefox";
    return "header.pdf.dialog.note.generic";
  };

  const sanitizePdfName = (raw: string): string => {
    const base = (raw || "document").trim().replace(/\.pdf$/i, "");
    const cleaned = base.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 120) || "document";
    return `${cleaned}.pdf`;
  };

  const handleGeneratePDF = async () => {
    if (!document) return;

    // プランゲート: 教材PDF出力の制限チェック
    const pdfCheck = usePlanStore.getState().canExportPDF();
    if (!pdfCheck.allowed) {
      toast.error(pdfCheck.reason, {
        duration: 6000,
        action: {
          label: isJa ? "アップグレード" : "Upgrade",
          onClick: () => usePlanStore.getState().setShowPricing(true),
        },
      });
      return;
    }

    setGenerating(true);
    try {
      const blob = await generatePDF(document);
      // PDF生成成功 → 使用量をカウント
      usePlanStore.getState().incrementPdfUsage();
      const defaultName = sanitizePdfName(document.metadata.title || "document");

      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            id: "latex-gui-pdf-export",
            startIn: "documents",
            types: [{ description: "PDF Document", accept: { "application/pdf": [".pdf"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success(t("toast.pdf.done"), { description: handle.name });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }

      setPdfBlob(blob);
      setPdfFilename(defaultName);
      setShowSaveDialog(true);
    } catch (err: unknown) {
      if (err instanceof CompileError) {
        const view = formatCompileError(err, t);
        const description = view.lines.length > 0 ? view.lines.join(" · ") : undefined;
        toast.error(view.title, { duration: 10000, description });
      } else {
        const message = err instanceof Error ? err.message : t("header.pdf.error.unknown");
        toast.error(`${t("toast.pdf.fail")}: ${message}`, { duration: 8000 });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePDF = () => {
    if (!pdfBlob) return;
    const finalName = sanitizePdfName(pdfFilename);
    const url = URL.createObjectURL(pdfBlob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = finalName;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPdfBlob(null);
    setShowSaveDialog(false);
    toast.success(t("toast.pdf.done"), { description: finalName });
  };

  return (
    <>
      <div className="editor-toolbar shrink-0 bg-background/80 backdrop-blur-md border-b border-foreground/[0.04]">
        <div className="flex items-center gap-0 px-2.5 py-1.5">

          {/* テンプレート */}
          <div className="flex items-center gap-2 pr-4 border-r border-foreground/[0.06] shrink-0">
            <TemplatePicker
              currentId={document?.template ?? "blank"}
              onSelect={handleTemplateChange}
              label=""
              large
            />
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              title={isJa ? "用紙サイズを変更" : "Change paper size"}
              className="h-8 px-2 rounded-lg border border-foreground/[0.08] bg-white/70 dark:bg-white/5 text-[11px] text-foreground/60 hover:text-foreground hover:border-foreground/[0.15] focus:outline-none cursor-pointer transition-colors font-mono"
            >
              {PAPER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* 書式 */}
          <div className="flex items-center gap-1 px-3">
            <FormattingToolbar />
          </div>

          {/* 図エディタ */}
          <div className="flex items-center gap-1 px-3 border-l border-foreground/[0.06]">
            <button
              onClick={openFigureEditor}
              title={isJa ? "図・ダイアグラムエディタを開く" : "Open Figure / Diagram Editor"}
              className="group flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold text-foreground/50 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-all duration-150"
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>{isJa ? "図を描く" : "Draw Figure"}</span>
            </button>
          </div>

          <div className="flex-1" />

          {/* PDF出力 — 唯一のPDFボタン */}
          <button
            onClick={handleGeneratePDF}
            disabled={!document || isGenerating}
            className="group relative flex items-center gap-2 h-8 px-5 rounded-full text-[12px] font-bold bg-foreground text-background shadow-md hover:opacity-90 transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isJa ? "PDFファイルを生成してダウンロード" : "Generate and download PDF"}
          >
            {isGenerating
              ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              : <Printer className="h-3.5 w-3.5 shrink-0" />
            }
            <span>{isGenerating ? (isJa ? "生成中..." : "Generating...") : (isJa ? "PDF出力" : "Export PDF")}</span>
          </button>
        </div>
      </div>

      {/* PDF Save As ダイアログ（showSaveFilePicker 非対応ブラウザ用） */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowSaveDialog(false); setPdfBlob(null); }}>
          <div
            className="bg-background rounded-xl border p-6 w-[380px] space-y-4 animate-scale-in"
            style={{ boxShadow: "var(--shadow-float)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold">{t("header.pdf.dialog.title")}</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">{t("header.pdf.dialog.filename")}</label>
              <input
                value={pdfFilename}
                onChange={(e) => setPdfFilename(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePDF(); }}
                className="w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                autoFocus
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                {t(detectBrowserNoteKey() as Parameters<typeof t>[0])}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowSaveDialog(false); setPdfBlob(null); }}
                className="px-4 py-2 text-xs rounded-lg border hover:bg-muted transition-all font-medium"
              >
                {t("header.pdf.dialog.cancel")}
              </button>
              <button
                onClick={handleSavePDF}
                className="px-5 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all font-semibold shadow-sm"
              >
                {t("header.pdf.dialog.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
