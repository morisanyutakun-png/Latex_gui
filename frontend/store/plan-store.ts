"use client";

import { create } from "zustand";
import { PlanId, PLANS } from "@/lib/plans";

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
}

function loadUsage(): UsageData {
  if (typeof window === "undefined") return { daily: {}, monthly: {} };
  try {
    const raw = localStorage.getItem(LS_USAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { daily: {}, monthly: {} };
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
  localStorage.setItem(LS_USAGE_KEY, JSON.stringify({ daily: cleanedDaily, monthly: cleanedMonthly }));
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

  // 読み取り
  todayUsage: () => number;
  monthUsage: () => number;
  dailyLimit: () => number;
  monthlyLimit: () => number;
  canMakeRequest: () => { allowed: boolean; reason: string };
  usagePercent: () => { daily: number; monthly: number };

  // 操作
  setPlan: (plan: PlanId) => void;
  incrementUsage: () => void;
  setShowPricing: (v: boolean) => void;
  initFromStorage: () => void;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  currentPlan: "free",
  usage: { daily: {}, monthly: {} },
  showPricing: false,

  todayUsage: () => get().usage.daily[todayKey()] || 0,
  monthUsage: () => get().usage.monthly[monthKey()] || 0,

  dailyLimit: () => PLANS[get().currentPlan].requestsPerDay,
  monthlyLimit: () => PLANS[get().currentPlan].requestsPerMonth,

  canMakeRequest: () => {
    // 開発段階: 制限超過は警告のみ、ブロックしない
    const state = get();
    const plan = PLANS[state.currentPlan];
    const daily = state.usage.daily[todayKey()] || 0;
    const monthly = state.usage.monthly[monthKey()] || 0;

    if (daily >= plan.requestsPerDay) {
      return {
        allowed: true,  // TODO: リリース時に false に変更
        reason: `⚠️ 本日のAIリクエスト上限 (${plan.requestsPerDay}回) を超えています。開発中のため引き続き利用可能です。`,
      };
    }
    if (monthly >= plan.requestsPerMonth) {
      return {
        allowed: true,  // TODO: リリース時に false に変更
        reason: `⚠️ 今月のAIリクエスト上限 (${plan.requestsPerMonth.toLocaleString()}回) を超えています。開発中のため引き続き利用可能です。`,
      };
    }
    return { allowed: true, reason: "" };
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
    };
    saveUsage(newUsage);
    set({ usage: newUsage });
  },

  setShowPricing: (v) => set({ showPricing: v }),

  initFromStorage: () => {
    set({ currentPlan: loadPlan(), usage: loadUsage() });
  },
}));
