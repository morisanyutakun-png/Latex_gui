/**
 * 採点モード — AI ルーブリック抽出 SSE プロキシ
 *
 * Vercel の関数実行時間制約を避けるため、AI_BACKEND_URL が設定されていれば
 * フロントから直接バックエンドに繋ぐ。設定がない場合のみこのプロキシ経由。
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/grading/extract-rubric/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(58000),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { detail: { message: "ルーブリック抽出に失敗しました", raw: err } },
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
    console.error("[proxy] grading/extract-rubric error:", err);
    return NextResponse.json(
      { detail: { message: "ルーブリック抽出サービスへの接続に失敗しました" } },
      { status: 502 },
    );
  }
}
