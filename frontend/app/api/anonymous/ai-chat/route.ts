/**
 * ゲスト用 AI チャットプロキシ。
 *
 * - 認証ヘッダは付けない (バックエンド側も auth dependency なし)
 * - INTERNAL_API_SECRET だけ付与する (本番でバックエンドが署名検証する場合に
 *   ヘッダ無しで弾かれないようにするため)
 * - X-Forwarded-For を素直に転送 (IP rate limit が効くように)
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

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
    const res = await fetch(`${BACKEND}/api/anonymous/ai-chat`, {
      method: "POST",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(180000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? "AI サーバの応答がタイムアウトしました。もう一度お試しください。"
            : "AI サーバに接続できませんでした。",
        },
      },
      { status: 502 },
    );
  }
}
