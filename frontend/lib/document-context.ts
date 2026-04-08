/**
 * 文書コンテキストビルダー — 現在の raw LaTeX をAIへの初回コンテキストに含める
 *
 * AIが read_latex を呼ぶ代わりに、リクエスト前にLaTeXソース全体（または抜粋）を
 * ユーザーメッセージに注入してツール呼び出しを1ターン削減する。
 *
 * Phase 3: locale ("ja" / "en") を受け取り、コンテキストヘッダのラベルと省略マーカーを
 * 言語に合わせる。バックエンド側 (_build_agent_contents) はどちらの形式でも
 * 「コンテキスト同梱済み」と判定できる。
 */

import type { DocumentModel } from "./types";

/** ユーザーメッセージに含めるLaTeXの最大文字数 */
const MAX_LATEX_INLINE = 12_000;

/**
 * ドキュメントの現在状態を AI に渡すコンテキスト文字列を生成する
 */
export function buildDocumentContext(doc: DocumentModel, locale: "ja" | "en" = "ja"): string {
  const { metadata, settings, latex, template } = doc;
  const lines: string[] = [];

  const en = locale === "en";
  const untitled = en ? "(untitled)" : "(無題)";
  const title = metadata.title || untitled;
  const docClass = settings.documentClass || "article";

  // ヘッダ — バックエンドの has_doc_context 判定で使われるマーカー
  if (en) {
    lines.push(
      `[Document LaTeX] template: ${template} | title: "${title}" | class: ${docClass} | length: ${latex.length} chars`
    );
  } else {
    lines.push(
      `[文書LaTeX] テンプレート: ${template} | タイトル: "${title}" | クラス: ${docClass} | 文字数: ${latex.length}`
    );
  }

  if (metadata.author) {
    lines.push(en ? `Author: "${metadata.author}"` : `著者: "${metadata.author}"`);
  }

  if (!latex || latex.length === 0) {
    lines.push(en ? "(LaTeX source is empty)" : "(LaTeXソースは空です)");
    return lines.join("\n");
  }

  if (latex.length <= MAX_LATEX_INLINE) {
    lines.push("```latex");
    lines.push(latex);
    lines.push("```");
  } else {
    const head = latex.slice(0, MAX_LATEX_INLINE / 2);
    const tail = latex.slice(-MAX_LATEX_INLINE / 2);
    const elided = latex.length - MAX_LATEX_INLINE;
    lines.push("```latex");
    lines.push(head);
    lines.push(
      en
        ? `\n... (${elided.toLocaleString()} chars elided) ...\n`
        : `\n... (${elided.toLocaleString()}文字省略) ...\n`
    );
    lines.push(tail);
    lines.push("```");
    lines.push(
      en
        ? "(call read_latex to fetch the full source)"
        : "(全文を確認するには read_latex を呼んでください)"
    );
  }

  return lines.join("\n");
}
