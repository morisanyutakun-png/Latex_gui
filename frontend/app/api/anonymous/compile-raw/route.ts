/**
 * ゲスト用 raw LaTeX コンパイルプロキシ。
 *
 * 通常の compile-raw は require_user で守られているが、ゲスト編集中は PDF
 * ライブプレビューを動かす必要があるため、認証なしの代替経路に流す。
 * バックエンド側で IP 単位の rate limit が効く。
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

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
    const res = await fetch(`${BACKEND}/api/anonymous/compile-raw`, {
      method: "POST",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(55000),
    });

    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "application/json",
        },
      });
    }
    const pdf = await res.arrayBuffer();
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("Content-Disposition") || 'inline; filename="preview.pdf"',
      },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          message: isTimeout
            ? "コンパイルがタイムアウトしました。"
            : "コンパイルサーバに接続できません。",
        },
      },
      { status: 502 },
    );
  }
}
