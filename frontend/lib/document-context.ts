/**
 * 文書コンテキストビルダー — 現在の raw LaTeX をAIへの初回コンテキストに含める
 *
 * AIが read_latex を呼ぶ代わりに、リクエスト前にLaTeXソース全体（または抜粋）を
 * ユーザーメッセージに注入してツール呼び出しを1ターン削減する。
 */

import type { DocumentModel } from "./types";

/** ユーザーメッセージに含めるLaTeXの最大文字数 */
const MAX_LATEX_INLINE = 12_000;

/**
 * ドキュメントの現在状態を AI に渡すコンテキスト文字列を生成する
 */
export function buildDocumentContext(doc: DocumentModel): string {
  const { metadata, settings, latex, template } = doc;
  const lines: string[] = [];

  const title = metadata.title || "(無題)";
  const docClass = settings.documentClass || "article";
  lines.push(`[文書LaTeX] テンプレート: ${template} | タイトル: "${title}" | クラス: ${docClass} | 文字数: ${latex.length}`);

  if (metadata.author) {
    lines.push(`著者: "${metadata.author}"`);
  }

  if (!latex || latex.length === 0) {
    lines.push("(LaTeXソースは空です)");
    return lines.join("\n");
  }

  if (latex.length <= MAX_LATEX_INLINE) {
    lines.push("```latex");
    lines.push(latex);
    lines.push("```");
  } else {
    const head = latex.slice(0, MAX_LATEX_INLINE / 2);
    const tail = latex.slice(-MAX_LATEX_INLINE / 2);
    lines.push("```latex");
    lines.push(head);
    lines.push(`\n... (${(latex.length - MAX_LATEX_INLINE).toLocaleString()}文字省略) ...\n`);
    lines.push(tail);
    lines.push("```");
    lines.push("(全文を確認するには read_latex を呼んでください)");
  }

  return lines.join("\n");
}
