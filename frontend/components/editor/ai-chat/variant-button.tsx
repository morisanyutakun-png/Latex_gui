"use client";

/**
 * VariantMenu — Claude / ChatGPT 風の「Regenerate with options」UI。
 *
 * 既存 UI 思想:
 *   - 1 ボタン (デフォルト = "同じ難易度") でワンタップ実行
 *   - 横の chevron をタップすると、5 つのスタイル (同じ / 難しく / 易しく / 別形式 / 量増)
 *     が並ぶポップオーバーが開く
 *   - キーボード操作可 (↑↓ で移動、Enter で実行、Esc で閉じる)
 *   - ロック時は menu 全体は同じだが「Pro で続けて生成」表示 → 開けない
 *   - Free 未消費は "お試し" バッジで「今ならタダで試せる」を強調
 *
 * Claude / ChatGPT の "regenerate" → 軽量ポップオーバー、選択肢に短い説明、を踏襲。
 */

import React from "react";
import {
  Sparkles, Lock, Loader2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Shuffle, Plus, Crown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { VARIANT_STYLES, type VariantStyle } from "@/lib/rem-prompts";

interface Props {
  onTrigger: (style: VariantStyle) => void;
  onLockedClick: () => void;
  locked: boolean;
  busy?: boolean;
  showProBadge?: boolean;
  className?: string;
  size?: "sm" | "md";
}

const ICONS = {
  Sparkles, TrendingUp, TrendingDown, Shuffle, Plus,
} as const;

const STYLE_ORDER: VariantStyle[] = ["same", "harder", "easier", "format", "more"];

export function VariantButton({
  onTrigger, onLockedClick, locked, busy, showProBadge, className, size = "sm",
}: Props) {
  const { locale } = useI18n();
  const isJa = !(locale || "ja").toLowerCase().startsWith("en");

  const [open, setOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // 外側クリック / Escape で閉じる
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % STYLE_ORDER.length); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => (i - 1 + STYLE_ORDER.length) % STYLE_ORDER.length); }
      if (e.key === "Enter")     { e.preventDefault(); handlePick(STYLE_ORDER[activeIdx]); }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIdx]);

  const handlePick = (style: VariantStyle) => {
    setOpen(false);
    if (locked) { onLockedClick(); return; }
    onTrigger(style);
  };

  // ── サイズ ──
  const sizing = size === "md" ? "h-8 text-[12.5px]" : "h-7 text-[11.5px]";

  // ── ロック表示 ──
  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        title={isJa ? "Pro プランで類題自動生成が無制限に使えます" : "Unlimited variant generation on Pro"}
        className={`group inline-flex items-center gap-1 ${sizing} px-2.5 rounded-full border border-violet-500/30 bg-violet-500/[0.04] text-violet-700 dark:text-violet-300 font-semibold hover:bg-violet-500/[0.1] active:scale-[0.97] transition ${className ?? ""}`}
      >
        <Lock className="h-3 w-3" />
        <Sparkles className="h-3 w-3" />
        <span>{isJa ? "Pro で続けて生成" : "Pro to continue"}</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className={`relative inline-flex items-stretch ${className ?? ""}`}>
      {/* ── メイン (default = same) ── */}
      <button
        type="button"
        onClick={() => handlePick("same")}
        disabled={busy}
        title={isJa ? VARIANT_STYLES.same.jaDesc : VARIANT_STYLES.same.enDesc}
        className={`group inline-flex items-center gap-1 ${sizing} pl-2.5 pr-2 rounded-l-full border border-r-0 border-violet-500/35 bg-gradient-to-r from-violet-500/[0.08] to-fuchsia-500/[0.06] text-foreground/85 font-semibold hover:border-violet-500/55 hover:from-violet-500/[0.12] hover:to-fuchsia-500/[0.1] active:scale-[0.97] transition disabled:opacity-50 disabled:cursor-wait`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
        ) : (
          <Sparkles className="h-3 w-3 text-violet-500 group-hover:scale-110 transition-transform" />
        )}
        <span>{isJa ? "類題をもう1枚" : "One more variant"}</span>
        {showProBadge && (
          <span
            className="ml-0.5 inline-flex items-center px-1 py-[1px] rounded-sm text-[8.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500"
            title={isJa ? "Pro 機能を 1 回お試しできます" : "1 free trial of this Pro feature"}
          >
            {isJa ? "お試し" : "TRY"}
          </span>
        )}
      </button>

      {/* ── chevron (open menu) ── */}
      <button
        type="button"
        onClick={() => { setActiveIdx(0); setOpen((v) => !v); }}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isJa ? "類題のオプションを開く" : "Open variant options"}
        title={isJa ? "難易度・形式を選んで生成" : "Pick difficulty / format"}
        className={`inline-flex items-center justify-center ${sizing} px-1.5 rounded-r-full border border-violet-500/35 bg-gradient-to-r from-violet-500/[0.08] to-fuchsia-500/[0.06] text-violet-600 hover:border-violet-500/55 hover:bg-violet-500/[0.12] active:scale-[0.97] transition disabled:opacity-50`}
      >
        {open
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        }
      </button>

      {/* ── メニュー本体 ── */}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute left-0 top-full mt-1.5 z-30 w-[280px] sm:w-[320px] rounded-xl bg-popover border border-foreground/[0.1] shadow-2xl shadow-black/15 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 pt-2.5 pb-1 border-b border-foreground/[0.06] flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-violet-500" />
            <span className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-violet-700 dark:text-violet-300">
              {isJa ? "REM 類題スタイル" : "Variant style"}
            </span>
            {showProBadge && (
              <span className="ml-auto inline-flex items-center px-1 py-[1px] rounded-sm text-[8.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500">
                {isJa ? "お試し中" : "TRIAL"}
              </span>
            )}
          </div>
          <ul className="py-1">
            {STYLE_ORDER.map((style, idx) => {
              const spec = VARIANT_STYLES[style];
              const Icon = ICONS[spec.iconKey];
              const isActive = idx === activeIdx;
              return (
                <li key={style} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => handlePick(style)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition ${
                      isActive ? "bg-violet-500/[0.07]" : "hover:bg-foreground/[0.04]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-6 w-6 shrink-0 rounded-md flex items-center justify-center ${
                        style === "harder"
                          ? "bg-rose-500/12 text-rose-600"
                          : style === "easier"
                          ? "bg-emerald-500/12 text-emerald-600"
                          : style === "format"
                          ? "bg-amber-500/12 text-amber-600"
                          : style === "more"
                          ? "bg-blue-500/12 text-blue-600"
                          : "bg-violet-500/12 text-violet-600"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-foreground/90 leading-tight">
                          {isJa ? spec.jaTitle : spec.enTitle}
                        </span>
                        {style === "same" && (
                          <span className="text-[9px] tracking-wider font-bold uppercase text-violet-500/70 px-1 rounded border border-violet-500/30">
                            {isJa ? "標準" : "DEFAULT"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">
                        {isJa ? spec.jaDesc : spec.enDesc}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-1.5 border-t border-foreground/[0.06] bg-foreground/[0.02] text-[9.5px] text-muted-foreground/70">
            {isJa ? "↑↓ 選択 ・ Enter 実行 ・ Esc 閉じる" : "↑↓ navigate · Enter run · Esc close"}
          </div>
        </div>
      )}
    </div>
  );
}
