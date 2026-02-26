/**
 * デバッグプロキシ — Koyeb バックエンドの TeX 環境情報を取得
 * /api/debug/tex-info にブラウザからアクセスして確認できる
 */
import { NextResponse } from "next/server";

export const maxDuration = 30;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  const t0 = Date.now();
  console.log(`[proxy] debug/tex-info → ${BACKEND}/api/debug/tex-info`);

  try {
    const res = await fetch(`${BACKEND}/api/debug/tex-info`, {
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    const data = await res.json();
    const elapsed = Date.now() - t0;
    return NextResponse.json({
      ...data,
      _proxy: {
        backend_url: BACKEND,
        response_time_ms: elapsed,
        backend_status: res.status,
      },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] debug/tex-info FAILED after ${elapsed}ms:`, err);
    return NextResponse.json(
      {
        error: "Backend unreachable",
        backend_url: BACKEND,
        elapsed_ms: elapsed,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
