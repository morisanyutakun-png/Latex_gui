/**
 * 「ログインなし無料お試し生成」プロキシ
 *
 * 役割:
 *   - ブラウザ → Vercel (このルート) → バックエンド `/api/anonymous/generate-pdf`
 *   - 匿名セッション cookie (`eddivom_anon_id`) を発行 / 確認し、
 *     1 つの cookie あたり試行回数を `eddivom_anon_trials` にカウントする。
 *   - サーバ側 (Vercel) で軽くゲートしておくことで、フロントの localStorage を
 *     消されたケースに対するセカンダリブレーキになる。
 *   - 厳密な不正対策ではなく CVR 検証優先 — cookie を消されたら通すで OK。
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const maxDuration = 60;

const BACKEND = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

// 同一 cookie あたりの最大試行回数。フロント側は 1 回に絞っているが、
// 既登録ユーザがログアウトして再試行する正当ケースも吸収するため少し余裕を持たせる。
const MAX_ANON_TRIALS_PER_COOKIE = 3;

const COOKIE_ID = "eddivom_anon_id";
const COOKIE_TRIALS = "eddivom_anon_trials";
// 30 日 (検証期間内に十分な計測ができる長さ + ブラウザ既定で消されにくい)
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function readTrialCount(req: NextRequest): number {
  const raw = req.cookies.get(COOKIE_TRIALS)?.value;
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function ensureAnonId(req: NextRequest): { id: string; isNew: boolean } {
  const existing = req.cookies.get(COOKIE_ID)?.value;
  if (existing && /^[\w-]{8,}$/.test(existing)) {
    return { id: existing, isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

function setCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function POST(req: NextRequest) {
  const { id: anonId, isNew } = ensureAnonId(req);
  const trials = readTrialCount(req);

  if (trials >= MAX_ANON_TRIALS_PER_COOKIE) {
    return NextResponse.json(
      {
        detail: {
          code: "TRIAL_LIMIT_REACHED",
          message: "無料お試しの上限に達しました。続きは無料登録 (30秒) でご利用ください。",
        },
      },
      { status: 429 },
    );
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json(
      { detail: { message: "リクエストの読み込みに失敗しました" } },
      { status: 400 },
    );
  }

  // 匿名セッション ID をバックエンドの rate-limit / 監査ログに渡す
  // (require_user は通らないので x-user-id ヘッダはあえて付けない — 匿名扱いを維持)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-anonymous-id": anonId,
    ...(INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {}),
  };

  // X-Forwarded-For を素直に転送 (バックエンド rate_limit が IP 別で見るため)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers["x-forwarded-for"] = xff;

  // ブラウザ指紋: シークレットウィンドウ越しの再試行を抑止するため、
  // バックエンドの匿名トライアル使用記録 (TTL 7 日) のキーに使う。
  const fp = req.headers.get("x-eddivom-fp");
  if (fp && /^[a-f0-9]{16,64}$/.test(fp)) headers["x-eddivom-fp"] = fp;

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/api/anonymous/generate-pdf`, {
      method: "POST",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(55000),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      {
        detail: {
          code: isTimeout ? "trial_timeout" : "trial_unreachable",
          message: isTimeout
            ? "生成サーバの応答が遅延しています。もう一度お試しください。"
            : "生成サーバに接続できませんでした。",
        },
      },
      { status: 502 },
    );
  }

  if (!backendRes.ok) {
    // エラーは消費としてカウントしない (試行回数を増やさない) — UX 上の親切設計。
    const errBody = await backendRes.text();
    const out = new NextResponse(errBody, {
      status: backendRes.status,
      headers: {
        "Content-Type": backendRes.headers.get("Content-Type") || "application/json",
      },
    });
    if (isNew) setCookie(out, COOKIE_ID, anonId);
    return out;
  }

  const pdfBytes = await backendRes.arrayBuffer();
  const out = new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="eddivom-trial.pdf"',
    },
  });
  // 成功時のみ試行回数を更新
  setCookie(out, COOKIE_ID, anonId);
  setCookie(out, COOKIE_TRIALS, String(trials + 1));
  return out;
}
