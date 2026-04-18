import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Node.js runtime + 長めのタイムアウトで Vercel の 10s デフォルトを越える
// Stripe 往復 (customer retrieve → customer create → session create) を通す。
// Hobby プランだと実効 10s までしか伸びないが、Pro プランでは 60s まで効く。
export const runtime = "nodejs";
export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ detail: "認証が必要です" }, { status: 401 });
  }

  let body: { plan_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "リクエストが不正です" }, { status: 400 });
  }

  // バックエンドが詰まった時に Vercel のデフォルト HTML 502 に落ちないよう、
  // こちらで明示的にタイムアウトを張って JSON エラーで返す。
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const url = `${BACKEND}/api/subscription/checkout`;
    console.log("[checkout] POST →", url, "user:", session.user.id);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": session.user.id,
        "x-user-email": session.user.email ?? "",
        "x-user-name": encodeURIComponent(session.user.name ?? ""),
        ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    console.log("[checkout] backend responded:", res.status, text.slice(0, 200));
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // バックエンドが JSON ではなくプレーンテキスト (例: Starlette の "Internal Server Error")
      // やエッジゲートウェイの HTML 502 ページを返した場合の整形。HTML はタグを剥がして詰める。
      const stripped = (text || "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);
      const fallback = stripped || res.statusText || `HTTP ${res.status}`;
      data = { detail: `バックエンド ${res.status}: ${fallback}` };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[checkout] fetch error:", msg);
    if ((e as { name?: string })?.name === "AbortError") {
      return NextResponse.json(
        { detail: "バックエンドへの接続がタイムアウトしました。時間を置いて再度お試しください。" },
        { status: 504 },
      );
    }
    return NextResponse.json({ detail: `バックエンド接続エラー: ${msg}` }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
