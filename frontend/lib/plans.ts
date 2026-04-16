/**
 * EddivomAI 料金プラン定義
 *
 * 差別化戦略:
 *   全プラン共通で高性能AI搭載。月間リクエスト数と機能で差別化。
 *   Starter → Pro → Premium の3段階 + Free。
 *   Proを「人気No.1」ポジションに据え、Premiumのアンカリング効果で
 *   Proへの誘導を狙う。月額払い (Stripe) のみ。
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
  tagline: string;          // プランの一言説明 (日本語)
  taglineEn: string;        // プランの一言説明 (英語)
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
    tagline: "まずは体験してみたい方に",
    taglineEn: "Try before you commit",
    features: [
      "AI教材生成 3回/日 (月30回)",
      "高性能AI 月5回まで (お試し)",
      "基本テンプレート",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "AI generation: 3/day (30/month)",
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
    price: 1980,
    priceLabel: "¥1,980",
    requestsPerDay: 20,
    requestsPerMonth: 400,
    premiumAiPerMonth: 40,
    tagline: "個人塾・家庭教師の方に",
    taglineEn: "For individual tutors",
    features: [
      "AI教材生成 20回/日 (月400回)",
      "高性能AI 月40回",
      "基本テンプレート",
      "思考ログ表示",
      "PDF出力",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "AI generation: 20/day (400/month)",
      "High-performance AI: 40/month",
      "Basic templates",
      "Thinking log display",
      "PDF export",
      "LaTeX source export",
    ],
    badge: "手軽に始める",
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameEn: "Pro",
    price: 4980,
    priceLabel: "¥4,980",
    requestsPerDay: 60,
    requestsPerMonth: 1500,
    premiumAiPerMonth: 200,
    tagline: "毎日使うならこのプラン",
    taglineEn: "Best for daily use",
    features: [
      "AI教材生成 60回/日 (月1,500回)",
      "高性能AI 月200回 (5倍)",
      "全テンプレート利用可",
      "PDF出力 (優先キュー)",
      "PDF・画像から問題を抽出",
      "バッチ処理 (上限100行)",
      "メールサポート",
    ],
    featuresEn: [
      "AI generation: 60/day (1,500/month)",
      "High-performance AI: 200/month (5×)",
      "All templates",
      "PDF export (priority queue)",
      "Import from PDF & images",
      "Batch processing (up to 100 rows)",
      "Email support",
    ],
    highlight: true,
    badge: "人気 No.1",
  },
  premium: {
    id: "premium",
    name: "Premium",
    nameEn: "Premium",
    price: 19800,
    priceLabel: "¥19,800",
    requestsPerDay: 300,
    requestsPerMonth: 8000,
    premiumAiPerMonth: 800,
    tagline: "教育機関・大量利用に",
    taglineEn: "For schools & heavy use",
    features: [
      "AI教材生成 300回/日 (月8,000回)",
      "高性能AI 月800回 (20倍)",
      "Proの全機能を含む",
      "PDF出力 (最優先キュー)",
      "バッチ処理 (最大300行)",
      "カスタムテンプレート作成",
      "紙デザインそのままPDF出力",
      "専任サポート担当",
    ],
    featuresEn: [
      "AI generation: 300/day (8,000/month)",
      "High-performance AI: 800/month (20×)",
      "Everything in Pro",
      "PDF export (highest priority)",
      "Batch processing (up to 300 rows)",
      "Custom template creation",
      "Paper design preserved in PDF",
      "Dedicated support",
    ],
    badge: "最上位プラン",
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
//   starter: cost ¥2,160,   revenue ¥1,980   → margin -¥180 (集客重視、ほぼトントン)
//   pro:     cost ¥8,800,   revenue ¥4,980   → margin -¥3,820 (実利用率40%想定で黒字化)
//   premium: cost ¥43,200,  revenue ¥19,800  → margin -¥23,400 (実利用率30%想定で黒字化)
//
// 補足: 上記は全上限使い切った場合の最悪ケース。実利用率 (典型 30-50%) を掛けると
//   starter: 実コスト ≈ ¥865 → 実利益 ≈ ¥1,115 (利益率 56%)
//   pro:     実コスト ≈ ¥3,520 → 実利益 ≈ ¥1,460 (利益率 29%)
//   premium: 実コスト ≈ ¥12,960 → 実利益 ≈ ¥6,840 (利益率 35%)
