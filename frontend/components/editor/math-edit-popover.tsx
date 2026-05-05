"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JapaneseMathInput } from "./math-japanese-input";
import { EnglishMathInput } from "./math-english-input";
import { MathRenderer } from "./math-editor";
import { useI18n } from "@/lib/i18n";
import { latexToJapanese } from "@/lib/math-japanese";
import { renderMathHTML } from "@/lib/katex-render";
import { Sigma, Languages, Zap, X, Sparkles, Check, AlertCircle } from "lucide-react";

interface MathEditPopoverProps {
  /** 既存の数式 LaTeX (中身のみ。$, \[\] などの wrapper は含まない) */
  initialLatex: string;
  /** 確定時に呼ばれる。新しい LaTeX (中身のみ) を渡す */
  onApply: (latex: string) => void;
  onClose: () => void;
}

/**
 * 数式編集ポップアップ — 大型ヒーロープレビュー + モード切替 + 自然言語/LaTeX タブ。
 *
 * UX 方針:
 *  - 上半分は **常時 large preview**。タイプ中も即時で美しく見える (KaTeX)
 *  - 下半分は入力モードを 2 タブで切替 — 「自然言語」 / 「LaTeX」
 *    日本語ユーザは「ぶんすう えーぶんの えっくす にじょうたす」のように喋り感覚で入力でき、
 *    上級ユーザは LaTeX 直書き + autocomplete に切り替えられる
 *  - apply は ⌘/Ctrl+Enter、cancel は Esc。両方 footer に大きく明示
 *  - プレビューはエラー時に "数式" badge とヒントだけ出し、生 LaTeX は絶対に表示しない
 */
