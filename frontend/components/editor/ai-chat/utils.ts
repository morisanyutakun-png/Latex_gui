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
