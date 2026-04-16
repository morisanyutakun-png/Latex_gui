/**
 * EddivomAI 料金プラン定義
 *
 * 差別化軸:
 *   1. 高性能AI 回数 (主軸 — コストに直結)
 *   2. 教材PDF出力 回数 (Free のみ制限)
 *   3. 機能解放 (採点/OMR/OCR は Starter+、バッチは Pro+、カスタムテンプレは Premium)
 *
 * TikZ図の作成・保存、リアルタイムプレビュー、思考ログは全プラン共通 (無制限)。
 * 月額払い (Stripe) のみ。内部コスト: $0.01/リクエスト ≈ ¥1.5 (実測値)
 */

export type PlanId = "free" | "starter" | "pro" | "premium";

/** プランでゲートする機能 */
export type GatedFeature =
  | "grading"          // 採点・自動採点
  | "ocr"              // PDF・画像から問題抽出
  | "latexExport"      // LaTeXソースエクスポート
  | "allTemplates"     // 全テンプレート利用
  | "batch"            // バッチ処理
  | "customTemplates"; // カスタムテンプレート作成

/** 機能 → 使えるようになる最低プラン */
const FEATURE_MIN_PLAN: Record<GatedFeature, PlanId> = {
  grading:         "starter",
  ocr:             "starter",
  latexExport:     "starter",
  allTemplates:    "pro",
  batch:           "pro",
  customTemplates: "premium",
};

/** 機能ごとの日本語ラベル (アップグレード促進メッセージ用) */
export const FEATURE_LABELS: Record<GatedFeature, { ja: string; en: string }> = {
  grading:         { ja: "採点・自動採点", en: "Grading & auto-scoring" },
  ocr:             { ja: "PDF・画像取り込み (OCR)", en: "PDF & image import (OCR)" },
  latexExport:     { ja: "LaTeXソースエクスポート", en: "LaTeX source export" },
  allTemplates:    { ja: "全テンプレート利用", en: "All templates" },
  batch:           { ja: "バッチ処理", en: "Batch processing" },
  customTemplates: { ja: "カスタムテンプレート作成", en: "Custom template creation" },
};

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, premium: 3 };

/** 現在のプランでその機能が使えるか判定 */
export function canUseFeature(currentPlan: PlanId, feature: GatedFeature): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

/** 機能を使うのに必要な最低プラン名を返す */
export function requiredPlanFor(feature: GatedFeature): PlanId {
  return FEATURE_MIN_PLAN[feature];
}

export interface PlanDef {
  id: PlanId;
  name: string;
  nameEn: string;
  price: number;            // 月額 (円, 税込)
  priceLabel: string;       // 表示用
  requestsPerDay: number;   // 1日のAIリクエスト上限 (内部スロットル)
  requestsPerMonth: number; // 月間AIリクエスト上限
  premiumAiPerMonth: number; // 互換用 (= requestsPerMonth)
  pdfPerMonth: number;      // 月間 教材PDF出力 上限 (0 = 無制限)
  batchMaxRows: number;     // バッチ処理の最大行数 (0 = 利用不可)
  tagline: string;
  taglineEn: string;
  features: string[];
  featuresEn: string[];
  highlight?: boolean;
  badge?: string;
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
    pdfPerMonth: 1,
    batchMaxRows: 0,
    tagline: "まずは体験してみたい方に",
    taglineEn: "Try before you commit",
    features: [
      "高性能AI 月3回",
      "教材PDF出力 月1回",
      "TikZ図の作成・保存 無制限",
      "基本テンプレート",
      "リアルタイムプレビュー",
      "思考ログ表示",
    ],
    featuresEn: [
      "High-performance AI: 3/month",
      "Worksheet PDF: 1/month",
      "TikZ figures: unlimited",
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
    pdfPerMonth: 0,
    batchMaxRows: 0,
    tagline: "個人塾・家庭教師の方に",
    taglineEn: "For individual tutors",
    features: [
      "高性能AI 月150回",
      "教材PDF出力 無制限",
      "TikZ図の作成・保存 無制限",
      "採点・自動採点 (OMR)",
      "PDF・画像取り込み (OCR)",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "High-performance AI: 150/month",
      "Worksheet PDF: unlimited",
      "TikZ figures: unlimited",
      "Grading & auto-scoring (OMR)",
      "PDF & image import (OCR)",
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
    pdfPerMonth: 0,
    batchMaxRows: 100,
    tagline: "毎日使うならこのプラン",
    taglineEn: "Best for daily use",
    features: [
      "高性能AI 月500回",
      "教材PDF出力 無制限 (優先処理)",
      "TikZ図の作成・保存 無制限",
      "全テンプレート利用可",
      "採点・自動採点 (OMR)",
      "PDF・画像取り込み (OCR)",
      "バッチ処理 (最大100行)",
    ],
    featuresEn: [
      "High-performance AI: 500/month",
      "Worksheet PDF: unlimited (priority)",
      "TikZ figures: unlimited",
      "All templates",
      "Grading & auto-scoring (OMR)",
      "PDF & image import (OCR)",
      "Batch processing (up to 100 rows)",
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
    pdfPerMonth: 0,
    batchMaxRows: 300,
    tagline: "教育機関・大量利用に",
    taglineEn: "For schools & heavy use",
    features: [
      "高性能AI 月2,000回",
      "教材PDF出力 無制限 (最優先処理)",
      "TikZ図の作成・保存 無制限",
      "全テンプレート + カスタム作成",
      "採点・自動採点 (OMR)",
      "PDF・画像取り込み (OCR)",
      "バッチ処理 (最大300行)",
    ],
    featuresEn: [
      "High-performance AI: 2,000/month",
      "Worksheet PDF: unlimited (highest priority)",
      "TikZ figures: unlimited",
      "All templates + custom creation",
      "Grading & auto-scoring (OMR)",
      "PDF & image import (OCR)",
      "Batch processing (up to 300 rows)",
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
