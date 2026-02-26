/**
 * ウォームアップ状態プロキシ — Koyeb バックエンドのエンジン準備状態を確認
 * 軽量エンドポイント (< 1秒で応答)
 */
import { NextResponse } from "next/server";

export const maxDuration = 15;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/debug/warmup-status`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Backend unreachable", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
