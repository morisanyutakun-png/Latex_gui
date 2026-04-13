"use client";

/**
 * EditToolbar — 2段構成の高さをとったリッチツールバー。
 * 上段: テンプレート・用紙 | 書式
 * 下段: PDFプレビュー・ソース確認 | アクション
 * 各ボタンに説明テキストがあり、見た目だけで機能がわかる。
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
  LayoutTemplate,
  Image,
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
      {/* ━━ Row 1: テンプレート + 用紙 | 書式 ━━ */}
      <div className="flex items-center gap-0 px-2.5 h-10">
        {/* テンプレート — メインの選択体験 */}
        <div className="flex items-center gap-2 pr-3 border-r border-foreground/[0.06] shrink-0">
          <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
            <LayoutTemplate className="h-4 w-4 text-violet-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground/30 leading-none">
              {isJa ? "テンプレート" : "Template"}
            </span>
            <div className="flex items-center gap-1.5 -mt-0.5">
              <TemplatePicker
                currentId={document?.template ?? "blank"}
                onSelect={handleTemplateChange}
                label=""
              />
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                className="h-6 px-1 rounded border border-foreground/[0.06] bg-transparent text-[10px] text-foreground/50 hover:text-foreground focus:outline-none cursor-pointer font-mono"
              >
                {PAPER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 書式 */}
        <div className="flex items-center gap-1 px-3 border-r border-foreground/[0.06]">
          <FormattingToolbar />
        </div>

        <div className="flex-1" />
      </div>

      {/* ━━ Row 2: 表示パネル + アクション ━━ */}
      <div className="flex items-center gap-1.5 px-2.5 h-9 border-t border-foreground/[0.03]">
        {/* PDFプレビュー — 大きめトグル */}
        <PanelToggle
          active={showPdfPanel}
          onClick={togglePdfPanel}
          icon={<Eye className="h-3.5 w-3.5" />}
          label={isJa ? "PDFプレビュー" : "PDF Preview"}
          desc={isJa ? "印刷イメージを確認" : "See print result"}
          color="sky"
        />

        {/* ソース確認 */}
        <PanelToggle
          active={showSourcePanel}
          onClick={toggleSourcePanel}
          icon={<Braces className="h-3.5 w-3.5" />}
          label={isJa ? "ソース確認" : "Source Code"}
          desc={isJa ? "LaTeXコードを表示・編集" : "View & edit LaTeX"}
          color="violet"
        />

        <div className="w-px h-5 bg-foreground/[0.06] mx-1 shrink-0" />

        {/* 画像読取 */}
        <button
          onClick={() => useUIStore.getState().triggerOMR()}
          className="group flex items-center gap-2 h-7 px-3 rounded-lg text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm transition-all duration-150 active:scale-[0.97] shrink-0"
          title={t("edit.toolbar.scan.tooltip")}
        >
          <ScanLine className="h-3.5 w-3.5 shrink-0" />
          <span>{isJa ? "画像読取" : "Scan"}</span>
        </button>

        <div className="flex-1" />

        {/* PDFダウンロード */}
        <button
          onClick={handleDownloadPDF}
          disabled={!document || downloading}
          className="flex items-center gap-2 h-7 px-4 rounded-lg text-[11px] font-bold bg-foreground text-background shadow-sm hover:opacity-90 transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
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

/* ── パネルトグル: アイコン + ラベル + 説明 ── */
function PanelToggle({ active, onClick, icon, label, desc, color }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: "sky" | "violet";
}) {
  const c = color === "sky"
    ? { on: "bg-sky-500/10 border-sky-400/40 text-sky-600 dark:text-sky-400", iconBg: "bg-sky-500/15", dot: "bg-sky-500" }
    : { on: "bg-violet-500/10 border-violet-400/40 text-violet-600 dark:text-violet-400", iconBg: "bg-violet-500/15", dot: "bg-violet-500" };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2 h-7 px-2.5 rounded-lg border transition-all duration-150 active:scale-[0.98] ${
        active
          ? `${c.on} font-semibold`
          : "border-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.03] hover:text-foreground/75 hover:border-foreground/[0.12]"
      }`}
    >
      <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${active ? c.iconBg : "bg-foreground/[0.04]"}`}>
        {icon}
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className="text-[11px] font-semibold">{label}</span>
        <span className={`text-[8px] ${active ? "opacity-60" : "opacity-40"} hidden lg:block`}>{desc}</span>
      </div>
      {active && <div className={`h-1.5 w-1.5 rounded-full ${c.dot} shrink-0 ml-0.5`} />}
    </button>
  );
}
