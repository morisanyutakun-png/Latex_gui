"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ClipboardList,
  Sigma,
  ScanSearch,
} from "lucide-react";
import type { AgentMode } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ModeDef {
  id: AgentMode;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  labelJa: string;
  labelEn: string;
  descJa: string;
  descEn: string;
}

const MODES: ModeDef[] = [
  {
    id: "auto",
    icon: Sparkles,
    labelJa: "標準",
    labelEn: "Auto",
    descJa: "標準編集。最小差分・既存テンプレ尊重",
    descEn: "Standard edit. Minimal diff, respect template",
  },
  {
    id: "problem",
    icon: ClipboardList,
    labelJa: "問題作成",
    labelEn: "Problem",
    descJa: "自律型問題作成。問題・解答・解説まで完走",
    descEn: "Autonomous. Problems + answers + solutions, fully filled",
  },
  {
    id: "math",
    icon: Sigma,
    labelJa: "数式",
    labelEn: "Math",
    descJa: "数式集中。align/分数/ベクトルを美しく",
    descEn: "Math-focused. align / fractions / vectors, polished",
  },
  {
    id: "review",
    icon: ScanSearch,
    labelJa: "校正",
    labelEn: "Review",
    descJa: "既存を読み、欠損・プレースホルダ・誤記を修正",
    descEn: "Read & fix gaps, placeholders, mistakes",
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

  const activeDesc = (() => {
    const target = hoverId ?? mode;
    const def = MODES.find((m) => m.id === target) ?? MODES[0];
    return locale === "en" ? def.descEn : def.descJa;
  })();

  return (
    <div className="px-0.5 mb-1.5 select-none">
      <div
        role="radiogroup"
        aria-label={locale === "en" ? "Agent mode" : "エージェントモード"}
        className="relative flex items-center gap-1 p-1 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-gradient-to-br from-amber-50/80 via-white/60 to-amber-50/70 dark:from-amber-500/[0.06] dark:via-white/[0.015] dark:to-amber-500/[0.04] backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(180,83,9,0.04)]"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          const label = locale === "en" ? m.labelEn : m.labelJa;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onChange(m.id)}
              onMouseEnter={() => setHoverId(m.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(m.id)}
              onBlur={() => setHoverId(null)}
              className={[
                "group relative flex-1 flex items-center justify-center gap-1.5",
                "h-7 px-2 rounded-lg text-[11.5px] font-semibold tracking-tight",
                "transition-all duration-200 focus:outline-none",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                isActive
                  ? "text-white shadow-[0_2px_6px_rgba(217,119,6,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 scale-[1.01]"
                  : "text-amber-700/70 dark:text-amber-300/60 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-white/70 dark:hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <Icon
                className={[
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  isActive ? "drop-shadow-[0_1px_1px_rgba(120,53,15,0.35)]" : "group-hover:scale-110",
                ].join(" ")}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span className="truncate">{label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 right-1 h-1 w-1 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 px-1.5 h-[14px] overflow-hidden">
        <p className="text-[10.5px] leading-[14px] text-amber-700/70 dark:text-amber-300/50 truncate">
          {activeDesc}
        </p>
      </div>
    </div>
  );
}
