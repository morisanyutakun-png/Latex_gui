/**
 * Canvas-based document editor types
 * Canva/PowerPoint風の自由配置エディタ用型定義
 */

// --- Template ---

export type TemplateType = "blank" | "report" | "announcement" | "worksheet";

export type ElementType = "heading" | "paragraph" | "list" | "table" | "image";

export type ListStyle = "bullet" | "numbered";

// --- Position & Style ---

export interface ElementPosition {
  x: number;      // mm (A4: 0-210)
  y: number;      // mm (A4: 0-297)
  width: number;  // mm
  height: number; // mm
}

export interface ElementStyle {
  textColor?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  fontSize?: number;        // pt (8-72)
  fontFamily?: "serif" | "sans";
  bold?: boolean;
  italic?: boolean;
  borderColor?: string;
  borderWidth?: number;     // pt
  borderRadius?: number;    // mm
  padding?: number;         // mm
  opacity?: number;         // 0-1
}

// --- Element content types ---

export interface HeadingContent {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
}

export interface ParagraphContent {
  type: "paragraph";
  text: string;
}

export interface ListContent {
  type: "list";
  style: ListStyle;
  items: string[];
}

export interface TableContent {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface ImageContent {
  type: "image";
  url: string;
  caption: string;
}

export type ElementContent =
  | HeadingContent
  | ParagraphContent
  | ListContent
  | TableContent
  | ImageContent;

// --- Canvas Element (block with position) ---

export interface CanvasElement {
  id: string;
  content: ElementContent;
  position: ElementPosition;
  style: ElementStyle;
  zIndex: number;
}

// --- Page ---

export interface Page {
  id: string;
  elements: CanvasElement[];
}

// --- Metadata ---

export interface Metadata {
  title: string;
  subtitle: string;
  author: string;
  date: string;
}

// --- Document ---

export interface DocumentModel {
  template: TemplateType;
  metadata: Metadata;
  pages: Page[];
}

// --- A4 constants ---

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

// --- Defaults ---

const DEFAULT_POSITIONS: Record<ElementType, Partial<ElementPosition>> = {
  heading:   { width: 170, height: 15 },
  paragraph: { width: 170, height: 40 },
  list:      { width: 170, height: 50 },
  table:     { width: 170, height: 50 },
  image:     { width: 80,  height: 60 },
};

const DEFAULT_STYLES: Record<ElementType, ElementStyle> = {
  heading:   { fontSize: 24, fontFamily: "sans", bold: true, textAlign: "left" },
  paragraph: { fontSize: 11, fontFamily: "serif", textAlign: "left" },
  list:      { fontSize: 11, fontFamily: "serif", textAlign: "left" },
  table:     { fontSize: 10, fontFamily: "sans", textAlign: "left" },
  image:     { textAlign: "center" },
};

export function createDefaultContent(type: ElementType): ElementContent {
  switch (type) {
    case "heading":
      return { type: "heading", text: "", level: 1 };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "list":
      return { type: "list", style: "bullet", items: [""] };
    case "table":
      return { type: "table", headers: ["列1", "列2"], rows: [["", ""]] };
    case "image":
      return { type: "image", url: "", caption: "" };
  }
}

export function createDefaultElement(
  type: ElementType,
  pageElementCount: number,
): CanvasElement {
  const pos = DEFAULT_POSITIONS[type];
  return {
    id: crypto.randomUUID(),
    content: createDefaultContent(type),
    position: {
      x: 20,
      y: 20 + pageElementCount * 10,
      width: pos.width ?? 170,
      height: pos.height ?? 40,
    },
    style: { ...DEFAULT_STYLES[type] },
    zIndex: pageElementCount + 1,
  };
}

export function createDefaultDocument(template: TemplateType): DocumentModel {
  return {
    template,
    metadata: {
      title: "",
      subtitle: "",
      author: "",
      date: new Date().toLocaleDateString("ja-JP"),
    },
    pages: [{ id: crypto.randomUUID(), elements: [] }],
  };
}

// --- Template info ---

export interface TemplateInfo {
  id: TemplateType;
  name: string;
  description: string;
  icon: string;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "blank",
    name: "白紙",
    description: "自由にレイアウトを組み立てる",
    icon: "blank",
  },
  {
    id: "report",
    name: "レポート",
    description: "章立てで整理されたレポートや報告書",
    icon: "report",
  },
  {
    id: "announcement",
    name: "案内文",
    description: "お知らせや通知などのフォーマルな文書",
    icon: "announcement",
  },
  {
    id: "worksheet",
    name: "教材",
    description: "問題と解答欄のある教材やプリント",
    icon: "worksheet",
  },
];

// Block type display info
export interface ElementTypeInfo {
  type: ElementType;
  name: string;
  description: string;
}

export const ELEMENT_TYPES: ElementTypeInfo[] = [
  { type: "heading",   name: "見出し",   description: "タイトルやセクション見出し" },
  { type: "paragraph", name: "テキスト", description: "本文テキストブロック" },
  { type: "list",      name: "リスト",   description: "箇条書き・番号付きリスト" },
  { type: "table",     name: "表",       description: "データ表" },
  { type: "image",     name: "画像",     description: "画像を挿入" },
];
