"use client";

/**
 * EditToolbar — テンプレ選択・PDF出力・OMR取り込み・補助パネル切替。
 * raw LaTeX 駆動だが、ユーザーには LaTeX という単語を出さない。
 */

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { generatePDF } from "@/lib/api";
import { createFromTemplate } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { TemplatePicker } from "@/components/editor/template-picker";
import {
  Download,
  ScanLine,
  FileText,
  Loader2,
  ChevronDown,
  Sliders,
  Eye,
  Braces,
} from "lucide-react";

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
  const showSourcePanel = useUIStore((s) => s.showSourcePanel);
  const showPdfPanel = useUIStore((s) => s.showPdfPanel);
  const toggleSourcePanel = useUIStore((s) => s.toggleSourcePanel);
  const togglePdfPanel = useUIStore((s) => s.togglePdfPanel);
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

      {/* ── テンプレート選択 (カテゴリ別カードグリッド) ── */}
      <TemplatePicker
        currentId={document?.template ?? "blank"}
        onSelect={handleTemplateChange}
        label={t("edit.toolbar.template.label")}
      />

      <div className="flex-1" />

      {/* ── 補助ビュー (オーバーフロー) ── */}
      <ViewToolsMenu
        showSourcePanel={showSourcePanel}
        showPdfPanel={showPdfPanel}
        onToggleSource={toggleSourcePanel}
        onTogglePdf={togglePdfPanel}
        label={t("edit.toolbar.tools.label")}
        sourceLabel={t("edit.toolbar.tools.source")}
        sourceDesc={t("edit.toolbar.tools.source.desc")}
        pdfLabel={t("edit.toolbar.tools.pdf")}
        pdfDesc={t("edit.toolbar.tools.pdf.desc")}
      />

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

// ─────────────────────────────────────
// ViewToolsMenu — 補助パネル切替 (LaTeX という単語を表に出さない)
// ─────────────────────────────────────

interface ViewToolsMenuProps {
  showSourcePanel: boolean;
  showPdfPanel: boolean;
  onToggleSource: () => void;
  onTogglePdf: () => void;
  label: string;
  sourceLabel: string;
  sourceDesc: string;
  pdfLabel: string;
  pdfDesc: string;
}

function ViewToolsMenu({
  showSourcePanel,
  showPdfPanel,
  onToggleSource,
  onTogglePdf,
  label,
  sourceLabel,
  sourceDesc,
  pdfLabel,
  pdfDesc,
}: ViewToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // open 時にトリガー位置を計算 (viewport 座標。position: fixed で配置するので)
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // 外側クリック / Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anyActive = showSourcePanel || showPdfPanel;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-all duration-150 active:scale-[0.97] ${
          anyActive
            ? "bg-foreground/[0.06] border-foreground/[0.18] text-foreground/85"
            : "bg-transparent border-foreground/[0.10] text-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground/80"
        }`}
        title={label}
      >
        <Sliders className="h-3 w-3 shrink-0" />
        <span className="hidden md:inline">{label}</span>
        <ChevronDown className={`h-3 w-3 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="fixed w-[280px] rounded-xl border border-border/60 bg-popover shadow-2xl shadow-foreground/20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ top: pos.top, right: pos.right, zIndex: 9999 }}
        >
          <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {label}
            </div>
          </div>
          <div className="py-1">
            <ToolToggleRow
              icon={Eye}
              label={pdfLabel}
              desc={pdfDesc}
              active={showPdfPanel}
              onClick={() => {
                onTogglePdf();
                setOpen(false);
              }}
            />
            <ToolToggleRow
              icon={Braces}
              label={sourceLabel}
              desc={sourceDesc}
              active={showSourcePanel}
              onClick={() => {
                onToggleSource();
                setOpen(false);
              }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

interface ToolToggleRowProps {
  icon: React.ElementType;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}

function ToolToggleRow({ icon: Icon, label, desc, active, onClick }: ToolToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/[0.04] transition-colors"
    >
      <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border ${
        active
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          : "bg-foreground/[0.04] border-foreground/[0.08] text-foreground/55"
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-foreground/90">{label}</span>
          {active && (
            <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-wider">
              ON
            </span>
          )}
        </div>
        <div className="text-[10.5px] text-muted-foreground/70 mt-0.5 leading-snug">
          {desc}
        </div>
      </div>
    </button>
  );
}
