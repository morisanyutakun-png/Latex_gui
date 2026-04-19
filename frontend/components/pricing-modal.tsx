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
import { Check, Crown, Zap, Sparkles, ShieldCheck } from "lucide-react";
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

interface PlanTheme {
  /** カード全体の背景グラデーション */
  bg: string;
  /** カード枠線 */
  border: string;
  /** プランアイコンの背景色 */
  iconBg: string;
  /** 「高性能AI」ハイライトブロックの背景+枠 */
  highlight: string;
  /** 大きな数字の色 */
  accentText: string;
  /** 機能リストのチェックアイコン色 */
  check: string;
  /** CTAボタン */
  btn: string;
  /** バッジ (「人気 No.1」など) */
  badge: string;
}

const PLAN_THEMES: Record<PlanId, PlanTheme> = {
  free: {
    bg: "bg-slate-50/80 dark:bg-slate-900/40",
    border: "border-slate-200 dark:border-slate-700",
    iconBg: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    highlight: "bg-white/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60",
    accentText: "text-slate-700 dark:text-slate-200",
    check: "text-slate-500 dark:text-slate-400",
    btn: "bg-slate-800 hover:bg-slate-900 text-white",
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
  starter: {
    bg: "bg-gradient-to-b from-emerald-50/70 to-emerald-50/20 dark:from-emerald-950/30 dark:to-emerald-950/10",
    border: "border-emerald-300/70 dark:border-emerald-700/60",
    iconBg: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    highlight: "bg-white dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60",
    accentText: "text-emerald-700 dark:text-emerald-300",
    check: "text-emerald-500",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    badge: "bg-emerald-500 text-white",
  },
  pro: {
    bg: "bg-gradient-to-b from-indigo-50/80 via-violet-50/50 to-violet-50/10 dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-violet-950/10",
    border: "border-violet-400/70 dark:border-violet-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-violet-600 text-white",
    highlight: "bg-white dark:bg-indigo-950/40 border-violet-200 dark:border-violet-800/60",
    accentText: "text-violet-700 dark:text-violet-300",
    check: "text-violet-500",
    btn: "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white",
    badge: "bg-gradient-to-r from-blue-600 to-violet-600 text-white",
  },
  premium: {
    bg: "bg-gradient-to-b from-amber-50/80 via-orange-50/40 to-orange-50/10 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-orange-950/5",
    border: "border-amber-400/70 dark:border-amber-500/70",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500 text-white",
    highlight: "bg-white dark:bg-amber-950/40 border-amber-200 dark:border-amber-700/60",
    accentText: "text-amber-600 dark:text-amber-400",
    check: "text-amber-500",
    btn: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white",
    badge: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
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
        幅設計: `max-w-[1400px]` + `w-[min(95vw,1400px)]` で広いディスプレイでは 1400px、
        狭い画面では 95vw に収める。DialogContent の基底 `sm:max-w-lg` を上書き。
      */}
      <DialogContent
        className="!max-w-[1400px] w-[min(95vw,1400px)] max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 border-border/60"
      >
        {/* ── ヘッダー ── */}
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-border/40 bg-gradient-to-br from-violet-50/40 via-background to-amber-50/30 dark:from-violet-950/20 dark:via-background dark:to-amber-950/10">
          <DialogTitle className="text-2xl font-extrabold text-center tracking-tight">
            {isJa ? "料金プラン" : "Pricing Plans"}
          </DialogTitle>
          <DialogDescription className="text-center text-[13px] text-muted-foreground">
            {isJa
              ? "AI回数・テンプレート数・採点/OMR などプランごとに使える機能が異なります"
              : "Each plan unlocks different AI limits, templates, and pro features like grading & OCR"}
          </DialogDescription>
        </DialogHeader>

        {/* ── カードグリッド ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 px-8 pt-8 pb-6">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const theme = PLAN_THEMES[planId];
            const isActive = currentPlan === planId;
            const isLower = PLAN_RANK_UI[planId] < PLAN_RANK_UI[currentPlan];
            const features = isJa ? plan.features : plan.featuresEn;
            const isPremium = planId === "premium";
            const isPro = planId === "pro";
            // 1日あたり換算 (おおよそ30日で割る)
            const perDay = plan.price > 0 ? Math.round(plan.price / 30) : 0;

            return (
              <div
                key={planId}
                className={`relative rounded-2xl border flex flex-col min-w-0 ${theme.bg} ${theme.border} ${
                  isPremium || isPro ? "shadow-xl" : "shadow-md"
                } ${isActive ? "ring-2 ring-offset-2 ring-offset-background ring-emerald-400" : ""} transition-all`}
              >
                {/* バッジ */}
                {plan.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shadow-md ${theme.badge}`}>
                    {plan.badge}
                  </span>
                )}

                <div className="p-6 flex flex-col flex-1">
                  {/* ── ヘッダー: アイコン + プラン名 + tagline ── */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${theme.iconBg}`}>
                      {PLAN_ICONS[planId]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-lg tracking-tight leading-tight">{plan.name}</h3>
                      <p className="text-[11px] text-muted-foreground/70 leading-snug mt-0.5">
                        {isJa ? plan.tagline : plan.taglineEn}
                      </p>
                    </div>
                  </div>

                  {/* ── 価格 ── */}
                  <div className="mb-1">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-black tracking-tight text-4xl">
                        {plan.priceLabel}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-sm text-muted-foreground font-medium">
                          {isJa ? "/ 月" : "/ mo"}
                        </span>
                      )}
                    </div>
                    {perDay > 0 ? (
                      <p className={`text-[11px] font-medium mt-1 ${theme.accentText}`}>
                        {isJa ? `1日あたり約 ¥${perDay}` : `~¥${perDay} / day`}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {isJa ? "クレジットカード登録不要" : "No credit card required"}
                      </p>
                    )}
                  </div>

                  {/* ── AI回数ハイライト ── */}
                  <div className={`rounded-xl border px-4 py-3 mt-4 mb-5 ${theme.highlight}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1 ${theme.accentText}`}>
                      {isJa ? "高性能AI" : "Premium AI"}
                    </div>
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className={`text-[32px] font-black leading-none tracking-tight ${theme.accentText}`}>
                        {plan.requestsPerMonth.toLocaleString()}
                      </span>
                      <span className="text-[12px] text-muted-foreground font-semibold">
                        {isJa ? "回 / 月" : "req / mo"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {isJa
                        ? `1日最大 ${plan.requestsPerDay.toLocaleString()} 回`
                        : `Up to ${plan.requestsPerDay.toLocaleString()} / day`}
                    </div>
                  </div>

                  {/* ── 機能一覧 ── */}
                  <ul
                    className="space-y-2.5 mb-6 flex-1"
                    // Japanese の1文字ずつ折返しを抑制 (カード幅が狭いときでも単語境界を尊重)
                    style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
                  >
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground/85">
                        <span className={`shrink-0 mt-0.5 h-4 w-4 rounded-full bg-current/10 flex items-center justify-center ${theme.check}`}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="flex-1">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* ── ボタン ── */}
                  <Button
                    className={`w-full h-11 text-[13px] font-bold whitespace-nowrap ${theme.btn} ${(isActive || isLower) ? "opacity-55 cursor-default grayscale-[0.4]" : "hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0 transition-all"}`}
                    onClick={() => handleSelect(planId)}
                    disabled={isActive || isLower || isRedirecting}
                  >
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" />
                        {isJa ? "ご契約中のプラン" : "Your current plan"}
                      </span>
                    ) : isLower
                      ? (isJa ? "上位プラン契約中" : "On higher plan")
                      : isRedirecting
                      ? (isJa ? "処理中..." : "Redirecting...")
                      : planId === "free"
                      ? (isJa ? "Freeで始める" : "Start Free")
                      : (isJa ? `${plan.name}にアップグレード` : `Upgrade to ${plan.name}`)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── フッター: 決済 trust badges + 注記 ── */}
        <div className="px-8 py-5 border-t border-border/40 bg-muted/30">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground mb-2">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isJa ? "Stripeによる安全な決済" : "Secure Stripe checkout"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {isJa ? "いつでもキャンセル可能" : "Cancel anytime"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {isJa ? "領収書発行対応" : "Receipts available"}
            </span>
          </div>
          <p className="text-center text-[10.5px] text-muted-foreground/70">
            {isJa
              ? "※ Googleアカウントでログインしてプランを選択すると、Stripeの決済画面に移動します。"
              : "* Sign in with Google and select a plan to proceed to Stripe checkout."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
