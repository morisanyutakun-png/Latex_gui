"use client";

/**
 * EditToolbar — テンプレ選択・PDFダウンロード・OMR取り込みのみ。
 * raw LaTeX 駆動なので、文字装飾系のボタンは廃止。
 */

import { useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { generatePDF } from "@/lib/api";
import { TEMPLATES, createFromTemplate } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { Download, ScanLine, FileText, Loader2 } from "lucide-react";

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

function Sep() {
  return <div className="w-px h-4 bg-border/30 mx-1 shrink-0" />;
}

export function EditToolbar() {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const { paperSize, setPaperSize } = useUIStore();
  const [downloading, setDownloading] = useState(false);

  const handleTemplateChange = (id: string) => {
    if (!id) return;
    if (document && document.latex.trim() && !confirm(t("edit.toolbar.template.confirm_overwrite"))) {
      return;
    }
    setDocument(createFromTemplate(id));
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
      alert(e instanceof Error ? e.message : t("edit.toolbar.pdf.error"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="editor-toolbar flex items-center gap-1 px-3 h-10 shrink-0 bg-background/72 backdrop-blur-md">
      {/* モードバッジ */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mr-1 shrink-0 bg-foreground/[0.05] text-foreground/75 border border-foreground/[0.10]">
        <FileText className="h-3 w-3" />
        <span>{t("edit.toolbar.mode_badge")}</span>
      </div>

      <Sep />

      {/* テンプレート選択 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-muted-foreground/40 font-mono select-none hidden sm:inline">{t("edit.toolbar.template.label")}</span>
        <select
          value={document?.template || "blank"}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="h-7 px-2 rounded-md border border-foreground/[0.10] bg-white/70 dark:bg-white/5 text-[11px] text-foreground/80 focus:outline-none cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-colors"
        >
          {TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.icon} {tpl.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      <Sep />

      {/* OMR */}
      <button
        onClick={() => useUIStore.getState().triggerOMR()}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm transition-all duration-150 active:scale-[0.97] shrink-0"
        title={t("edit.toolbar.scan.tooltip")}
      >
        <ScanLine className="h-3 w-3 shrink-0" />
        <span className="hidden sm:inline">{t("header.scan.label")}</span>
      </button>

      <Sep />

      {/* PDFダウンロード */}
      <button
        onClick={handleDownloadPDF}
        disabled={!document || downloading}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sm transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("edit.toolbar.pdf.tooltip")}
      >
        {downloading ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <Download className="h-3 w-3 shrink-0" />
        )}
        <span className="hidden sm:inline">PDF</span>
      </button>

      <Sep />

      {/* 用紙サイズ */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-muted-foreground/40 font-mono select-none hidden sm:inline">{t("toolbar.paper")}</span>
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value as PaperSize)}
          className="h-7 px-2 rounded-md border border-foreground/[0.10] bg-white/70 dark:bg-white/5 text-[11px] text-foreground/70 hover:text-foreground focus:outline-none cursor-pointer transition-colors font-mono"
        >
          {PAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
