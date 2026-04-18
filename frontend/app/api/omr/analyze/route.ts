/**
 * OMR 解析 プロキシ — multipart/form-data をそのまま転送
 * FormData は body を再利用できないのでリトライなし
 * タイムアウトメッセージを詳細化
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { detail: { code: "UNAUTHORIZED", message: "OMR機能を使うにはログインが必要です。" } },
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
    const formData = await req.formData();
    const res = await fetch(`${BACKEND}/api/omr/analyze`, {
      method: "POST",
      headers: authHdrs,
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
