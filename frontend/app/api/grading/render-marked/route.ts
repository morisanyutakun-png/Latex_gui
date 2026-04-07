/**
 * 採点モード — 赤入れPDF プロキシ
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/grading/render-marked`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(58000),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { detail: { message: "赤入れPDFの生成に失敗しました", raw: err } },
        { status: res.status },
      );
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("Content-Disposition") || "inline",
      },
    });
  } catch (err) {
    console.error("[proxy] grading/render-marked error:", err);
    return NextResponse.json(
      { detail: { message: "PDF生成サービスへの接続に失敗しました" } },
      { status: 502 },
    );
  }
}
