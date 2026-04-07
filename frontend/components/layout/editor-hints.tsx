"use client";

import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { useI18n } from "@/lib/i18n";
import { Keyboard, Sigma, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

const HINTS = {
  default: {
    icon: Keyboard,
    ja: "左のエディタで raw LaTeX を編集 · 右ペインで自動プレビュー · AIに依頼すれば代わりに編集します",
    en: "Edit raw LaTeX on the left · Auto preview on the right · Ask AI to edit for you",
  },
  math: {
    icon: Sigma,
    ja: "数式モード: $...$ でインライン数式 · \\[ ... \\] でディスプレイ数式",
    en: "Math: $...$ for inline · \\[ ... \\] for display",
  },
  empty: {
    icon: Sparkles,
    ja: "テンプレートから始めるか、AIに「○○を作って」と依頼してください",
    en: "Start from a template or ask AI to create something",
  },
};

export function EditorHints() {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "ja";
  const isMathEditing = useUIStore((s) => s.isMathEditing);
  const latex = useDocumentStore((s) => s.document?.latex);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [isMathEditing]);

  if (dismissed) return null;

  let hint = HINTS.default;
  if (isMathEditing) {
    hint = HINTS.math;
  } else if (!latex || latex.trim().length === 0) {
    hint = HINTS.empty;
  }

  const Icon = hint.icon;
  const isMath = isMathEditing;

  return (
    <div className={`flex items-center gap-2 px-4 h-7 text-[11px] shrink-0 select-none border-b transition-colors duration-300 ${
      isMath
        ? "bg-violet-500/[0.03] dark:bg-violet-500/[0.04] border-violet-500/10 text-violet-500/60 dark:text-violet-400/50"
        : "bg-foreground/[0.01] dark:bg-foreground/[0.015] border-foreground/[0.03] text-foreground/30"
    }`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate font-mono tracking-wide">{hint[lang]}</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto text-foreground/15 hover:text-foreground/40 transition-colors text-[10px] shrink-0"
      >
        &times;
      </button>
    </div>
  );
}
