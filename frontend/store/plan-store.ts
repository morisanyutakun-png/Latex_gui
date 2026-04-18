"use client";

import { create } from "zustand";
import { PlanId, PLANS, GatedFeature, canUseFeature, requiredPlanFor, FEATURE_LABELS } from "@/lib/plans";
import { fetchMySubscription, fetchMyUsage } from "@/lib/subscription-api";

// プラン名だけは localStorage に残しておき、初回レンダリングで UI が崩れないようにする。
// 使用量は完全にサーバサイドで管理（localStorage 改変でバイパス不可）。
const LS_PLAN_KEY = "eddivom-plan";

function loadPlan(): PlanId {
  if (typeof window === "undefined") return "free";
  try {
    const raw = localStorage.getItem(LS_PLAN_KEY);
    if (raw && (raw === "free" || raw === "starter" || raw === "pro" || raw === "premium")) return raw as PlanId;
  } catch { /* ignore */ }
  return "free";
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
}

export const usePlanStore = create<PlanState>((set, get) => ({
  currentPlan: "free",
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
    if (typeof window !== "undefined") localStorage.setItem(LS_PLAN_KEY, plan);
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
      set({
        currentPlan: u.plan_id,
        aiUsedDay: u.ai_used_day,
        aiUsedMonth: u.ai_used_month,
        aiLimitDay: u.ai_limit_day,
        aiLimitMonth: u.ai_limit_month,
        pdfUsedMonth: u.pdf_used_month,
        pdfLimitMonth: u.pdf_limit_month,
        batchMaxRows: u.batch_max_rows,
        usageFetched: true,
      });
      if (typeof window !== "undefined") localStorage.setItem(LS_PLAN_KEY, u.plan_id);
    } catch {
      // サーバ取得失敗時は現状維持
      set({ usageFetched: true });
    }
  },

  setShowPricing: (v) => set({ showPricing: v }),

  initFromStorage: () => {
    const plan = loadPlan();
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
    try {
      const [status] = await Promise.all([fetchMySubscription(), get().refreshUsage()]);
      const planId = status.plan_id as PlanId;
      if (typeof window !== "undefined") localStorage.setItem(LS_PLAN_KEY, planId);
      set({ currentPlan: planId, subscriptionFetched: true });
    } catch {
      set({ currentPlan: loadPlan(), subscriptionFetched: true });
    } finally {
      set({ isLoadingSubscription: false });
    }
  },
}));
