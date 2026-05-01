import type { DocumentModel, BatchRequest, ChatMessage } from "./types";
import type { Rubric, RubricBundle, GradingResult, GradingStreamEvent } from "./grading-types";

/**
 * API ベース URL
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * AI専用バックエンドURL（Vercel無料プランの60秒制限を回避するため）
 */
const AI_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

// ═══ Phase 2: 構造化エラー型 ═══════════════════════════════
//
// バックエンドの PDFGenerationError は { message, code, params, violations }
// 形式の HTTPException detail を返す。フロントエンドはこれを CompileError に
// 詰め替えて throw し、UI 層 (document-editor / app-header) が i18n を使って
// `code` ベースでローカライズする。
//
// 旧 API: throw new Error("セキュリティポリシー違反: 未許可パッケージ: minted")
// 新 API: throw new CompileError({code: "security_violation",
//                                 violations: [{code: "package_not_allowed", package: "minted"}],
//                                 fallbackMessage: "セキュリティポリシー違反: ..."})

export interface SecurityViolationItem {
  code:
    | "package_not_allowed"
    | "tikz_library_not_allowed"
    | "forbidden_command"
    | "dangerous_command"
    | "file_access";
  package?: string;
  library?: string;
  command?: string;
}

export interface CompileErrorDetail {
  code?: string | null;
  params?: Record<string, unknown> | null;
  violations?: SecurityViolationItem[] | null;
  fallbackMessage: string;
  status: number;
}

export class CompileError extends Error {
  readonly code?: string | null;
  readonly params: Record<string, unknown>;
  readonly violations: SecurityViolationItem[];
  readonly status: number;

  constructor(detail: CompileErrorDetail) {
    super(detail.fallbackMessage);
    this.name = "CompileError";
    this.code = detail.code ?? null;
    this.params = detail.params ?? {};
    this.violations = detail.violations ?? [];
    this.status = detail.status;
  }
}

/**
 * 1 つのプレースホルダ ({package}, {command}, {library}) を埋める軽量フォーマッタ。
 * i18n の t() で取り出した raw 文字列に対して使う。
 */
function fillPlaceholders(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key];
    return v == null ? `{${key}}` : String(v);
  });
}

/**
 * CompileError を i18n でローカライズして「タイトル」と「詳細リスト」のペアにする。
 * UI 側はこれを使って Alert / Toast を組み立てる。
 *
 * @param error  throw された CompileError (api.ts 経由なら必ずこの型)
 * @param t      i18n の翻訳関数 ((key) => string)
 * @returns      { title, lines }  title はヘッダ用、lines は本文の各行
 */
export function formatCompileError(
  error: CompileError,
  t: (key: string) => string,
): { title: string; lines: string[]; hint?: string } {
  // セキュリティ違反 → 構造化リストを 1 行ずつ翻訳
  if (error.code === "security_violation" && error.violations.length > 0) {
    const lines = error.violations.map((v) => {
      const key = `error.security.${v.code}`;
      const template = t(key);
      // 翻訳キーが見つからなかった (t がキーをそのまま返す) ときは fallback
      if (template === key) return v.command || v.package || v.library || v.code;
      return fillPlaceholders(template, {
        package: v.package ?? "",
        library: v.library ?? "",
        command: v.command ?? "",
      });
    });
    return {
      title: t("error.security.title"),
      lines: [t("error.security.intro"), ...lines],
      hint: t("error.security.hint"),
    };
  }

  // その他の既知エラー code
  if (error.code === "network_timeout") {
    return { title: t("error.compile"), lines: [t("error.network.timeout")] };
  }
  if (error.code === "network_unreachable") {
    return { title: t("error.compile"), lines: [t("error.network.unreachable")] };
  }
  if (error.code === "latex_too_large") {
    return { title: t("error.compile"), lines: [t("error.latex_too_large")] };
  }
  if (error.code === "pdf_generation_failed") {
    return { title: t("error.compile"), lines: [t("error.pdf_generation_failed")] };
  }

  // 未知の code → fallbackMessage をそのまま見せる (バックエンドのコンパイルエラーなど)
  return { title: t("error.compile"), lines: [error.message] };
}

