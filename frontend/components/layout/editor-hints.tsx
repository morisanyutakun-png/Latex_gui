"use client";

import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { useI18n } from "@/lib/i18n";
import { Keyboard, Type, Sigma, MousePointer } from "lucide-react";
import { useState, useEffect } from "react";

const HINTS = {
  default: {
    icon: MousePointer,
    ja: "テキストをクリックして編集 · Tab で数式モード · Enter で新しいブロック",
    en: "Click text to edit · Tab for math mode · Enter for new block",
  },
  math: {
    icon: Sigma,
    ja: "数式モード: LaTeX記法で入力 · ;a → \\alpha · ;f → \\frac{}{} · Esc で戻る",
    en: "Math mode: Type LaTeX · ;a → \\alpha · ;f → \\frac{}{} · Esc to exit",
  },
  heading: {
    icon: Type,
    ja: "見出し: H1/H2/H3を選択 · ツールバーで太字・色・配置を変更",
    en: "Heading: Select H1/H2/H3 · Use toolbar for bold, color, alignment",
  },
  empty: {
    icon: Keyboard,
    ja: "テンプレートから開始するか、テキストをクリックして入力を始めましょう",
    en: "Start from a template or click text to begin typing",
  },
};

export function EditorHints() {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "ja";
  const isMathEditing = useUIStore((s) => s.isMathEditing);
  const selectedBlockId = useUIStore((s) => s.selectedBlockId);
  const activeGuideContext = useUIStore((s) => s.activeGuideContext);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when context changes
  useEffect(() => {
    setDismissed(false);
  }, [isMathEditing, activeGuideContext]);

  if (dismissed) return null;

  let hint = HINTS.default;
  if (isMathEditing) {
    hint = HINTS.math;
  } else if (activeGuideContext === "heading") {
    hint = HINTS.heading;
  } else if (!blocks || blocks.length <= 1) {
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
