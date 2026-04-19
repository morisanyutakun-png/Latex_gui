/**
 * /api/batch/preview — バッチ生成の 1 行目プレビュープロキシ
 * 認証必須: バックエンドへ x-user-id / x-internal-secret を転送する。
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 30;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { detail: { code: "UNAUTHORIZED", message: "ログインが必要です。" } },
      { status: 401 },
    );
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-id": session.user.id,
    "x-user-email": session.user.email ?? "",
    "x-user-name": encodeURIComponent(session.user.name ?? ""),
    ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
  };
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/batch/preview`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(28000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { detail: { message: "バックエンドに接続できません" } },
      { status: 502 },
    );
  }
}
