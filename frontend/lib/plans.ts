/**
 * EddivomAI 料金プラン定義
 *
 * リクエスト数ベースの制限で利益計算を容易にする。
 * コスト見積もり:
 *   Claude Haiku 3.5: ~$0.024/req → 1リクエスト ≈ ¥3.6
 *     (入力 ~9,000 tokens, 出力 ~4,300 tokens 想定)
 *   Claude Sonnet: ~$0.05/req → 1リクエスト ≈ ¥8
 *     (入力 ~9,000 tokens, 出力 ~4,300 tokens 想定)
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
  sonnetPerMonth: number;   // 月間Sonnetリクエスト上限 (0 = 利用不可)
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
    requestsPerDay: 3,
    requestsPerMonth: 30,
    sonnetPerMonth: 0,
    features: [
      "AIリクエスト 3回/日 (月30回)",
      "AIモデル: 軽量版",
      "基本テンプレート",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "3 AI requests/day (30/month)",
      "AI model: Lightweight",
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
    requestsPerDay: 10,
    requestsPerMonth: 200,
    sonnetPerMonth: 0,
    features: [
      "AIリクエスト 10回/日 (月200回)",
      "AIモデル: 軽量版",
      "基本テンプレート",
      "思考ログ表示",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "10 AI requests/day (200/month)",
      "AI model: Lightweight",
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
    requestsPerDay: 25,
    requestsPerMonth: 500,
    sonnetPerMonth: 50,
    features: [
      "AIリクエスト 25回/日 (月500回)",
      "高精度AI 月50回まで",
      "全テンプレート利用可",
      "PDF出力 (優先キュー)",
      "バッチ処理 (上限50行)",
      "画像 (OMR) 解析",
      "メールサポート",
    ],
    featuresEn: [
      "25 AI requests/day (500/month)",
      "High-quality AI up to 50/month",
      "All templates",
      "PDF export (priority queue)",
      "Batch processing (up to 50 rows)",
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
    requestsPerDay: 80,
    requestsPerMonth: 1500,
    sonnetPerMonth: 200,
    features: [
      "AIリクエスト 80回/日 (月1,500回)",
      "高精度AI 月200回まで",
      "全テンプレート利用可",
      "PDF出力 (最優先)",
      "バッチ処理 (上限200行)",
      "画像 (OMR) 解析",
      "優先サポート",
      "カスタムテンプレート作成",
      "紙デザインそのままPDF出力",
    ],
    featuresEn: [
      "80 AI requests/day (1,500/month)",
      "High-quality AI up to 200/month",
      "All templates",
      "PDF export (highest priority)",
      "Batch processing (up to 200 rows)",
      "Image (OMR) analysis",
      "Priority support",
      "Custom template creation",
      "Paper design preserved in PDF",
    ],
    badge: "最上位",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "premium"];

/** 利益試算ヘルパー (内部用) */
export function estimateMargin(planId: PlanId): {
  haikuCost: number;
  sonnetCost: number;
  maxMonthlyCost: number;
  revenue: number;
  margin: number;
} {
  const plan = PLANS[planId];
  const haikuCostPerReq = 3.6;  // 円 (Claude Haiku 3.5: ~$0.024/req)
  const sonnetCostPerReq = 8;   // 円 (Claude Sonnet: ~$0.05/req)
  const haikuReqs = plan.requestsPerMonth - plan.sonnetPerMonth;
  const haikuCost = haikuReqs * haikuCostPerReq;
  const sonnetCost = plan.sonnetPerMonth * sonnetCostPerReq;
  const maxMonthlyCost = haikuCost + sonnetCost;
  const revenue = plan.price;
  const margin = revenue - maxMonthlyCost;
  return { haikuCost, sonnetCost, maxMonthlyCost, revenue, margin };
}
// free:    cost ¥108,   revenue ¥0      → margin -¥108
// starter: cost ¥720,   revenue ¥980    → margin +¥260  (利益率 27%)
// pro:     cost ¥2,020, revenue ¥2,980  → margin +¥960  (利益率 32%)
// premium: cost ¥6,280, revenue ¥12,800 → margin +¥6,520 (利益率 51%)