/**
 * fetch のレスポンスが !ok のとき、構造化エラーを抽出して CompileError を作る。
 * バックエンドの shape:
 *   { detail: { message, code, params, violations } }
 * 旧サーバや 502/504 などで detail が無い場合は code 無しの fallback メッセージのみ。
 */
async function buildCompileError(res: Response, fallback: string): Promise<CompileError> {
  let detail: Record<string, unknown> | null = null;
  try {
    const body = await res.json();
    detail = (body && typeof body === "object" && "detail" in body)
      ? (body.detail as Record<string, unknown>)
      : (body as Record<string, unknown>);
  } catch {
    /* ignore parse error */
  }
  const detailMessage = detail && typeof detail === "object" && typeof detail.message === "string"
    ? detail.message
    : null;
  return new CompileError({
    code: detail && typeof detail.code === "string" ? detail.code : null,
    params: detail && detail.params && typeof detail.params === "object"
      ? (detail.params as Record<string, unknown>)
      : null,
    violations: detail && Array.isArray(detail.violations)
      ? (detail.violations as SecurityViolationItem[])
      : null,
    fallbackMessage: detailMessage || fallback,
    status: res.status,
  });
}

/**
 * ログインなし無料お試し生成 — 匿名 PDF を生成する。
 *
 * フロントの localStorage で 1 回に絞った上で、Next.js proxy の cookie + バックエンドの
 * IP rate limit が二重ガードする。GA4 イベントは UI 層 (呼び出し側) で発火する。
 */
export interface AnonymousTrialResponse {
  /** 生成された PDF Blob (inline 表示用)。 */
  pdf: Blob;
  /** 生成にかかった時間 (ms)。GA4 `duration_ms` に渡す。 */
  durationMs: number;
}

export interface AnonymousTrialErrorDetail {
  code?: string;
  message: string;
  status: number;
}

export class AnonymousTrialError extends Error {
  readonly code?: string;
  readonly status: number;
  constructor(detail: AnonymousTrialErrorDetail) {
    super(detail.message);
    this.name = "AnonymousTrialError";
    this.code = detail.code;
    this.status = detail.status;
  }
}

