"use client";

import { create } from "zustand";
import { PlanId, PLANS, GatedFeature, canUseFeature, requiredPlanFor, FEATURE_LABELS } from "@/lib/plans";
import { fetchMySubscription, fetchMyUsage } from "@/lib/subscription-api";

// セキュリティ: 以前は `eddivom-plan` を localStorage にキャッシュしていたが、
// DevTools から書き換えると UI が有料プラン相当に見えてしまい、実リクエストは
// サーバで拒否される = 「UI は使えるのに API だけ失敗する」という紛らわしい
// UX 不整合を生んだ。プランの真実のソースはバックエンドのみとする。
// 初回レンダリング時は全員 "free" として扱い、fetchSubscription の結果を待つ。
function defaultPlan(): PlanId {
  return "free";
}

// 旧バージョンでブラウザに残ったプランキャッシュを破棄する (起動時に一度だけ呼ぶ)。
function cleanupLegacyPlanCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("eddivom-plan");
  } catch { /* ignore */ }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface PlanState {
  currentPlan: PlanId;
  // サーバから取得した利用量（UI の quota 判定はこの値に基づく）
  aiUsedDay: number;
  aiUsedMonth: number;
  aiLimitDay: number;
  aiLimitMonth: number;
  pdfUsedMonth: number;
  pdfLimitMonth: number;  // 0 = 無制限
  batchMaxRows: number;

  showPricing: boolean;
  isLoadingSubscription: boolean;
  subscriptionFetched: boolean;
  usageFetched: boolean;

  // 読み取り (レガシー互換: 表示コンポーネント用)
  todayUsage: () => number;
  monthUsage: () => number;
  pdfMonthUsage: () => number;
  dailyLimit: () => number;
  monthlyLimit: () => number;
  pdfMonthlyLimit: () => number;
  canMakeRequest: () => { allowed: boolean; reason: string };
  canExportPDF: () => { allowed: boolean; reason: string };
  checkFeature: (feature: GatedFeature) => { allowed: boolean; reason: string; requiredPlan: PlanId };
  usagePercent: () => { daily: number; monthly: number };

  // 操作
  setPlan: (plan: PlanId) => void;
  /** 楽観的インクリメント + サーバから再同期 */
  incrementUsage: () => void;
  incrementPdfUsage: () => void;
  /** サーバから利用状況を再取得 */
  refreshUsage: () => Promise<void>;
  setShowPricing: (v: boolean) => void;
  initFromStorage: () => void;
  fetchSubscription: () => Promise<void>;
  /**
   * ログアウトに伴うストアリセット。
   * - currentPlan を free に戻す
   * - サーバ取得済みフラグを下ろして「未認証扱い」に揃える
   * - 利用量カウンタも 0 に戻す (前ユーザの quota を引きずらない)
   * これがないとログアウト後も plan/subscription がキャッシュされ、TemplateGallery が
   * 「続きから編集」CTA を出して新規ゲスト体験に入れない。
   */
  resetForLogout: () => void;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  currentPlan: defaultPlan(),
  aiUsedDay: 0,
  aiUsedMonth: 0,
  aiLimitDay: PLANS.free.requestsPerDay,
  aiLimitMonth: PLANS.free.requestsPerMonth,
  pdfUsedMonth: 0,
  pdfLimitMonth: PLANS.free.pdfPerMonth,
  batchMaxRows: PLANS.free.batchMaxRows,
  showPricing: false,
  isLoadingSubscription: false,
  subscriptionFetched: false,
  usageFetched: false,

  todayUsage: () => get().aiUsedDay,
  monthUsage: () => get().aiUsedMonth,
  pdfMonthUsage: () => get().pdfUsedMonth,

  dailyLimit: () => get().aiLimitDay,
  monthlyLimit: () => get().aiLimitMonth,
  pdfMonthlyLimit: () => get().pdfLimitMonth,

  canMakeRequest: () => {
    const s = get();
    if (s.aiUsedDay >= s.aiLimitDay) {
      return {
        allowed: false,
        reason: `本日の高性能AI上限 (${s.aiLimitDay}回) に達しました。プランをアップグレードすると上限が増えます。`,
      };
    }
    if (s.aiUsedMonth >= s.aiLimitMonth) {
      return {
        allowed: false,
        reason: `今月の高性能AI上限 (${s.aiLimitMonth.toLocaleString()}回) に達しました。プランをアップグレードすると上限が増えます。`,
      };
    }
    return { allowed: true, reason: "" };
  },

  canExportPDF: () => {
    const s = get();
    if (s.pdfLimitMonth === 0) return { allowed: true, reason: "" };
    if (s.pdfUsedMonth >= s.pdfLimitMonth) {
      return {
        allowed: false,
        reason: `今月の教材PDF出力上限 (${s.pdfLimitMonth}回) に達しました。Starterプラン以上でPDF出力が無制限になります。`,
      };
    }
    return { allowed: true, reason: "" };
  },

  checkFeature: (feature: GatedFeature) => {
    const s = get();
    const allowed = canUseFeature(s.currentPlan, feature);
    const req = requiredPlanFor(feature);
    const label = FEATURE_LABELS[feature];
    if (allowed) return { allowed: true, reason: "", requiredPlan: req };
    return {
      allowed: false,
      reason: `「${label.ja}」は${PLANS[req].name}プラン以上でご利用いただけます。`,
      requiredPlan: req,
    };
  },

  usagePercent: () => {
    const s = get();
    return {
      daily: Math.min(100, (s.aiUsedDay / Math.max(1, s.aiLimitDay)) * 100),
      monthly: Math.min(100, (s.aiUsedMonth / Math.max(1, s.aiLimitMonth)) * 100),
    };
  },

  setPlan: (plan) => {
    // プラン更新は store のみに保持 (localStorage には書かない — XSS / DevTools 改変対策)
    set({ currentPlan: plan });
    // プランが変わったら上限もプラン定義に合わせて即時反映（サーバ再同期まで）
    const def = PLANS[plan];
    set({
      aiLimitDay: def.requestsPerDay,
      aiLimitMonth: def.requestsPerMonth,
      pdfLimitMonth: def.pdfPerMonth,
      batchMaxRows: def.batchMaxRows,
    });
    // 非同期でサーバから再取得
    void get().refreshUsage();
  },

  incrementUsage: () => {
    // 楽観的更新（サーバはリクエスト時点で既にカウント済み）
    set((s) => ({
      aiUsedDay: s.aiUsedDay + 1,
      aiUsedMonth: s.aiUsedMonth + 1,
    }));
    // 少し待ってからサーバと同期（複数リクエスト束ねるため）
    void get().refreshUsage();
  },

  incrementPdfUsage: () => {
    set((s) => ({ pdfUsedMonth: s.pdfUsedMonth + 1 }));
    void get().refreshUsage();
  },

  refreshUsage: async () => {
    try {
      const u = await fetchMyUsage();
      // サーバが明示的にプラン情報を返したときだけ currentPlan を更新する。
      // 空レスポンス / 未認証時 / ネットワーク失敗時は既存値を維持する
      // (途中で Free に戻って UI が点滅する race を防ぐ)。
      const serverPlan = u.plan_id as PlanId | undefined;
      const next: Partial<PlanState> = {
        aiUsedDay: u.ai_used_day,
        aiUsedMonth: u.ai_used_month,
        aiLimitDay: u.ai_limit_day,
        aiLimitMonth: u.ai_limit_month,
        pdfUsedMonth: u.pdf_used_month,
        pdfLimitMonth: u.pdf_limit_month,
        batchMaxRows: u.batch_max_rows,
        usageFetched: true,
      };
      if (serverPlan && (serverPlan === "free" || serverPlan === "starter" || serverPlan === "pro" || serverPlan === "premium")) {
        next.currentPlan = serverPlan;
      }
      set(next);
    } catch {
      // サーバ取得失敗時は現状維持 (プランもそのまま)
      set({ usageFetched: true });
    }
  },

  setShowPricing: (v) => set({ showPricing: v }),

  initFromStorage: () => {
    // 未ログイン / サーバ未到達時の安全な既定として Free プランの上限を設定する。
    // 旧バージョンで残った localStorage のプランキャッシュは破棄する。
    // ★ subscription が既にサーバから取得済みなら何もしない (race 対策)。
    //   以前は AIChatPanel 側が無条件で呼び、fetchSubscription で設定済みの
    //   "pro" を "free" で上書きして「決済したのに Free に見える」バグが起きた。
    cleanupLegacyPlanCache();
    const { subscriptionFetched, usageFetched, currentPlan } = get();
    if (subscriptionFetched || usageFetched || currentPlan !== "free") return;
    const plan = defaultPlan();
    const def = PLANS[plan];
    set({
      currentPlan: plan,
      aiLimitDay: def.requestsPerDay,
      aiLimitMonth: def.requestsPerMonth,
      pdfLimitMonth: def.pdfPerMonth,
      batchMaxRows: def.batchMaxRows,
    });
  },

  fetchSubscription: async () => {
    set({ isLoadingSubscription: true });
    // リトライ付き: ネットワーク一時失敗 / Koyeb コールドスタート等で
    // 一度失敗しただけで Free に誤判定されないよう、合計 3 回試行する。
    const attempt = async (): Promise<PlanId | null> => {
      try {
        const status = await fetchMySubscription();
        return (status.plan_id as PlanId) || null;
      } catch {
        return null;
      }
    };
    let planId: PlanId | null = null;
    for (let i = 0; i < 3; i++) {
      planId = await attempt();
      if (planId !== null) break;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
    // Usage は別トライで並列に。失敗してもプラン判定には影響させない。
    void get().refreshUsage();
    try {
      if (planId !== null) {
        set({ currentPlan: planId, subscriptionFetched: true });
      } else {
        // 最後まで取れなかった: 既存 currentPlan を尊重し、fetched フラグだけ立てる。
        // (Free に強制降格すると、既に "pro" が楽観的に入っているケースを壊す)
        set({ subscriptionFetched: true });
      }
    } finally {
      set({ isLoadingSubscription: false });
    }
  },

  resetForLogout: () => {
    const def = PLANS.free;
    set({
      currentPlan: "free",
      aiUsedDay: 0,
      aiUsedMonth: 0,
      aiLimitDay: def.requestsPerDay,
      aiLimitMonth: def.requestsPerMonth,
      pdfUsedMonth: 0,
      pdfLimitMonth: def.pdfPerMonth,
      batchMaxRows: def.batchMaxRows,
      subscriptionFetched: false,
      usageFetched: false,
      isLoadingSubscription: false,
    });
  },
}));
