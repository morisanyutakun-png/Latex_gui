/**
 * PDF生成プロキシ — ブラウザ → Vercel (同一オリジン) → Koyeb バックエンド
 *
 * CORS 問題を回避し、バックエンド URL をサーバー側だけで管理する。
 * Vercel 環境変数: API_URL (NEXT_PUBLIC_ 不要)
 *
 * v4: リトライ対応 + タイムアウト整合性改善
 */
import { NextRequest, NextResponse } from "next/server";

// Vercel Serverless Function の実行時間上限 (秒)
// Hobby: max 60s, Pro: max 300s
export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// バックエンドの TOTAL_TIME_BUDGET=45s + ネットワーク遅延に余裕を持たせる
const BACKEND_TIMEOUT_MS = 52000;

async function callBackend(body: string): Promise<Response> {
  return fetch(`${BACKEND}/api/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  console.log(`[proxy] generate-pdf → ${BACKEND}/api/generate-pdf`);

  try {
    const body = await req.text();

    let res: Response;
    try {
      res = await callBackend(body);
    } catch (firstErr) {
      // 初回失敗時: コールドスタートの可能性があるためリトライ
      const elapsed1 = Date.now() - t0;
      const isTimeout = firstErr instanceof Error && (firstErr.name === "TimeoutError" || firstErr.name === "AbortError");
      const isNetwork = firstErr instanceof Error && firstErr.message?.includes("fetch");

      if ((isTimeout || isNetwork) && elapsed1 < 52000) {
        console.log(`[proxy] First attempt failed (${elapsed1}ms), retrying once...`);
        // 残り時間で再試行 (Vercelの60秒上限を考慮)
        const retryTimeout = Math.min(BACKEND_TIMEOUT_MS, Math.max((57000 - elapsed1), 8000));
        try {
          res = await fetch(`${BACKEND}/api/generate-pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(retryTimeout),
          });
        } catch (retryErr) {
          throw retryErr; // リトライも失敗
        }
      } else {
        throw firstErr;
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[proxy] generate-pdf response: ${res.status} (${elapsed}ms)`);

    if (!res.ok) {
      const errBody = await res.text();
      return new NextResponse(errBody, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
      });
    }

    const pdfBytes = await res.arrayBuffer();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("Content-Disposition") || 'attachment; filename="document.pdf"',
      },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] generate-pdf FAILED after ${elapsed}ms:`, err);

    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const message = isTimeout
      ? `PDF生成がタイムアウトしました (${Math.round(elapsed / 1000)}秒)。バックエンドがまだ起動中の可能性があります。数秒待ってから再度お試しください。`
      : `バックエンドサーバーに接続できません (${BACKEND})。サーバーが起動しているか確認してください。`;
    return NextResponse.json(
      { detail: { message } },
      { status: 502 },
    );
  }
}