export async function generateAnonymousTrialPDF(
  topic: string,
  locale: AILocale = "ja",
): Promise<AnonymousTrialResponse> {
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`/api/anonymous-trial/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, locale }),
      signal: AbortSignal.timeout(58000),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new AnonymousTrialError({
      code: isTimeout ? "trial_timeout" : "trial_network",
      message: isTimeout
        ? "生成サーバの応答が遅延しています。もう一度お試しください。"
        : "生成サーバに接続できませんでした。",
      status: 0,
    });
  }

  if (!res.ok) {
    let detailMsg = `生成に失敗しました (HTTP ${res.status})`;
    let detailCode: string | undefined;
    try {
      const body = await res.json();
      const detail = body?.detail;
      if (detail && typeof detail === "object") {
        if (typeof detail.message === "string") detailMsg = detail.message;
        if (typeof detail.code === "string") detailCode = detail.code;
      }
    } catch {
      /* 非 JSON レスポンス: フォールバックメッセージを使う */
    }
    throw new AnonymousTrialError({
      code: detailCode,
      message: detailMsg,
      status: res.status,
    });
  }

  return { pdf: await res.blob(), durationMs: Date.now() - t0 };
}


export async function generatePDF(doc: DocumentModel): Promise<Blob> {
  const maxAttempts = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
        signal: AbortSignal.timeout(58000),
      });

      if (!res.ok) {
        const err = await buildCompileError(
          res,
          `PDF generation failed (HTTP ${res.status})`,
        );
        // 502/504 はインフラ起因の一時障害なのでリトライ
        if ((res.status === 502 || res.status === 504) && attempt < maxAttempts) {
          lastError = err;
          continue;
        }
        throw err;
      }

      return await res.blob();
    } catch (networkErr) {
      // CompileError はそのまま伝播
      if (networkErr instanceof CompileError) {
        throw networkErr;
      }

      const isTimeout = networkErr instanceof Error &&
        (networkErr.name === "TimeoutError" || networkErr.name === "AbortError");

      if (isTimeout && attempt < maxAttempts) {
        lastError = new CompileError({
          code: "network_timeout",
          fallbackMessage: "PDF server is taking longer than usual; retrying…",
          status: 0,
        });
        continue;
      }

      throw new CompileError({
        code: isTimeout ? "network_timeout" : "network_unreachable",
        fallbackMessage: isTimeout
          ? "PDF generation is taking too long. The server may be starting up — please wait a moment and try again."
          : "Could not reach the PDF compile server. Please check your network connection.",
        status: 0,
      });
    }
  }

  throw lastError || new CompileError({
    code: "pdf_generation_failed",
    fallbackMessage: "PDF generation failed",
    status: 0,
  });
}

/** 共通オプション: ゲストモード時は認証不要の `/api/anonymous/...` プロキシを使う。 */
export interface AnonymousOption {
  anonymous?: boolean;
}

export async function previewLatex(doc: DocumentModel, opts: AnonymousOption = {}): Promise<string> {
  const body = JSON.stringify(doc);
  const tryFetch = (anon: boolean) => fetch(
    anon ? `/api/anonymous/preview-latex` : `/api/preview-latex`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
  );
  let res = await tryFetch(!!opts.anonymous);
  if (!res.ok && res.status === 401 && !opts.anonymous) {
    // 認証必須エンドポイントが 401 を返したらゲスト用にフォールバック。
    res = await tryFetch(true);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: { message?: string } })?.detail;
    throw new Error(detail?.message ?? "LaTeXプレビューの取得に失敗しました");
  }
  const data = await res.json();
  return data.latex;
}

export async function compileRawLatex(
  latex: string,
  filename?: string,
  opts: AnonymousOption = {},
): Promise<Blob> {
  const body = JSON.stringify({ latex, filename: filename ?? "document" });
  const tryFetch = (anon: boolean) => fetch(
    anon ? `/api/anonymous/compile-raw` : `/api/compile-raw`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // モバイル回線 + コールドスタートの LuaLaTeX は 30〜45秒かかる場合がある。
      // Vercel proxy 側は maxDuration=60 / 55s timeout なので、フロントは 58s で打ち切る。
      signal: AbortSignal.timeout(58000),
    },
  );

  // 502 / 504 はインフラ系の transient failure (cold start, gateway timeout) なので
  // 1 回だけリトライする。422 (LaTeX 由来の compile error) はリトライしない。
  const MAX_ATTEMPTS = 2;
  let res: Response | null = null;
  let lastTransientErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      res = await tryFetch(!!opts.anonymous);
    } catch (netErr) {
      const isTimeout = netErr instanceof Error &&
        (netErr.name === "TimeoutError" || netErr.name === "AbortError");
      if (attempt < MAX_ATTEMPTS) {
        lastTransientErr = netErr instanceof Error ? netErr : new Error(String(netErr));
        continue;
      }
      throw new CompileError({
        code: isTimeout ? "network_timeout" : "network_unreachable",
        fallbackMessage: isTimeout
          ? "コンパイルがタイムアウトしました。もう一度お試しください。"
          : "コンパイルサーバに接続できませんでした。",
        status: 0,
      });
    }

    if (res.ok) break;

    // 401: anonymous プロキシへ自動フォールバック (一度だけ)
    if (res.status === 401 && !opts.anonymous && attempt === 1) {
      res = await tryFetch(true);
      if (res.ok) break;
    }

    // 502/504: transient なのでリトライ
    if ((res.status === 502 || res.status === 504) && attempt < MAX_ATTEMPTS) {
      lastTransientErr = new Error(`HTTP ${res.status}`);
      continue;
    }
    break;
  }

  if (!res) {
    throw lastTransientErr || new Error("compile failed");
  }
  if (!res.ok) {
    throw await buildCompileError(res, `LaTeX compile failed (HTTP ${res.status})`);
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

// ═══ バッチ生成 (教材工場) API ═══

export async function detectVariables(doc: DocumentModel): Promise<string[]> {
  // 認証必須のため Next.js プロキシ経由 (同一オリジン) で呼ぶ
  const res = await fetch(`/api/batch/detect-variables`, {
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
  // NextAuth セッションを使ってバックエンドの quota/auth を通すため、
  // 常に Next.js プロキシ (同一オリジン) 経由で呼ぶ。
  const res = await fetch(`/api/batch/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(300000),
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
  // 認証必須のため Next.js プロキシ経由 (同一オリジン) で呼ぶ
  const res = await fetch(`/api/batch/preview`, {
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
  /** New full LaTeX source produced by the agent (or null if no edits were made) */
  latex: string | null;
  thinking: Array<{ type: string; text: string; tool?: string; duration?: number }>;
  usage: { inputTokens: number; outputTokens: number };
  /** Anonymous flow: server-side compiled PDF as base64. Allows the client to
   *  display the PDF without a second compile-raw round-trip. May be null
   *  (older backends, compile failed, no latex). */
  pdfBase64?: string | null;
}

/**
 * UI ロケール (`useI18n().locale`) を AI バックエンドへ渡す型。
 * Phase 3: バックエンドはこれを使って system prompt の言語を切り替える。
 */
export type AILocale = "ja" | "en";

/**
 * エージェントモード ID。バックエンドの VALID_MODES と同期している。
 * - plan: 計画のみ。read-only ツールだけ許可、チャットに番号付き計画を返す
 * - edit: 自律編集。計画を書かず即実行、完走モード
 * - mix:  計画 + 自律実行。同ターン内で計画テキスト → 編集まで完走
 */
export type AgentMode = "plan" | "edit" | "mix";

export async function sendAIMessage(
  messages: Pick<ChatMessage, "role" | "content">[],
  doc: DocumentModel,
  locale: AILocale = "ja",
  mode: AgentMode = "edit",
  opts: AnonymousOption = {},
): Promise<AIChatResponse> {
  // ゲストモードは Next.js プロキシ (同一オリジン) 経由で必ず呼ぶ。直結すると
  // CORS と INTERNAL_API_SECRET の取り回しで詰まる。
  const url = opts.anonymous
    ? `/api/anonymous/ai-chat`
    : (AI_BACKEND_URL ? `${AI_BACKEND_URL}/api/ai/chat` : `${API_BASE}/api/ai/chat`);
  // ゲストお試しは AI 出力 + サーバ側 PDF コンパイルまでが一連で含まれるので、
  // 単発 chat (90s) よりも長めに取る (LuaLaTeX cold start で +30〜45s 余分)。
  const timeoutMs = opts.anonymous ? 140000 : 180000;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, document: doc, locale, mode }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail
      || (locale === "en"
        ? `Failed to fetch AI response (HTTP ${res.status})`
        : `AIの応答取得に失敗しました (HTTP ${res.status})`);
    throw new Error(msg);
  }

  const data = await res.json();
  return {
    message: data.message || "",
    latex: data.latex ?? null,
    thinking: data.thinking || [],
    usage: data.usage || { inputTokens: 0, outputTokens: 0 },
    // 匿名フローのみサーバから渡ってくる。base64 のままフロントへ。
    pdfBase64: typeof data.pdf_base64 === "string" ? data.pdf_base64 : null,
  };
}

