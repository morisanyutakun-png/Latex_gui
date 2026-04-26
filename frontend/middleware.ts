import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware — UA ベースで `/` を `/m`(モバイル) または `/` のまま(デスクトップ) に振り分ける。
 *
 * 目的:
 *  - `app/page.tsx` で `headers()` を使うと route が "dynamic" になり CDN キャッシュが効かない。
 *  - 代わりに middleware で URL を rewrite すれば、`/` と `/m` はそれぞれ静的(prerender)化でき、
 *    Vercel/Edge CDN がキャッシュ → TTFB を 1s → ~150-300ms に短縮できる。
 *  - rewrite なので URL バーは `/` のまま、bookmark / SEO / canonical も維持。
 */

function isMobileUA(ua: string): boolean {
  if (!ua) return false;
  // iPad は最近の iOS で Mac UA を返すので除外。Mobi/Android Mobile/iPhone のみ拾う。
  return /Mobi|Android.*Mobile|iPhone/i.test(ua);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // ルート(LP) のみが対象。/editor などには触らない。
  if (pathname !== "/") return NextResponse.next();

  const ua = req.headers.get("user-agent") ?? "";
  if (isMobileUA(ua)) {
    const url = req.nextUrl.clone();
    url.pathname = "/m";
    url.search = search;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
