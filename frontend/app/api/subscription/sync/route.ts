import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Stripe 側の最新状態で DB を強制同期するプロキシ。
// webhook 取りこぼしが疑われる場合の self-heal として、購入 redirect 後などに叩かれる。
export const runtime = "nodejs";
export const maxDuration = 30;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ detail: "認証が必要です" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/subscription/sync`, {
      method: "POST",
      headers: {
        "x-user-id": session.user.id,
        "x-user-email": session.user.email ?? "",
        "x-user-name": encodeURIComponent(session.user.name ?? ""),
        ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { detail: text.slice(0, 300) }; }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `バックエンド接続エラー: ${msg}` }, { status: 502 });
  }
}
