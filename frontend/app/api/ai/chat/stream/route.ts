/**
 * AI チャット SSE ストリーミングプロキシ
 * ブラウザ → Vercel → Koyeb バックエンド
 */
import { NextRequest } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${BACKEND}/api/ai/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(120000),
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
