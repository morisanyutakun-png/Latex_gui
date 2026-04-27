"use client";

/**
 * GuestSignupOverlay の遅延マウンタ。
 *
 * GuestSignupOverlay 本体 (`./guest-signup-overlay`) は Stripe checkout 連携 + プラン定義 +
 * gtag 計測 + 多数の lucide アイコンを持つ重い client コンポーネント。LP の LCP/FCP を悪化
 * させないため、`signupOverlay.open` が true になった「実際にユーザがゲスト登録 CTA を
 * 押した瞬間」まで JS バンドルから完全に切り離す。
 *
 * 仕組み:
 *   1. ui-store の signupOverlay.open を購読 (この hook 自体は軽量)
 *   2. open になった初回だけ dynamic import で実体を読み込む
 *   3. 実体がロード済みなら以降は普通にレンダーする
 */
import React from "react";
import dynamic from "next/dynamic";
import { useUIStore } from "@/store/ui-store";

// ssr:false: overlay は完全にユーザ操作起点。SSR HTML に含めない方が初期 HTML が軽い。
// loading: () => null: ロード中の placeholder も出さない (overlay なので一瞬遅れて出ても
// UX に違和感は無い + Layout shift も起きない)。
const GuestSignupOverlay = dynamic(
  () => import("./guest-signup-overlay").then((m) => m.GuestSignupOverlay),
  { ssr: false, loading: () => null },
);

export function GuestSignupOverlayMount() {
  const open = useUIStore((s) => s.signupOverlay.open);
  // 一度でも開かれたら以降は常にマウントしておく (再オープン時に再ロードしないため)
  const everOpenedRef = React.useRef(false);
  if (open) everOpenedRef.current = true;

  if (!everOpenedRef.current) return null;
  return <GuestSignupOverlay />;
}
