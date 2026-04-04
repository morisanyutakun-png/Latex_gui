/**
 * EddivomAI 料金プラン定義
 *
 * リクエスト数ベースの制限で利益計算を容易にする。
 * Gemini 2.5 Flash のコスト: ~$0.003/req → 1リクエスト ≈ 0.45円
 */

export type PlanId = "free" | "pro" | "premium";

export interface PlanDef {
  id: PlanId;
  name: string;
  nameEn: string;
  price: number;            // 月額 (円, 税込)
  priceLabel: string;       // 表示用
  requestsPerDay: number;   // 1日のAIリクエスト上限
  requestsPerMonth: number; // 月間AIリクエスト上限
  features: string[];       // 機能一覧 (日本語)
  featuresEn: string[];     // 機能一覧 (英語)
  highlight?: boolean;      // おすすめ表示
  badge?: string;           // バッジ表示
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    nameEn: "Free",
    price: 0,
    priceLabel: "¥0",
    requestsPerDay: 10,
    requestsPerMonth: 100,
    features: [
      "AIリクエスト 10回/日",
      "月間100リクエストまで",
      "基本テンプレート",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "10 AI requests/day",
      "Up to 100 requests/month",
      "Basic templates",
      "PDF export",
      "LaTeX source export",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameEn: "Pro",
    price: 2980,
    priceLabel: "¥2,980",
    requestsPerDay: 100,
    requestsPerMonth: 2000,
    features: [
      "AIリクエスト 100回/日",
      "月間2,000リクエストまで",
      "全テンプレート利用可",
      "PDF出力 (優先キュー)",
      "バッチ処理",
      "画像 (OMR) 解析",
      "メールサポート",
    ],
    featuresEn: [
      "100 AI requests/day",
      "Up to 2,000 requests/month",
      "All templates",
      "PDF export (priority queue)",
      "Batch processing",
      "Image (OMR) analysis",
      "Email support",
    ],
    highlight: true,
    badge: "人気",
  },
  premium: {
    id: "premium",
    name: "Premium",
    nameEn: "Premium",
    price: 12800,
    priceLabel: "¥12,800",
    requestsPerDay: 1000,
    requestsPerMonth: 20000,
    features: [
      "AIリクエスト 1,000回/日",
      "月間20,000リクエストまで",
      "全テンプレート利用可",
      "PDF出力 (最優先)",
      "バッチ処理 (上限200行)",
      "画像 (OMR) 解析",
      "優先サポート",
      "API アクセス (近日公開)",
      "カスタムテンプレート作成",
    ],
    featuresEn: [
      "1,000 AI requests/day",
      "Up to 20,000 requests/month",
      "All templates",
      "PDF export (highest priority)",
      "Batch processing (up to 200 rows)",
      "Image (OMR) analysis",
      "Priority support",
      "API access (coming soon)",
      "Custom template creation",
    ],
    badge: "最上位",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "premium"];

/** 利益試算ヘルパー (内部用) */
export function estimateMargin(planId: PlanId): {
  costPerReq: number;
  maxMonthlyCost: number;
  revenue: number;
  margin: number;
} {
  const plan = PLANS[planId];
  const costPerReq = 0.45; // 円 (Gemini 2.5 Flash)
  const maxMonthlyCost = plan.requestsPerMonth * costPerReq;
  const revenue = plan.price;
  const margin = revenue - maxMonthlyCost;
  return { costPerReq, maxMonthlyCost, revenue, margin };
}
// free:    max cost ¥45,    revenue ¥0      → margin -¥45
// pro:     max cost ¥900,   revenue ¥2,980  → margin +¥2,080
// premium: max cost ¥9,000, revenue ¥12,800 → margin +¥3,800
