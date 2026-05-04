"use client";

import { AppHeader } from "@/components/layout/app-header";
import { EditToolbar } from "@/components/layout/edit-toolbar";
import { StatusBar } from "@/components/layout/status-bar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";
import { MobilePdfPreview } from "@/components/editor/mobile-pdf-preview";
import { PricingModal } from "@/components/pricing-modal";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useResizePanel } from "@/hooks/use-resize-panel";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { createDefaultDocument } from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";
import { hasUsedAnonymousTrial } from "@/lib/anonymous-trial";
import { trackGuestEditorOpen, trackGuestSignupClick } from "@/lib/gtag";
import { Sparkles, Globe, FileText, ClipboardCheck, ScanLine, Eye, Braces, PenTool, Lock, MoreVertical, Plus, ChevronLeft, Trash2, Crown, PanelLeft, SquarePen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { OMRSplitView } from "@/components/omr/omr-split-view";
import { GradingMode } from "@/components/grading/grading-mode";
import { FigureEditor } from "@/components/figure-editor/figure-editor";
import { VariantStudio } from "@/components/editor/variant-studio";
import { usePlanStore } from "@/store/plan-store";
import { PLANS, canUseFeature, requiredPlanFor } from "@/lib/plans";
import { toast } from "sonner";
import { verifyCheckoutSession } from "@/lib/subscription-api";
import { sendPurchaseEvent } from "@/lib/gtag";
import type { PlanId } from "@/lib/plans";

type SidebarTab = "ai";

/**
 * LP の「無料で1枚作る」プロンプト入力 CTA から来たときに、sessionStorage に
 * 預けられた prompt を ui-store の pendingChatMessage にコピーして消費する。
 * AI チャット側が pendingChatMessage を購読していて、見つけたら自動で送信する仕組み。
 * 何度も流し込まないよう、必ず読み出し直後に sessionStorage をクリアする。
 */
function consumeLpInitialPrompt() {
  if (typeof window === "undefined") return;
  let prompt: string | null = null;
  try { prompt = sessionStorage.getItem("lp_initial_prompt"); } catch { return; }
  if (!prompt) return;
  try { sessionStorage.removeItem("lp_initial_prompt"); } catch { /* ignore */ }
  const trimmed = prompt.trim();
  if (!trimmed) return;
  useUIStore.getState().setPendingChatMessage(trimmed);
}

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const { locale, setLocale, t } = useI18n();
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const showPdfPanel = useUIStore((s) => s.showPdfPanel);
  const showSourcePanel = useUIStore((s) => s.showSourcePanel);
  const showVisualPanel = useUIStore((s) => s.showVisualPanel);
  const togglePdfPanel = useUIStore((s) => s.togglePdfPanel);
  const toggleSourcePanel = useUIStore((s) => s.toggleSourcePanel);
  const toggleVisualPanel = useUIStore((s) => s.toggleVisualPanel);
  const triggerOMR = useUIStore((s) => s.triggerOMR);
  const openOMR = useUIStore((s) => s.openOMR);
  const setOMRTrigger = useUIStore((s) => s.setOMRTrigger);
  const openGrading = useUIStore((s) => s.openGrading);
  const closeGrading = useUIStore((s) => s.closeGrading);
  const gradingMode = useUIStore((s) => s.gradingMode);
  const figureEditorMode = useUIStore((s) => s.figureEditorMode);
  const openFigureEditor = useUIStore((s) => s.openFigureEditor);
  const isMobile = useIsMobile();

  const doc = useDocumentStore((s) => s.document);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const syncPaperSizeFromLatex = useUIStore((s) => s.syncPaperSizeFromLatex);
  const router = useRouter();

  // テンプレートや AI 編集でドキュメントが変わったとき、
  // LaTeX ソースの \documentclass[...] にある paper option を UI に反映する。
  useEffect(() => {
    syncPaperSizeFromLatex();
  }, [doc?.template, doc?.latex, syncPaperSizeFromLatex]);

  // プラン状態を購読 — Activity bar の OMR / 採点 / LaTeXソース ボタンを
  // 使えないプランでは視覚的にロック表示する (クリックは pricing 誘導に回す)。
  // `currentPlan` の変化で再レンダリングされるよう、subscribe してから canUseFeature で判定する。
  const currentPlan = usePlanStore((s) => s.currentPlan);
  // ゲスト (ログインなしお試し) は OMR / 採点 / LaTeX エクスポートも全部ロック扱いにする。
  // プラン判定は currentPlan が初期値 "free" のままなのでロック判定はそもそも true だが、
  // 将来 free に解禁された場合でもゲストはロックを維持したいので明示的に OR を取る。
  const _guestLocks = useUIStore((s) => s.isGuest);
  const ocrLocked = _guestLocks || !canUseFeature(currentPlan, "ocr");
  const gradingLocked = _guestLocks || !canUseFeature(currentPlan, "grading");
  const latexExportLocked = _guestLocks || !canUseFeature(currentPlan, "latexExport");
  // 必要プラン名を動的に (OMR/採点は Pro に昇格したので、tooltip も Pro を指すようにする)
  const ocrRequired = PLANS[requiredPlanFor("ocr")].name;
  const gradingRequired = PLANS[requiredPlanFor("grading")].name;
  const latexExportRequired = PLANS[requiredPlanFor("latexExport")].name;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("ai");
  const { width: sidebarWidth, isDragging, handleMouseDown } = useResizePanel();

  // ── 読み取り (OMR) モード起動用ファイル入力 ──────────────────────────────
  // サイドバーの「読み取り」ボタン・Welcome/Quick-start の「ファイルから読み込む」は
  // すべて useUIStore.triggerOMR() 経由で、この hidden <input> の click() を叩く。
  // ユーザがファイルを選ぶと openOMR(url, name) を呼び、<OMRSplitView /> がフル画面で
  // 立ち上がり、解析完了後に抽出 LaTeX でドキュメントを上書きする。
  // チャットには一切流さない。
  const omrFileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setOMRTrigger(() => omrFileInputRef.current?.click());
    return () => setOMRTrigger(null);
  }, [setOMRTrigger]);

  const handleOMRFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを連続選択できるよう入力値をリセット
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    openOMR(url, file.name);
  };

  const [mobileTab, setMobileTab] = useState<"ai" | "preview">("ai");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── URL パラメータを同期的に検出（レンダー中に確定、effect より前） ──
  const skipRedirect = useRef(false);
  if (typeof window !== "undefined" && !skipRedirect.current) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" || params.get("new") === "1" || params.get("guest") === "1") {
      skipRedirect.current = true;
    }
  }

  // ── ゲストモード (?guest=1) ────────────────────────────────────
  // 「無料で1枚作ってみる」CTA から来た未ログインユーザは、ログインせずに
  // AI 1 回 + プレビュー編集ができる。session が確立されたらゲストモードを解く。
  const session = useSession();
  const isGuest = useUIStore((s) => s.isGuest);
  const guestTrialUsed = useUIStore((s) => s.guestTrialUsed);
  const setGuest = useUIStore((s) => s.setGuest);
  const setGuestTrialUsed = useUIStore((s) => s.setGuestTrialUsed);

  // ?guest=1 で来たら ui-store のゲストフラグを立てる + 空ドキュメントを用意。
  // すでに別タブで login 済みなら通常モードに遷移させる。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("guest") !== "1") return;

    // 認証済みならゲスト遷移はキャンセル → 通常エディタに任せる
    if (session.status === "authenticated") {
      setGuest(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("guest");
      window.history.replaceState({}, "", url.pathname + url.search);
      return;
    }

    setGuest(true);
    setGuestTrialUsed(hasUsedAnonymousTrial());
    if (!useDocumentStore.getState().document) {
      useDocumentStore.getState().setDocument(
        createDefaultDocument("blank", getTemplateLatex("blank")),
      );
    }
    // LP プロンプト入力 CTA から渡された prompt を AI チャットに流し込む。
    // 入力が空でも CTA を押せるので、値があるときだけ実行する。
    consumeLpInitialPrompt();
    // GA4: ゲストエディタに到着した瞬間を計測。CTA クリック数との比で
    // ナビゲーション失敗 (回線断 / blocker / 履歴戻り) の歩留まりを把握する。
    trackGuestEditorOpen();
  }, [session.status, setGuest, setGuestTrialUsed]);

  // ログイン成立を検知したら自動でゲストモード解除
  useEffect(() => {
    if (session.status === "authenticated" && isGuest) {
      setGuest(false);
    }
  }, [session.status, isGuest, setGuest]);

  // Handle ?new=1 from login redirect — create blank document
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1" && !doc) {
      setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
      window.history.replaceState({}, "", "/editor");
      // ログイン済みで LP プロンプト入力 CTA から来た場合の prompt を流し込む。
      consumeLpInitialPrompt();
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

  // doc がない場合は LP へ（ただし checkout/new/guest リダイレクト中はスキップ）。
  //
  // skipRedirect.current は render 内で同期的に立てているが、React 19 の
  // Strict / NextAuth の SessionProvider が status="loading" → "unauthenticated"
  // 移行で再レンダー → setDocument 反映前のタイミングで先にこの effect が回ると
  // doc=null のまま LP へ蹴られていた (= 1 回目だけ LP に戻る症状)。
  //
  // 防御を 3 段にする:
  //   1) skipRedirect.current ref (render 内で設定)
  //   2) URL に ?guest=1 / ?new=1 / ?checkout=success が乗っているか毎回再チェック
  //   3) ui-store.isGuest が立っている間は無条件で残す
  useEffect(() => {
    if (skipRedirect.current) return;
    if (isGuest) return;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("guest") === "1" || p.get("new") === "1" || p.get("checkout") === "success") {
        skipRedirect.current = true;
        return;
      }
    }
    if (!doc) router.push("/");
  }, [doc, router, isGuest]);

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

  /* ══════════ MOBILE (ChatGPT モバイル風) ══════════
     - スリムなヘッダー (戻る + タイトル + 新規チャット + ⋮ メニュー)
     - 下部に大きめ 56px tab bar + safe-area 対応
     - ⋮ メニュー: 言語切替 / クリア / OCR / アップグレード
     - PC は完全に維持 */
  if (isMobile) {
    const planNameDisplay = PLANS[currentPlan]?.name || "Free";
    const handleNewChat = () => {
      const ok = (typeof window !== "undefined")
        ? window.confirm(locale === "en" ? "Start a new chat? Current chat history will be cleared." : "新しいチャットを開始しますか? 現在のチャット履歴は削除されます。")
        : true;
      if (!ok) return;
      useUIStore.getState().clearChat();
      try { localStorage.removeItem("latex-gui-chat-v3"); } catch { /* ignore */ }
      setMobileTab("ai");
    };
    return (
      <div className="flex h-[100dvh] flex-col bg-background overflow-hidden">
        {/* ヘッダー — ChatGPT モバイル風:
            AI 画面: [≡ メニュー] [Eddivom pill] ... [✏︎ 新規] [⋮]
            プレビュー画面: [‹ 戻る] [タイトル] ... [⋮] */}
        <header
          className="flex items-center gap-1 px-2 h-12 shrink-0 transition-colors duration-300 bg-background"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {mobileTab === "ai" ? (
            <>
              {/* ≡ メニュートグル — 添付シート/履歴 (現状はメニューを兼ねる) */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label={locale === "en" ? "Menu" : "メニュー"}
                className="h-10 w-10 flex items-center justify-center rounded-full text-foreground/85 hover:bg-foreground/[0.06] active:scale-95 transition"
              >
                <PanelLeft className="h-5 w-5" strokeWidth={1.8} />
              </button>
              {/* 中央 pill タイトル — Eddivom ブランド: 常時 amber ドット + AI active 中は underline がパルス */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={`relative inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5 border border-amber-300/40 dark:border-amber-500/30 hover:border-amber-400/60 active:scale-[0.98] transition shadow-sm shadow-amber-500/10 ${
                  isChatLoading ? "eddivom-pill-active" : ""
                }`}
                aria-label="Eddivom"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  style={{ boxShadow: "0 0 6px rgba(245, 158, 11, 0.6)" }}
                  aria-hidden
                />
                <span className="text-[15px] font-semibold tracking-tight bg-gradient-to-r from-amber-700 to-orange-700 dark:from-amber-300 dark:to-orange-300 bg-clip-text text-transparent">
                  Eddivom
                </span>
              </button>
              <div className="flex-1" />
              {/* ✏︎ 新規チャット */}
              <button
                onClick={handleNewChat}
                aria-label={locale === "en" ? "New chat" : "新規チャット"}
                title={locale === "en" ? "New chat" : "新規チャット"}
                className="h-10 w-10 flex items-center justify-center rounded-full text-foreground/85 hover:bg-foreground/[0.06] active:scale-95 transition"
              >
                <SquarePen className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label={locale === "en" ? "Menu" : "メニュー"}
                className="h-10 w-10 flex items-center justify-center rounded-full text-foreground/65 hover:bg-foreground/[0.06] active:scale-95 transition"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              {/* プレビューモード: ‹ で AI チャットへ */}
              <button
                onClick={() => setMobileTab("ai")}
                aria-label={locale === "en" ? "Back to chat" : "チャットへ戻る"}
                className="h-10 w-10 flex items-center justify-center rounded-full text-foreground/85 hover:bg-foreground/[0.06] active:scale-95 transition"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-sky-500 shrink-0" />
                <span className="text-[14.5px] font-semibold text-foreground/85 truncate">
                  {doc.metadata.title || t("header.untitled")}
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label={locale === "en" ? "Menu" : "メニュー"}
                className="h-10 w-10 flex items-center justify-center rounded-full text-foreground/65 hover:bg-foreground/[0.06] active:scale-95 transition"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </>
          )}
        </header>

        {/* メイン: AI チャット or PDF プレビュー */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {mobileTab === "ai" ? (
            <div className="h-full overflow-hidden flex flex-col">
              <AIChatPanel onOpenPreview={() => setMobileTab("preview")} />
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <MobilePdfPreview onOpenChat={() => setMobileTab("ai")} />
            </div>
          )}

          {/* プレビュー FAB は AIChatPanel 内 (Composer の直上) に配置するので、
              ここでは出さない。Safari の URL バーと干渉しないようにするため。 */}
        </div>

        <PricingModal />

        {/* ⋮ メニュー (bottom sheet) */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-page-fade-in"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden
            />
            <div
              className="fixed left-0 right-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-2xl border-t border-border/40 animate-in slide-in-from-bottom duration-200"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex justify-center pt-2 pb-1">
                <span className="h-1 w-10 rounded-full bg-foreground/15" />
              </div>
              <div className="px-4 pt-1 pb-2 flex items-center gap-2">
                <span className="text-[15px] font-bold text-foreground/85">
                  {locale === "en" ? "Menu" : "メニュー"}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10.5px] font-bold uppercase tracking-wider">
                  <Crown className="h-3 w-3" />
                  {planNameDisplay}
                </span>
              </div>
              <div className="px-2 pb-1 flex flex-col">
                {/* Language toggle */}
                <button
                  type="button"
                  onClick={() => { setLocale(locale === "ja" ? "en" : "ja"); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground/85 hover:bg-foreground/[0.06] active:scale-[0.99] transition"
                >
                  <span className="h-9 w-9 rounded-full bg-foreground/[0.05] flex items-center justify-center">
                    <Globe className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left text-[14px] font-medium">
                    {locale === "en" ? "Switch to Japanese" : "英語に切り替え"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/60 uppercase">
                    {locale === "ja" ? "JA → EN" : "EN → JA"}
                  </span>
                </button>

                {/* Scan / OCR */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
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
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground/85 hover:bg-foreground/[0.06] active:scale-[0.99] transition"
                >
                  <span className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <ScanLine className="h-4 w-4 text-emerald-600" />
                  </span>
                  <span className="flex-1 text-left text-[14px] font-medium">
                    {locale === "en" ? "Scan PDF or image" : "PDF / 画像を読み取る"}
                  </span>
                  {ocrLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
                </button>

                {/* Clear chat */}
                <button
                  type="button"
                  onClick={() => {
                    const ok = window.confirm(locale === "en" ? "Clear chat history?" : "チャット履歴を消去しますか?");
                    if (!ok) return;
                    useUIStore.getState().clearChat();
                    try { localStorage.removeItem("latex-gui-chat-v3"); } catch { /* ignore */ }
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground/85 hover:bg-rose-50 dark:hover:bg-rose-500/15 active:scale-[0.99] transition"
                >
                  <span className="h-9 w-9 rounded-full bg-rose-500/15 flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </span>
                  <span className="flex-1 text-left text-[14px] font-medium">
                    {locale === "en" ? "Clear chat history" : "チャット履歴を消去"}
                  </span>
                </button>

                {/* Upgrade */}
                {currentPlan === "free" && (
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); usePlanStore.getState().setShowPricing(true); }}
                    className="mt-1 flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-violet-500/15 border border-amber-500/30 active:scale-[0.99] transition"
                  >
                    <span className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500 to-violet-500 flex items-center justify-center shadow-md">
                      <Crown className="h-4 w-4 text-white" />
                    </span>
                    <span className="flex-1 text-left">
                      <span className="block text-[14px] font-bold text-foreground/85">
                        {locale === "en" ? "Upgrade to Pro" : "Pro にアップグレード"}
                      </span>
                      <span className="block text-[11px] text-muted-foreground/70">
                        {locale === "en" ? "More AI requests, unlock OCR & grading" : "AI 回数 UP、OCR・採点を解放"}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* 下部タブバーは撤廃 — Composer の上に「プレビュー」FAB を出して切替する。
            ChatGPT モバイル風にチャットを主役にし、画面下のスペースを composer に明け渡す。 */}
      </div>
    );
  }

  /* ══════════ DESKTOP ══════════ */

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f4f0] dark:bg-[#111110]">
      {/* OMR (読み取りモード) は全画面 Split View として常時マウント。
          omrMode=false の間は null を返すので不可視。起動用の hidden <input> は
          その直下に置き、サイドバー → triggerOMR() → click() → onChange で openOMR() が
          呼ばれて SplitView が前面に出る。 */}
      <input
        ref={omrFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        className="hidden"
        onChange={handleOMRFilePick}
        aria-hidden="true"
      />
      <OMRSplitView />
      {figureEditorMode && <FigureEditor />}
      {/* 類題ジェネレータ・モード — 既存 OMR/Figure と同じ「独立モード」パターン。
          チャット履歴は触らず、1-shot で doc に類題を反映する。 */}
      <VariantStudio />

      {/* ゲストモード帯: 「ログインなしで体験中」の状態を常時提示し、
          AI 1 回 + 編集 + ライブプレビューだけが解放されている事を伝える。 */}
      {isGuest && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-[12px] bg-gradient-to-r from-violet-500/[0.10] via-fuchsia-500/[0.08] to-blue-500/[0.10] border-b border-violet-500/25 text-foreground/85">
          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <span className="font-medium truncate">
            {locale === "en"
              ? guestTrialUsed
                ? "Worksheet ready. Save it to your free account to edit and download it again later."
                : "Guest mode — 1 free AI generation. Save with a free account to keep editing and downloading."
              : guestTrialUsed
                ? "プリントが完成しました。無料アカウントで保存すれば、再編集・再ダウンロードできます。"
                : "ゲストモード — まずは1枚作れます。無料アカウントで保存すれば再編集・再ダウンロードできます。"}
          </span>
          <button
            onClick={() => {
              trackGuestSignupClick({ placement: "guest_banner" });
              useUIStore.getState().openSignupOverlay({
                reason: guestTrialUsed ? "trial_complete" : "manual",
                placement: "guest_banner",
              });
            }}
            className="ml-auto shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-foreground text-background text-[11.5px] font-bold hover:opacity-90 transition"
          >
            {locale === "en"
              ? guestTrialUsed ? "Save this worksheet" : "Sign up free"
              : guestTrialUsed ? "このプリントを保存" : "無料登録"}
          </button>
        </div>
      )}

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

            {/* ✨ Variant Studio — 類題ジェネレータ。Pro+ で無制限 / Free は 1 回お試し。
                AI チャット (差分修正) とは別の「核機能」モードとして対等に並べる。 */}
            {(() => {
              const variantStudioOpen = useUIStore.getState().variantStudioOpen;
              const variantPro = canUseFeature(currentPlan, "variantGen");
              // ロック判定 = Pro 未満 かつ 既にお試し消費済み (storeget で同期 fetch)
              let variantTrialUsed = false;
              try { variantTrialUsed = typeof window !== "undefined" && window.localStorage.getItem("eddivom:variant-trial:used") === "1"; } catch { /* ignore */ }
              const variantLocked = !variantPro && variantTrialUsed;
              return (
                <ActivityBtn
                  accent="violet"
                  active={variantStudioOpen}
                  icon={<Sparkles className={variantStudioOpen ? "h-[15px] w-[15px] text-white" : "h-[17px] w-[17px]"} />}
                  label={locale === "en" ? "Variants" : "類題"}
                  onClick={() => {
                    if (variantLocked) {
                      // ロック時はトーストで pricing 誘導 (既存 OCR と同パターン)
                      const planName = PLANS[requiredPlanFor("variantGen")].name;
                      toast.error(
                        locale === "en"
                          ? `Variant Studio requires ${planName} plan or higher.`
                          : `類題ジェネレータは ${planName} プラン以上で無制限利用できます。`,
                        {
                          duration: 5000,
                          action: {
                            label: locale === "en" ? "Upgrade" : "アップグレード",
                            onClick: () => usePlanStore.getState().setShowPricing(true),
                          },
                        },
                      );
                      return;
                    }
                    useUIStore.getState().openVariantStudio({
                      preselectedStyle: "same",
                    });
                  }}
                  title={
                    variantLocked
                      ? (locale === "en" ? "Pro plan required (unlimited variants)" : "Pro プランで類題が無制限")
                      : (locale === "en" ? "Variant Studio — generate similar problems" : "類題ジェネレータ — 1ボタンで何枚でも")
                  }
                  disabled={gradingMode}
                  locked={variantLocked}
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
              title={ocrLocked ? (locale === "en" ? `${ocrRequired} plan or higher required` : `${ocrRequired}プラン以上で利用可能`) : t("side.tooltip.scan")}
              disabled={gradingMode}
              locked={ocrLocked}
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
              title={gradingLocked ? (locale === "en" ? `${gradingRequired} plan or higher required` : `${gradingRequired}プラン以上で利用可能`) : t("side.tooltip.grading")}
              pulse={gradingMode}
              locked={gradingLocked}
            />

            <div className="h-px bg-foreground/[0.06] mx-2 my-1" />

            {/* Visual editor toggle — 中央の「直接編集できる紙」を出し入れ */}
            <ActivityBtn
              accent="emerald"
              active={showVisualPanel}
              icon={<PenTool className={showVisualPanel ? "h-[16px] w-[16px] text-white" : "h-[16px] w-[16px]"} />}
              label={t("side.label.visual")}
              onClick={toggleVisualPanel}
              title={t("side.tooltip.visual")}
            />

            {/* PDF preview toggle */}
            <ActivityBtn
              accent="sky"
              active={showPdfPanel}
              icon={<Eye className={showPdfPanel ? "h-[16px] w-[16px] text-white" : "h-[16px] w-[16px]"} />}
              label={t("side.label.preview")}
              onClick={togglePdfPanel}
              title={t("side.tooltip.preview")}
            />

            {/* LaTeX source toggle — Starter+ 限定 (LP: LaTeXソースエクスポート) */}
            <ActivityBtn
              accent="violet"
              active={showSourcePanel}
              icon={<Braces className={showSourcePanel ? "h-[16px] w-[16px] text-white" : "h-[16px] w-[16px]"} />}
              label={t("side.label.source")}
              onClick={() => {
                // 閉じる方向は常に許可 (開いている状態から抜けられないと困る)。
                // 開く方向だけプランチェックし、Free は pricing modal に誘導する。
                if (showSourcePanel) {
                  toggleSourcePanel();
                  return;
                }
                const check = usePlanStore.getState().checkFeature("latexExport");
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
                toggleSourcePanel();
              }}
              title={latexExportLocked ? (locale === "en" ? `${latexExportRequired} plan or higher required` : `${latexExportRequired}プラン以上で利用可能`) : t("side.tooltip.source")}
              locked={latexExportLocked}
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
  /**
   * プランで使えない状態。`disabled` (完全に押せない) とは別物で、
   * click 自体は生きたまま pricing modal 誘導用のハンドラが走るようにする。
   * 見た目だけ "上位プランが必要" と示す。
   */
  locked?: boolean;
}

function ActivityBtn({ accent, icon, label, onClick, title, active = false, badge = false, disabled = false, pulse = false, locked = false }: ActivityBtnProps) {
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
          : locked
          ? "text-foreground/25 hover:text-foreground/45 hover:bg-foreground/[0.03]"
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
        <div className={`h-7 w-7 flex items-center justify-center ${locked ? "opacity-50" : ""}`}>{icon}</div>
      )}
      <span className="text-[9px] font-medium leading-none tracking-tight">{label}</span>
      {badge && (
        <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
      {locked && !active && (
        <span className="absolute top-1 right-1.5 h-3 w-3 rounded-full bg-foreground/70 dark:bg-white/80 flex items-center justify-center shadow-sm ring-1 ring-background">
          <Lock className="h-2 w-2 text-background" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
