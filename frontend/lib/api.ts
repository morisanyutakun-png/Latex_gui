import { DocumentModel, BatchRequest } from "./types";

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
  // 最大2回試行 (初回がコールドスタートタイムアウトの場合にリトライ)
  const maxAttempts = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
        // Vercel Route Handler (max 60s) + マージン
        signal: AbortSignal.timeout(58000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const detail = err?.detail;
        const message = typeof detail === "string"
          ? detail
          : detail?.message || `PDF生成に失敗しました (HTTP ${res.status})`;

        // 502/504 はリトライ可能
        if ((res.status === 502 || res.status === 504) && attempt < maxAttempts) {
          lastError = new Error(message);
          continue;
        }
        throw new Error(message);
      }

      return await res.blob();
    } catch (networkErr) {
      if (networkErr instanceof Error && networkErr.message?.startsWith("PDF")) {
        throw networkErr; // アプリケーションエラー（リトライ不要）
      }

      const isTimeout = networkErr instanceof Error &&
        (networkErr.name === "TimeoutError" || networkErr.name === "AbortError");

      if (isTimeout && attempt < maxAttempts) {
        lastError = new Error("PDF生成サーバーが応答待ちです。再試行中...");
        continue;
      }

      throw new Error(
        isTimeout
          ? "PDF生成に時間がかかりすぎています。サーバーが起動中の可能性があるため、しばらく待ってから再度お試しください。"
          : "PDF生成サーバーへのリクエストに失敗しました。\nネットワーク接続を確認してください。"
      );
    }
  }

  throw lastError || new Error("PDF生成に失敗しました");
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

// ═══ バッチ生成 (教材工場) API ═══

export async function detectVariables(doc: DocumentModel): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/batch/detect-variables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("変数検出に失敗しました");
  const data = await res.json();
  return data.variables;
}

export async function batchGeneratePDFs(req: BatchRequest): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/batch/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(300000), // 5分
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const message = err?.detail?.message || `バッチ生成に失敗 (HTTP ${res.status})`;
    throw new Error(message);
  }
  return await res.blob();
}

export async function batchPreview(req: BatchRequest): Promise<{
  latex: string;
  variables: Record<string, string>;
  totalRows: number;
}> {
  const res = await fetch(`${API_BASE}/api/batch/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("バッチプレビューに失敗しました");
  const data = await res.json();
  return { latex: data.latex, variables: data.variables || {}, totalRows: data.total_rows || 0 };
}

// ═══ キャッシュ管理 API ═══

export async function getCacheStats(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/cache/stats`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("キャッシュ統計の取得に失敗");
  const data = await res.json();
  return data.stats;
}

export async function clearCache(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cache/clear`, { method: "POST" });
  if (!res.ok) throw new Error("キャッシュクリアに失敗");
}

// ═══ セキュリティ情報 API ═══

export async function getAllowedPackages(): Promise<{
  packages: string[];
  tikzLibraries: string[];
}> {
  const res = await fetch(`${API_BASE}/api/security/allowed-packages`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("パッケージ情報の取得に失敗");
  const data = await res.json();
  return { packages: data.packages, tikzLibraries: data.tikz_libraries };
}