/**
 * base64 → Blob (PDF) 変換。匿名 AI チャットがサーバ側で組版した PDF を
 * フロントが直接ビューアに渡せる Blob にする。
 */
export function pdfBase64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

// ═══ AI チャット SSE ストリーミング ═══

export type StreamEvent =
  | { type: "thinking"; text: string }
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; args?: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: Record<string, unknown>; duration: number }
  | { type: "latex"; latex: string }
  | { type: "done"; message: string; latex: string | null; thinking: AIChatResponse["thinking"]; usage: AIChatResponse["usage"] }
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
  locale: AILocale = "ja",
  mode: AgentMode = "edit",
): Promise<StreamDiagnostics> {
  const url = AI_BACKEND_URL
    ? `${AI_BACKEND_URL}/api/ai/chat/stream`
    : `${API_BASE}/api/ai/chat/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, document: doc, locale, mode }),
    signal: signal || AbortSignal.timeout(300000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail
      || (locale === "en"
        ? `Failed to fetch AI response (HTTP ${res.status})`
        : `AIの応答取得に失敗しました (HTTP ${res.status})`);
    throw new Error(msg);
  }

  if (!res.body) {
    throw new Error(locale === "en"
      ? "Streaming response is empty"
      : "ストリーミングレスポンスが空です");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastDataTime = Date.now();
  const READ_TIMEOUT = 180000;

  const diag: StreamDiagnostics = {
    eventsReceived: 0,
    lastEventType: null,
    streamEndedNormally: false,
  };

  try {
    while (true) {
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
            continue;
          }
          diag.eventsReceived++;
          diag.lastEventType = event.type;
          onEvent(event);
        }
      }
    }

    if (buffer.startsWith("data: ")) {
      let event: StreamEvent;
      try {
        event = JSON.parse(buffer.slice(6)) as StreamEvent;
      } catch {
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
  /** Extracted full LaTeX source */
  latex: string | null;
}

export type OMRStreamEvent =
  | { type: "progress"; phase: string; message: string }
  // warnings: バックエンドの security 検証で残った許可外要素 (通常は空配列)。
  //   例: ["package:authblk", "tikz:shapes.arrows"]
  //   現状はログ・UI 警告用途のみで、compile は試みる。
  | { type: "done"; description: string; latex: string | null; warnings?: string[] }
  | { type: "error"; message: string };

export async function analyzeImageOMR(
  imageFile: File,
  doc: DocumentModel,
  hint: string = "",
  locale: AILocale = "en",
): Promise<OMRAnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("document", JSON.stringify(doc));
  formData.append("hint", hint);
  formData.append("locale", locale);

  const res = await fetch(`${API_BASE}/api/omr/analyze`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.detail?.message || err?.detail
      || (locale === "en"
        ? `Scan failed (HTTP ${res.status})`
        : `OMR解析に失敗しました (HTTP ${res.status})`);
    throw new Error(msg);
  }

  const data = await res.json();
  return {
    description: data.description || "",
    latex: data.latex ?? null,
  };
}

export async function streamOMRAnalyze(
  imageFile: File,
  doc: DocumentModel,
  onEvent: (event: OMRStreamEvent) => void,
  hint: string = "",
  signal?: AbortSignal,
  locale: AILocale = "en",
): Promise<OMRAnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("document", JSON.stringify(doc));
  formData.append("hint", hint);
  formData.append("locale", locale);

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
    const msg = err?.detail?.message || err?.detail
      || (locale === "en"
        ? `Scan failed (HTTP ${res.status})`
        : `OMR解析に失敗しました (HTTP ${res.status})`);
    throw new Error(msg);
  }

  if (!res.body) throw new Error(locale === "en"
    ? "Streaming response is empty"
    : "ストリーミングレスポンスが空です");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: OMRAnalyzeResponse = { description: "", latex: null };

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
              latex: event.latex ?? null,
            };
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    }

    if (buffer.startsWith("data: ")) {
      try {
        const event = JSON.parse(buffer.slice(6)) as OMRStreamEvent;
        onEvent(event);
        if (event.type === "done") {
          result = {
            description: event.description || "",
            latex: event.latex ?? null,
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

// ═══ 採点モード API ═══

export async function parseRubric(latex: string): Promise<RubricBundle> {
  const res = await fetch(`${API_BASE}/api/grading/parse-rubric`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latex }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || "ルーブリックの解析に失敗しました");
  }
  return res.json();
}

export async function writeRubric(latex: string, rubrics: Rubric[]): Promise<string> {
  const res = await fetch(`${API_BASE}/api/grading/write-rubric`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latex, rubrics }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || "ルーブリックの保存に失敗しました");
  }
  const data = await res.json();
  return data.latex;
}

export type ExtractRubricEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "done"; latex: string; rubrics: RubricBundle }
  | { type: "error"; message: string };

export async function extractRubricStream(
  latex: string,
  onEvent: (event: ExtractRubricEvent) => void,
  signal?: AbortSignal,
  locale: AILocale = "en",
): Promise<{ latex: string; rubrics: RubricBundle }> {
  const url = AI_BACKEND_URL
    ? `${AI_BACKEND_URL}/api/grading/extract-rubric/stream`
    : `${API_BASE}/api/grading/extract-rubric/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latex, locale }),
    signal: signal || AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || (locale === "en"
      ? `Rubric extraction failed (HTTP ${res.status})`
      : `ルーブリック抽出に失敗しました (HTTP ${res.status})`));
  }
  if (!res.body) throw new Error(locale === "en"
    ? "Streaming response is empty"
    : "ストリーミングレスポンスが空です");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: { latex: string; rubrics: RubricBundle } | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event: ExtractRubricEvent;
        try {
          event = JSON.parse(line.slice(6)) as ExtractRubricEvent;
        } catch {
          continue;
        }
        onEvent(event);
        if (event.type === "done") {
          result = { latex: event.latex, rubrics: event.rubrics };
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    }
    if (buffer.startsWith("data: ")) {
      try {
        const event = JSON.parse(buffer.slice(6)) as ExtractRubricEvent;
        onEvent(event);
        if (event.type === "done") {
          result = { latex: event.latex, rubrics: event.rubrics };
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      } catch { /* ignore */ }
    }
  } finally {
    reader.releaseLock();
  }

  if (!result) throw new Error("ルーブリック抽出が完了しませんでした");
  return result;
}

