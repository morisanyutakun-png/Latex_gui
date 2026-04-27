"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePlanStore } from "@/store/plan-store";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";

/**
 * セッション状態が確定したタイミングでサブスクリプション情報を取得する。
 * - authenticated:   バックエンドからサブスク状態を取得
 * - unauthenticated: ストアをリセット (前回ログイン状態のキャッシュをクリア)
 *
 * ログアウト時は plan-store と doc-store / chat localStorage をクリーンに戻す。
 * これがないと:
 *   - currentPlan が "pro" のまま残って LP に「続きから編集」CTA が出る
 *   - 前ユーザのドキュメント (localStorage) が新規アクセス時に復元されて
 *     「無料で1枚作ってみる」フローに入れない
 *
 * このコンポーネント自体は何もレンダリングしない。
 */
export function SubscriptionInitializer() {
  const { status } = useSession();
  const fetchSubscription = usePlanStore((s) => s.fetchSubscription);
  const initFromStorage = usePlanStore((s) => s.initFromStorage);
  const resetForLogout = usePlanStore((s) => s.resetForLogout);
  // 直前のセッションステータス。authenticated → unauthenticated の遷移
  // (= 明示的ログアウト) を検出するために必要。
  const prevStatusRef = useRef<typeof status | null>(null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "authenticated") {
      fetchSubscription();
      return;
    }

    if (status === "unauthenticated") {
      // 明示的ログアウト (authenticated → unauthenticated): プラン状態と保存ドキュメント、
      // チャット履歴を全部消して「ゲストとして来た新規ユーザー」と同じ状態に揃える。
      if (prev === "authenticated") {
        resetForLogout();
        useDocumentStore.getState().clearDocument();
        useUIStore.getState().clearChat();
        useUIStore.getState().setGuest(false);
        useUIStore.getState().setGuestTrialUsed(false);
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("latex-gui-document");
            localStorage.removeItem("latex-gui-document-ts");
            localStorage.removeItem("latex-gui-document-tab");
            localStorage.removeItem("latex-gui-chat-v3");
          } catch { /* ignore */ }
        }
        return;
      }
      // 初回未認証アクセス (新規 / リロード) は従来どおり既定値の初期化のみ。
      initFromStorage();
    }
  }, [status, fetchSubscription, initFromStorage, resetForLogout]);

  return null;
}
