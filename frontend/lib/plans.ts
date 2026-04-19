/**
 * EddivomAI 料金プラン定義
 *
 * 差別化軸:
 *   1. 高性能AI 回数 (主軸 — コストに直結)
 *   2. 教材PDF出力 回数 (Free のみ 1回/月、Starter 以上は無制限)
 *   3. 機能解放:
 *        - Starter+: LaTeXソースエクスポート (+ 上記の数量UP)
 *        - Pro+:     採点 / OMR(OCR) / 全テンプレート / バッチ処理
 *   4. テンプレート数:
 *        - Free / Starter: 基本 6 種類 (blank / article / letter / worksheet / school-test / kaisetsu-note)
 *        - Pro / Premium:  全 12 種類 (+ 共通テスト / 国公立二次 / 塾プリント / 英語 / 報告書 / 発表スライド)
 *
 * TikZ図の作成・保存、リアルタイムプレビュー、思考ログは全プラン共通 (無制限)。
 * 月額払い (Stripe) のみ。内部コスト: $0.01/リクエスト ≈ ¥1.5 (実測値)
 */

export type PlanId = "free" | "starter" | "pro" | "premium";

/**
 * プランでゲートする機能。
 *
 * LP の公約と必ず一致させる。LP に載せた機能はここに定義し、
 * UI およびサーバで `canUseFeature` / `require_feature` を使って強制する。
 * customTemplates はエディタに実装が無いため LP からも除外してある。
 */
export type GatedFeature =
  | "grading"          // 採点・自動採点 (Pro+)
  | "ocr"              // PDF・画像から問題抽出 (Pro+)
  | "latexExport"      // LaTeXソースエクスポート (Starter+)
  | "allTemplates"     // 全テンプレート利用 (Pro+)
  | "batch";           // バッチ処理 (Pro+)

/** 機能 → 使えるようになる最低プラン (バックエンド plan_limits.py と同期必須) */
const FEATURE_MIN_PLAN: Record<GatedFeature, PlanId> = {
  grading:         "pro",
  ocr:             "pro",
  latexExport:     "starter",
  allTemplates:    "pro",
  batch:           "pro",
};

/** 機能ごとの日本語ラベル (アップグレード促進メッセージ用) */
export const FEATURE_LABELS: Record<GatedFeature, { ja: string; en: string }> = {
  grading:         { ja: "採点・自動採点", en: "Grading & auto-scoring" },
  ocr:             { ja: "PDF・画像取り込み (OCR)", en: "PDF & image import (OCR)" },
  latexExport:     { ja: "LaTeXソースエクスポート", en: "LaTeX source export" },
  allTemplates:    { ja: "全テンプレート利用", en: "All templates" },
  batch:           { ja: "バッチ処理", en: "Batch processing" },
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

/**
 * 機能が使えない状態で表示する短い「必要プラン」ラベル。
 * 例: `requiredPlanLabel("ocr", "ja")` → `"Proプラン〜"`
 */
export function requiredPlanLabel(feature: GatedFeature, locale: "ja" | "en" = "ja"): string {
  const name = PLANS[requiredPlanFor(feature)].name;
  return locale === "en" ? `${name}+` : `${name}プラン〜`;
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
      "基本テンプレート 6種類",
      "TikZ図の作成・保存 無制限",
      "リアルタイムプレビュー",
      "思考ログ表示",
    ],
    featuresEn: [
      "Premium AI: 3 / month",
      "Worksheet PDF: 1 / month",
      "6 basic templates",
      "Unlimited TikZ figures",
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
      "高性能AI 月150回 (1日15回まで)",
      "教材PDF出力 無制限",
      "基本テンプレート 6種類",
      "LaTeXソースエクスポート",
      "TikZ図の作成・保存 無制限",
    ],
    featuresEn: [
      "Premium AI: 150 / month (15 / day)",
      "Worksheet PDF: unlimited",
      "6 basic templates",
      "LaTeX source export",
      "Unlimited TikZ figures",
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
      "高性能AI 月500回 (1日40回まで)",
      "教材PDF出力 無制限 (優先処理)",
      "全テンプレート 12種類 (入試・発表含む)",
      "採点・自動採点 (OMR)",
      "PDF・画像取り込み (OCR)",
      "バッチ処理 (最大100行)",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "Premium AI: 500 / month (40 / day)",
      "Worksheet PDF: unlimited (priority)",
      "All 12 templates (exams, slides, etc.)",
      "Grading & auto-scoring (OMR)",
      "PDF & image import (OCR)",
      "Batch processing (up to 100 rows)",
      "LaTeX source export",
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
      "高性能AI 月2,000回 (1日150回まで)",
      "教材PDF出力 無制限 (最優先処理)",
      "全テンプレート 12種類 (入試・発表含む)",
      "採点・自動採点 (OMR)",
      "PDF・画像取り込み (OCR)",
      "バッチ処理 (最大300行)",
      "LaTeXソースエクスポート",
    ],
    featuresEn: [
      "Premium AI: 2,000 / month (150 / day)",
      "Worksheet PDF: unlimited (highest priority)",
      "All 12 templates (exams, slides, etc.)",
      "Grading & auto-scoring (OMR)",
      "PDF & image import (OCR)",
      "Batch processing (up to 300 rows)",
      "LaTeX source export",
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
