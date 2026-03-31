/**
 * AI チャット プロキシ — ブラウザ → Vercel → Koyeb バックエンド
 * ANTHROPIC_API_KEY はバックエンドのみで管理（フロントエンドには不要）
 * Koyeb コールドスタート対策: タイムアウト時に1回リトライ
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TIMEOUT_MS = 55000;

async function callBackend(body: string, timeoutMs: number): Promise<Response> {
  return fetch(`${BACKEND}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await req.text();

    let res: Response;
    try {
      res = await callBackend(body, TIMEOUT_MS);
    } catch (firstErr) {
      const elapsed = Date.now() - t0;
      const isTimeout = firstErr instanceof Error &&
        (firstErr.name === "TimeoutError" || firstErr.name === "AbortError");
      const isNetwork = firstErr instanceof Error && firstErr.message?.includes("fetch");

      // Koyeb コールドスタート対策: タイムアウト or ネットワークエラーなら1回リトライ
      if ((isTimeout || isNetwork) && elapsed < 55000) {
        console.log(`[proxy] ai/chat first attempt failed (${elapsed}ms), retrying...`);
        const retryTimeout = Math.max(57000 - elapsed, 5000);
        try {
          res = await callBackend(body, Math.min(retryTimeout, TIMEOUT_MS));
        } catch (retryErr) {
          throw retryErr;
        }
      } else {
        throw firstErr;
      }
    }

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] ai/chat FAILED after ${elapsed}ms:`, err);
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? `AIサービスの応答がタイムアウトしました (${Math.round(elapsed / 1000)}秒)。サーバーが起動中の可能性があります。しばらく待ってから再度お試しください。`
            : "AIサービスへの接続に失敗しました。ネットワーク接続とバックエンドの状態を確認してください。",
        },
      },
      { status: 502 },
    );
  }
}
