/**
 * ヘルスチェックプロキシ
 */
import { NextResponse } from "next/server";

export const maxDuration = 15;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/health`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json({ ...data, backend_url: BACKEND }, { status: res.status });
  } catch (err) {
    console.error(`[proxy] health check failed (${BACKEND}):`, err);
    return NextResponse.json(
      { status: "error", message: "Backend unreachable", backend_url: BACKEND },
      { status: 502 },
    );
  }
}
