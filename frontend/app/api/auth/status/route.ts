import { NextResponse } from "next/server";

export async function GET() {
  const isConfigured = !!(
    process.env.AUTH_SECRET &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );

  return NextResponse.json({ configured: isConfigured });
}
