"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePlanStore } from "@/store/plan-store";

/**
 * セッション状態が確定したタイミングでサブスクリプション情報を取得する。
 * パフォーマンス: requestIdleCallback で deferring することで、初回 LCP / TBT を圧迫しない。
 * 一部のユーザはサブスク情報が必要になる前に LP を離脱するため、即時取得しなくて良い。
 */
export function SubscriptionInitializer() {
  const { status } = useSession();
  const fetchSubscription = usePlanStore((s) => s.fetchSubscription);
  const initFromStorage = usePlanStore((s) => s.initFromStorage);

  useEffect(() => {
    if (status === "loading") return;
    const run = () => {
      if (status === "authenticated") fetchSubscription();
      else if (status === "unauthenticated") initFromStorage();
    };
    // メインスレッドが落ち着いてから実行 (TBT 抑制)
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    // Safari fallback: setTimeout で 600ms 後に発火 (LCP/TBT 計測ウィンドウを越える)
    const t = setTimeout(run, 600);
    return () => clearTimeout(t);
  }, [status, fetchSubscription, initFromStorage]);

  return null;
}
