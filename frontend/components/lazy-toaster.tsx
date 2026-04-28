"use client";

/**
 * LazyToaster — sonner の Toaster を遅延マウントするためのラッパ。
 *
 * sonner は最低でも 30+ KiB あり、しかも Toaster 自体が常時 DOM にいるので
 * 初期 hydration コストに加わる。Toast が出るのはユーザ操作後 (login 失敗、
 * Stripe エラーなど) のみなので、初回 paint の後 (idle) までマウントを
 * 遅らせて LP の LCP/TBT に乗らないようにする。
 *
 * 重要: `useEffect` 内で `import("sonner")` を動的に読むので、Toaster の
 * JS bundle は別 chunk になり初期ロードに含まれない。
 */
import React, { useEffect, useState } from "react";

export function LazyToaster() {
  const [Toaster, setToaster] = useState<React.ComponentType<{ richColors?: boolean; position?: "bottom-center" }> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    };
    const w = window as IdleWindow;
    const load = () => {
      void import("sonner").then((m) => setToaster(() => m.Toaster));
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(load, { timeout: 2000 });
    } else {
      window.setTimeout(load, 1500);
    }
  }, []);

  if (!Toaster) return null;
  return <Toaster richColors position="bottom-center" />;
}
