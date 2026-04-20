import { LastAIAction } from "@/store/ui-store";

type Translator = (key: string) => string;

export function buildLastAIAction(latex: string, t: Translator): LastAIAction {
  return {
    description: `${t("action.latex.updated.prefix")}${latex.length}${t("action.latex.updated.suffix")}`,
    timestamp: Date.now(),
  };
}

export function cleanAIContent(content: string): string {
  // Strip stray fenced code blocks (the agent shouldn't print latex inline,
  // but if it does we hide them).
  let cleaned = content.replace(/```(?:latex|tex)?\s*\n?[\s\S]*?```/g, "").trim();
  if (!cleaned) cleaned = content.trim();
  return cleaned;
}

/**
 * edit / mix モードで強制している「実施サマリー」ブロックを本文から切り出す。
 *
 * 検出ヘッダ (ja/en 両対応):
 *   **✅ 実施サマリー**
 *   **✅ What was done**
 *
 * 見つかったらヘッダ以降をサマリーとして返し、本文からは取り除く。
 * AI が誤って ``` でサマリーを囲んだ場合のフェンスも除去する。
 *
 * 見つからなければ content をそのまま body に返し、summary は null。
 * ストリーミング途中でヘッダがまだ出現していない段階でも壊れないようにする。
 */
const SUMMARY_HEAD_RE = /\*\*✅\s*(?:実施サマリー|What was done)\*\*/;

export function splitSummary(content: string): { body: string; summary: string | null } {
  if (!content) return { body: "", summary: null };
  const m = content.match(SUMMARY_HEAD_RE);
  if (!m || m.index === undefined) return { body: content, summary: null };

  let body = content.slice(0, m.index).trimEnd();
  let summary = content.slice(m.index).trim();

  // 本文末尾が ```... で残っていたら落とす (AI がサマリーを fence で囲んだケース)
  body = body.replace(/```[a-zA-Z]*\s*$/m, "").trimEnd();
  // サマリー冒頭/末尾の ``` フェンスも剥がす
  summary = summary.replace(/^```[a-zA-Z]*\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  return { body, summary };
}

export function formatRelativeTime(timestamp: number, t: Translator, locale: "ja" | "en" = "ja"): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return t("time.now");
  if (seconds < 60) return `${seconds}${t("time.seconds_ago.suffix")}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${t("time.minutes_ago.suffix")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("time.hours_ago.suffix")}`;
  return new Date(timestamp).toLocaleTimeString(locale === "en" ? "en-US" : "ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
