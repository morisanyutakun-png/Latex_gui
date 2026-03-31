/**
 * OMR 解析 プロキシ — multipart/form-data をそのまま転送
 * FormData は body を再利用できないのでリトライなし
 * タイムアウトメッセージを詳細化
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const formData = await req.formData();
    const res = await fetch(`${BACKEND}/api/omr/analyze`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(58000),
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] omr/analyze FAILED after ${elapsed}ms:`, err);
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? `OMR解析がタイムアウトしました (${Math.round(elapsed / 1000)}秒)。サーバーが起動中の場合は数秒待ってから再度お試しください。`
            : "OMR解析サービスへの接続に失敗しました。",
        },
      },
      { status: 502 },
    );
  }
}
