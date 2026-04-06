/**
 * Block-based Document Model
 * Word-like structured editing → LaTeX structured output
 */

// ──── Block Types ────

export type BlockType =
  | "heading"
  | "paragraph"
  | "math"
  | "list"
  | "table"
  | "image"
  | "divider"
  | "code"
  | "quote"
  | "circuit"
  | "diagram"
  | "chemistry"
  | "chart"
  | "latex";

/**
 * Block types whose editing UI is "heavy" (preset grids, multi-input forms)
 * and should pop out into the LeftReviewPanel rather than expand inline on the paper.
 */
export const HEAVY_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  "chemistry",
  "chart",
  "circuit",
  "diagram",
  "latex",
]);

// ──── Content Models (Discriminated Union) ────

export interface HeadingContent {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
}

export interface ParagraphContent {
  type: "paragraph";
  text: string;
}

export interface MathContent {
  type: "math";
  latex: string;
  displayMode: boolean;
  sourceText?: string;
}

export type ListStyle = "bullet" | "numbered";

export interface ListContent {
  type: "list";
  style: ListStyle;
  items: string[];
}

export interface TableContent {
  type: "table";
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ImageContent {
  type: "image";
  url: string;
  caption: string;
  width?: number;
}

export interface DividerContent {
  type: "divider";
  style: "solid" | "dashed" | "dotted";
}

export interface CodeContent {
  type: "code";
  language: string;
  code: string;
}

export interface QuoteContent {
  type: "quote";
  text: string;
  attribution?: string;
}

export interface CircuitContent {
  type: "circuit";
  code: string;
  caption?: string;
  preset?: string;
}

export interface DiagramContent {
  type: "diagram";
  code: string;
  caption?: string;
  diagramType: "flowchart" | "sequence" | "block" | "state" | "tree" | "agent" | "custom";
  preset?: string;
}

export interface ChemistryContent {
  type: "chemistry";
  formula: string;
  displayMode: boolean;
  caption?: string;
}

export interface ChartContent {
  type: "chart";
  chartType: "line" | "bar" | "scatter" | "histogram";
  code: string;
  caption?: string;
  preset?: string;
}

export interface LaTeXContent {
  type: "latex";
  code: string;
  caption?: string;
}

export type BlockContent =
  | HeadingContent
  | ParagraphContent
  | MathContent
  | ListContent
  | TableContent
  | ImageContent
  | DividerContent
  | CodeContent
  | QuoteContent
  | CircuitContent
  | DiagramContent
  | ChemistryContent
  | ChartContent
  | LaTeXContent;

// ──── Block Style ────

export interface BlockStyle {
  textAlign?: "left" | "center" | "right";
  fontSize?: number;
  fontFamily?: "serif" | "sans";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  backgroundColor?: string;
}

// ──── Block ────

export interface Block {
  id: string;
  content: BlockContent;
  style: BlockStyle;
}

// ──── LaTeX Document Classes ────

export type LaTeXDocumentClass =
  | "article"    // 短い論文・レポート
  | "report"     // 章のある長い報告書
  | "book"       // 書籍
  | "letter"     // 手紙
  | "beamer"     // プレゼンテーション
  | "jlreq"      // 日本語組版
  | "ltjsarticle"; // LuaLaTeX 日本語article

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

export type PaperTheme = "plain" | "grid" | "lined" | "dot-grid" | "elegant" | "modern";

// ──── Design Preset System ────

export type DesignPresetId =
  | "none"
  | "ocean-academic"
  | "forest-nature"
  | "sunset-warm"
  | "sakura-soft"
  | "midnight-pro"
  | "mint-fresh"
  | "coral-pop"
  | "lavender-dream"
  | "slate-minimal"
  | "golden-classic";

export interface DesignPreset {
  id: DesignPresetId;
  name: string;
  description: string;
  colors: {
    primary: string;        // main accent (headings, borders)
    secondary: string;      // sub-accent (highlights, boxes)
    background: string;     // paper background
    surface: string;        // box/card backgrounds
    text: string;           // body text
    muted: string;          // captions, footnotes
  };
  style: {
    headerBorder: boolean;
    sectionDividers: boolean;
    coloredBoxes: boolean;      // tcolorbox for quotes, notes
    gradientHeader: boolean;    // gradient stripe at page top
    sideStripe: boolean;        // colored stripe on left margin
    styledCodeBlocks: boolean;  // colored code frames
    decorativeFooter: boolean;  // branded page footer
  };
  preview: {
    gradient: string;       // CSS gradient for UI preview
    emoji: string;
  };
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "none",
    name: "プレーン",
    description: "装飾なし・シンプルな白黒",
    colors: { primary: "#333333", secondary: "#666666", background: "#ffffff", surface: "#f5f5f5", text: "#1a1a1a", muted: "#888888" },
    style: { headerBorder: false, sectionDividers: false, coloredBoxes: false, gradientHeader: false, sideStripe: false, styledCodeBlocks: false, decorativeFooter: false },
    preview: { gradient: "from-gray-200 to-gray-100", emoji: "📝" },
  },
  {
    id: "ocean-academic",
    name: "オーシャン・アカデミック",
    description: "知的で落ち着いた海のブルー。論文・レポートに最適",
    colors: { primary: "#1e40af", secondary: "#3b82f6", background: "#fafbff", surface: "#eff6ff", text: "#1e293b", muted: "#64748b" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: true, gradientHeader: true, sideStripe: false, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-blue-600 via-blue-500 to-cyan-400", emoji: "🌊" },
  },
  {
    id: "forest-nature",
    name: "フォレスト・ナチュラル",
    description: "自然をイメージした落ち着きのあるグリーン。理科・環境系に",
    colors: { primary: "#166534", secondary: "#22c55e", background: "#fafff7", surface: "#f0fdf4", text: "#1a2e1a", muted: "#6b8f71" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: true, gradientHeader: false, sideStripe: true, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-green-700 via-emerald-500 to-lime-400", emoji: "🌿" },
  },
  {
    id: "sunset-warm",
    name: "サンセット・ウォーム",
    description: "温かみのあるオレンジ&レッド。発表資料・教材プリントに",
    colors: { primary: "#c2410c", secondary: "#f97316", background: "#fffbf5", surface: "#fff7ed", text: "#27180e", muted: "#9a7b6b" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: true, gradientHeader: true, sideStripe: false, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-orange-600 via-amber-500 to-yellow-400", emoji: "🌅" },
  },
  {
    id: "sakura-soft",
    name: "サクラ・ソフト",
    description: "やわらかいピンク。女性向け教材・カジュアルな配布物に",
    colors: { primary: "#be185d", secondary: "#f472b6", background: "#fffbfd", surface: "#fdf2f8", text: "#2d1a24", muted: "#9f7a8e" },
    style: { headerBorder: true, sectionDividers: false, coloredBoxes: true, gradientHeader: false, sideStripe: true, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-pink-600 via-rose-400 to-pink-300", emoji: "🌸" },
  },
  {
    id: "midnight-pro",
    name: "ミッドナイト・プロ",
    description: "ダークでプロフェッショナル。技術文書・仕様書に",
    colors: { primary: "#6366f1", secondary: "#a78bfa", background: "#fafaff", surface: "#eef2ff", text: "#1e1b4b", muted: "#6b7280" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: true, gradientHeader: true, sideStripe: false, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-indigo-700 via-violet-600 to-purple-500", emoji: "🌙" },
  },
  {
    id: "mint-fresh",
    name: "ミント・フレッシュ",
    description: "清涼感のあるミントグリーン。数学・情報系の教材に",
    colors: { primary: "#0d9488", secondary: "#5eead4", background: "#f8fffd", surface: "#f0fdfa", text: "#142f2e", muted: "#6b9e99" },
    style: { headerBorder: false, sectionDividers: true, coloredBoxes: true, gradientHeader: false, sideStripe: true, styledCodeBlocks: true, decorativeFooter: false },
    preview: { gradient: "from-teal-600 via-emerald-400 to-cyan-300", emoji: "🍃" },
  },
  {
    id: "coral-pop",
    name: "コーラル・ポップ",
    description: "ビビッドなコーラル。ワークシート・テスト用紙に映える",
    colors: { primary: "#dc2626", secondary: "#fb923c", background: "#fffafa", surface: "#fef2f2", text: "#2a1515", muted: "#a18072" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: true, gradientHeader: true, sideStripe: false, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-red-500 via-orange-400 to-amber-300", emoji: "🪸" },
  },
  {
    id: "lavender-dream",
    name: "ラベンダー・ドリーム",
    description: "上品なパープル。文系科目・エッセイ・文学教材に",
    colors: { primary: "#7c3aed", secondary: "#c4b5fd", background: "#fdfaff", surface: "#f5f3ff", text: "#1f1535", muted: "#8b7fa3" },
    style: { headerBorder: true, sectionDividers: false, coloredBoxes: true, gradientHeader: false, sideStripe: true, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-violet-600 via-purple-500 to-fuchsia-400", emoji: "💜" },
  },
  {
    id: "slate-minimal",
    name: "スレート・ミニマル",
    description: "モダンなグレートーン。ビジネス文書・フォーマルな書類に",
    colors: { primary: "#334155", secondary: "#94a3b8", background: "#fafafa", surface: "#f1f5f9", text: "#0f172a", muted: "#94a3b8" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: false, gradientHeader: false, sideStripe: false, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-slate-600 via-gray-500 to-slate-400", emoji: "🔘" },
  },
  {
    id: "golden-classic",
    name: "ゴールデン・クラシック",
    description: "格調高いゴールド&ブラウン。教科書・公式文書に",
    colors: { primary: "#92400e", secondary: "#d97706", background: "#fffef7", surface: "#fefce8", text: "#1c1917", muted: "#a8977a" },
    style: { headerBorder: true, sectionDividers: true, coloredBoxes: true, gradientHeader: true, sideStripe: false, styledCodeBlocks: true, decorativeFooter: true },
    preview: { gradient: "from-amber-700 via-yellow-600 to-amber-400", emoji: "✨" },
  },
];

export interface PaperDesign {
  theme: PaperTheme;
  paperColor: string;       // hex color (e.g. "#ffffff")
  accentColor: string;      // hex color for headings/borders
  headerBorder: boolean;    // show border under title
  sectionDividers: boolean; // auto dividers between sections
  designPreset?: DesignPresetId;  // preset that overrides individual colors
}

export const DEFAULT_PAPER_DESIGN: PaperDesign = {
  theme: "plain",
  paperColor: "#ffffff",
  accentColor: "#4f46e5",
  headerBorder: false,
  sectionDividers: false,
  designPreset: "none",
};

export interface DocumentSettings {
  paperSize: "a4" | "letter" | "b5";
  margins: { top: number; bottom: number; left: number; right: number };
  lineSpacing: number;
  pageNumbers: boolean;
  twoColumn: boolean;
  documentClass: LaTeXDocumentClass;
  paperDesign?: PaperDesign;
}

// ──── Advanced Mode (上級者モード) ────

export interface AdvancedHooks {
  enabled: boolean;
  customPreamble: string;
  preDocument: string;
  postDocument: string;
  customCommands: string[];
}

export const DEFAULT_ADVANCED_HOOKS: AdvancedHooks = {
  enabled: false,
  customPreamble: "",
  preDocument: "",
  postDocument: "",
  customCommands: [],
};

// ──── Document ────

export interface DocumentMetadata {
  title: string;
  author: string;
  date?: string;
}

export interface DocumentModel {
  template: string;
  metadata: DocumentMetadata;
  settings: DocumentSettings;
  blocks: Block[];
  advanced?: AdvancedHooks;
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

// ──── Defaults ────

export const DEFAULT_SETTINGS: DocumentSettings = {
  paperSize: "a4",
  margins: { top: 25, bottom: 25, left: 20, right: 20 },
  lineSpacing: 1.15,
  pageNumbers: true,
  twoColumn: false,
  documentClass: "article",
};

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  textAlign: "left",
  fontSize: 11,
  fontFamily: "sans",
};

// ──── Block Palette Info ────

export interface BlockTypeInfo {
  type: BlockType;
  name: string;
  description: string;
  color: string;
  packages?: string[];  // auto-declared packages when this block is inserted
}

export const BLOCK_TYPES: BlockTypeInfo[] = [
  { type: "heading",   name: "見出し",     description: "セクション見出し",     color: "text-blue-500" },
  { type: "paragraph", name: "テキスト",   description: "本文テキスト",         color: "text-slate-500" },
  { type: "math",      name: "数式",       description: "インライン数式を挿入",   color: "text-violet-500", packages: ["amsmath", "amssymb", "mathtools"] },
  { type: "list",      name: "リスト",     description: "箇条書き・番号リスト", color: "text-emerald-500", packages: ["enumitem"] },
  { type: "table",     name: "表",         description: "表組みデータ",         color: "text-orange-500", packages: ["booktabs"] },
  { type: "image",     name: "画像",       description: "画像を挿入",           color: "text-pink-500", packages: ["graphicx"] },
  { type: "divider",   name: "区切り線",   description: "水平区切り線",         color: "text-gray-400" },
  { type: "code",      name: "コード",     description: "プログラムコード",     color: "text-teal-500", packages: ["listings"] },
  { type: "quote",     name: "引用",       description: "引用・コールアウト",   color: "text-amber-500", packages: ["tcolorbox"] },
  { type: "circuit",   name: "回路図",     description: "電子回路図",           color: "text-cyan-500", packages: ["tikz", "circuitikz"] },
  { type: "diagram",   name: "ダイアグラム", description: "フローチャート・状態図", color: "text-indigo-500", packages: ["tikz"] },
  { type: "chemistry", name: "化学式",     description: "化学反応式・分子式",   color: "text-lime-500", packages: ["mhchem"] },
  { type: "chart",     name: "グラフ",     description: "データ可視化",         color: "text-rose-500", packages: ["tikz", "pgfplots"] },
  { type: "latex",     name: "LaTeXコード", description: "生のLaTeXコードを直接挿入", color: "text-fuchsia-500", packages: [] },
];

// ──── Helper: Create Block ────

import { v4 as uuidv4 } from "uuid";

export function createBlock(type: BlockType, overrides?: Partial<BlockStyle>): Block {
  const style: BlockStyle = { ...DEFAULT_BLOCK_STYLE, ...overrides };

  const contentMap: Record<BlockType, () => BlockContent> = {
    heading:   () => ({ type: "heading", text: "", level: 2 }),
    paragraph: () => ({ type: "paragraph", text: "" }),
    math:      () => ({ type: "math", latex: "", displayMode: true }),
    list:      () => ({ type: "list", style: "bullet", items: [""] }),
    table:     () => ({ type: "table", headers: ["列 1", "列 2", "列 3"], rows: [["", "", ""]] }),
    image:     () => ({ type: "image", url: "", caption: "" }),
    divider:   () => ({ type: "divider", style: "solid" }),
    code:      () => ({ type: "code", language: "", code: "" }),
    quote:     () => ({ type: "quote", text: "" }),
    circuit:   () => ({ type: "circuit", code: "", caption: "" }),
    diagram:   () => ({ type: "diagram", code: "", diagramType: "flowchart", caption: "" }),
    chemistry: () => ({ type: "chemistry", formula: "", displayMode: true }),
    chart:     () => ({ type: "chart", chartType: "line", code: "", caption: "" }),
    latex:     () => ({ type: "latex", code: "", caption: "" }),
  };

  return {
    id: uuidv4(),
    content: contentMap[type](),
    style,
  };
}

// ──── AI Chat & Document Patch Types ────

export type PatchOp =
  | { op: "add_block"; afterId: string | null; block: Block }
  | { op: "update_block"; blockId: string; content?: Partial<BlockContent>; style?: Partial<BlockStyle> }
  | { op: "delete_block"; blockId: string }
  | { op: "reorder"; blockIds: string[] }
  | { op: "update_design"; paperDesign: Partial<PaperDesign> };

export interface DocumentPatch {
  ops: PatchOp[];
}

export interface ThinkingStep {
  type: "thinking" | "tool_call" | "tool_result" | "error";
  text: string;
  tool?: string;       // e.g. "edit_document", "read_document", etc.
  duration?: number;   // ms
  result?: Record<string, unknown>;  // tool execution result
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  patches?: DocumentPatch | null;
  appliedAt?: number;
  feedback?: "good" | "bad" | null;
  changeSummary?: string;            // AI が��をしたかの要約
  thinkingSteps?: ThinkingStep[];    // AI の思考ログ
  requestId?: string;                // デバッグ用リクエストID
  timestamp?: number;                // メッセージ作成時刻 (epoch ms)
  duration?: number;                 // レスポンス所要時間 (ms)
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;                    // エラーメッセージ
  isStreaming?: boolean;             // ストリーミング中フラグ
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

export function createDefaultDocument(template: string, blocks: Block[]): DocumentModel {
  return {
    template,
    metadata: { title: "", author: "" },
    settings: { ...DEFAULT_SETTINGS },
    blocks,
  };
}
