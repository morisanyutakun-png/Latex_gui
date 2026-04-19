import { PlanId } from "@/lib/plans";

export interface SubscriptionStatus {
  plan_id: PlanId;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

export interface UsageStatus {
  plan_id: PlanId;
  ai_used_day: number;
  ai_used_month: number;
  ai_limit_day: number;
  ai_limit_month: number;
  pdf_used_month: number;
  pdf_limit_month: number;  // 0 = 無制限
  batch_max_rows: number;
}

/**
 * 現在のサブスクリプション状態をバックエンドから取得する。
 * 以前は !res.ok の時に黙って `free` を返していたため、ネットワーク一時失敗が
 * 「プランが Free に降格した」と誤認される致命的な UX バグを生んでいた。
 * 今はステータスコードと共に throw し、呼び出し側 (store のリトライ) に判断を委ねる。
 */
export async function fetchMySubscription(): Promise<SubscriptionStatus> {
  const res = await fetch("/api/subscription/me", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`subscription/me returned ${res.status}`);
  }
  return res.json();
}

export interface CheckoutVerification {
  paid: boolean;
  payment_status?: string;
  value: number;
  currency: string;
  transaction_id: string;
  plan_id: string;
  // backend が redirect 時に DB upsert を試みた結果の診断情報
  upsert?: {
    attempted?: boolean;
    success?: boolean;
    error?: string | null;
    sub_id?: string;
    plan_id?: string;
    user_id_written?: string;
    db_action?: string;
    verified_after_commit?: boolean;
    verified_user_id?: string;
    verified_plan_id?: string;
    verified_status?: string;
    customer_id?: string;
    is_test_session?: boolean;
    subscription_retrieve_error?: string;
    [k: string]: unknown;
  };
}

/**
 * Stripe Checkout Session の支払い状況をサーバサイドで検証する。
 * Google Ads の Purchase conversion を URL パラメータだけで判定させないための関門。
 */
export async function verifyCheckoutSession(sessionId: string): Promise<CheckoutVerification | null> {
  if (!sessionId) {
    console.warn("[verifyCheckoutSession] empty sessionId");
    return null;
  }
  try {
    const res = await fetch(
      `/api/subscription/verify-checkout?session_id=${encodeURIComponent(sessionId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[verifyCheckoutSession] backend returned ${res.status}`,
        body.slice(0, 300),
      );
      return null;
    }
    const data = await res.json();
    return {
      paid: !!data.paid,
      payment_status: data.payment_status,
      value: Number(data.value ?? 0),
      currency: String(data.currency ?? ""),
      transaction_id: String(data.transaction_id ?? sessionId),
      plan_id: String(data.plan_id ?? ""),
      upsert: data.upsert ?? undefined,
    };
  } catch (e) {
    console.error("[verifyCheckoutSession] fetch threw", e);
    return null;
  }
}

/**
 * サーバサイドで記録された今月/今日の利用状況を取得する。
 * ネットワーク失敗を Free フォールバックで隠すと、プラン判定がそこに伝播して
 * 「決済したのに Free に戻る」バグの原因になるため throw する。
 */
export async function fetchMyUsage(): Promise<UsageStatus> {
  const res = await fetch("/api/subscription/usage", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`subscription/usage returned ${res.status}`);
  }
  return res.json();
}

/**
 * Stripe Checkout Session を作成してリダイレクト先URLを返す。
 * エラー時は理由付きで例外を投げる。
 *
 * サーバが「要求プラン ≤ 現プラン」と判定した場合は Stripe を経由せず
 * `action: "already_on_plan"` を返すので、呼び出し側で分岐できる。
 */
export interface CheckoutResult {
  url: string;
  action: "checkout" | "already_on_plan" | "free_activated";
  currentPlan?: PlanId;
}

export async function createCheckoutSession(planId: PlanId): Promise<CheckoutResult> {
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
  return {
    url: String(data.checkout_url),
    action: (data.action as CheckoutResult["action"]) || "checkout",
    currentPlan: (data.current_plan as PlanId | undefined) ?? undefined,
  };
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
