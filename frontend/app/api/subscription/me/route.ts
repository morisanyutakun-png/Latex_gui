import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ plan_id: "free", status: "free" });
  }

  try {
    const res = await fetch(`${BACKEND}/api/subscription/me`, {
      headers: {
        "x-user-id": session.user.id,
        "x-user-email": session.user.email ?? "",
        "x-user-name": session.user.name ?? "",
        ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
      },
      // サブスク状態は毎回最新を取得する
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ plan_id: "free", status: "free" });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ plan_id: "free", status: "free" });
  }
}
