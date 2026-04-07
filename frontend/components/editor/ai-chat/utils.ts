import { LastAIAction } from "@/store/ui-store";

export function buildLastAIAction(latex: string): LastAIAction {
  return {
    description: `LaTeXソースを更新（${latex.length}文字）`,
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

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "たった今";
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return new Date(timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
