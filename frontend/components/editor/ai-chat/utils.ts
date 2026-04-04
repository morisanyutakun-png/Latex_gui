import { DocumentPatch, PatchOp } from "@/lib/types";
import { LastAIAction } from "@/store/ui-store";

export function buildLastAIAction(patch: DocumentPatch, newIds: string[]): LastAIAction {
  let added = 0, updated = 0, deleted = 0, reordered = 0;
  for (const op of patch.ops) {
    if (op.op === "add_block") added++;
    else if (op.op === "update_block") updated++;
    else if (op.op === "delete_block") deleted++;
    else if (op.op === "reorder") reordered++;
  }
  const parts: string[] = [];
  if (added) parts.push(`${added}件追加`);
  if (updated) parts.push(`${updated}件更新`);
  if (deleted) parts.push(`${deleted}件削除`);
  if (reordered && !added && !updated && !deleted) parts.push("並び替え");
  return {
    description: parts.join(" · ") || "変更を適用",
    blockIds: newIds,
    opCounts: { added, updated, deleted, reordered },
    timestamp: Date.now(),
  };
}

export function describeOp(op: PatchOp): { icon: string; label: string; color: string } {
  switch (op.op) {
    case "add_block": {
      const c = op.block.content as unknown as Record<string, unknown>;
      const btype = c.type as string;
      const typeNames: Record<string, string> = {
        heading: "見出し", paragraph: "テキスト", math: "数式", list: "リスト",
        table: "表", image: "画像", divider: "区切り線", code: "コード", quote: "引用",
        circuit: "回路図", diagram: "ダイアグラム", chemistry: "化学式", chart: "グラフ",
      };
      const typeName = typeNames[btype] || btype;
      let preview = "";
      if (btype === "heading") preview = `"${String(c.text || "").slice(0, 30)}"`;
      else if (btype === "paragraph") preview = `"${String(c.text || "").slice(0, 30)}${String(c.text || "").length > 30 ? "..." : ""}"`;
      else if (btype === "math") preview = `$${String(c.latex || "")}$`;
      else if (btype === "list") preview = `${(c.items as string[] | undefined)?.length ?? 0}項目`;
      else if (btype === "table") preview = `${(c.headers as string[] | undefined)?.length ?? 0}列`;
      return { icon: "+", label: `${typeName}ブロックを追加${preview ? ": " + preview : ""}`, color: "text-emerald-600 dark:text-emerald-400" };
    }
    case "update_block":
      return { icon: "~", label: `ブロックを更新 (${op.blockId.slice(0, 8)}...)`, color: "text-blue-600 dark:text-blue-400" };
    case "delete_block":
      return { icon: "−", label: `ブロックを削除 (${op.blockId.slice(0, 8)}...)`, color: "text-red-600 dark:text-red-400" };
    case "reorder":
      return { icon: "↕", label: `${op.blockIds.length}件のブロックを並び替え`, color: "text-amber-600 dark:text-amber-400" };
    case "update_design":
      return { icon: "🎨", label: "紙のデザインを変更", color: "text-violet-600 dark:text-violet-400" };
  }
}

export function cleanAIContent(content: string, hasPatches: boolean): string {
  if (!hasPatches) return content;
  let cleaned = content
    .replace(/```(?:json)?\s*\n?[\s\S]*?```/g, "")
    .replace(/^\s*[\[{][\s\S]{50,}?[\]}]\s*$/gm, "")
    .trim();
  if (!cleaned) {
    const opsCount = content.match(/"(?:op|type)"\s*:/g)?.length || 0;
    cleaned = `${opsCount || ""}件の変更を適用しました。`;
  }
  return cleaned;
}

export function getThinkingLines(msg: string): string[] {
  if (msg.includes("問題") || msg.includes("テスト") || msg.includes("quiz") || msg.includes("exam")) {
    return [
      "問題パターンを分析中... Analyzing question patterns",
      "難易度と形式を決定中... Determining difficulty & format",
      "数式・解答を生成中... Generating equations & solutions",
      "レイアウトを構築中... Building layout",
    ];
  }
  if (msg.includes("追加") || msg.includes("書いて") || msg.includes("作成") || msg.includes("生成")) {
    return [
      "リクエストを分析中... Parsing request",
      "ブロック構造を設計中... Designing block structure",
      "コンテンツを生成中... Generating content",
      "ドキュメントに統合中... Integrating into document",
    ];
  }
  if (msg.includes("修正") || msg.includes("変更") || msg.includes("直して") || msg.includes("update")) {
    return [
      "対象ブロッ���を特定中... Identifying target blocks",
      "変更内容を分析中... Analyzing modifications",
      "パッチを生成中... Generating patches",
      "整合性を確認中... Verifying consistency",
    ];
  }
  if (msg.includes("削除") || msg.includes("消して") || msg.includes("remove")) {
    return [
      "対��ブロックを検索中... Finding target blocks",
      "依存関係を確認中... Checking dependencies",
      "削除パッチ生成中... Generating removal patch",
      "最終確認中... Final verification",
    ];
  }
  return [
    "リクエストを解析中... Analyzing request",
    "ドキュメント構造を確認中... Checking document structure",
    "コンテンツを生成中... Generating content",
    "ブロックを構築中... Building blocks",
    "レイアウトを調整中... Adjusting layout",
    "出力を最適化中... Optimizing output",
    "最終処理中... Finalizing response",
  ];
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
