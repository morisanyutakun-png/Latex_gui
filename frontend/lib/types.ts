/**
 * 中間表現（JSON）の型定義
 * Backend Pydanticモデルと1:1対応
 */

export type TemplateType = "report" | "announcement" | "worksheet";

export type BlockType = "heading" | "paragraph" | "list" | "table" | "image";

export type ListStyle = "bullet" | "numbered";

// --- Block Types ---

export interface HeadingBlock {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
}

export interface ListBlock {
  type: "list";
  style: ListStyle;
  items: string[];
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface ImageBlock {
  type: "image";
  url: string;
  caption: string;
  width: number;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | ImageBlock;

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
  blocks: Block[];
}

// --- Block defaults ---

export function createDefaultBlock(type: BlockType): Block {
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
      return { type: "image", url: "", caption: "", width: 0.8 };
  }
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
    blocks: [],
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
    id: "report",
    name: "レポート",
    description: "章立てで整理されたレポートや報告書を作成",
    icon: "📄",
  },
  {
    id: "announcement",
    name: "案内文",
    description: "お知らせや通知などのフォーマルな案内文を作成",
    icon: "📢",
  },
  {
    id: "worksheet",
    name: "教材・ワークシート",
    description: "問題と解答欄のある教材やプリントを作成",
    icon: "📝",
  },
];

// Block type display info
export interface BlockTypeInfo {
  type: BlockType;
  name: string;
  description: string;
  icon: string;
}

export const BLOCK_TYPES: BlockTypeInfo[] = [
  { type: "heading", name: "見出し", description: "セクションの見出し", icon: "H" },
  { type: "paragraph", name: "本文", description: "テキスト段落", icon: "¶" },
  { type: "list", name: "箇条書き", description: "リスト形式の一覧", icon: "•" },
  { type: "table", name: "表", description: "データを表形式で表示", icon: "▦" },
  { type: "image", name: "画像", description: "URLから画像を挿入", icon: "🖼" },
];
