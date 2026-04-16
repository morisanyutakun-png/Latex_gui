"use client";

import { create } from "zustand";
import { PlanId, PLANS, GatedFeature, canUseFeature, requiredPlanFor, FEATURE_LABELS } from "@/lib/plans";
import { fetchMySubscription } from "@/lib/subscription-api";

// ─── LocalStorage キー ───────────────────────────────────────────────────────
const LS_PLAN_KEY = "eddivom-plan";
const LS_USAGE_KEY = "eddivom-usage";

// ─── 使用量の日付キー ─────────────────────────────────────────────────────────
function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-04-04"
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // "2026-04"
}

// ─── 永続化される使用量データ ─────────────────────────────────────────────────
interface UsageData {
  daily: Record<string, number>;   // { "2026-04-04": 5 }
  monthly: Record<string, number>; // { "2026-04": 42 }
  pdfMonthly: Record<string, number>; // { "2026-04": 1 }  教材PDF出力
}

function loadUsage(): UsageData {
  if (typeof window === "undefined") return { daily: {}, monthly: {}, pdfMonthly: {} };
  try {
    const raw = localStorage.getItem(LS_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { daily: parsed.daily || {}, monthly: parsed.monthly || {}, pdfMonthly: parsed.pdfMonthly || {} };
    }
  } catch { /* ignore */ }
  return { daily: {}, monthly: {}, pdfMonthly: {} };
}

function saveUsage(data: UsageData) {
  if (typeof window === "undefined") return;
  // 古いエントリを掃除 (30日以前の daily, 3ヶ月以前の monthly)
  const now = new Date();
  const cleanedDaily: Record<string, number> = {};
  for (const [key, val] of Object.entries(data.daily)) {
    const d = new Date(key);
    if (now.getTime() - d.getTime() < 30 * 86400000) cleanedDaily[key] = val;
  }
  const cleanedMonthly: Record<string, number> = {};
  for (const [key, val] of Object.entries(data.monthly)) {
    const d = new Date(key + "-01");
    if (now.getTime() - d.getTime() < 90 * 86400000) cleanedMonthly[key] = val;
  }
  const cleanedPdfMonthly: Record<string, number> = {};
  for (const [key, val] of Object.entries(data.pdfMonthly || {})) {
    const d = new Date(key + "-01");
    if (now.getTime() - d.getTime() < 90 * 86400000) cleanedPdfMonthly[key] = val;
  }
  localStorage.setItem(LS_USAGE_KEY, JSON.stringify({ daily: cleanedDaily, monthly: cleanedMonthly, pdfMonthly: cleanedPdfMonthly }));
}

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
  usage: UsageData;
  showPricing: boolean;
  isLoadingSubscription: boolean;
  subscriptionFetched: boolean;

  // 読み取り
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
  incrementUsage: () => void;
  incrementPdfUsage: () => void;
  setShowPricing: (v: boolean) => void;
  initFromStorage: () => void;
  fetchSubscription: () => Promise<void>;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  currentPlan: "free",
  usage: { daily: {}, monthly: {}, pdfMonthly: {} },
  showPricing: false,
  isLoadingSubscription: false,
  subscriptionFetched: false,

  todayUsage: () => get().usage.daily[todayKey()] || 0,
  monthUsage: () => get().usage.monthly[monthKey()] || 0,
  pdfMonthUsage: () => get().usage.pdfMonthly?.[monthKey()] || 0,

  dailyLimit: () => PLANS[get().currentPlan].requestsPerDay,
  monthlyLimit: () => PLANS[get().currentPlan].requestsPerMonth,
  pdfMonthlyLimit: () => PLANS[get().currentPlan].pdfPerMonth,

  canMakeRequest: () => {
    const state = get();
    const plan = PLANS[state.currentPlan];
    const daily = state.usage.daily[todayKey()] || 0;
    const monthly = state.usage.monthly[monthKey()] || 0;

    if (daily >= plan.requestsPerDay) {
      return {
        allowed: false,
        reason: `本日の高性能AI上限 (${plan.requestsPerDay}回) に達しました。プランをアップグレードすると上限が増えます。`,
      };
    }
    if (monthly >= plan.requestsPerMonth) {
      return {
        allowed: false,
        reason: `今月の高性能AI上限 (${plan.requestsPerMonth.toLocaleString()}回) に達しました。プランをアップグレードすると上限が増えます。`,
      };
    }
    return { allowed: true, reason: "" };
  },

  canExportPDF: () => {
    const state = get();
    const plan = PLANS[state.currentPlan];
    // pdfPerMonth === 0 は無制限
    if (plan.pdfPerMonth === 0) return { allowed: true, reason: "" };
    const used = state.usage.pdfMonthly?.[monthKey()] || 0;
    if (used >= plan.pdfPerMonth) {
      return {
        allowed: false,
        reason: `今月の教材PDF出力上限 (${plan.pdfPerMonth}回) に達しました。Starterプラン以上で無制限にPDF出力できます。`,
      };
    }
    return { allowed: true, reason: "" };
  },

  checkFeature: (feature: GatedFeature) => {
    const state = get();
    const allowed = canUseFeature(state.currentPlan, feature);
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
    const state = get();
    const plan = PLANS[state.currentPlan];
    const daily = state.usage.daily[todayKey()] || 0;
    const monthly = state.usage.monthly[monthKey()] || 0;
    return {
      daily: Math.min(100, (daily / plan.requestsPerDay) * 100),
      monthly: Math.min(100, (monthly / plan.requestsPerMonth) * 100),
    };
  },

  setPlan: (plan) => {
    if (typeof window !== "undefined") localStorage.setItem(LS_PLAN_KEY, plan);
    set({ currentPlan: plan });
  },

  incrementUsage: () => {
    const state = get();
    const dk = todayKey();
    const mk = monthKey();
    const newUsage: UsageData = {
      daily: { ...state.usage.daily, [dk]: (state.usage.daily[dk] || 0) + 1 },
      monthly: { ...state.usage.monthly, [mk]: (state.usage.monthly[mk] || 0) + 1 },
      pdfMonthly: state.usage.pdfMonthly || {},
    };
    saveUsage(newUsage);
    set({ usage: newUsage });
  },

  incrementPdfUsage: () => {
    const state = get();
    const mk = monthKey();
    const newUsage: UsageData = {
      daily: state.usage.daily,
      monthly: state.usage.monthly,
      pdfMonthly: { ...(state.usage.pdfMonthly || {}), [mk]: ((state.usage.pdfMonthly || {})[mk] || 0) + 1 },
    };
    saveUsage(newUsage);
    set({ usage: newUsage });
  },

  setShowPricing: (v) => set({ showPricing: v }),

  initFromStorage: () => {
    set({ currentPlan: loadPlan(), usage: loadUsage() });
  },

  fetchSubscription: async () => {
    set({ isLoadingSubscription: true });
    try {
      const status = await fetchMySubscription();
      const planId = status.plan_id as PlanId;
      // バックエンドから取得したプランを反映 (LocalStorageにも保存)
      if (typeof window !== "undefined") localStorage.setItem(LS_PLAN_KEY, planId);
      set({ currentPlan: planId, subscriptionFetched: true, usage: loadUsage() });
    } catch {
      // エラー時はLocalStorageのプランをフォールバックとして使用
      set({ currentPlan: loadPlan(), subscriptionFetched: true, usage: loadUsage() });
    } finally {
      set({ isLoadingSubscription: false });
    }
  },
}));
