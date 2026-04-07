/**
 * 採点モード — AI 採点 SSE プロキシ (multipart)
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const formData = await req.formData();
    const res = await fetch(`${BACKEND}/api/grading/grade/stream`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(58000),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { detail: { message: "採点に失敗しました", raw: err } },
        { status: res.status },
      );
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] grading/grade FAILED after ${elapsed}ms:`, err);
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? `採点がタイムアウトしました (${Math.round(elapsed / 1000)}秒)。サーバー起動中の場合は数秒待ってから再度お試しください。`
            : "採点サービスへの接続に失敗しました。",
        },
      },
      { status: 502 },
    );
  }
}
