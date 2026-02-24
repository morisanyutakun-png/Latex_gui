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
    description: "短い文書向け。章(\\chapter)なし。\\section から始まる。",
    features: ["\\section", "\\subsection", "\\abstract", "二段組対応"],
    icon: "📝",
  },
  {
    id: "report",
    name: "report",
    japanese: "報告書",
    description: "章(\\chapter)を持つ長い報告書。表紙ページあり。",
    features: ["\\chapter", "\\section", "\\appendix", "表紙ページ"],
    icon: "📊",
  },
  {
    id: "book",
    name: "book",
    japanese: "書籍",
    description: "書籍向け。左右ページの区別、部・章構成。",
    features: ["\\part", "\\chapter", "\\frontmatter", "見開き対応"],
    icon: "📚",
  },
  {
    id: "letter",
    name: "letter",
    japanese: "手紙",
    description: "ビジネスレター形式。宛先・署名付き。",
    features: ["\\opening", "\\closing", "\\signature", "封筒対応"],
    icon: "✉️",
  },
  {
    id: "beamer",
    name: "beamer",
    japanese: "スライド",
    description: "プレゼンテーション用スライド。",
    features: ["\\frame", "\\pause", "テーマ切替", "アニメーション"],
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
  twoColumn: boolean;
  documentClass: LaTeXDocumentClass;
}

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
}

export const BLOCK_TYPES: BlockTypeInfo[] = [
  { type: "heading",   name: "見出し",     description: "セクション見出し",     color: "text-blue-500" },
  { type: "paragraph", name: "テキスト",   description: "本文テキスト",         color: "text-slate-500" },
  { type: "math",      name: "数式",       description: "LaTeX数式",            color: "text-violet-500" },
  { type: "list",      name: "リスト",     description: "箇条書き・番号リスト", color: "text-emerald-500" },
  { type: "table",     name: "表",         description: "表組みデータ",         color: "text-orange-500" },
  { type: "image",     name: "画像",       description: "画像を挿入",           color: "text-pink-500" },
  { type: "divider",   name: "区切り線",   description: "水平区切り線",         color: "text-gray-400" },
  { type: "code",      name: "コード",     description: "プログラムコード",     color: "text-teal-500" },
  { type: "quote",     name: "引用",       description: "引用・コールアウト",   color: "text-amber-500" },
  { type: "circuit",   name: "回路図",     description: "電子回路図 (circuitikz)", color: "text-cyan-500" },
  { type: "diagram",   name: "ダイアグラム", description: "フローチャート・状態図 (TikZ)", color: "text-indigo-500" },
  { type: "chemistry", name: "化学式",     description: "化学反応式・分子式",   color: "text-lime-500" },
  { type: "chart",     name: "グラフ",     description: "データ可視化 (pgfplots)", color: "text-rose-500" },
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

export function createDefaultDocument(template: string, blocks: Block[]): DocumentModel {
  return {
    template,
    metadata: { title: "無題のドキュメント", author: "" },
    settings: { ...DEFAULT_SETTINGS },
    blocks,
  };
}
