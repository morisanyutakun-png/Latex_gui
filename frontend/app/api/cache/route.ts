/**
 * キャッシュ管理プロキシ
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/cache/stats`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "キャッシュ統計の取得に失敗" }, { status: 502 });
  }
}

export async function POST() {
  try {
    const res = await fetch(`${BACKEND}/api/cache/clear`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "キャッシュクリアに失敗" }, { status: 502 });
  }
}
