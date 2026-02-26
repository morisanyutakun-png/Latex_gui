/**
 * PDF生成プロキシ — ブラウザ → Vercel (同一オリジン) → Koyeb バックエンド
 *
 * CORS 問題を回避し、バックエンド URL をサーバー側だけで管理する。
 * Vercel 環境変数: API_URL (NEXT_PUBLIC_ 不要)
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${BACKEND}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(55000), // Vercel の 60s 制限より少し短く
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new NextResponse(errBody, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
      });
    }

    const pdfBytes = await res.arrayBuffer();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("Content-Disposition") || 'attachment; filename="document.pdf"',
      },
    });
  } catch (err) {
    console.error("[proxy] generate-pdf error:", err);
    const message = err instanceof Error && err.name === "TimeoutError"
      ? "バックエンドサーバーがタイムアウトしました"
      : "バックエンドサーバーに接続できません";
    return NextResponse.json(
      { detail: { message } },
      { status: 502 },
    );
  }
}
