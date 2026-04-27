/**
 * ゲスト用 LaTeX プレビュー (raw を返す軽い endpoint)。
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: NextRequest) {
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json(
      { detail: { message: "リクエストの読み込みに失敗しました" } },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
  };
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers["x-forwarded-for"] = xff;

  try {
    const res = await fetch(`${BACKEND}/api/anonymous/preview-latex`, {
      method: "POST",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(15000),
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
