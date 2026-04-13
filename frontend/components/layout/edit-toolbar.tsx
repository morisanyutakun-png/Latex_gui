"use client";

/**
 * EditToolbar — テンプレートを主役に据えたリッチツールバー。
 * 上段: テンプレート（大きく目立つ）+ 用紙 | 書式ボタン
 * 下段: PDFプレビュー・ソース確認 | 画像読取 | PDF保存
 * 全ボタンに hover tooltip で「何ができるか」を表示。
 */

import { useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { generatePDF, CompileError, formatCompileError } from "@/lib/api";
import { createFromTemplate } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { TemplatePicker } from "@/components/editor/template-picker";
import { FormattingToolbar } from "@/components/editor/formatting-toolbar";
import {
  Download,
  ScanLine,
  Loader2,
  Eye,
  Braces,
} from "lucide-react";

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
  const showSourcePanel = useUIStore((s) => s.showSourcePanel);
  const showPdfPanel = useUIStore((s) => s.showPdfPanel);
  const toggleSourcePanel = useUIStore((s) => s.toggleSourcePanel);
  const togglePdfPanel = useUIStore((s) => s.togglePdfPanel);
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

      {/* ━━ Row 1: テンプレート（主役）+ 書式 ━━ */}
      <div className="flex items-center gap-0 px-2.5 py-1.5">

        {/* テンプレート — 大きく、dashed border で「ここを選んで」と誘導 */}
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
      </div>

      {/* ━━ Row 2: 表示切替 + アクション ━━ */}
      <div className="flex items-center gap-1.5 px-2.5 h-9 border-t border-foreground/[0.03]">

        {/* PDFプレビュー */}
        <PanelToggle
          active={showPdfPanel}
          onClick={togglePdfPanel}
          icon={<Eye className="h-3.5 w-3.5" />}
          label={isJa ? "PDFプレビュー" : "PDF Preview"}
          tooltip={isJa ? "右側に印刷時の仕上がりを表示します" : "Show print preview on the right"}
          color="sky"
        />

        {/* ソース確認 */}
        <PanelToggle
          active={showSourcePanel}
          onClick={toggleSourcePanel}
          icon={<Braces className="h-3.5 w-3.5" />}
          label={isJa ? "ソース確認" : "Source Code"}
          tooltip={isJa ? "LaTeXのソースコードを直接表示・編集できます" : "View and edit the LaTeX source directly"}
          color="violet"
        />

        <div className="w-px h-5 bg-foreground/[0.06] mx-1 shrink-0" />

        {/* 画像読取 */}
        <button
          onClick={() => useUIStore.getState().triggerOMR()}
          className="group relative flex items-center gap-2 h-7 px-3 rounded-lg text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm transition-all duration-150 active:scale-[0.97] shrink-0"
          title={isJa ? "画像やPDFをアップロードしてLaTeXに自動変換します" : "Upload an image or PDF to auto-convert to LaTeX"}
        >
          <ScanLine className="h-3.5 w-3.5 shrink-0" />
          <span>{isJa ? "画像読取" : "Scan"}</span>
          <Tooltip text={isJa ? "画像・PDFをLaTeXに変換" : "Convert image/PDF to LaTeX"} />
        </button>

        <div className="flex-1" />

        {/* PDF保存 */}
        <button
          onClick={handleDownloadPDF}
          disabled={!document || downloading}
          className="group relative flex items-center gap-2 h-7 px-4 rounded-lg text-[11px] font-bold bg-foreground text-background shadow-sm hover:opacity-90 transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isJa ? "現在の書類をPDFファイルとしてダウンロードします" : "Download current document as PDF"}
        >
          {downloading
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            : <Download className="h-3.5 w-3.5 shrink-0" />
          }
          <span>{isJa ? "PDF保存" : "Save PDF"}</span>
          <Tooltip text={isJa ? "PDFファイルをダウンロード" : "Download as PDF file"} />
        </button>
      </div>
    </div>
  );
}

/* ── パネルトグル ── */
function PanelToggle({ active, onClick, icon, label, tooltip, color }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  color: "sky" | "violet";
}) {
  const c = color === "sky"
    ? { on: "bg-sky-500/10 border-sky-400/40 text-sky-600 dark:text-sky-400", iconBg: "bg-sky-500/15", dot: "bg-sky-500" }
    : { on: "bg-violet-500/10 border-violet-400/40 text-violet-600 dark:text-violet-400", iconBg: "bg-violet-500/15", dot: "bg-violet-500" };

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={`group relative flex items-center gap-2 h-7 px-2.5 rounded-lg border transition-all duration-150 active:scale-[0.98] ${
        active
          ? `${c.on} font-semibold`
          : "border-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.03] hover:text-foreground/75 hover:border-foreground/[0.12]"
      }`}
    >
      <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${active ? c.iconBg : "bg-foreground/[0.04]"}`}>
        {icon}
      </div>
      <span className="text-[11px] font-semibold">{label}</span>
      {active && <div className={`h-1.5 w-1.5 rounded-full ${c.dot} shrink-0 ml-0.5`} />}
      <Tooltip text={tooltip} />
    </button>
  );
}

/* ── ホバー Tooltip ── */
function Tooltip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-50">
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 -top-1 h-2 w-2 rotate-45 bg-foreground" />
    </span>
  );
}
