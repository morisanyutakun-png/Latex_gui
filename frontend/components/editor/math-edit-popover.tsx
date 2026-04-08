"use client";

import { useEffect, useMemo, useRef } from "react";
import { JapaneseMathInput } from "./math-japanese-input";
import { MathRenderer } from "./math-editor";
import { useI18n } from "@/lib/i18n";
import { latexToJapanese } from "@/lib/math-japanese";
import { X } from "lucide-react";

interface MathEditPopoverProps {
  /** 既存の数式 LaTeX (中身のみ。$, \[\] などの wrapper は含まない) */
  initialLatex: string;
  /** 確定時に呼ばれる。新しい LaTeX (中身のみ) を渡す */
  onApply: (newLatex: string) => void;
  onClose: () => void;
}

/**
 * 数式編集ポップアップ
 *
 * 既存数式を編集する場合は、`latexToJapanese` で日本語訳を生成して入力欄に
 * 初期表示する。同時に元の LaTeX を override として保持しておくことで、
 * ユーザーが何も編集せずに apply しても元の LaTeX がそのまま戻る。
 * (ユーザーが入力欄に触ると override は自動でクリアされ、日本語が再パースされる)
 */
export function MathEditPopover({ initialLatex, onApply, onClose }: MathEditPopoverProps) {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  const initialJapanese = useMemo(() => latexToJapanese(initialLatex), [initialLatex]);
  const hasInitial = initialLatex.trim().length > 0;

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleApply = (latex: string) => {
    if (latex.trim()) onApply(latex);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/30 backdrop-blur-[2px] px-4 pt-[10vh] animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-gradient-to-r from-violet-50/60 to-fuchsia-50/40 dark:from-violet-950/20 dark:to-fuchsia-950/10">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span className="text-xs font-semibold text-foreground/80">
              {t("doc.editor.math.popover.title")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            title={t("doc.editor.math.popover.cancel")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 現在の数式プレビュー (新規挿入なら表示しない) */}
        {hasInitial && (
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
              {t("doc.editor.math.popover.current")}
            </div>
            <div className="flex justify-center py-1 overflow-auto">
              <MathRenderer latex={initialLatex} displayMode={true} />
            </div>
          </div>
        )}

        {/* JapaneseMathInput 本体 — 既存式の場合は日本語訳がデフォルトで入力済み */}
        <div className="p-3 max-h-[60vh] overflow-y-auto">
          <JapaneseMathInput
            initialSourceText={hasInitial ? initialJapanese : ""}
            initialOverrideLatex={hasInitial ? initialLatex : null}
            onApply={(latex) => {
              handleApply(latex);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
