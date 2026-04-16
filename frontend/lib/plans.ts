/**
 * EddivomAI 料金プラン定義
 *
 * 差別化戦略:
 *   全プラン共通で軽量AI を使い、**高性能AI (high-performance AI) の月間回数**
 *   を主軸にプランを差別化する。松竹梅 (Starter → Pro → Premium) の3段階。
 *
 * 内部コスト見積もり (参考):
 *   軽量AI:    ~¥4/リクエスト
 *   高性能AI:  ~¥18/リクエスト
 *   (入力 ~9,000 tokens, 出力 ~4,300 tokens 想定)
 */

export type PlanId = "free" | "starter" | "pro" | "premium";

export interface PlanDef {
  id: PlanId;
  name: string;
  nameEn: string;
  price: number;            // 月額 (円, 税込)
  priceLabel: string;       // 表示用
  requestsPerDay: number;   // 1日の標準AIリクエスト上限
  requestsPerMonth: number; // 月間標準AIリクエスト上限
  premiumAiPerMonth: number; // 月間「高性能AI」リクエスト上限 (0 = 利用不可)
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
    premiumAiPerMonth: 5,
    features: [
      "標準AI 3回/日 (月30回)",
      "高性能AI 月5回まで (お試し)",
      "基本テンプレート",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "Standard AI: 3/day (30/month)",
      "High-performance AI: 5/month (trial)",
      "Basic templates",
      "PDF export",
      "LaTeX source export",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    nameEn: "Starter",
    price: 1480,
    priceLabel: "¥1,480",
    requestsPerDay: 15,
    requestsPerMonth: 300,
    premiumAiPerMonth: 30,
    features: [
      "標準AI 15回/日 (月300回)",
      "高性能AI 月30回まで",
      "基本テンプレート",
      "思考ログ表示",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "Standard AI: 15/day (300/month)",
      "High-performance AI: 30/month",
      "Basic templates",
      "Thinking log display",
      "PDF export",
      "LaTeX source export",
    ],
    badge: "松",
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameEn: "Pro",
    price: 4800,
    priceLabel: "¥4,800",
    requestsPerDay: 50,
    requestsPerMonth: 1200,
    premiumAiPerMonth: 150,
    features: [
      "標準AI 50回/日 (月1,200回)",
      "高性能AI 月150回まで (5倍)",
      "全テンプレート利用可",
      "PDF出力 (優先キュー)",
      "バッチ処理 (上限100行)",
      "画像 (OMR) 解析",
      "メールサポート",
    ],
    featuresEn: [
      "Standard AI: 50/day (1,200/month)",
      "High-performance AI: 150/month (5×)",
      "All templates",
      "PDF export (priority queue)",
      "Batch processing (up to 100 rows)",
      "Image (OMR) analysis",
      "Email support",
    ],
    highlight: true,
    badge: "竹 · 人気",
  },
  premium: {
    id: "premium",
    name: "Premium",
    nameEn: "Premium",
    price: 14800,
    priceLabel: "¥14,800",
    requestsPerDay: 200,
    requestsPerMonth: 5000,
    premiumAiPerMonth: 600,
    features: [
      "標準AI 200回/日 (月5,000回)",
      "高性能AI 月600回まで (20倍)",
      "全テンプレート利用可",
      "PDF出力 (最優先)",
      "バッチ処理 (上限300行)",
      "画像 (OMR) 解析",
      "優先サポート",
      "カスタムテンプレート作成",
      "紙デザインそのままPDF出力",
    ],
    featuresEn: [
      "Standard AI: 200/day (5,000/month)",
      "High-performance AI: 600/month (20×)",
      "All templates",
      "PDF export (highest priority)",
      "Batch processing (up to 300 rows)",
      "Image (OMR) analysis",
      "Priority support",
      "Custom template creation",
      "Paper design preserved in PDF",
    ],
    badge: "梅 · 最上位",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "premium"];

/** 利益試算ヘルパー (内部用) */
export function estimateMargin(planId: PlanId): {
  standardCost: number;
  premiumCost: number;
  maxMonthlyCost: number;
  revenue: number;
  margin: number;
} {
  const plan = PLANS[planId];
  const standardCostPerReq = 4;   // 円 (軽量AI)
  const premiumCostPerReq = 18;   // 円 (高性能AI)
  const standardReqs = plan.requestsPerMonth - plan.premiumAiPerMonth;
  const standardCost = Math.max(0, standardReqs) * standardCostPerReq;
  const premiumCost = plan.premiumAiPerMonth * premiumCostPerReq;
  const maxMonthlyCost = standardCost + premiumCost;
  const revenue = plan.price;
  const margin = revenue - maxMonthlyCost;
  return { standardCost, premiumCost, maxMonthlyCost, revenue, margin };
}
// 利益試算 (最大使用時):
//   free:    cost ¥190,     revenue ¥0       → margin -¥190 (獲得コスト)
//   starter: cost ¥1,620,   revenue ¥1,480   → margin -¥140 (MVP段階は集客重視)
//   pro:     cost ¥6,900,   revenue ¥4,800   → margin -¥2,100 (実利用率50%想定で黒字化)
//   premium: cost ¥21,400,  revenue ¥14,800  → margin -¥6,600 (実利用率40%想定で黒字化)
//
// 補足: 上記は全上限使い切った場合の最悪ケース。実利用率 (典型 30-50%) を掛けると
//   pro: 実コスト ≈ ¥3,450 → 実利益 ≈ ¥1,350 (利益率 28%)
//   premium: 実コスト ≈ ¥8,560 → 実利益 ≈ ¥6,240 (利益率 42%)
