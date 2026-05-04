"use client";

/**
 * 「✨ 類題をもう1枚」ボタン — assistant メッセージ末尾に小さく出す。
 *
 * 仕様:
 *   - Pro+ ユーザは常時 active
 *   - Free ユーザは未消費なら 1 回だけ active、消費後は locked
 *   - locked 状態は <Lock /> アイコン付きで表示し、クリックで signup overlay を開く
 *     (既存 OCR/採点ボタンと同じ視覚言語)
 *
 * このボタン自身は「prompt 加工 + handleSend」を行わない。親コンポーネント
 * (ai-chat/index.tsx) が `onTrigger` を実装する。
 */

import React from "react";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Props {
  onTrigger: () => void;
  onLockedClick: () => void;
  locked: boolean;
  busy?: boolean;
  /** `true` の場合: ロックアイコンを目立たせて Pro 案内を強調 (Free 使用済み)。
   *  `false` の場合: 通常の active 表示 (Pro+ または Free 未使用)。 */
  showProBadge?: boolean;
  /** 親が UI 上「assistant message 直下」と「フローティング」で位置を切り替えたい時用の class。 */
  className?: string;
  size?: "sm" | "md";
}

export function VariantButton({
  onTrigger, onLockedClick, locked, busy, showProBadge, className, size = "sm",
}: Props) {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  const label = isJa ? "類題をもう1枚" : "One more variant";
  const lockedLabel = isJa ? "Pro で続けて生成" : "Pro to keep generating";
  const sizing =
    size === "md"
      ? "h-8 px-3 text-[12.5px]"
      : "h-7 px-2.5 text-[11.5px]";

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        title={isJa ? "Pro プラン以上で類題自動生成が無制限に使えます" : "Unlimited variant generation on Pro and above"}
        className={`group inline-flex items-center gap-1 ${sizing} rounded-full border border-violet-500/30 bg-violet-500/[0.04] text-violet-700 dark:text-violet-300 font-semibold hover:bg-violet-500/[0.1] active:scale-[0.97] transition ${className ?? ""}`}
      >
        <Lock className="h-3 w-3" />
        <Sparkles className="h-3 w-3" />
        <span>{lockedLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onTrigger}
      disabled={busy}
      className={`group inline-flex items-center gap-1 ${sizing} rounded-full border border-violet-500/35 bg-gradient-to-r from-violet-500/[0.08] to-fuchsia-500/[0.06] text-foreground/85 font-semibold hover:border-violet-500/55 hover:from-violet-500/[0.12] hover:to-fuchsia-500/[0.1] active:scale-[0.97] transition disabled:opacity-50 disabled:cursor-wait ${className ?? ""}`}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
      ) : (
        <Sparkles className="h-3 w-3 text-violet-500 group-hover:scale-110 transition-transform" />
      )}
      <span>{label}</span>
      {showProBadge && (
        <span className="ml-0.5 inline-flex items-center px-1 py-[1px] rounded-sm text-[8.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500">
          {isJa ? "お試し" : "TRY"}
        </span>
      )}
    </button>
  );
}