export interface GradeAnswerArgs {
  rubrics: RubricBundle;
  problemLatex: string;
  studentName: string;
  studentId: string;
  files: File[];
  locale?: AILocale;
}

export async function gradeAnswerStream(
  args: GradeAnswerArgs,
  onEvent: (event: GradingStreamEvent) => void,
  signal?: AbortSignal,
): Promise<GradingResult> {
  const locale: AILocale = args.locale || "en";
  const formData = new FormData();
  formData.append("request_json", JSON.stringify({
    rubrics: args.rubrics,
    problemLatex: args.problemLatex,
    studentName: args.studentName,
    studentId: args.studentId,
    locale,
  }));
  for (const f of args.files) {
    formData.append("answers", f);
  }

  const url = AI_BACKEND_URL
    ? `${AI_BACKEND_URL}/api/grading/grade/stream`
    : `${API_BASE}/api/grading/grade/stream`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    signal: signal || AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || (locale === "en"
      ? `Grading failed (HTTP ${res.status})`
      : `採点に失敗しました (HTTP ${res.status})`));
  }
  if (!res.body) throw new Error(locale === "en"
    ? "Streaming response is empty"
    : "ストリーミングレスポンスが空です");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: GradingResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event: GradingStreamEvent;
        try {
          event = JSON.parse(line.slice(6)) as GradingStreamEvent;
        } catch {
          continue;
        }
        onEvent(event);
        if (event.type === "done") {
          finalResult = event.result;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    }
    if (buffer.startsWith("data: ")) {
      try {
        const event = JSON.parse(buffer.slice(6)) as GradingStreamEvent;
        onEvent(event);
        if (event.type === "done") finalResult = event.result;
        else if (event.type === "error") throw new Error(event.message);
      } catch { /* ignore */ }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResult) throw new Error("採点が完了しませんでした");
  return finalResult;
}

export async function renderFeedbackPdf(
  result: GradingResult,
  locale: AILocale = "en",
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/grading/render-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result, locale }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || (locale === "en"
      ? "Failed to generate the feedback PDF"
      : "フィードバックPDFの生成に失敗しました"));
  }
  return res.blob();
}

export async function renderMarkedPdf(
  result: GradingResult,
  locale: AILocale = "en",
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/grading/render-marked`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result, locale }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail?.message || (locale === "en"
      ? "Failed to generate the marked-up PDF"
      : "赤入れPDFの生成に失敗しました"));
  }
  return res.blob();
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

