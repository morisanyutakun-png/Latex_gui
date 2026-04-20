"use client";

import React, { useState } from "react";
import { ClipboardList, Wand2, Layers } from "lucide-react";
import type { AgentMode } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/**
 * Claude Code 風のタブ型モード切替。
 * アクティブタブは下線 (animated) + モード固有のアクセントカラーで発色。
 * - plan: sky (#0ea5e9)
 * - edit: amber (#f59e0b)   — ブランドカラー
 * - mix:  violet (#8b5cf6)
 */

interface ModeDef {
  id: AgentMode;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  labelJa: string;
  labelEn: string;
  descJa: string;
  descEn: string;
  // CSS color tokens (see MODE_ACCENTS below for the shared palette)
  accent: string;
  accentSoft: string;
  accentGlow: string;
}

/**
 * モード固有のアクセント色パレット。タブ UI と InputArea の focus/送信ボタンで共有する。
 * `ring` は focus 時の濃いリング、`ringSoft` はその外側の薄いハロー、
 * `btnFrom` / `btnTo` は送信ボタンのグラデ両端、`btnShadow` は送信ボタンの影。
 */
export interface ModeAccent {
  accent: string;
  accentSoft: string;
  accentGlow: string;
  ring: string;
  ringSoft: string;
  btnFrom: string;
  btnTo: string;
  btnShadow: string;
}

export const MODE_ACCENTS: Record<AgentMode, ModeAccent> = {
  plan: {
    accent: "#0284c7",
    accentSoft: "rgba(14,165,233,0.10)",
    accentGlow: "rgba(14,165,233,0.55)",
    ring: "rgba(2,132,199,0.55)",
    ringSoft: "rgba(14,165,233,0.10)",
    btnFrom: "#0ea5e9",
    btnTo: "#0369a1",
    btnShadow: "rgba(2,132,199,0.35)",
  },
  edit: {
    accent: "#d97706",
    accentSoft: "rgba(245,158,11,0.12)",
    accentGlow: "rgba(217,119,6,0.55)",
    ring: "rgba(217,119,6,0.55)",
    ringSoft: "rgba(245,158,11,0.10)",
    btnFrom: "#f59e0b",
    btnTo: "#d97706",
    btnShadow: "rgba(217,119,6,0.35)",
  },
  mix: {
    accent: "#7c3aed",
    accentSoft: "rgba(139,92,246,0.12)",
    accentGlow: "rgba(124,58,237,0.55)",
    ring: "rgba(124,58,237,0.55)",
    ringSoft: "rgba(139,92,246,0.10)",
    btnFrom: "#8b5cf6",
    btnTo: "#6d28d9",
    btnShadow: "rgba(124,58,237,0.35)",
  },
};

const MODES: ModeDef[] = [
  {
    id: "plan",
    icon: ClipboardList,
    labelJa: "Plan",
    labelEn: "Plan",
    descJa: "計画のみ・編集しない。番号付きの実行計画をチャットに返す。",
    descEn: "Plan only. Reply with a numbered plan — no edits applied.",
    accent: MODE_ACCENTS.plan.accent,
    accentSoft: MODE_ACCENTS.plan.accentSoft,
    accentGlow: MODE_ACCENTS.plan.accentGlow,
  },
  {
    id: "edit",
    icon: Wand2,
    labelJa: "Edit",
    labelEn: "Edit",
    descJa: "自律編集。問題・数式・解答・解説まで完走する run-to-completion。",
    descEn: "Autonomous edit. Run-to-completion: problems, math, answers, solutions.",
    accent: MODE_ACCENTS.edit.accent,
    accentSoft: MODE_ACCENTS.edit.accentSoft,
    accentGlow: MODE_ACCENTS.edit.accentGlow,
  },
  {
    id: "mix",
    icon: Layers,
    labelJa: "Mix",
    labelEn: "Mix",
    descJa: "計画 + 実行。短い計画を先に出してから、そのまま編集まで完走。",
    descEn: "Plan + execute. Emit a short plan, then run it to completion.",
    accent: MODE_ACCENTS.mix.accent,
    accentSoft: MODE_ACCENTS.mix.accentSoft,
    accentGlow: MODE_ACCENTS.mix.accentGlow,
  },
];

export function ModeSwitcher({
  mode,
  onChange,
  disabled,
}: {
  mode: AgentMode;
  onChange: (m: AgentMode) => void;
  disabled?: boolean;
}) {
  const { locale } = useI18n();
  const [hoverId, setHoverId] = useState<AgentMode | null>(null);

  const activeDef = MODES.find((m) => m.id === mode) ?? MODES[1];
  const focusDef = (hoverId && MODES.find((m) => m.id === hoverId)) || activeDef;
  const desc = locale === "en" ? focusDef.descEn : focusDef.descJa;

  return (
    <div className="px-0.5 select-none" aria-label={locale === "en" ? "Agent mode" : "エージェントモード"}>
      {/* Tab row */}
      <div
        role="tablist"
        aria-label={locale === "en" ? "Agent mode" : "エージェントモード"}
        className="flex items-stretch gap-0 border-b border-black/[0.07] dark:border-white/[0.06]"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          const label = locale === "en" ? m.labelEn : m.labelJa;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => onChange(m.id)}
              onMouseEnter={() => setHoverId(m.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(m.id)}
              onBlur={() => setHoverId(null)}
              style={{
                color: isActive ? m.accent : undefined,
                background: isActive ? m.accentSoft : undefined,
              }}
              className={[
                "group relative flex items-center justify-center gap-1.5",
                "h-8 px-3 -mb-px text-[12px] font-semibold tracking-tight",
                "transition-colors duration-150 focus:outline-none",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "border-b-2",
                isActive
                  ? "border-current"
                  : "border-transparent text-foreground/45 hover:text-foreground/75",
              ].join(" ")}
            >
              <Icon
                className={[
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                  isActive ? "" : "group-hover:scale-110",
                ].join(" ")}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span>{label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-2 right-2 -bottom-[2px] h-[2px] rounded-full"
                  style={{
                    background: m.accent,
                    boxShadow: `0 0 8px ${m.accentGlow}, 0 1px 0 ${m.accent}`,
                  }}
                />
              )}
            </button>
          );
        })}

        {/* right-side dot indicating current mode (accessibility echo) */}
        <div className="ml-auto flex items-center pr-1">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full transition-colors duration-200"
            style={{ background: activeDef.accent, boxShadow: `0 0 6px ${activeDef.accentGlow}` }}
          />
        </div>
      </div>

      {/* Description strip */}
      <div className="mt-1 px-1 h-[16px] overflow-hidden">
        <p
          className="text-[10.5px] leading-[16px] font-medium truncate transition-colors duration-150"
          style={{ color: focusDef.accent }}
        >
          {desc}
        </p>
      </div>
    </div>
  );
}
