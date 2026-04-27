"use client";

/**
 * IdleMount — initial paint には placeholder を出し、ブラウザがアイドルになった
 * タイミング (or `idleTimeoutMs` 後) に重い children をマウントする。
 *
 * 効能:
 *   - SSR HTML payload が縮む (children の JSX が出力されない)
 *   - 初期 hydration で重い JSX を即時評価しないので TBT が大幅に下がる
 *   - placeholder は同サイズの空 div なので CLS を発生させない
 *
 * ヒーロー直下の EditorMockup / FigureDrawMockup のような巨大 JSX を包む用途。
 * SEO 的には文字情報を含まない装飾なので非表示でも影響なし。
 */
import React, { useEffect, useState } from "react";

export function IdleMount({
  children,
  minHeight = "0",
  idleTimeoutMs = 600,
}: {
  children: React.ReactNode;
  minHeight?: string;
  idleTimeoutMs?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [idleTimeoutMs]);
  if (!show) {
    return <div style={{ minHeight }} aria-hidden />;
  }
  return <>{children}</>;
}
