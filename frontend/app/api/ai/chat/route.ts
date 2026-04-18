/**
 * AI チャット プロキシ — ブラウザ → Vercel → Koyeb バックエンド
 * ANTHROPIC_API_KEY はバックエンドのみで管理（フロントエンドには不要）
 * Koyeb コールドスタート対策: タイムアウト時に1回リトライ
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 300;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";
const TIMEOUT_MS = 180000;

async function callBackend(body: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  return fetch(`${BACKEND}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { detail: { code: "UNAUTHORIZED", message: "AI機能を使うにはログインが必要です。" } },
      { status: 401 },
    );
  }
  const authHdrs: Record<string, string> = {
    "x-user-id": session.user.id,
    "x-user-email": session.user.email ?? "",
    "x-user-name": encodeURIComponent(session.user.name ?? ""),
    ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
  };

  try {
    const body = await req.text();

    let res: Response;
    try {
      res = await callBackend(body, authHdrs, TIMEOUT_MS);
    } catch (firstErr) {
      const elapsed = Date.now() - t0;
      const isTimeout = firstErr instanceof Error &&
        (firstErr.name === "TimeoutError" || firstErr.name === "AbortError");
      const isNetwork = firstErr instanceof Error && firstErr.message?.includes("fetch");

      // Koyeb コールドスタート対策: タイムアウト or ネットワークエラーなら1回リトライ
      if ((isTimeout || isNetwork) && elapsed < 120000) {
        console.log(`[proxy] ai/chat first attempt failed (${elapsed}ms), retrying...`);
        const retryTimeout = Math.max(TIMEOUT_MS - elapsed, 10000);
        try {
          res = await callBackend(body, authHdrs, retryTimeout);
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
