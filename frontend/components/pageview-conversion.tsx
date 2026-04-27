"use client";

/**
 * Google Ads ページビュー conversion を全ルートで発火するクライアントコンポーネント。
 *
 * - layout.tsx に常駐させる (App Router の CSR ナビゲーションでも毎回フックする)
 * - usePathname + useSearchParams を購読しているので、router.push の度に再発火する
 * - 同一 URL の連続発火は lib/gtag.ts 側で in-memory dedupe される
 *
 * Ads 管理画面で配布された <script>gtag('event','conversion',{send_to:'AW-.../...'})</script>
 * スニペットを Next.js でも検出可能にする目的。
 */
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendPageviewConversion } from "@/lib/gtag";

export function PageviewConversion() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 検索パラメータも含めた完全 URL を識別子にする (SPA でも CTA → /editor?guest=1 と
    // /editor?guest=1&plan=free を別 URL として両方計測したいケースに対応)。
    const search = searchParams?.toString() ?? "";
    const url = pathname + (search ? `?${search}` : "");
    sendPageviewConversion(url);
  }, [pathname, searchParams]);

  return null;
}
