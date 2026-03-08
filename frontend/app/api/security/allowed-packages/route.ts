/**
 * セキュリティ情報プロキシ (許可パッケージ一覧)
 */
import { NextResponse } from "next/server";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/security/allowed-packages`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "パッケージ情報の取得に失敗" }, { status: 502 });
  }
}
