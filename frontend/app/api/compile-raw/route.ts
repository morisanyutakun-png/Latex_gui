/**
 * /api/compile-raw — raw LaTeX 文字列を受け取って PDF Blob を返すプロキシ
 *
 * フロントエンドの VisualEditor / LatexCodeEditor / PdfPreviewPanel で
 * 「いま編集中の生 LaTeX をその場でコンパイルしてプレビュー」するために使う。
 * generate-pdf と同じく Vercel → バックエンド (FastAPI) を中継する。
 */
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";

// Vercel Hobby は最大 60 秒
export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

const BACKEND_TIMEOUT_MS = 55000;

function authHeaders(session: Session | null): Record<string, string> {
  if (!session?.user?.id) return {};
  return {
    "x-user-id": session.user.id,
    "x-user-email": session.user.email ?? "",
    "x-user-name": encodeURIComponent(session.user.name ?? ""),
    ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
  };
}

async function callBackend(body: string, extra: Record<string, string>): Promise<Response> {
  return fetch(`${BACKEND}/api/compile-raw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extra },
    body,
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        detail: {
          code: "UNAUTHORIZED",
          message: "プレビュー生成にはログインが必要です。サインインしてからもう一度お試しください。",
        },
      },
      { status: 401 },
    );
  }
  const headers = authHeaders(session);

  try {
    const body = await req.text();

    let res: Response;
    try {
      res = await callBackend(body, headers);
    } catch (firstErr) {
      // 初回失敗時: コールドスタート想定で 1 回だけリトライ
      const elapsed1 = Date.now() - t0;
      const isTimeout = firstErr instanceof Error && (firstErr.name === "TimeoutError" || firstErr.name === "AbortError");
      const isNetwork = firstErr instanceof Error && firstErr.message?.includes("fetch");

      if ((isTimeout || isNetwork) && elapsed1 < 55000) {
        const retryTimeout = Math.min(BACKEND_TIMEOUT_MS, Math.max(57000 - elapsed1, 8000));
        res = await fetch(`${BACKEND}/api/compile-raw`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body,
          signal: AbortSignal.timeout(retryTimeout),
        });
      } else {
        throw firstErr;
      }
    }

    if (!res.ok) {
      const errBody = await res.text();
      return new NextResponse(errBody, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
      });
    }

    const pdfBytes = await res.arrayBuffer();
    // ★ 重要: バックエンドは `attachment; filename=...` を返すが、これをそのまま
    // 転送するとブラウザが「ダウンロード専用」として blob を扱い、iframe で inline
    // 表示できない (Safari / Chrome 双方で発現)。プレビュー用途では必ず inline
    // に上書きする。ダウンロード自体は PdfPreviewPanel の "PDF" リンクに任せる。
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="preview.pdf"',
        // Safari が iframe 内 PDF を表示するとき X-Frame-Options がホスト側から
        // 干渉しないよう SAMEORIGIN を明示 (next.config は DENY だがここは上書き)。
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const message = isTimeout
      ? `プレビュー生成がタイムアウトしました (${Math.round(elapsed / 1000)}秒)`
      : `バックエンドサーバーに接続できません (${BACKEND})`;
    return NextResponse.json({ detail: { message } }, { status: 502 });
  }
}
