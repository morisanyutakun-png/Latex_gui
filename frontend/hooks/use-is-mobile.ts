"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768; // Tailwind md

/**
 * モバイル幅判定。
 *
 * `initial` を渡すと SSR / 初期レンダー時の値を上書きできる。サーバ側で User-Agent を
 * 見て決めた結果を hydration に渡すことで、PC レイアウト → モバイルレイアウトへの
 * 「ポストハイドレーション swap」を回避できる (= LCP の render delay を 2 秒以上短縮)。
 *
 * 互換: 引数なし呼び出しは従来通り false で開始 → useEffect で実値に同期。
 */
export function useIsMobile(initial = false): boolean {
  const [isMobile, setIsMobile] = useState(initial);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
