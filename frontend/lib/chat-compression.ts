/**
 * チャット履歴圧縮 — AIを使わずフロントエンドのみでトークンを削減
 *
 * 戦略:
 * 1. 直近 windowSize ペア（デフォルト3ペア=6メッセージ）はフル送信
 * 2. それ以前のアシスタント応答は先頭100文字に切り詰め
 * 3. 古いメッセージからキーワードを抽出し、1行サマリーを先頭に挿入
 */

import type { ChatMessage } from "./types";

// ─── 設定 ─────────────────────────────────────────────────────────────────────

/** 直近何ペア（user+assistant）をフル保持するか */
const DEFAULT_WINDOW_SIZE = 3;

/** ウィンドウ外のアシスタント応答を何文字まで残すか */
const TRUNCATE_LENGTH = 100;

/** サマリーに含めるキーワード最大数 */
const MAX_KEYWORDS = 8;

// ─── キーワード抽出（AI不使用） ───────────────────────────────────────────────

/** よく出る助詞・接続詞等を除外 */
const STOP_WORDS = new Set([
  "の", "は", "が", "を", "に", "で", "と", "も", "から", "まで", "より",
  "です", "ます", "した", "して", "する", "ください", "ありがとう",
  "お願い", "思い", "これ", "それ", "あれ", "この", "その", "あの",
  "こと", "もの", "ため", "よう", "など", "について", "という",
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "can", "could", "should", "may", "might", "shall",
  "and", "or", "but", "if", "then", "so", "that", "this", "it",
  "to", "of", "in", "on", "at", "for", "with", "from", "by",
]);

/**
 * ユーザーメッセージからキーワードを抽出（AI不使用）
 * 日本語: 漢字+カタカナの連続、英語: 3文字以上の単語
 */
function extractKeywords(messages: ChatMessage[]): string[] {
  const freq = new Map<string, number>();

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const text = msg.content;

    // 日本語キーワード: 漢字・カタカナ2文字以上の連続
    const jpMatches = text.match(/[\u4e00-\u9fafカ-ン]{2,}/g) || [];
    for (const w of jpMatches) {
      if (!STOP_WORDS.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
    }

    // 英語キーワード: 3文字以上
    const enMatches = text.match(/[a-zA-Z]{3,}/g) || [];
    for (const w of enMatches) {
      const lower = w.toLowerCase();
      if (!STOP_WORDS.has(lower)) freq.set(lower, (freq.get(lower) || 0) + 1);
    }
  }

  // 頻度順でソートし上位を返す
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word);
}

// ─── メイン関数 ───────────────────────────────────────────────────────────────

export interface CompressOptions {
  /** 直近何ペア（user+assistant）をフル保持するか (default: 3) */
  windowSize?: number;
}

/**
 * チャット履歴を圧縮して送信用の配列を返す
 *
 * @param messages - 既存のチャット履歴（新しいユーザーメッセージは含まない）
 * @param newUserMsg - 今回送信するユーザーメッセージ
 * @param opts - オプション
 * @returns 送信用の { role, content }[] 配列
 */
export function compressHistory(
  messages: ChatMessage[],
  newUserMsg: ChatMessage,
  opts?: CompressOptions,
): { role: "user" | "assistant"; content: string }[] {
  const windowSize = opts?.windowSize ?? DEFAULT_WINDOW_SIZE;
  const allMessages = [...messages, newUserMsg];

  // 6件以下なら圧縮不要
  const windowCount = windowSize * 2; // user+assistant のペア数
  if (allMessages.length <= windowCount) {
    return allMessages.map((m) => ({ role: m.role, content: m.content }));
  }

  // ウィンドウ内（末尾）とウィンドウ外（先頭）に分割
  const cutoff = allMessages.length - windowCount;
  const olderMessages = allMessages.slice(0, cutoff);
  const recentMessages = allMessages.slice(cutoff);

  // ── キーワードサマリーを生成 ──
  const keywords = extractKeywords(olderMessages);
  const summaryLine = keywords.length > 0
    ? `[過去の文脈: ${keywords.join("、")}]`
    : "";

  // ── 古いメッセージを圧縮 ──
  const compressed: { role: "user" | "assistant"; content: string }[] = [];

  if (summaryLine) {
    // サマリーを最初のユーザーメッセージとして挿入
    compressed.push({ role: "user", content: summaryLine });
    compressed.push({ role: "assistant", content: "了解しました。過去の文脈を踏まえて対応します。" });
  }

  // 古いメッセージは大幅に省略（最初と最後だけ残す）
  // ユーザーの意図がわかるよう、ユーザーメッセージはフル保持
  for (const msg of olderMessages) {
    if (msg.role === "user") {
      // ユーザーメッセージはフル（意図を保持）
      compressed.push({ role: "user", content: msg.content });
    } else {
      // アシスタント応答は切り詰め
      const truncated = msg.content.length > TRUNCATE_LENGTH
        ? msg.content.slice(0, TRUNCATE_LENGTH) + "...（省略）"
        : msg.content;
      compressed.push({ role: "assistant", content: truncated });
    }
  }

  // ── 直近メッセージはフル送信 ──
  for (const msg of recentMessages) {
    compressed.push({ role: msg.role, content: msg.content });
  }

  return compressed;
}
