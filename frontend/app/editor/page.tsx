"use client";

import { AppHeader } from "@/components/layout/app-header";
import { EditToolbar } from "@/components/layout/edit-toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { PricingModal } from "@/components/pricing-modal";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useResizePanel } from "@/hooks/use-resize-panel";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createDefaultDocument } from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";
import { Sparkles, Globe, FileText, ClipboardCheck, ScanLine, Eye, Braces, PenTool } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { OMRSplitView } from "@/components/omr/omr-split-view";
import { GradingMode } from "@/components/grading/grading-mode";
import { FigureEditor } from "@/components/figure-editor/figure-editor";
import { usePlanStore } from "@/store/plan-store";
import { PLANS } from "@/lib/plans";
import { toast } from "sonner";
import { verifyCheckoutSession } from "@/lib/subscription-api";
import { sendPurchaseEvent } from "@/lib/gtag";
import type { PlanId } from "@/lib/plans";

type SidebarTab = "ai";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const showPdfPanel = useUIStore((s) => s.showPdfPanel);
  const showSourcePanel = useUIStore((s) => s.showSourcePanel);
  const togglePdfPanel = useUIStore((s) => s.togglePdfPanel);
  const toggleSourcePanel = useUIStore((s) => s.toggleSourcePanel);
  const triggerOMR = useUIStore((s) => s.triggerOMR);
  const openGrading = useUIStore((s) => s.openGrading);
  const closeGrading = useUIStore((s) => s.closeGrading);
  const gradingMode = useUIStore((s) => s.gradingMode);
  const figureEditorMode = useUIStore((s) => s.figureEditorMode);
  const openFigureEditor = useUIStore((s) => s.openFigureEditor);
  const isMobile = useIsMobile();

  const doc = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");
  const { width: sidebarWidth, isDragging, handleMouseDown } = useResizePanel();

  const [mobileTab, setMobileTab] = useState<"ai" | "preview">("ai");

  // ── URL パラメータを同期的に検出（レンダー中に確定、effect より前） ──
  const skipRedirect = useRef(false);
  if (typeof window !== "undefined" && !skipRedirect.current) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" || params.get("new") === "1") {
      skipRedirect.current = true;
    }
  }

  // Handle ?new=1 from login redirect — create blank document
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1" && !doc) {
      setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
      window.history.replaceState({}, "", "/editor");
    }
  }, [doc, setDocument]);

  // Handle ?checkout=success — Stripe / Free 登録からの復帰
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    const planParam = params.get("plan") || "";
    // Stripe が success_url に埋め込んだ session ID (cs_xxx)。Free プランは無い。
    const sessionId = params.get("session_id") || "";

    // 診断は console のみ (ユーザーには見せない)。問題発生時は DevTools で追える。
    const log = (msg: string, data?: unknown) => {
      if (data !== undefined) console.info(`[checkout-flow] ${msg}`, data);
      else console.info(`[checkout-flow] ${msg}`);
    };
    log("reached /editor", { plan: planParam, sessionId: sessionId.slice(0, 20) });

    // 1. ドキュメントを即座に作成
    if (!useDocumentStore.getState().document) {
      useDocumentStore.getState().setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
    }

    // 2. URL をクリーン (session_id を露出させない)
    window.history.replaceState({}, "", "/editor");

    // 3. verify → backend で DB upsert → GA4 purchase。upsert 成功が分かった時点で
    //    楽観的にストアを更新して UI を即反映させる (fetchSubscription の確認は後追い)。
    const verifyPromise: Promise<void> = (planParam !== "free" && sessionId)
      ? (async () => {
          const v = await verifyCheckoutSession(sessionId);
          if (!v) {
            console.error("[checkout-flow] verify returned null");
            return;
          }
          log("verify response", v);

          // upsert が成功した = DB に行ができた → ストアを即更新
          if (v.upsert?.success && v.plan_id) {
            usePlanStore.getState().setPlan(v.plan_id as PlanId);
            log("optimistic plan set from verify upsert", { plan: v.plan_id });
          } else if (v.upsert && !v.upsert.success) {
            console.error("[checkout-flow] upsert failed", v.upsert);
          }

          const acceptable = v.paid || v.payment_status === "no_payment_required";
          if (!acceptable || !v.currency || !v.transaction_id) return;

          const planDef = PLANS[v.plan_id as PlanId];
          await sendPurchaseEvent({
            transactionId: v.transaction_id,
            value: v.value,
            currency: v.currency,
            items: [
              {
                item_id: v.plan_id || "subscription",
                item_name: planDef?.name || v.plan_id || "Subscription",
                item_category: "subscription",
                price: v.value,
                quantity: 1,
              },
            ],
          });
        })()
      : Promise.resolve();

    // 4. 確認のため fetchSubscription。まだ Free なら /sync → 再 fetch。
    //    楽観更新済みなので UI はすでに正しく出ているはず。これは authoritative 確認。
    const fetchWithRetry = async (retries: number): Promise<string> => {
      const { fetchSubscription } = usePlanStore.getState();
      await fetchSubscription();
      const { currentPlan } = usePlanStore.getState();
      if (planParam === "free") return currentPlan;
      if (currentPlan === "free" && retries > 0) {
        try {
          await fetch("/api/subscription/sync", { method: "POST", cache: "no-store" });
        } catch { /* next retry handles it */ }
        await new Promise((r) => setTimeout(r, 1000));
        return fetchWithRetry(retries - 1);
      }
      return currentPlan;
    };

    verifyPromise.then(() => fetchWithRetry(5)).then((plan) => {
      const planDef = PLANS[plan as keyof typeof PLANS];
      const planName = plan !== "free" ? planDef?.name || plan : "Free";
      if (planParam !== "free" && plan === "free") {
        // ユーザーには障害として通知 (これは本当の問題なので toast を出す)
        toast.error(
          locale === "en"
            ? "Purchase was processed but plan activation is delayed. Please reload in a moment."
            : "購入は完了しましたがプラン反映が遅延しています。数秒後にリロードしてください。",
          { duration: 8000 },
        );
      } else {
        toast.success(
          locale === "en"
            ? `${planName} plan activated!`
            : `${planName} プランが有効になりました！`,
          { duration: 5000 },
        );
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // doc がない場合は LP へ（ただし checkout/new リダイレクト中はスキップ）
  useEffect(() => {
    if (skipRedirect.current) return;
    if (!doc) router.push("/");
  }, [doc, router]);

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(15000) }).catch(() => {});
  }, []);

  // 採点モードに入ったらサイドバーを閉じる（全 Hook は early return より前に置く）
  useEffect(() => {
    if (gradingMode) {
      setSidebarOpen(false);
    }
  }, [gradingMode]);

  const isAIActive = !gradingMode && (sidebarOpen && activeTab === "ai") || isChatLoading;

  if (!doc) return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-surface-0 overflow-hidden animate-page-fade-in">
      <div className="flex items-center gap-3 px-3 h-12 border-b border-border/40 bg-background/80 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-muted animate-skeleton-pulse" />
        <div className="h-5 w-24 rounded bg-muted animate-skeleton-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-24 rounded-full bg-muted animate-skeleton-pulse" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col items-center py-10">
          <div className="w-[700px] max-w-full space-y-4 px-4">
            <div className="h-8 w-2/3 rounded bg-muted animate-skeleton-pulse" />
            <div className="h-4 w-full rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-4 w-5/6 rounded bg-muted/60 animate-skeleton-pulse" />
            <div className="h-20 w-full rounded-lg bg-muted/40 animate-skeleton-pulse mt-6" />
          </div>
        </div>
        <div className="w-11 border-l border-foreground/[0.04] bg-background/50 dark:bg-surface-0/60" />
      </div>
      <div className="h-6 bg-surface-1 dark:bg-surface-0 border-t border-border/30" />
    </div>
  );

  const handleTabClick = (tab: SidebarTab) => {
    if (sidebarOpen && activeTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveTab(tab);
    }
  };

  /* ══════════ MOBILE ══════════ */
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        <header className="flex items-center gap-2 px-3 h-12 border-b shrink-0 transition-colors duration-300 border-border/20 bg-background">
          <button
            onClick={() => router.push("/")}
            className="text-muted-foreground/60 p-1.5 -ml-1 rounded"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 text-sm font-medium text-foreground/70 truncate">
            {doc.metadata.title || t("header.untitled")}
          </span>
          <button
            onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground border border-border/30 hover:bg-muted/40 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="uppercase font-mono">{locale === "ja" ? "JA" : "EN"}</span>
          </button>
          {isChatLoading && <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />}
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === "ai" ? (
            <div className="h-full overflow-hidden flex flex-col"><AIChatPanel /></div>
          ) : (
            <div className="h-full overflow-auto"><DocumentEditor /></div>
          )}
        </div>

        <PricingModal />
        <div className="flex border-t border-border/20 bg-background/95 backdrop-blur-sm shrink-0">
          {(["ai", "preview"] as const).map((tab) => {
            const isActive = mobileTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  isActive
                    ? tab === "ai" ? "text-violet-500 dark:text-violet-400" : "text-sky-500 dark:text-sky-400"
                    : "text-muted-foreground/50"
                }`}
              >
                {tab === "ai" ? <Sparkles className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                <span>{tab === "ai" ? t("mobile.tab.ai") : t("mobile.tab.preview")}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ══════════ DESKTOP ══════════ */

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f4f0] dark:bg-[#111110]">
      <OMRSplitView />
      {figureEditorMode && <FigureEditor />}

      <AppHeader isAIActive={isAIActive} />

      {!gradingMode && <EditToolbar />}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden min-w-0 relative">
          {gradingMode ? (
            <GradingMode />
          ) : (
            <DocumentEditor />
          )}
        </div>

        {sidebarOpen && (
          <div
            className={`resize-handle ${isDragging ? "is-dragging" : ""}`}
            onMouseDown={handleMouseDown}
          />
        )}

        <div className="flex flex-shrink-0 sidebar-card bg-[#f9f9f8] dark:bg-[#111110] overflow-hidden shadow-[-1px_0_0_0_hsl(var(--border)/0.4)]">
          <div
            className="overflow-hidden flex flex-col panel-depth"
            style={{
              width: sidebarOpen ? sidebarWidth : 0,
              transition: isDragging ? "none" : "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {sidebarOpen && (
              <div className="h-full flex flex-col min-w-0" style={{ width: sidebarWidth }}>
                <div className="flex-1 min-h-0 animate-slide-in-right overflow-hidden flex flex-col" key={activeTab}>
                  <AIChatPanel />
                </div>
              </div>
            )}
          </div>

          <div className="activity-bar w-[68px] flex flex-col items-stretch pt-2 pb-2 gap-0.5 border-l border-foreground/[0.05] bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
            {/* AI Chat — 採点モード中は無効 */}
            {(() => {
              const isActive = !gradingMode && sidebarOpen && activeTab === "ai";
              return (
                <ActivityBtn
                  active={isActive}
                  accent="amber"
                  icon={<Sparkles className={isActive ? "h-[15px] w-[15px] text-white" : "h-[17px] w-[17px]"} />}
                  label={t("side.label.ai")}
                  onClick={() => { if (!gradingMode) handleTabClick("ai"); }}
                  title={gradingMode ? "" : t("side.tooltip.ai")}
                  badge={isChatLoading}
                  disabled={gradingMode}
                />
              );
            })()}

            {/* Scan / OMR — Starter+ のみ。Free はアップグレード促進。 */}
            <ActivityBtn
              accent="emerald"
              icon={<ScanLine className="h-[17px] w-[17px]" />}
              label={t("side.label.scan")}
              onClick={() => {
                const check = usePlanStore.getState().checkFeature("ocr");
                if (!check.allowed) {
                  toast.error(check.reason, {
                    duration: 5000,
                    action: {
                      label: locale === "en" ? "Upgrade" : "アップグレード",
                      onClick: () => usePlanStore.getState().setShowPricing(true),
                    },
                  });
                  return;
                }
                triggerOMR();
              }}
              title={t("side.tooltip.scan")}
              disabled={gradingMode}
            />

            {/* Figure Editor — 図エディタ */}
            <ActivityBtn
              accent="teal"
              active={figureEditorMode}
              icon={<PenTool className={figureEditorMode ? "h-[15px] w-[15px] text-white" : "h-[17px] w-[17px]"} />}
              label={t("side.label.figure")}
              onClick={openFigureEditor}
              title={t("side.tooltip.figure")}
              disabled={gradingMode}
            />

            {/* Grading — 採点モード時は光る。Starter+ のみ。 */}
            <ActivityBtn
              accent="rose"
              active={gradingMode}
              icon={<ClipboardCheck className={gradingMode ? "h-[15px] w-[15px] text-white" : "h-[17px] w-[17px]"} />}
              label={t("side.label.grading")}
              onClick={() => {
                // Toggle: if already grading → cancel; otherwise open
                if (gradingMode) {
                  closeGrading();
                  return;
                }
                const check = usePlanStore.getState().checkFeature("grading");
                if (!check.allowed) {
                  toast.error(check.reason, {
                    duration: 5000,
                    action: {
                      label: locale === "en" ? "Upgrade" : "アップグレード",
                      onClick: () => usePlanStore.getState().setShowPricing(true),
                    },
                  });
                  return;
                }
                openGrading(doc.latex, doc.metadata.title || "");
              }}
              title={t("side.tooltip.grading")}
              pulse={gradingMode}
            />

            <div className="h-px bg-foreground/[0.06] mx-2 my-1" />

            {/* PDF preview toggle */}
            <ActivityBtn
              accent="sky"
              active={showPdfPanel}
              icon={<Eye className={showPdfPanel ? "h-[16px] w-[16px] text-white" : "h-[16px] w-[16px]"} />}
              label={t("side.label.preview")}
              onClick={togglePdfPanel}
              title={t("side.tooltip.preview")}
            />

            {/* LaTeX source toggle */}
            <ActivityBtn
              accent="violet"
              active={showSourcePanel}
              icon={<Braces className={showSourcePanel ? "h-[16px] w-[16px] text-white" : "h-[16px] w-[16px]"} />}
              label={t("side.label.source")}
              onClick={toggleSourcePanel}
              title={t("side.tooltip.source")}
            />

            <div className="flex-1" />

            {/* Locale toggle */}
            <button
              onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
              title={locale === "ja" ? t("side.tooltip.lang.toEn") : t("side.tooltip.lang.toJa")}
              className="mx-1 mt-1 h-11 flex flex-col items-center justify-center gap-0.5 rounded-lg text-foreground/30 hover:text-foreground/70 hover:bg-foreground/[0.05] transition-all duration-200"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[8.5px] font-mono uppercase tracking-wider font-semibold">
                {locale === "ja" ? "JA" : "EN"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <StatusBar />
      <PricingModal />
    </div>
  );
}

// ─── Activity bar button (icon + label) ────────────────────────

type ActivityAccent = "amber" | "emerald" | "rose" | "sky" | "violet" | "teal";

const ACCENT_CLASSES: Record<ActivityAccent, { active: string; hover: string; text: string }> = {
  amber: {
    active: "bg-gradient-to-br from-amber-500 to-amber-600 shadow-md shadow-amber-500/30",
    hover: "hover:text-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  emerald: {
    active: "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30",
    hover: "hover:text-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    active: "bg-gradient-to-br from-rose-500 to-rose-600 shadow-md shadow-rose-500/30",
    hover: "hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
  },
  sky: {
    active: "bg-gradient-to-br from-sky-500 to-sky-600 shadow-md shadow-sky-500/30",
    hover: "hover:text-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
  },
  violet: {
    active: "bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/30",
    hover: "hover:text-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
  },
  teal: {
    active: "bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-500/30",
    hover: "hover:text-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
  },
};

interface ActivityBtnProps {
  accent: ActivityAccent;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
  active?: boolean;
  badge?: boolean;
  disabled?: boolean;
  pulse?: boolean;
}

function ActivityBtn({ accent, icon, label, onClick, title, active = false, badge = false, disabled = false, pulse = false }: ActivityBtnProps) {
  const style = ACCENT_CLASSES[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`relative mx-1 h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all duration-200 ${
        disabled && !active
          ? "text-foreground/15 cursor-not-allowed"
          : active
          ? `${style.text} bg-foreground/[0.04]`
          : `text-foreground/35 ${style.hover}`
      }`}
    >
      {active ? (
        <div className={`h-7 w-7 rounded-full ${style.active} flex items-center justify-center ${pulse ? "animate-pulse" : ""}`}>
          {icon}
        </div>
      ) : (
        <div className="h-7 w-7 flex items-center justify-center">{icon}</div>
      )}
      <span className="text-[9px] font-medium leading-none tracking-tight">{label}</span>
      {badge && (
        <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
    </button>
  );
}
