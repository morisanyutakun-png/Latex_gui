import { NextResponse } from "next/server";

// NextAuth handlers — only active when AUTH_SECRET + Google credentials are set
let GET: (req: Request) => Promise<Response>;
let POST: (req: Request) => Promise<Response>;

const isConfigured = !!(
  process.env.AUTH_SECRET &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
);

if (isConfigured) {
  const { handlers } = require("@/auth");
  GET = handlers.GET;
  POST = handlers.POST;
} else {
  // Return a helpful error instead of crashing
  const notConfigured = async () =>
    NextResponse.json(
      { error: "認証が設定されていません。AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET を環境変数に設定してください。" },
      { status: 503 }
    );
  GET = notConfigured;
  POST = notConfigured;
}

export { GET, POST };
