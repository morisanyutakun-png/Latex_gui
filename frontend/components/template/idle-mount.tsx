"use client";

/**
 * IdleMount — initial paint には placeholder を出し、children のマウントを
 * 「アイドルかつビューポート近接」まで遅らせる。
 *
 * 効能:
 *   - SSR HTML payload が縮む (children の JSX が出力されない)
 *   - 初期 hydration で重い JSX を即時評価しないので TBT が大幅に下がる
 *   - 画面外にあるうちは EditorMockup の setInterval すら走らないので、
 *     ヒーロー読み込み中のメインスレッドが空く (LCP / TBT 改善)
 *   - placeholder は同サイズの空 div なので CLS を発生させない
 *
 * ヒーロー直下の EditorMockup / FigureDrawMockup のような巨大 JSX を包む用途。
 * SEO 的には文字情報を含まない装飾なので非表示でも影響なし。
 */
import React, { useEffect, useRef, useState } from "react";

export function IdleMount({
  children,
  minHeight = "0",
  idleTimeoutMs = 600,
  rootMargin = "200px",
}: {
  children: React.ReactNode;
  minHeight?: string;
  idleTimeoutMs?: number;
  /** IntersectionObserver の rootMargin。これより画面外にあるうちはマウントしない。
   *  デフォルト 200px は「次に来る 1 セクション程度」までは事前準備しておく値。 */
  rootMargin?: string;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (show) return;
    const el = ref.current;
    // IntersectionObserver があるブラウザ (= 主要ブラウザ全般) はビューポート接近で起こす。
    // ない環境のフォールバックは旧来の idle / timeout 動作に戻して挙動互換を保つ。
    if (el && typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setShow(true);
              obs.disconnect();
              break;
            }
          }
        },
        { rootMargin },
      );
      obs.observe(el);
      return () => obs.disconnect();
    }
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    };
    const w = window as IdleWindow;
    const idle = w.requestIdleCallback;
    if (typeof idle === "function") {
      idle(() => setShow(true), { timeout: 1500 });
    } else {
      const t = window.setTimeout(() => setShow(true), idleTimeoutMs);
      return () => window.clearTimeout(t);
    }
  }, [idleTimeoutMs, rootMargin, show]);

  if (!show) {
    return <div ref={ref} style={{ minHeight }} aria-hidden />;
  }
  return <>{children}</>;
}
