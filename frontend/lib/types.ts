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
  | "chart";

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
  diagramType: "flowchart" | "sequence" | "block" | "state" | "tree" | "custom";
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
  | ChartContent;

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

export interface PaperDesign {
  theme: PaperTheme;
  paperColor: string;       // hex color (e.g. "#ffffff")
  accentColor: string;      // hex color for headings/borders
  headerBorder: boolean;    // show border under title
  sectionDividers: boolean; // auto dividers between sections
}

export const DEFAULT_PAPER_DESIGN: PaperDesign = {
  theme: "plain",
  paperColor: "#ffffff",
  accentColor: "#4f46e5",
  headerBorder: false,
  sectionDividers: false,
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
  tool?: string;       // e.g. "edit_document"
  duration?: number;   // ms
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

export function createDefaultDocument(template: string, blocks: Block[]): DocumentModel {
  return {
    template,
    metadata: { title: "", author: "" },
    settings: { ...DEFAULT_SETTINGS },
    blocks,
  };
}
