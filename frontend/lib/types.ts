/**
 * Raw LaTeX Document Model
 * Template-driven editing — AI / user edit raw LaTeX directly.
 */

// ──── LaTeX Document Classes ────

export type LaTeXDocumentClass =
  | "article"
  | "report"
  | "book"
  | "letter"
  | "beamer"
  | "jlreq"
  | "ltjsarticle";

export interface DocumentClassInfo {
  id: LaTeXDocumentClass;
  name: string;
  japanese: string;
  description: string;
  features: string[];
  icon: string;
}

export const DOCUMENT_CLASSES: DocumentClassInfo[] = [
  {
    id: "article",
    name: "article",
    japanese: "論文・レポート",
    description: "短い文書向け。セクション見出しで構成。",
    features: ["セクション", "サブセクション", "概要", "二段組対応"],
    icon: "📝",
  },
  {
    id: "report",
    name: "report",
    japanese: "報告書",
    description: "章立てのある長い報告書。表紙ページ付き。",
    features: ["章", "セクション", "付録", "表紙ページ"],
    icon: "📊",
  },
  {
    id: "book",
    name: "book",
    japanese: "書籍",
    description: "書籍向け。左右ページの区別、部・章構成。",
    features: ["部", "章", "前付け", "見開き対応"],
    icon: "📚",
  },
  {
    id: "letter",
    name: "letter",
    japanese: "手紙",
    description: "ビジネスレター形式。宛先・署名付き。",
    features: ["挨拶文", "結語", "署名", "封筒対応"],
    icon: "✉️",
  },
  {
    id: "beamer",
    name: "beamer",
    japanese: "スライド",
    description: "プレゼンテーション用スライド。",
    features: ["スライド", "一時停止", "テーマ切替", "アニメーション"],
    icon: "🖥️",
  },
  {
    id: "jlreq",
    name: "jlreq",
    japanese: "日本語文書",
    description: "日本語組版ルールに準拠した文書。",
    features: ["JIS組版", "縦書き対応", "ルビ", "圏点"],
    icon: "🇯🇵",
  },
];

// ──── Document Settings ────

export interface DocumentSettings {
  paperSize: "a4" | "letter" | "b5";
  margins: { top: number; bottom: number; left: number; right: number };
  lineSpacing: number;
  pageNumbers: boolean;
  documentClass: LaTeXDocumentClass;
}

// ──── Document Metadata ────

export interface DocumentMetadata {
  title: string;
  author: string;
  date?: string;
}

// ──── Document Model ────

export interface DocumentModel {
  template: string;
  metadata: DocumentMetadata;
  settings: DocumentSettings;
  /** raw LaTeX source — what AI / user edits directly */
  latex: string;
}

// ──── Defaults ────

export const DEFAULT_SETTINGS: DocumentSettings = {
  paperSize: "a4",
  margins: { top: 25, bottom: 25, left: 20, right: 20 },
  lineSpacing: 1.15,
  pageNumbers: true,
  documentClass: "article",
};

export function createDefaultDocument(template: string, latex: string): DocumentModel {
  return {
    template,
    metadata: { title: "", author: "" },
    settings: { ...DEFAULT_SETTINGS },
    latex,
  };
}

// ──── Batch (量産) Types ────

export interface BatchRequest {
  template: DocumentModel;
  variablesCsv?: string;
  variablesJson?: string;
  filenameTemplate: string;
  maxRows: number;
}

export interface BatchResultItem {
  index: number;
  filename: string;
  success: boolean;
  error?: string;
  timeMs?: number;
}

// ──── AI Chat Types ────

export interface ThinkingStep {
  type: "thinking" | "tool_call" | "tool_result" | "error";
  text: string;
  tool?: string;
  duration?: number;
  result?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** New LaTeX produced by this message (if any) */
  latex?: string | null;
  appliedAt?: number;
  feedback?: "good" | "bad" | null;
  changeSummary?: string;
  thinkingSteps?: ThinkingStep[];
  requestId?: string;
  timestamp?: number;
  duration?: number;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
  isStreaming?: boolean;
}

// ──── Scoring (OMR採点) ────

export interface AnswerKeyItem {
  questionId: string;
  correctAnswer: string;
  points: number;
  answerType: "choice" | "numeric" | "text";
}

export interface AnswerKey {
  title: string;
  items: AnswerKeyItem[];
  totalPoints: number;
}

export interface StudentAnswer {
  questionId: string;
  answer: string;
  confidence: number;
}

export interface ScoreResultItem {
  questionId: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
}

export interface ScoreResult {
  totalScore: number;
  totalPossible: number;
  percentage: number;
  items: ScoreResultItem[];
}
