import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ detail: "認証が必要です" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/subscription/portal`, {
      method: "POST",
      headers: {
        "x-user-id": session.user.id,
        "x-user-email": session.user.email ?? "",
        "x-user-name": encodeURIComponent(session.user.name ?? ""),
        ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Stripe接続に失敗しました" }, { status: 502 });
  }
}
