"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  LayoutTemplate,
  ScanLine,
  ClipboardCheck,
  Eye,
  Braces,
  Download,
  X,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { TemplatePicker } from "./template-picker";
import { createFromTemplate, TEMPLATES } from "@/lib/templates";
import { usePlanStore } from "@/store/plan-store";
import { canUseFeature, requiredPlanLabel } from "@/lib/plans";
import { toast } from "sonner";

const DISMISS_KEY = "lx-welcome-dismissed-v1";

/**
 * WelcomeOverlay — first-time discovery panel.
 *
 * Shows centred over the editor when the current document is empty AND the
 * user hasn't dismissed it. Surfaces every mode the user can take a worksheet
 * through, so a brand-new user can pick a path without reading docs.
 *
 * Modes surfaced:
 *   1. Talk to the AI agent (right panel, builds the worksheet for you)
 *   2. Pick a template (preset layouts: tests, worksheets, articles…)
 *   3. Scan an image / PDF (OMR — convert printed material to LaTeX)
 *   4. Open grading mode (rubric → AI grading → marked PDF)
 *
 * Plus a footer hint about the print-preview / source toggles in the toolbar
 * so the user can find them later.
 */
export function WelcomeOverlay() {
  const { t, locale } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const triggerOMR = useUIStore((s) => s.triggerOMR);
  const openGrading = useUIStore((s) => s.openGrading);
  const setShowPdfPanel = useUIStore((s) => s.setShowPdfPanel);

  const [dismissedSession, setDismissedSession] = useState(false);
  const [persistentDismissed, setPersistentDismissed] = useState<boolean | null>(null);

  // Read the persistent flag once on mount
  useEffect(() => {
    try {
      setPersistentDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setPersistentDismissed(false);
    }
  }, []);

  if (persistentDismissed === null) return null; // wait for mount
  if (persistentDismissed) return null;
  if (dismissedSession) return null;

  const isEmpty = !document || !document.latex || document.latex.trim().length === 0;
  if (!isEmpty) return null;

  const dismissForever = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch { /* ignore */ }
    setPersistentDismissed(true);
  };

  const startWithAI = () => {
    setDismissedSession(true);
    // Sidebar is already AI-focused by default — just let the user start typing.
    // We could focus the chat textarea here, but that lives deep in the chat
    // component tree and requires plumbing.
  };

  const startWithTemplate = (id: string) => {
    // LP:「全テンプレート利用可」は Pro+。Pro 未満が tier:"pro" を選んだら pricing へ。
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl?.tier === "pro") {
      const check = usePlanStore.getState().checkFeature("allTemplates");
      if (!check.allowed) {
        usePlanStore.getState().setShowPricing(true);
        return;
      }
    }
    setDocument(createFromTemplate(id, locale));
    setDismissedSession(true);
  };

  const startWithScan = () => {
    const check = usePlanStore.getState().checkFeature("ocr");
    if (!check.allowed) {
      toast.error(check.reason, { duration: 5000, action: { label: "アップグレード", onClick: () => usePlanStore.getState().setShowPricing(true) } });
      return;
    }
    setDismissedSession(true);
    triggerOMR();
  };

  const startWithGrading = () => {
    const check = usePlanStore.getState().checkFeature("grading");
    if (!check.allowed) {
      toast.error(check.reason, { duration: 5000, action: { label: "アップグレード", onClick: () => usePlanStore.getState().setShowPricing(true) } });
      return;
    }
    setDismissedSession(true);
    openGrading(document?.latex || "", document?.metadata.title || "");
  };

  const showPreview = () => {
    setShowPdfPanel(true);
    setDismissedSession(true);
  };

  // Pro+ 限定機能 (OMR / 採点) の視覚的ロック判定。判定根拠は canUseFeature に寄せて
  // プラン変更で即時再レンダリングされるよう、currentPlan を購読する。
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const ocrLocked = !canUseFeature(currentPlan, "ocr");
  const gradingLocked = !canUseFeature(currentPlan, "grading");
  const ocrBadge = requiredPlanLabel("ocr", locale === "en" ? "en" : "ja");
  const gradingBadge = requiredPlanLabel("grading", locale === "en" ? "en" : "ja");

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-6 overflow-auto pointer-events-none"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl shadow-foreground/10 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/40 bg-gradient-to-br from-amber-50/80 via-violet-50/50 to-sky-50/50 dark:from-amber-950/25 dark:via-violet-950/20 dark:to-sky-950/25">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground/90 leading-tight">
                {t("welcome.title")}
              </h2>
            </div>
            <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
              {t("welcome.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissedSession(true)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors shrink-0 -mr-1 -mt-1"
            title={t("welcome.dismiss")}
            aria-label={t("welcome.dismiss")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode cards grid */}
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. AI Chat */}
            <ModeCard
              accent="amber"
              icon={<Sparkles className="h-5 w-5" />}
              badge={t("welcome.card.ai.badge")}
              title={t("welcome.card.ai.title")}
              desc={t("welcome.card.ai.desc")}
              cta={t("welcome.card.ai.cta")}
              onClick={startWithAI}
            />

            {/* 2. Templates — uses the existing TemplatePicker as the action */}
            <TemplateCard
              accent="violet"
              icon={<LayoutTemplate className="h-5 w-5" />}
              badge={t("welcome.card.template.badge")}
              title={t("welcome.card.template.title")}
              desc={t("welcome.card.template.desc")}
              cta={t("welcome.card.template.cta")}
              currentId={document?.template ?? "blank"}
              onSelect={startWithTemplate}
            />

            {/* 3. Scan PDF — Pro+ */}
            <ModeCard
              accent="emerald"
              icon={<ScanLine className="h-5 w-5" />}
              badge={t("welcome.card.scan.badge")}
              title={t("welcome.card.scan.title")}
              desc={t("welcome.card.scan.desc")}
              cta={t("welcome.card.scan.cta")}
              onClick={startWithScan}
              locked={ocrLocked}
              lockedBadge={ocrBadge}
            />

            {/* 4. Grading — Pro+ */}
            <ModeCard
              accent="rose"
              icon={<ClipboardCheck className="h-5 w-5" />}
              badge={t("welcome.card.grading.badge")}
              title={t("welcome.card.grading.title")}
              desc={t("welcome.card.grading.desc")}
              cta={t("welcome.card.grading.cta")}
              onClick={startWithGrading}
              locked={gradingLocked}
              lockedBadge={gradingBadge}
            />
          </div>
        </div>

        {/* Toolbar tips */}
        <div className="px-5 pb-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <ToolbarTip
              icon={<Eye className="h-3 w-3" />}
              title={t("welcome.tip.preview.title")}
              desc={t("welcome.tip.preview.desc")}
              onClick={showPreview}
            />
            <ToolbarTip
              icon={<Braces className="h-3 w-3" />}
              title={t("welcome.tip.source.title")}
              desc={t("welcome.tip.source.desc")}
            />
            <ToolbarTip
              icon={<Download className="h-3 w-3" />}
              title={t("welcome.tip.pdf.title")}
              desc={t("welcome.tip.pdf.desc")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
          <button
            type="button"
            onClick={dismissForever}
            className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {t("welcome.dont_show")}
          </button>
          <button
            type="button"
            onClick={() => setDismissedSession(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            <span>{t("welcome.start_blank")}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

type Accent = "amber" | "violet" | "emerald" | "rose";

const ACCENT_STYLES: Record<Accent, { iconBg: string; ring: string; badge: string }> = {
  amber: {
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25",
    ring: "hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  violet: {
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-lg shadow-violet-500/25",
    ring: "hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-500/10",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  emerald: {
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/25",
    ring: "hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  rose: {
    iconBg: "bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-lg shadow-rose-500/25",
    ring: "hover:border-rose-400/50 hover:shadow-lg hover:shadow-rose-500/10",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

interface ModeCardProps {
  accent: Accent;
  icon: React.ReactNode;
  badge: string;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  /** 現プランで使えない状態。クリックは pricing 誘導に流すのでボタンは生かす。 */
  locked?: boolean;
  /** ロック時にカード右肩に表示するミニバッジ (例: "Starterプラン〜") */
  lockedBadge?: string;
}

function ModeCard({ accent, icon, badge, title, desc, cta, onClick, locked = false, lockedBadge }: ModeCardProps) {
  const style = ACCENT_STYLES[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all duration-200 ${
        locked
          ? "border-border/30 bg-foreground/[0.015] hover:border-violet-400/40 hover:bg-violet-500/[0.03]"
          : `border-border/40 bg-background hover:bg-foreground/[0.02] hover:shadow-lg ${style.ring}`
      }`}
    >
      <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${style.iconBg} ${locked ? "grayscale opacity-65" : ""}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-bold ${locked ? "text-foreground/55" : "text-foreground/90"}`}>{title}</div>
        <div className={`text-[11px] leading-snug mt-0.5 ${locked ? "text-muted-foreground/45" : "text-muted-foreground/60"}`}>{desc}</div>
      </div>
      {locked ? (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-violet-600 text-white text-[9px] font-bold shadow">
            <Lock className="h-2.5 w-2.5" />
            {lockedBadge}
          </span>
        </div>
      ) : (
        <ArrowRight className="h-4 w-4 text-foreground/20 group-hover:text-foreground/50 shrink-0 transition-all group-hover:translate-x-0.5" />
      )}
    </button>
  );
}

interface TemplateCardProps {
  accent: Accent;
  icon: React.ReactNode;
  badge: string;
  title: string;
  desc: string;
  cta: string;
  currentId: string;
  onSelect: (id: string) => void;
}

function TemplateCard({ accent, icon, badge, title, desc, cta, currentId, onSelect }: TemplateCardProps) {
  const style = ACCENT_STYLES[accent];
  return (
    <div
      className={`group relative flex items-start gap-3.5 p-4 rounded-xl border border-border/40 bg-background hover:bg-foreground/[0.02] text-left transition-all duration-200 hover:shadow-lg ${style.ring}`}
    >
      <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${style.iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-foreground/90">{title}</div>
        <div className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5 mb-2">{desc}</div>
        <TemplatePicker currentId={currentId} onSelect={onSelect} label={cta} />
      </div>
    </div>
  );
}

interface ToolbarTipProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick?: () => void;
}

function ToolbarTip({ icon, title, desc, onClick }: ToolbarTipProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border border-border/30 bg-background text-left ${
        onClick ? "hover:border-border/60 hover:bg-foreground/[0.03] transition-colors cursor-pointer" : ""
      }`}
    >
      <div className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-foreground/55 bg-foreground/[0.05]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-foreground/85">{title}</div>
        <div className="text-[10px] text-muted-foreground/65 leading-snug">{desc}</div>
      </div>
    </Tag>
  );
}
