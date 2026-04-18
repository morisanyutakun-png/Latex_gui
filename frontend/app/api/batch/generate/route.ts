/**
 * バッチ生成プロキシ — ブラウザ → Next.js → バックエンド
 * NextAuth セッションから x-user-id を注入してバックエンドの auth/quota を通す。
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 300;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { detail: { code: "UNAUTHORIZED", message: "バッチ処理を使うにはログインが必要です。" } },
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
    const res = await fetch(`${BACKEND}/api/batch/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHdrs },
      body,
      signal: AbortSignal.timeout(290000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new NextResponse(errBody, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
      });
    }

    const zipBytes = await res.arrayBuffer();
    const fwdHeaders: Record<string, string> = {
      "Content-Type": "application/zip",
      "Content-Disposition": res.headers.get("Content-Disposition") || 'attachment; filename="batch_output.zip"',
    };
    for (const h of ["X-Batch-Total", "X-Batch-Success", "X-Batch-Errors", "X-Batch-Time-Ms"]) {
      const v = res.headers.get(h);
      if (v) fwdHeaders[h] = v;
    }
    return new NextResponse(zipBytes, { status: 200, headers: fwdHeaders });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? "バッチ生成がタイムアウトしました。"
            : "バッチ生成サービスへの接続に失敗しました。",
        },
      },
      { status: 502 },
    );
  }
}
