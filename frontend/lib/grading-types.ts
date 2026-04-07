/**
 * 採点モード型定義 (camelCase)
 *
 * Backend `grading_models.py` のミラー。
 */

// ──── ルーブリック ────

export interface RubricCriterion {
  description: string;
  weight: number;
  hint?: string | null;
}

export interface Rubric {
  questionId: string;
  questionLabel: string;
  maxPoints: number;
  criteria: RubricCriterion[];
  hint?: string | null;
  sourceLine?: number | null;
}

export interface RubricBundle {
  rubrics: Rubric[];
  totalPoints: number;
  parseWarnings: string[];
}

// ──── 採点入力 ────

export interface AnswerPage {
  pageIndex: number;
  imageUrl?: string | null;
  widthPx: number;
  heightPx: number;
}

export interface GradingRequest {
  rubrics: RubricBundle;
  problemLatex: string;
  answerPages: AnswerPage[];
  studentName: string;
  studentId: string;
}

// ──── 採点結果 ────

export interface BBox {
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MarkKind = "circle" | "cross" | "triangle" | "comment" | "score";

export interface Mark {
  kind: MarkKind;
  bbox?: BBox | null;
  text?: string | null;
}

export interface CriterionResult {
  description: string;
  weight: number;
  awarded: number;
  comment: string;
}

export interface GradedQuestion {
  questionId: string;
  questionLabel: string;
  maxPoints: number;
  awardedPoints: number;
  transcribedAnswer: string;
  overallComment: string;
  criteriaResults: CriterionResult[];
  marks: Mark[];
}

export interface GradingResult {
  studentName: string;
  studentId: string;
  totalPoints: number;
  maxPoints: number;
  percentage: number;
  questions: GradedQuestion[];
  answerPages: AnswerPage[];
  overallFeedback: string;
}

// ──── ステップ進行 ────

export type GradingPhase =
  | "idle"
  | "step1-rubric"
  | "step2-upload"
  | "step3-grading"
  | "step4-result"
  | "error";

// ──── SSE イベント ────

export type GradingStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "question_done"; questionId: string; awarded: number; max: number }
  | { type: "done"; result: GradingResult }
  | { type: "error"; message: string };
