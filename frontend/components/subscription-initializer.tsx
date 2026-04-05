"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePlanStore } from "@/store/plan-store";

/**
 * セッション状態が確定したタイミングでサブスクリプション情報を取得する。
 * - authenticated: バックエンドからサブスク状態を取得
 * - unauthenticated: LocalStorageからゲスト状態を初期化
 * このコンポーネント自体は何もレンダリングしない。
 */
export function SubscriptionInitializer() {
  const { status } = useSession();
  const fetchSubscription = usePlanStore((s) => s.fetchSubscription);
  const initFromStorage = usePlanStore((s) => s.initFromStorage);

  useEffect(() => {
    if (status === "authenticated") {
      fetchSubscription();
    } else if (status === "unauthenticated") {
      initFromStorage();
    }
  }, [status, fetchSubscription, initFromStorage]);

  return null;
}
