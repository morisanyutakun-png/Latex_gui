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
    requestsPerDay: 10,           // 内部制限 (表示しない)
    requestsPerMonth: 30,
    premiumAiPerMonth: 3,
    tagline: "まずは体験してみたい方に",
    taglineEn: "Try before you commit",
    features: [
      "AI教材生成 月30回",
      "高性能AI 月3回まで",
      "PDF出力 月1回まで",
      "基本テンプレート",
      "エディタ上でプレビュー",
    ],
    featuresEn: [
      "AI generation: 30/month",
      "High-performance AI: 3/month",
      "PDF export: 1/month",
      "Basic templates",
      "In-editor preview",
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
      "AI教材生成 月400回",
      "高性能AI 月40回",
      "PDF出力 無制限",
      "基本テンプレート",
      "思考ログ表示",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "AI generation: 400/month",
      "High-performance AI: 40/month",
      "Unlimited PDF export",
      "Basic templates",
      "Thinking log display",
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
      "AI教材生成 月1,500回",
      "高性能AI 月200回 (5倍)",
      "PDF出力 無制限 (優先キュー)",
      "全テンプレート利用可",
      "PDF・画像から問題を抽出",
      "バッチ処理 (上限100行)",
      "メールサポート",
    ],
    featuresEn: [
      "AI generation: 1,500/month",
      "High-performance AI: 200/month (5×)",
      "Unlimited PDF export (priority)",
      "All templates",
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
      "AI教材生成 月8,000回",
      "高性能AI 月800回 (20倍)",
      "PDF出力 無制限 (最優先キュー)",
      "Proの全機能を含む",
      "バッチ処理 (最大300行)",
      "カスタムテンプレート作成",
      "紙デザインそのままPDF出力",
      "専任サポート担当",
    ],
    featuresEn: [
      "AI generation: 8,000/month",
      "High-performance AI: 800/month (20×)",
      "Unlimited PDF export (highest priority)",
      "Everything in Pro",
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
  // 実測値: $0.01/リクエスト ≈ ¥1.5 ($1=¥150)
  // 現在は全リクエスト同一モデルのため一律コスト
  const costPerReq = 1.5;          // 円/リクエスト (実測 $0.01)
  const standardCost = 0;          // 内部区分用 (現在は未使用)
  const premiumCost = 0;           // 内部区分用 (現在は未使用)
  const maxMonthlyCost = plan.requestsPerMonth * costPerReq;
  const revenue = plan.price;
  const margin = revenue - maxMonthlyCost;
  return { standardCost, premiumCost, maxMonthlyCost, revenue, margin };
}
// 利益試算 (実測 $0.01/req = ¥1.5, 全上限使い切った最悪ケース):
//   free:    cost ¥45,      revenue ¥0       → margin -¥45    (獲得コスト)
//   starter: cost ¥600,     revenue ¥1,980   → margin +¥1,380 (利益率 70%)
//   pro:     cost ¥2,250,   revenue ¥4,980   → margin +¥2,730 (利益率 55%)
//   premium: cost ¥12,000,  revenue ¥19,800  → margin +¥7,800 (利益率 39%)
//
// Stripe手数料 (3.6% + ¥40) 控除後:
//   starter: net ¥1,869 → margin +¥1,269 (利益率 68%)
//   pro:     net ¥4,701 → margin +¥2,451 (利益率 52%)
//   premium: net ¥19,047 → margin +¥7,047 (利益率 37%)
//
// 実利用率 (典型 30-40%) を掛けると:
//   starter: 実コスト ≈ ¥210  → 実利益 ≈ ¥1,659 (利益率 89%)
//   pro:     実コスト ≈ ¥788  → 実利益 ≈ ¥3,913 (利益率 83%)
//   premium: 実コスト ≈ ¥4,200 → 実利益 ≈ ¥14,847 (利益率 78%)
