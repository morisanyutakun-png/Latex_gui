import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ paid: false }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id") || "";
  if (!sessionId) {
    return NextResponse.json({ paid: false, error: "missing session_id" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND}/api/subscription/verify-checkout?session_id=${encodeURIComponent(sessionId)}`,
      {
        headers: {
          "x-user-id": session.user.id,
          "x-user-email": session.user.email ?? "",
          "x-user-name": encodeURIComponent(session.user.name ?? ""),
          ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
        },
        cache: "no-store",
      },
    );

    const data = await res.json().catch(() => ({ paid: false }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ paid: false }, { status: 502 });
  }
}
