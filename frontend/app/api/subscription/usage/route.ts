import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

const FREE_FALLBACK = {
  plan_id: "free",
  ai_used_day: 0,
  ai_used_month: 0,
  ai_limit_day: 3,
  ai_limit_month: 3,
  pdf_used_month: 0,
  pdf_limit_month: 1,
  batch_max_rows: 0,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(FREE_FALLBACK);
  }

  try {
    const res = await fetch(`${BACKEND}/api/subscription/usage`, {
      headers: {
        "x-user-id": session.user.id,
        "x-user-email": session.user.email ?? "",
        "x-user-name": encodeURIComponent(session.user.name ?? ""),
        ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(FREE_FALLBACK);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FREE_FALLBACK);
  }
}
