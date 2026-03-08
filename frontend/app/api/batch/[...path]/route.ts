/**
 * バッチ生成プロキシ (教材工場)
 * ブラウザ → Vercel Route Handler → バックエンド
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // バッチ処理は長時間かかる可能性

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const path = req.nextUrl.pathname.replace("/api/batch/", "");
  const backendUrl = `${BACKEND}/api/batch/${path}`;
  console.log(`[proxy] batch/${path} → ${backendUrl}`);

  try {
    const body = await req.text();
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(280000), // 4分40秒
    });

    const elapsed = Date.now() - t0;
    console.log(`[proxy] batch/${path} response: ${res.status} (${elapsed}ms)`);

    if (!res.ok) {
      const errBody = await res.text();
      return new NextResponse(errBody, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
      });
    }

    const contentType = res.headers.get("Content-Type") || "application/json";

    if (contentType.includes("application/zip")) {
      const zipBytes = await res.arrayBuffer();
      return new NextResponse(zipBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": res.headers.get("Content-Disposition") || 'attachment; filename="batch_output.zip"',
          "X-Batch-Total": res.headers.get("X-Batch-Total") || "",
          "X-Batch-Success": res.headers.get("X-Batch-Success") || "",
          "X-Batch-Errors": res.headers.get("X-Batch-Errors") || "",
          "X-Batch-Time-Ms": res.headers.get("X-Batch-Time-Ms") || "",
        },
      });
    }

    const jsonBody = await res.text();
    return new NextResponse(jsonBody, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] batch/${path} FAILED after ${elapsed}ms:`, err);
    return NextResponse.json(
      { detail: { message: `バッチ処理に失敗しました (${Math.round(elapsed / 1000)}秒)` } },
      { status: 502 },
    );
  }
}
