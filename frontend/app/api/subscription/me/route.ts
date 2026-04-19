import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function GET() {
  const session = await auth();

  // 未認証は 200 で free 返却 (UX 上「ログイン促し」ではなく Free プランとして扱う)
  if (!session?.user?.id) {
    return NextResponse.json({ plan_id: "free", status: "free" });
  }

  try {
    const res = await fetch(`${BACKEND}/api/subscription/me`, {
      headers: {
        "x-user-id": session.user.id,
        "x-user-email": session.user.email ?? "",
        "x-user-name": encodeURIComponent(session.user.name ?? ""),
        ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
      },
      // サブスク状態は毎回最新を取得する
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // 以前は黙って "free" を返していたが、認証済みユーザーに対して
      // バックエンド 5xx / タイムアウトで "free" 降格に見せるのは致命的 UX バグ。
      // エラーステータスをそのまま透過し、クライアント側 (store のリトライ) で
      // 「一時失敗」として扱えるようにする。
      const body = await res.text().catch(() => "");
      return new NextResponse(body || JSON.stringify({ detail: "subscription-me proxy upstream error" }), {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    // ネットワーク失敗 / timeout: 502 を返してリトライ対象にする
    const msg = err instanceof Error ? err.message : "network error";
    return NextResponse.json(
      { detail: `subscription-me proxy failed: ${msg}` },
      { status: 502 },
    );
  }
}
