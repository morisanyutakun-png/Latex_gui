/**
 * 採点モード — ルーブリックパース プロキシ
 * 決定論的な軽量エンドポイント。AI 不使用・短時間。
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/grading/parse-rubric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[proxy] grading/parse-rubric error:", err);
    return NextResponse.json(
      { detail: { message: "ルーブリックの解析に失敗しました" } },
      { status: 502 },
    );
  }
}