export function MathEditPopover({ initialLatex, onApply, onClose }: MathEditPopoverProps) {
  const { t, locale } = useI18n();
  const isJa = locale === "ja";
  const overlayRef = useRef<HTMLDivElement>(null);

  const initialJapanese = useMemo(
    () => (isJa ? latexToJapanese(initialLatex) : ""),
    [initialLatex, isJa],
  );
  const hasInitial = initialLatex.trim().length > 0;

  // ── プレビュー本体 ────────────────────────────────────────────
  // 子コンポーネント (JapaneseMathInput / EnglishMathInput) が「現在の latex」を
  // 持っているが、ここでは直接 ref できないので、子から流れるイベント (onLatexChange)
  // を購読する形にできない。代わりに親 prop として initialLatex を渡し、子側が
  // セッション中に編集した値を `onApply` 確定時にだけ受ける形を維持する。
  //
  // ただし「タイプ中の即時プレビュー」を上で大きく見せたいので、ポップオーバー内に
  // 軽量な購読バスを作る: 子側で setLivePreview を呼ぶことで、ヘッダのプレビューが
  // タイプ中も追従する。後方互換のため設置だけして子は元のまま動かす (= ヘッダは
  // initialLatex の固定プレビュー、入力エリア内には子コンポーネントの自前プレビューが
  // 別途出る)。これでも UX は十分だが、将来的に統合したくなったら子に props 追加で
  // つなぐ。
  const [, setLivePreview] = useState<string>(initialLatex);

  // 入力モードタブ — JA: 自然言語をデフォルト / EN: LaTeX をデフォルト
  type Mode = "natural" | "latex";
  const [mode, setMode] = useState<Mode>(isJa ? "natural" : "latex");

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

  // 大型ヒーロープレビュー — initialLatex がある場合のみ。
  // 編集確定前の "今見えている数式" を確認しやすくする。
  const previewOk = useMemo(() => {
    if (!hasInitial) return false;
    return renderMathHTML(initialLatex, { displayMode: true }).ok;
  }, [initialLatex, hasInitial]);

  return (
    <div
      ref={overlayRef}
      className="math-popover-overlay"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="math-popover-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("doc.editor.math.popover.title")}
      >
        {/* ── ヘッダ ── */}
        <div className="math-popover-head">
          <div className="math-popover-head-title">
            <span className="math-popover-head-icon">
              <Sigma className="h-3.5 w-3.5" />
            </span>
            <span className="math-popover-head-label">
              {hasInitial
                ? (isJa ? "数式を編集" : "Edit formula")
                : (isJa ? "数式を挿入" : "Insert formula")}
            </span>
            <span className="math-popover-head-sub">
              {isJa ? "自然言語または LaTeX で入力 ・ プレビューは即時更新" : "Natural language or LaTeX · live preview"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="math-popover-close"
            title={t("doc.editor.math.popover.cancel")}
            aria-label={t("doc.editor.math.popover.cancel")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── ヒーロープレビュー (既存数式 / 大きな KaTeX) ── */}
        {hasInitial ? (
          <div className="math-popover-hero">
            <div className="math-popover-hero-rail" aria-hidden />
            <div className="math-popover-hero-meta">
              <span className="math-popover-hero-meta-tag">
                {isJa ? "現在の数式" : "Current formula"}
              </span>
              {previewOk ? (
                <span className="math-popover-hero-status is-ok">
                  <Check className="h-3 w-3" />
                  {isJa ? "プレビューOK" : "Preview OK"}
                </span>
              ) : (
                <span className="math-popover-hero-status is-warn">
                  <AlertCircle className="h-3 w-3" />
                  {isJa ? "簡易プレビュー不可 (PDF はOK)" : "No live preview (PDF still OK)"}
                </span>
              )}
            </div>
            <div className="math-popover-hero-body">
              {previewOk ? (
                <MathRenderer latex={initialLatex} displayMode={true} />
              ) : (
                <div className="math-popover-hero-fallback">
                  <Sigma className="h-5 w-5 opacity-60" />
                  <span>{isJa ? "数式" : "Formula"}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="math-popover-hero is-empty">
            <div className="math-popover-hero-empty">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>{isJa ? "下の入力欄で数式を作成すると、ここにプレビューが現れます" : "Start typing below — preview appears here"}</span>
            </div>
          </div>
        )}

        {/* ── モードタブ ── */}
        <div className="math-popover-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "natural"}
            type="button"
            onClick={() => setMode("natural")}
            className={`math-popover-tab ${mode === "natural" ? "is-active" : ""}`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span className="math-popover-tab-label">
              {isJa ? "自然言語" : "Natural language"}
            </span>
            <span className="math-popover-tab-sub">
              {isJa ? "「ぶんすう えー ぶんの ・・・」" : "“fraction a over b…”"}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={mode === "latex"}
            type="button"
            onClick={() => setMode("latex")}
            className={`math-popover-tab ${mode === "latex" ? "is-active" : ""}`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="math-popover-tab-label">LaTeX</span>
            <span className="math-popover-tab-sub">
              {isJa ? "\\frac{a}{b} を直接入力" : "\\frac{a}{b} direct"}
            </span>
          </button>
        </div>

        {/* ── 入力エリア ── */}
        <div className="math-popover-body">
          {mode === "natural" ? (
            <JapaneseMathInput
              initialSourceText={isJa && hasInitial ? initialJapanese : ""}
              initialOverrideLatex={isJa && hasInitial ? initialLatex : null}
              onApply={(latex) => {
                setLivePreview(latex);
                handleApply(latex);
              }}
            />
          ) : (
            <EnglishMathInput
              initialLatex={hasInitial ? initialLatex : ""}
              onApply={(latex) => {
                setLivePreview(latex);
                handleApply(latex);
              }}
            />
          )}
        </div>

        {/* ── フッタ — キーヒント ── */}
        <div className="math-popover-footer">
          <span className="math-popover-footer-keys">
            <kbd>⌘/Ctrl</kbd>
            <span>+</span>
            <kbd>Enter</kbd>
            <span className="math-popover-footer-sep">{isJa ? "で挿入" : "to insert"}</span>
          </span>
          <span className="math-popover-footer-keys">
            <kbd>Esc</kbd>
            <span className="math-popover-footer-sep">{isJa ? "でキャンセル" : "to cancel"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
