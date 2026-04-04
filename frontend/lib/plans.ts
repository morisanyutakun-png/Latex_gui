/**
 * EddivomAI 料金プラン定義
 *
 * リクエスト数ベースの制限で利益計算を容易にする。
 * Gemini 2.5 Flash のコスト: ~$0.003/req → 1リクエスト ≈ 0.40円
 * (thinking_budget=2048 で思考トークンを最適化)
 */

export type PlanId = "free" | "starter" | "pro" | "premium";

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
  starter: {
    id: "starter",
    name: "Starter",
    nameEn: "Starter",
    price: 980,
    priceLabel: "¥980",
    requestsPerDay: 30,
    requestsPerMonth: 500,
    features: [
      "AIリクエスト 30回/日",
      "月間500リクエストまで",
      "基本テンプレート",
      "思考ログ表示",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "30 AI requests/day",
      "Up to 500 requests/month",
      "Basic templates",
      "Thinking log display",
      "PDF export",
      "LaTeX source export",
    ],
    badge: "お手頃",
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
    requestsPerDay: 5000,
    requestsPerMonth: 100000,
    features: [
      "AIリクエスト ほぼ無制限",
      "月間100,000リクエスト",
      "全テンプレート利用可",
      "PDF出力 (最優先)",
      "バッチ処理 (上限200行)",
      "画像 (OMR) 解析",
      "優先サポート",
      "API アクセス (近日公開)",
      "カスタムテンプレート作成",
      "紙デザインそのままPDF出力",
    ],
    featuresEn: [
      "AI requests: virtually unlimited",
      "100,000 requests/month",
      "All templates",
      "PDF export (highest priority)",
      "Batch processing (up to 200 rows)",
      "Image (OMR) analysis",
      "Priority support",
      "API access (coming soon)",
      "Custom template creation",
      "Paper design preserved in PDF",
    ],
    badge: "最上位",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "premium"];

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
// free:    max cost ¥40,     revenue ¥0      → margin -¥40
// starter: max cost ¥200,    revenue ¥980    → margin +¥780
// pro:     max cost ¥800,    revenue ¥2,980  → margin +¥2,180
// premium: max cost ¥40,000, revenue ¥12,800 → margin -¥27,200 (理論最大, 実使用は~¥2,000程度)
// ※ premium は "ほぼ無制限" の体験を提供。実際の平均利用は月2,000-5,000リクエスト程度を想定
