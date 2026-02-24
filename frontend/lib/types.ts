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
  | "quote";

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

export type BlockContent =
  | HeadingContent
  | ParagraphContent
  | MathContent
  | ListContent
  | TableContent
  | ImageContent
  | DividerContent
  | CodeContent
  | QuoteContent;

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

// ──── Document Settings ────

export interface DocumentSettings {
  paperSize: "a4" | "letter" | "b5";
  margins: { top: number; bottom: number; left: number; right: number };
  lineSpacing: number;
  pageNumbers: boolean;
  twoColumn: boolean;
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
