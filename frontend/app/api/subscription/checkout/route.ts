import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

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
    });

    const text = await res.text();
    console.log("[checkout] backend responded:", res.status, text);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // バックエンドが JSON ではなくプレーンテキスト (例: Starlette の "Internal Server Error") を
      // 返した場合は、原因不明にならないよう HTTP ステータスと本文をそのまま detail に詰める
      const trimmed = (text || "").trim().slice(0, 500) || res.statusText || `HTTP ${res.status}`;
      data = { detail: `バックエンド ${res.status}: ${trimmed}` };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[checkout] fetch error:", msg);
    return NextResponse.json({ detail: `バックエンド接続エラー: ${msg}` }, { status: 502 });
  }
}
