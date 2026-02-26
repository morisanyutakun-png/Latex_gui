import { DocumentModel } from "./types";

/**
 * API ベース URL
 *
 * 本番 (Vercel): 空文字列 → 同一オリジンの /api/* Route Handler を経由
 *   → サーバーサイドで Koyeb バックエンドへプロキシ (CORS 不要)
 *
 * ローカル開発: NEXT_PUBLIC_API_URL=http://localhost:8000 を .env.local に設定
 *   → 直接バックエンドに接続
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function generatePDF(doc: DocumentModel): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
      // ブラウザ側タイムアウト: Vercel Route Handler (max 60s) + マージン
      signal: AbortSignal.timeout(65000),
    });
  } catch (networkErr) {
    // ネットワークエラー or ブラウザ側タイムアウト
    const isTimeout = networkErr instanceof Error &&
      (networkErr.name === "TimeoutError" || networkErr.name === "AbortError");
    throw new Error(
      isTimeout
        ? "PDF生成に時間がかかりすぎています。しばらく待ってから再度お試しください。"
        : "PDF生成サーバーへのリクエストに失敗しました。\nネットワーク接続を確認してください。"
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const detail = err?.detail;
    const message = typeof detail === "string"
      ? detail
      : detail?.message || `PDF生成に失敗しました (HTTP ${res.status})`;
    throw new Error(message);
  }
  return res.blob();
}

export async function previewLatex(doc: DocumentModel): Promise<string> {
  const res = await fetch(`${API_BASE}/api/preview-latex`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    throw new Error("LaTeXプレビューの取得に失敗しました");
  }
  const data = await res.json();
  return data.latex;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function previewBlockSVG(
  code: string,
  blockType: string,
  caption: string = ""
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/preview-block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, block_type: blockType, caption }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || "プレビュー生成に失敗しました");
  }
  const data = await res.json();
  return data.svg;
}
