import type { DocumentModel, BatchRequest, ChatMessage, DocumentPatch } from "./types";

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

/**
 * AI専用バックエンドURL
 *
 * Vercel無料プランは60秒でタイムアウトするため、
 * AIストリーミングはVercelプロキシを経由せず直接バックエンドに接続する。
 * NEXT_PUBLIC_BACKEND_URL を設定すればプロキシをバイパスする。
 */
const AI_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: { message?: string } })?.detail;
    throw new Error(detail?.message ?? "LaTeXプレビューの取得に失敗しました");
  }
  const data = await res.json();
  return data.latex;
}

export async function compileRawLatex(latex: string, filename?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/compile-raw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latex, filename: filename ?? "document" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "LaTeXコンパイルに失敗しました");
  }
  return res.blob();
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

// ═══ AI チャット API ═══

export interface AIChatResponse {
  message: string;
  patches: DocumentPatch | null;
  thinking: Array<{ type: "thinking" | "action" | "result"; text: string }>;
  usage: { inputTokens: number; outputTokens: number };
}

export async function sendAIMessage(
  messages: Pick<ChatMessage, "role" | "content">[],
  doc: DocumentModel,
): Promise<AIChatResponse> {
  // バックエンドURLが設定されていればVercelプロキシをバイパス
  const url = AI_BACKEND_URL
    ? `${AI_BACKEND_URL}/api/ai/chat`
    : `${API_BASE}/api/ai/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, document: doc, requestPatches: true }),
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail || `AIの応答取得に失敗しました (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  return {
    message: data.message || "",
    patches: data.patches || null,
    thinking: data.thinking || [],
    usage: data.usage || { inputTokens: 0, outputTokens: 0 },
  };
}

// ═══ AI チャット SSE ストリーミング ═══

export type StreamEvent =
  | { type: "thinking"; text: string }
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; args?: Record<string, unknown>; ops_count?: number }
  | { type: "tool_result"; name: string; result: Record<string, unknown>; duration: number }
  | { type: "patch"; ops: Record<string, unknown>[] }
  | { type: "done"; message: string; patches: DocumentPatch | null; thinking: AIChatResponse["thinking"]; usage: AIChatResponse["usage"] }
  | { type: "error"; message: string };

export interface StreamDiagnostics {
  eventsReceived: number;
  lastEventType: string | null;
  streamEndedNormally: boolean;
  errorMessage?: string;
}

export async function streamAIMessage(
  messages: Pick<ChatMessage, "role" | "content">[],
  doc: DocumentModel,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<StreamDiagnostics> {
  // バックエンドURLが設定されていればVercelプロキシをバイパス（60秒制限回避）
  const url = AI_BACKEND_URL
    ? `${AI_BACKEND_URL}/api/ai/chat/stream`
    : `${API_BASE}/api/ai/chat/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, document: doc, requestPatches: true }),
    signal: signal || AbortSignal.timeout(300000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail || `AIの応答取得に失敗しました (HTTP ${res.status})`;
    throw new Error(msg);
  }

  if (!res.body) throw new Error("ストリーミングレスポンスが空です");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastDataTime = Date.now();
  const READ_TIMEOUT = 180000; // 3 minutes without any data = timeout

  const diag: StreamDiagnostics = {
    eventsReceived: 0,
    lastEventType: null,
    streamEndedNormally: false,
  };

  try {
    while (true) {
      // Create a timeout race for each read (with cleanup)
      const readPromise = reader.read();
      let timer: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        const remaining = READ_TIMEOUT - (Date.now() - lastDataTime);
        if (remaining <= 0) {
          reject(new Error("ストリーミングがタイムアウトしました"));
          return;
        }
        timer = setTimeout(() => reject(new Error("ストリーミングがタイムアウトしました")), remaining);
      });

      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([readPromise, timeoutPromise]);
      } catch (timeoutErr) {
        try { reader.cancel(); } catch { /* ignore */ }
        diag.errorMessage = "タイムアウト: AIからの応答が長時間ありませんでした";
        throw timeoutErr;
      } finally {
        if (timer) clearTimeout(timer);
      }

      const { done, value } = result;
      if (done) {
        diag.streamEndedNormally = true;
        break;
      }

      lastDataTime = Date.now();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          let event: StreamEvent;
          try {
            event = JSON.parse(line.slice(6)) as StreamEvent;
          } catch {
            continue; // ignore malformed SSE lines
          }
          diag.eventsReceived++;
          diag.lastEventType = event.type;
          onEvent(event); // callback errors propagate up
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith("data: ")) {
      let event: StreamEvent;
      try {
        event = JSON.parse(buffer.slice(6)) as StreamEvent;
      } catch {
        // ignore
        return diag;
      }
      diag.eventsReceived++;
      diag.lastEventType = event.type;
      onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }

  return diag;
}

// ═══ OMR 解析 API ═══

export interface OMRAnalyzeResponse {
  description: string;
  patches: DocumentPatch | null;
}

export type OMRStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "done"; description: string; patches: DocumentPatch | null }
  | { type: "error"; message: string };

export async function analyzeImageOMR(
  imageFile: File,
  doc: DocumentModel,
  hint: string = "",
): Promise<OMRAnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("document", JSON.stringify(doc));
  formData.append("hint", hint);

  const res = await fetch(`${API_BASE}/api/omr/analyze`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail || `OMR解析に失敗しました (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  return {
    description: data.description || "",
    patches: data.patches || null,
  };
}

/**
 * SSEストリーミング版OMR解析 — 進捗をリアルタイムで受け取る
 */
export async function streamOMRAnalyze(
  imageFile: File,
  doc: DocumentModel,
  onEvent: (event: OMRStreamEvent) => void,
  hint: string = "",
  signal?: AbortSignal,
): Promise<OMRAnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("document", JSON.stringify(doc));
  formData.append("hint", hint);

  // バックエンドURLが設定されていればプロキシをバイパス
  const url = AI_BACKEND_URL
    ? `${AI_BACKEND_URL}/api/omr/analyze/stream`
    : `${API_BASE}/api/omr/analyze/stream`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    signal: signal || AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail || `OMR解析に失敗しました (HTTP ${res.status})`;
    throw new Error(msg);
  }

  if (!res.body) throw new Error("ストリーミングレスポンスが空です");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: OMRAnalyzeResponse = { description: "", patches: null };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          let event: OMRStreamEvent;
          try {
            event = JSON.parse(line.slice(6)) as OMRStreamEvent;
          } catch {
            continue;
          }
          onEvent(event);

          if (event.type === "done") {
            result = {
              description: event.description || "",
              patches: event.patches || null,
            };
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith("data: ")) {
      try {
        const event = JSON.parse(buffer.slice(6)) as OMRStreamEvent;
        onEvent(event);
        if (event.type === "done") {
          result = {
            description: event.description || "",
            patches: event.patches || null,
          };
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      } catch { /* ignore */ }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
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

// ═══ 採点 API ═══

import type { AnswerKey, StudentAnswer, ScoreResult } from "./types";

export async function scoreAnswers(
  answerKey: AnswerKey,
  studentAnswers: StudentAnswer[],
): Promise<ScoreResult> {
  const res = await fetch(`${API_BASE}/api/scoring/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answerKey, studentAnswers }),
  });
  if (!res.ok) throw new Error("採点に失敗しました");
  return res.json();
}
