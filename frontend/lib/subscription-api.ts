import { PlanId } from "@/lib/plans";

export interface SubscriptionStatus {
  plan_id: PlanId;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

/** 現在のサブスクリプション状態をバックエンドから取得する。 */
export async function fetchMySubscription(): Promise<SubscriptionStatus> {
  const res = await fetch("/api/subscription/me", { cache: "no-store" });
  if (!res.ok) return { plan_id: "free", status: "free", current_period_end: null, cancel_at_period_end: false, stripe_customer_id: null };
  return res.json();
}

/**
 * Stripe Checkout Session を作成してリダイレクト先URLを返す。
 * エラー時は理由付きで例外を投げる。
 */
export async function createCheckoutSession(planId: PlanId): Promise<string> {
  const res = await fetch("/api/subscription/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: planId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail || `HTTP ${res.status}`;
    throw new Error(`Checkout failed: ${detail}`);
  }
  const data = await res.json();
  if (!data.checkout_url) {
    throw new Error("Checkout URL was empty");
  }
  return data.checkout_url;
}

/**
 * Stripe Customer Portal Session を作成してリダイレクト先URLを返す。
 * エラー時は null を返す。
 */
export async function createPortalSession(): Promise<string | null> {
  const res = await fetch("/api/subscription/portal", { method: "POST" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.portal_url ?? null;
}
