/**
 * PDF生成プロキシ — ブラウザ → Vercel (同一オリジン) → Koyeb バックエンド
 *
 * CORS 問題を回避し、バックエンド URL をサーバー側だけで管理する。
 * Vercel 環境変数: API_URL (NEXT_PUBLIC_ 不要)
 */
import { NextRequest, NextResponse } from "next/server";

// Vercel Serverless Function の実行時間上限 (秒)
// Hobby: max 60s, Pro: max 300s
export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  console.log(`[proxy] generate-pdf → ${BACKEND}/api/generate-pdf`);

  try {
    const body = await req.text();

    const res = await fetch(`${BACKEND}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // バックエンドの REQUEST_TIMEOUT=60s に合わせてマージンを設定
      // ウォームアップ完了後は 5-15 秒で返るが、初回は最大 50-55 秒かかる可能性
      signal: AbortSignal.timeout(58000),
    });

    const elapsed = Date.now() - t0;
    console.log(`[proxy] generate-pdf response: ${res.status} (${elapsed}ms)`);

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
    const elapsed = Date.now() - t0;
    console.error(`[proxy] generate-pdf FAILED after ${elapsed}ms:`, err);

    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const message = isTimeout
      ? `PDF生成がタイムアウトしました (${Math.round(elapsed / 1000)}秒)。Koyeb バックエンドの応答が遅い可能性があります。`
      : `バックエンドサーバーに接続できません (${BACKEND})`;
    return NextResponse.json(
      { detail: { message } },
      { status: 502 },
    );
  }
}
