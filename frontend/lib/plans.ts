/**
 * EddivomAI 料金プラン定義
 *
 * 差別化戦略:
 *   全プランで同一の高性能AIを搭載 (モデル名は非公開)。
 *   AI回数・PDF出力回数・機能解放で段階的に差別化。
 *   月額払い (Stripe) のみ。
 *
 *   Free  → 「良さは分かるけどPDF月1回じゃ足りない」→ Starter へ
 *   Starter → 「テンプレートもっと欲しい、OCR使いたい」→ Pro へ
 *   Pro  → 「大量に使う、カスタムしたい」→ Premium へ
 *
 * 内部コスト: $0.01/リクエスト ≈ ¥1.5 (実測値)
 */

export type PlanId = "free" | "starter" | "pro" | "premium";

export interface PlanDef {
  id: PlanId;
  name: string;
  nameEn: string;
  price: number;            // 月額 (円, 税込)
  priceLabel: string;       // 表示用
  requestsPerDay: number;   // 1日のAIリクエスト上限 (内部スロットル)
  requestsPerMonth: number; // 月間AIリクエスト上限
  premiumAiPerMonth: number; // 互換用 (= requestsPerMonth と同値、UI上は区別しない)
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
    requestsPerMonth: 3,
    premiumAiPerMonth: 3,
    tagline: "まずは体験してみたい方に",
    taglineEn: "Try before you commit",
    features: [
      "高性能AI 月3回",
      "PDF出力 月1回",
      "基本テンプレート",
      "リアルタイムプレビュー",
      "思考ログ表示",
    ],
    featuresEn: [
      "High-performance AI: 3/month",
      "PDF export: 1/month",
      "Basic templates",
      "Real-time preview",
      "Thinking log display",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    nameEn: "Starter",
    price: 1980,
    priceLabel: "¥1,980",
    requestsPerDay: 15,
    requestsPerMonth: 150,
    premiumAiPerMonth: 150,
    tagline: "個人塾・家庭教師の方に",
    taglineEn: "For individual tutors",
    features: [
      "高性能AI 月150回",
      "PDF出力 無制限",
      "基本テンプレート",
      "リアルタイムプレビュー",
      "思考ログ表示",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "High-performance AI: 150/month",
      "Unlimited PDF export",
      "Basic templates",
      "Real-time preview",
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
    requestsPerDay: 40,
    requestsPerMonth: 500,
    premiumAiPerMonth: 500,
    tagline: "毎日使うならこのプラン",
    taglineEn: "Best for daily use",
    features: [
      "高性能AI 月500回",
      "PDF出力 無制限 (優先処理)",
      "全テンプレート利用可",
      "PDF・画像から問題を抽出 (OCR)",
      "バッチ処理 (最大100行)",
      "メールサポート",
    ],
    featuresEn: [
      "High-performance AI: 500/month",
      "Unlimited PDF export (priority)",
      "All templates",
      "Import from PDF & images (OCR)",
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
    requestsPerDay: 150,
    requestsPerMonth: 2000,
    premiumAiPerMonth: 2000,
    tagline: "教育機関・大量利用に",
    taglineEn: "For schools & heavy use",
    features: [
      "高性能AI 月2,000回",
      "PDF出力 無制限 (最優先処理)",
      "Proの全機能を含む",
      "バッチ処理 (最大300行)",
      "カスタムテンプレート作成",
      "紙デザインそのままPDF出力",
      "専任サポート担当",
    ],
    featuresEn: [
      "High-performance AI: 2,000/month",
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
  const costPerReq = 1.5;
  const standardCost = 0;
  const premiumCost = 0;
  const maxMonthlyCost = plan.requestsPerMonth * costPerReq;
  const revenue = plan.price;
  const margin = revenue - maxMonthlyCost;
  return { standardCost, premiumCost, maxMonthlyCost, revenue, margin };
}
// 利益試算 (実測 $0.01/req = ¥1.5, 全上限使い切った最悪ケース):
//   free:    cost ¥4.5,   revenue ¥0       → margin -¥4.5    (獲得コスト)
//   starter: cost ¥225,   revenue ¥1,980   → margin +¥1,755  (利益率 89%)
//   pro:     cost ¥750,   revenue ¥4,980   → margin +¥4,230  (利益率 85%)
//   premium: cost ¥3,000, revenue ¥19,800  → margin +¥16,800 (利益率 85%)
//
// Stripe手数料 (3.6% + ¥40) 控除後:
//   starter: net ¥1,869 → margin +¥1,644 (利益率 88%)
//   pro:     net ¥4,701 → margin +¥3,951 (利益率 84%)
//   premium: net ¥19,047 → margin +¥16,047 (利益率 84%)
