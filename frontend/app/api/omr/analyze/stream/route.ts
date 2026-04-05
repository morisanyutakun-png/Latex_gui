/**
 * OMR 解析 SSEストリーミング プロキシ
 * バックエンドのSSEレスポンスをそのまま転送
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const formData = await req.formData();
    const res = await fetch(`${BACKEND}/api/omr/analyze/stream`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(58000),
    });

    if (!res.ok) {
      const data = await res.text();
      return new NextResponse(data, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream SSE response through
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] omr/analyze/stream FAILED after ${elapsed}ms:`, err);
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? `OMR解析がタイムアウトしました (${Math.round(elapsed / 1000)}秒)。`
            : "OMR解析サービスへの接続に失敗しました。",
        },
      },
      { status: 502 },
    );
  }
}
