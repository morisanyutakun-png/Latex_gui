/**
 * Variant Studio 用の「サイレント1ショット類題生成」ヘルパ。
 *
 * 役割分担:
 *   - AI チャット (`streamAIMessage`/`sendAIMessage`) はユーザの会話履歴に乗る差分修正用
 *   - 類題生成は会話履歴を汚さない別モードの操作 → このモジュール経由でだけ叩く
 *
 * 設計:
 *   - 既存の `/api/ai/chat` プロキシをそのまま再利用 (新エンドポイント不要)
 *   - 履歴 = `[ { role:"user", content: variantPrompt } ]` の 1 件だけ
 *   - レスポンスの latex を直接 document-store に反映する (replace / append)
 *   - **ユーザの自由入力 (hint) は受け付けない**。REM ノウハウだけで完結させる
 *   - 進行中は ui-store の `activeRewriteKind="variant"` を立てて、Studio パネルが
 *     共有のローディング表示を出せる
 */

import { sendAIMessage } from "@/lib/api";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import {
  buildVariantPrompt,
  normalizeLocale,
  type VariantStyle,
  type RemLocale,
} from "@/lib/rem-prompts";

export interface VariantGenerateOptions {
  /** 何問作るかのヒント (AI に伝えるだけで、必ず守られる保証はない)。 */
  count?: number;
  /** "replace" = doc 上書き、"append" = 末尾に追記。 */
  outputMode?: "replace" | "append";
  /** UI ロケール (RemLocale でも UI ロケール文字列でも OK)。 */
  locale?: string | null;
  /** AbortController (将来のキャンセル対応)。 */
  signal?: AbortSignal;
}

export interface VariantGenerateResult {
  latex: string;
  usage: { inputTokens: number; outputTokens: number };
  message: string;
}

/**
 * 既存 doc を seed にして、選択スタイルで類題セットを 1 回作って doc に反映する。
 * チャット履歴 (`useUIStore.chatMessages`) には一切手を加えない。
 *
 * 失敗時は throw する (呼び出し元の Studio パネルでトースト/エラーバナー表示)。
 */
export async function generateVariantSilently(
  style: VariantStyle,
  opts: VariantGenerateOptions = {},
): Promise<VariantGenerateResult> {
  const docNow = useDocumentStore.getState().document;
  if (!docNow) {
    throw new Error("ドキュメントが読み込まれていません。エディタを開いてからお試しください。");
  }
  // ── ゲストガード (defense-in-depth) ──
  // ゲスト (?guest=1) は anonymous trial の 1 枚だけ AI を叩ける権限しか持たない。
  // variant 経路は別 trial カウンタなので、ゲストに通すと anonymous trial と二重消費になる。
  // また /api/ai/chat (ログイン必須プロキシ) を直叩きすると 401 になる。
  // UI 側でロックしているが、念のためここでも明示的に弾く。
  const isGuestNow = useUIStore.getState().isGuest;
  if (isGuestNow) {
    throw new Error("類題ジェネレータは無料登録 (30秒) で使えます。");
  }

  const remLocale: RemLocale = normalizeLocale(opts.locale ?? null);
  const prompt = buildVariantPrompt(docNow.latex || "", remLocale, style, opts.count);
  const messages = [{ role: "user" as const, content: prompt }];

  // ローディングセマンティック ON。Studio が共有の進捗 UI を出せるように。
  // チャット側の loading は別物 (`isChatLoading`) なので絶対に立てない。
  useUIStore.getState().setActiveRewriteKind("variant");

  try {
    const aiLocale = remLocale === "en" ? "en" : "ja";
    const result = await sendAIMessage(messages, docNow, aiLocale, "edit");
    const newLatex = (result.latex || "").trim();
    if (!newLatex) {
      throw new Error("AI から有効な LaTeX が返ってきませんでした。もう一度お試しください。");
    }

    // ── 反映 ──
    const outputMode = opts.outputMode ?? "replace";
    const setDocument = useDocumentStore.getState().setDocument;
    if (outputMode === "append") {
      const merged = mergeBeforeEndDocument(docNow.latex || "", newLatex);
      setDocument({ ...docNow, latex: merged });
    } else {
      setDocument({ ...docNow, latex: newLatex });
    }

    return {
      latex: newLatex,
      usage: result.usage,
      message: result.message || "",
    };
  } finally {
    useUIStore.getState().setActiveRewriteKind(null);
  }
}

/**
 * 既存 doc の `\end{document}` の直前に、新しい類題ブロックを挿入する。
 * `\end{document}` が見当たらないテンプレ (preamble だけのドラフト等) では単純末尾連結に倒す。
 *
 * 渡された `addedLatex` が完成された full document の場合は、その本文 (begin..end の間) だけを
 * 抽出して足す。
 */
function mergeBeforeEndDocument(baseLatex: string, addedLatex: string): string {
  const innerMatch = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(addedLatex);
  const addedBody = innerMatch ? innerMatch[1].trim() : addedLatex.trim();
  if (!addedBody) return baseLatex;

  const endIdx = baseLatex.lastIndexOf("\\end{document}");
  if (endIdx < 0) {
    return `${baseLatex}\n\n${addedBody}\n`;
  }
  const before = baseLatex.slice(0, endIdx);
  const after = baseLatex.slice(endIdx);
  const separator = "\n\n\\bigskip\n\\hrule\n\\bigskip\n\n";
  return `${before}${separator}${addedBody}\n\n${after}`;
}
