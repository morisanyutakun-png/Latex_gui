"use client";

/**
 * EditToolbar — テンプレート選択 + 書式 + PDF保存。
 * PDFプレビュー・ソース確認・画像読取はサイドバーに任せる。
 */

import { useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { generatePDF, CompileError, formatCompileError } from "@/lib/api";
import { createFromTemplate } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { TemplatePicker } from "@/components/editor/template-picker";
import { FormattingToolbar } from "@/components/editor/formatting-toolbar";
import { Download, Loader2 } from "lucide-react";

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
  const [downloading, setDownloading] = useState(false);

  const handleTemplateChange = (id: string) => {
    if (!id) return;
    if (document && document.latex.trim() && !confirm(t("edit.toolbar.template.confirm_overwrite"))) return;
    setDocument(createFromTemplate(id, locale));
  };

  const handleDownloadPDF = async () => {
    if (!document) return;
    setDownloading(true);
    try {
      const blob = await generatePDF(document);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = (document.metadata.title || "document") + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (e instanceof CompileError) {
        const view = formatCompileError(e, t);
        alert([view.title, ...view.lines, view.hint].filter(Boolean).join("\n"));
      } else {
        alert(e instanceof Error ? e.message : t("edit.toolbar.pdf.error"));
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="editor-toolbar shrink-0 bg-background/80 backdrop-blur-md border-b border-foreground/[0.04]">
      <div className="flex items-center gap-0 px-2.5 py-1.5">

        {/* テンプレート — 大きく目立つ */}
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

        {/* 書式ボタン群 */}
        <div className="flex items-center gap-1 px-3">
          <FormattingToolbar />
        </div>

        <div className="flex-1" />

        {/* PDF保存 */}
        <button
          onClick={handleDownloadPDF}
          disabled={!document || downloading}
          className="group relative flex items-center gap-2 h-8 px-4 rounded-lg text-[11px] font-bold bg-foreground text-background shadow-sm hover:opacity-90 transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isJa ? "現在の書類をPDFファイルとしてダウンロードします" : "Download current document as PDF"}
        >
          {downloading
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            : <Download className="h-3.5 w-3.5 shrink-0" />
          }
          <span>{isJa ? "PDF保存" : "Save PDF"}</span>
        </button>
      </div>
    </div>
  );
}
