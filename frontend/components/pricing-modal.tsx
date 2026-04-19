"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Zap, Sparkles } from "lucide-react";
import { usePlanStore } from "@/store/plan-store";
import { PLANS, PLAN_ORDER, PlanId } from "@/lib/plans";

const PLAN_RANK_UI: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, premium: 3 };
import { useI18n } from "@/lib/i18n";

const PLAN_ICONS: Record<PlanId, React.ReactNode> = {
  free: <Zap className="h-5 w-5" />,
  starter: <Zap className="h-5 w-5" />,
  pro: <Sparkles className="h-5 w-5" />,
  premium: <Crown className="h-5 w-5" />,
};

const PLAN_COLORS: Record<PlanId, { bg: string; border: string; badge: string; btn: string }> = {
  free: {
    bg: "bg-slate-50 dark:bg-slate-900/40",
    border: "border-slate-200 dark:border-slate-700",
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    btn: "bg-slate-600 hover:bg-slate-700 text-white",
  },
  starter: {
    bg: "bg-emerald-50/50 dark:bg-emerald-950/30",
    border: "border-emerald-300 dark:border-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  pro: {
    bg: "bg-indigo-50/50 dark:bg-indigo-950/30",
    border: "border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-800",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    btn: "bg-indigo-600 hover:bg-indigo-700 text-white",
  },
  premium: {
    bg: "bg-gradient-to-br from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20",
    border: "border-amber-300 dark:border-amber-600 ring-2 ring-amber-200 dark:ring-amber-800",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    btn: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white",
  },
};

export function PricingModal() {
  const { showPricing, setShowPricing, currentPlan } = usePlanStore();
  const { locale } = useI18n();
  const isJa = locale === "ja";
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  const handleSelect = async (planId: PlanId) => {
    setShowPricing(false);

    // 認証チェック — 全プラン（Free含む）でログイン＋Stripe を通す
    try {
      const { getSession, signIn } = await import("next-auth/react");
      const session = await getSession();
      if (!session) {
        signIn("google", { callbackUrl: "/" });
        return;
      }
    } catch {
      return;
    }

    // Stripe Checkout へリダイレクト（Free は ¥0 だがユーザー識別のため通す）
    setIsRedirecting(true);
    try {
      const { createCheckoutSession } = await import("@/lib/subscription-api");
      const result = await createCheckoutSession(planId);
      if (result.action === "already_on_plan") {
        // サーバ判定で既に同 or 上位プラン → Stripe を挟まずエディタへ
        const { toast: toastFn } = await import("sonner");
        const planName = PLANS[(result.currentPlan || "free") as PlanId]?.name ?? "";
        toastFn.success(
          isJa
            ? `すでに${planName}プランをご契約中です。エディタに移動します。`
            : `You already have the ${planName} plan. Taking you to the editor.`,
        );
        window.location.href = "/editor";
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      setIsRedirecting(false);
    }
  };

  return (
    <Dialog open={showPricing} onOpenChange={setShowPricing}>
      {/*
        横幅を 6xl に広げ、overflow は縦のみ。Premium の `scale-[1.03]` が
        はみ出さないようにグリッドのパディングを多めに取る。
      */}
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-xl font-bold text-center">
            {isJa ? "料金プラン" : "Pricing Plans"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-slate-500">
            {isJa
              ? "全プラン高性能AI搭載 — 違いは使える回数だけ"
              : "High-performance AI on every plan — only usage limits differ"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pt-4 pb-6">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const colors = PLAN_COLORS[planId];
            const isActive = currentPlan === planId;
            const isLower = PLAN_RANK_UI[planId] < PLAN_RANK_UI[currentPlan];
            const features = isJa ? plan.features : plan.featuresEn;
            const isPremium = planId === "premium";

            return (
              <div
                key={planId}
                className={`relative rounded-2xl border p-5 flex flex-col min-w-0 ${colors.bg} ${colors.border} ${
                  isPremium ? "shadow-xl z-10" : plan.highlight ? "shadow-lg" : "shadow-sm"
                } transition-all`}
              >
                {/* バッジ */}
                {plan.badge && (
                  <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${colors.badge}`}>
                    {plan.badge}
                  </span>
                )}

                {/* ヘッダー */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${colors.badge}`}>
                    {PLAN_ICONS[planId]}
                  </div>
                  <h3 className="font-bold text-base">{plan.name}</h3>
                </div>

                {/* 価格 */}
                <div className="mb-4 flex items-baseline gap-1 flex-wrap">
                  <span className={`font-extrabold tracking-tight ${isPremium ? "text-3xl" : "text-2xl"}`}>
                    {plan.priceLabel}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-slate-500">
                      {isJa ? "/月" : "/mo"}
                    </span>
                  )}
                </div>

                {/* リクエスト制限ハイライト — "高性能AI" を縦に積んでカラム幅で潰れないようにする */}
                <div className={`rounded-lg border px-3 py-2.5 mb-4 ${
                  isPremium
                    ? "bg-amber-50/80 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-700/50"
                    : "bg-white/60 dark:bg-black/20 border-slate-200/50 dark:border-slate-700/50"
                }`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                    isPremium ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400"
                  }`}>
                    {isJa ? "高性能AI" : "Premium AI"}
                  </div>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className={`text-2xl font-extrabold leading-none tracking-tight ${
                      isPremium ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400"
                    }`}>
                      {plan.requestsPerMonth.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isJa ? "回 / 月" : "req/mo"}
                    </span>
                  </div>
                </div>

                {/* 機能一覧 */}
                <ul className="space-y-2 mb-5 flex-1">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug">
                      <Check className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isPremium ? "text-amber-500" : "text-emerald-500"}`} />
                      <span className="break-words">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* ボタン */}
                <Button
                  className={`w-full whitespace-nowrap ${colors.btn} ${(isActive || isLower) ? "opacity-60 cursor-default" : ""} ${isPremium ? "font-bold" : ""}`}
                  onClick={() => handleSelect(planId)}
                  disabled={isActive || isLower || isRedirecting}
                >
                  {isActive
                    ? (isJa ? "現在のプラン" : "Current Plan")
                    : isLower
                    ? (isJa ? "上位プラン契約中" : "On higher plan")
                    : isRedirecting
                    ? (isJa ? "処理中..." : "Redirecting...")
                    : planId === "free"
                    ? (isJa ? "Freeで始める" : "Start Free")
                    : (isJa ? "このプランにする" : "Select Plan")}
                </Button>
              </div>
            );
          })}
        </div>

        {/* 注記 */}
        <div className="px-6 pb-5 text-center text-[11px] text-slate-400">
          {isJa
            ? "※ Googleアカウントでログインしてプランを選択すると、Stripeの決済画面に移動します。"
            : "* Sign in with Google and select a plan to proceed to Stripe checkout."}
        </div>
      </DialogContent>
    </Dialog>
  );
}
