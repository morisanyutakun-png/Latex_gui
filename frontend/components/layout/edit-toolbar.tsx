"use client";

/**
 * EditToolbar — 人間工学的設計: 各グループにラベルを付け、
 * ボタンの見た目自体が機能を説明する。
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
  Printer,
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
    <div className="editor-toolbar flex items-center gap-0 px-2 h-10 shrink-0 bg-background/72 backdrop-blur-md">

      {/* ━━ 1. レイアウト ━━ */}
      <ToolGroup label={isJa ? "レイアウト" : "Layout"}>
        <div className="flex items-center gap-1">
          <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
            <LayoutTemplate className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <TemplatePicker
            currentId={document?.template ?? "blank"}
            onSelect={handleTemplateChange}
            label={t("edit.toolbar.template.label")}
          />
        </div>
        {/* 用紙 */}
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value as PaperSize)}
          className="h-7 px-1.5 rounded-md border border-foreground/[0.08] bg-white/70 dark:bg-white/5 text-[11px] text-foreground/60 hover:text-foreground focus:outline-none cursor-pointer transition-colors font-mono"
        >
          {PAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </ToolGroup>

      {/* ━━ 2. 書式 ━━ */}
      <ToolGroup label={isJa ? "書式" : "Format"}>
        <FormattingToolbar />
      </ToolGroup>

      {/* ━━ 3. 表示 ━━ */}
      <ToolGroup label={isJa ? "表示" : "View"}>
        <ToggleBtn
          active={showPdfPanel}
          onClick={togglePdfPanel}
          icon={<Eye className="h-3 w-3" />}
          label={isJa ? "プレビュー" : "Preview"}
          color="sky"
        />
        <ToggleBtn
          active={showSourcePanel}
          onClick={toggleSourcePanel}
          icon={<Braces className="h-3 w-3" />}
          label={isJa ? "ソース" : "Source"}
          color="violet"
        />
      </ToolGroup>

      <div className="flex-1" />

      {/* ━━ 4. アクション ━━ */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => useUIStore.getState().triggerOMR()}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm transition-all duration-150 active:scale-[0.97] shrink-0"
          title={t("edit.toolbar.scan.tooltip")}
        >
          <ScanLine className="h-3 w-3 shrink-0" />
          <span className="hidden sm:inline">{isJa ? "画像読取" : "Scan"}</span>
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={!document || downloading}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sm transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("edit.toolbar.pdf.tooltip")}
        >
          {downloading
            ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            : <Download className="h-3 w-3 shrink-0" />
          }
          <span className="hidden sm:inline">PDF</span>
        </button>
      </div>
    </div>
  );
}

/* ── ツールグループ: ラベル付きセクション ── */
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1.5 relative">
      {/* 左セパレータ */}
      <div className="w-px h-5 bg-foreground/[0.06] -ml-0.5 mr-0.5 shrink-0" />
      {/* グループラベル */}
      <span className="absolute -top-[1px] left-2.5 text-[8px] font-semibold uppercase tracking-widest text-foreground/25 select-none pointer-events-none">
        {label}
      </span>
      {children}
    </div>
  );
}

/* ── トグルボタン ── */
function ToggleBtn({ active, onClick, icon, label, color }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: "sky" | "violet";
}) {
  const styles = {
    sky: {
      on: "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
      badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    violet: {
      on: "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400",
      badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border transition-all duration-150 active:scale-[0.97] ${
        active
          ? `${styles.on} font-semibold`
          : "bg-transparent border-foreground/[0.08] text-foreground/45 hover:bg-foreground/[0.04] hover:text-foreground/75"
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {active && (
        <span className={`text-[7px] px-1 py-px rounded font-mono uppercase tracking-wider leading-none ${styles.badge}`}>
          ON
        </span>
      )}
    </button>
  );
}
