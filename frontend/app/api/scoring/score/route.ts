/**
 * 採点プロキシ
 * ブラウザ → Next.js Route Handler → バックエンド
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const backendUrl = `${BACKEND}/api/scoring/score`;

  try {
    const body = await req.text();
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { success: false, message: "採点に失敗しました", detail: errBody },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[proxy] scoring/score error:", e);
    return NextResponse.json(
      { success: false, message: e?.message || "採点エラー" },
      { status: 502 },
    );
  }
}
