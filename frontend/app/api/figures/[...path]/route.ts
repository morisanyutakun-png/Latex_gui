/**
 * /api/figures/* — 図アセットライブラリへの薄いプロキシ
 *
 * バックエンド (FastAPI) の /api/figures/{id}, /api/figures, /api/figures/{id}/preview.png
 * をそのまま中継する。Visual Editor が <img src="/api/figures/.../preview.png"> で
 * プレビュー PNG を表示するときのエントリポイント。
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 60;

const BACKEND =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

async function proxy(req: NextRequest, path: string[], requireAuth: boolean): Promise<Response> {
  const suffix = path.map((p) => encodeURIComponent(p)).join("/");
  const qs = req.nextUrl.search || "";
  const url = `${BACKEND}/api/figures/${suffix}${qs}`;
  const hdrs: Record<string, string> = {
    Accept: req.headers.get("accept") || "*/*",
  };
  if (requireAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { detail: { code: "UNAUTHORIZED", message: "ログインが必要です。" } },
        { status: 401 },
      );
    }
    hdrs["x-user-id"] = session.user.id;
    hdrs["x-user-email"] = session.user.email ?? "";
    hdrs["x-user-name"] = encodeURIComponent(session.user.name ?? "");
    if (INTERNAL_SECRET) hdrs["x-internal-secret"] = INTERNAL_SECRET;
  }
  const init: RequestInit = {
    method: req.method,
    headers: hdrs,
    signal: AbortSignal.timeout(55000),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const ct = req.headers.get("content-type");
    if (ct) hdrs["content-type"] = ct;
    init.body = await req.text();
  }
  const upstream = await fetch(url, init);
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cc = upstream.headers.get("cache-control");
  if (cc) headers.set("cache-control", cc);
  return new NextResponse(body, {
    status: upstream.status,
    headers,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    // 図書館のメタデータと PNG は匿名でも閲覧可 (公開リファレンスとして利用)
    return await proxy(req, path ?? [], false);
  } catch (err) {
    return NextResponse.json(
      { error: "figures proxy failed", detail: String(err) },
      { status: 502 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    // POST は /api/figures/snippet/compile 等の LuaLaTeX コンパイルを伴うため
    // 認証必須 (匿名からの資源消費を防ぐ)。
    return await proxy(req, path ?? [], true);
  } catch (err) {
    return NextResponse.json(
      { error: "figures proxy failed", detail: String(err) },
      { status: 502 },
    );
  }
}
