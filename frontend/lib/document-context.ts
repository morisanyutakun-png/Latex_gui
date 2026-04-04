/**
 * 文書コンテキストビルダー — フロントエンド側でドキュメント構造サマリーを生成
 *
 * AIがread_documentツールを呼ぶ代わりに、リクエスト前に文書の全体像を
 * テキストとしてユーザーメッセージに注入する。これによりツール呼び出し
 * ターンを1-2回削減し、トークンコストを30-50%節約する。
 *
 * AIは一切使用しない（ゼロコスト）。
 */

import type { DocumentModel, Block, BlockContent } from "./types";

/** 全ブロック概要を含める上限 */
const MAX_BLOCKS_FULL = 50;

/** ブロックプレビューの文字数上限 */
const PREVIEW_LENGTH = 40;

/**
 * ブロックのコンテンツから1行プレビューを生成
 */
function blockPreview(content: BlockContent): string {
  switch (content.type) {
    case "heading":
      return content.text || "(空)";

    case "paragraph": {
      const t = content.text || "";
      return t.length > PREVIEW_LENGTH ? t.slice(0, PREVIEW_LENGTH) + "..." : t;
    }

    case "math":
      return content.latex
        ? (content.displayMode ? `$$${content.latex}$$` : `$${content.latex}$`)
        : "(空)";

    case "list":
      return `${content.items.length}項目: "${content.items[0] || ""}"...`;

    case "table":
      return `${content.headers.length}列×${content.rows.length}行${content.caption ? ` "${content.caption}"` : ""}`;

    case "code":
      return `${content.language || "code"} (${content.code.length}文字)`;

    case "quote": {
      const q = content.text || "";
      return q.length > PREVIEW_LENGTH ? q.slice(0, PREVIEW_LENGTH) + "..." : q;
    }

    case "image":
      return content.caption || "(画像)";

    case "divider":
      return "---";

    case "circuit":
      return content.caption || "(回路図)";

    case "diagram":
      return `${content.diagramType}${content.caption ? ` "${content.caption}"` : ""}`;

    case "chemistry":
      return content.formula || "(化学式)";

    case "chart":
      return `${content.chartType}${content.caption ? ` "${content.caption}"` : ""}`;

    default:
      return "(不明)";
  }
}

/**
 * ブロックの型分布を集計
 */
function blockTypeSummary(blocks: Block[]): string {
  const counts: Record<string, number> = {};
  for (const b of blocks) {
    const t = b.content.type;
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => `${type}×${count}`)
    .join(", ");
}

/**
 * ドキュメントの構造サマリーをテキストとして生成する
 *
 * @param doc - 現在のDocumentModel
 * @param cursorBlockId - カーソルがあるブロックID（任意）
 * @returns `[文書構造]` タグ付きのサマリーテキスト（推定200-500トークン）
 */
export function buildDocumentContext(doc: DocumentModel, cursorBlockId?: string): string {
  const { metadata, settings, blocks } = doc;
  const lines: string[] = [];

  // ヘッダー
  const title = metadata.title || "(無題)";
  const docClass = settings.documentClass || "article";
  lines.push(`[文書構造] タイトル: "${title}" | ブロック数: ${blocks.length} | クラス: ${docClass}`);

  if (metadata.author) {
    lines.push(`著者: "${metadata.author}"`);
  }

  if (blocks.length === 0) {
    lines.push("(空の文書)");
    return lines.join("\n");
  }

  // ブロック数が多い場合はサマリーモード
  if (blocks.length > MAX_BLOCKS_FULL) {
    lines.push(`型分布: ${blockTypeSummary(blocks)}`);

    // カーソル付近5ブロックを詳細表示
    if (cursorBlockId) {
      const cursorIdx = blocks.findIndex((b) => b.id === cursorBlockId);
      if (cursorIdx >= 0) {
        const start = Math.max(0, cursorIdx - 2);
        const end = Math.min(blocks.length, cursorIdx + 3);
        lines.push(`\nカーソル付近 (#${start}-#${end - 1}):`);
        for (let i = start; i < end; i++) {
          const b = blocks[i];
          const marker = i === cursorIdx ? " ← カーソル" : "";
          lines.push(`  #${i} ${b.content.type}: ${blockPreview(b.content)}${marker}`);
        }
      }
    } else {
      // カーソルなし: 先頭5 + 末尾3を表示
      lines.push("\n先頭:");
      for (let i = 0; i < Math.min(5, blocks.length); i++) {
        lines.push(`  #${i} ${blocks[i].content.type}: ${blockPreview(blocks[i].content)}`);
      }
      if (blocks.length > 8) {
        lines.push(`  ... (${blocks.length - 8}ブロック省略)`);
      }
      lines.push("末尾:");
      for (let i = Math.max(5, blocks.length - 3); i < blocks.length; i++) {
        lines.push(`  #${i} ${blocks[i].content.type}: ${blockPreview(blocks[i].content)}`);
      }
    }
  } else {
    // 50ブロック以下: 全ブロック概要
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const marker = b.id === cursorBlockId ? " ← カーソル" : "";
      lines.push(`#${i} ${b.content.type}: ${blockPreview(b.content)}${marker}`);
    }
  }

  return lines.join("\n");
}
