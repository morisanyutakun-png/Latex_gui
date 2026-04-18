/**
 * AI チャット SSE ストリーミングプロキシ
 * ブラウザ → Vercel → Koyeb バックエンド
 */
import { NextRequest } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 300;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ detail: { code: "UNAUTHORIZED", message: "AI機能を使うにはログインが必要です。" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
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

    const res = await fetch(`${BACKEND}/api/ai/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHdrs },
      body,
      signal: AbortSignal.timeout(300000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(errText, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!res.body) {
      return new Response(
        JSON.stringify({ detail: { message: "ストリーミングレスポンスが空です" } }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Pipe the SSE stream from backend to client
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[proxy] ai/chat/stream FAILED:", err);
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return new Response(
      JSON.stringify({
        detail: {
          message: isTimeout
            ? "AIサービスの応答がタイムアウトしました。"
            : "AIサービスへの接続に失敗しました。",
        },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
