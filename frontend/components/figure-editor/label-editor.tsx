"use client";

/**
 * LabelEditor — ergonomic label input for figure shapes.
 *
 * Features:
 *  - Cursor-aware insertion: clicking a quick-insert button inserts at cursor,
 *    wraps selected text, and keeps focus.
 *  - KaTeX live preview when math mode is on.
 *  - Collapsible Greek letter / symbol palette.
 *  - Inline, non-intrusive syntax hints (toggle with "?").
 *  - Plain / Math / Vector flavors.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FigureShape, LabelPosition } from "./types";
import { LABEL_POSITIONS } from "./types";
import { renderInlineMathOrPlaceholder } from "@/lib/katex-render";
import {
  ChevronDown, X, Info,
} from "lucide-react";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

// ── Quick-insert catalog ────────────────────────────────────────

interface InsertAction {
  label: React.ReactNode;
  before: string;
  after?: string;
  /** Placeholder text inserted between before/after if no selection */
  placeholder?: string;
  tooltip: string;
  tooltipJa: string;
  /** Auto-enable math mode when clicked */
  requiresMath?: boolean;
}

/**
 * Quick-insert actions. Each has:
 *  - `label`: a VISUAL representation (not LaTeX code) — shows what the result looks like
 *  - `name` / `nameJa`: a plain-language name for the tooltip (no code shown)
 *  - `before` / `after` / `placeholder`: the actual TeX inserted (hidden from user)
 */
const QUICK_INSERTS: InsertAction[] = [
  { label: <>x<sub className="text-[0.7em] -ml-px">n</sub></>,
    before: "_{", after: "}", placeholder: "n",
    tooltip: "Subscript", tooltipJa: "下付き文字", requiresMath: true },
  { label: <>x<sup className="text-[0.7em] -ml-px">n</sup></>,
    before: "^{", after: "}", placeholder: "n",
    tooltip: "Superscript", tooltipJa: "上付き文字", requiresMath: true },
  { label: <span className="relative inline-block leading-none"><span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[10px]">→</span><span>v</span></span>,
    before: "\\vec{", after: "}", placeholder: "v",
    tooltip: "Vector (arrow over letter)", tooltipJa: "ベクトル(矢印付き)", requiresMath: true },
  { label: <span className="relative inline-block leading-none"><span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[10px]">^</span><span>x</span></span>,
    before: "\\hat{", after: "}", placeholder: "x",
    tooltip: "Hat (estimate / unit)", tooltipJa: "ハット(推定値・単位)", requiresMath: true },
  { label: <span className="relative inline-block leading-none"><span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px]">·</span><span>x</span></span>,
    before: "\\dot{", after: "}", placeholder: "x",
    tooltip: "Dot (time derivative)", tooltipJa: "ドット(時間微分)", requiresMath: true },
  { label: <span className="relative inline-block leading-none"><span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[10px]">−</span><span>x</span></span>,
    before: "\\bar{", after: "}", placeholder: "x",
    tooltip: "Bar (mean / average)", tooltipJa: "バー(平均値)", requiresMath: true },
  { label: <span className="inline-flex flex-col items-center leading-[0.85] text-[9px] font-serif"><span>a</span><span className="border-t border-current w-3" /><span>b</span></span>,
    before: "\\frac{", after: "}{}", placeholder: "a",
    tooltip: "Fraction", tooltipJa: "分数", requiresMath: true },
  { label: <span className="font-serif">√x</span>,
    before: "\\sqrt{", after: "}", placeholder: "x",
    tooltip: "Square root", tooltipJa: "平方根", requiresMath: true },
];

// Organized symbol palette
const GREEK_LOWER = [
  { sym: "α", tex: "\\alpha" }, { sym: "β", tex: "\\beta" }, { sym: "γ", tex: "\\gamma" },
  { sym: "δ", tex: "\\delta" }, { sym: "ε", tex: "\\epsilon" }, { sym: "ζ", tex: "\\zeta" },
  { sym: "η", tex: "\\eta" }, { sym: "θ", tex: "\\theta" }, { sym: "ι", tex: "\\iota" },
  { sym: "κ", tex: "\\kappa" }, { sym: "λ", tex: "\\lambda" }, { sym: "μ", tex: "\\mu" },
  { sym: "ν", tex: "\\nu" }, { sym: "ξ", tex: "\\xi" }, { sym: "π", tex: "\\pi" },
  { sym: "ρ", tex: "\\rho" }, { sym: "σ", tex: "\\sigma" }, { sym: "τ", tex: "\\tau" },
  { sym: "υ", tex: "\\upsilon" }, { sym: "φ", tex: "\\phi" }, { sym: "χ", tex: "\\chi" },
  { sym: "ψ", tex: "\\psi" }, { sym: "ω", tex: "\\omega" },
];

const GREEK_UPPER = [
  { sym: "Γ", tex: "\\Gamma" }, { sym: "Δ", tex: "\\Delta" }, { sym: "Θ", tex: "\\Theta" },
  { sym: "Λ", tex: "\\Lambda" }, { sym: "Ξ", tex: "\\Xi" }, { sym: "Π", tex: "\\Pi" },
  { sym: "Σ", tex: "\\Sigma" }, { sym: "Φ", tex: "\\Phi" }, { sym: "Ψ", tex: "\\Psi" },
  { sym: "Ω", tex: "\\Omega" },
];

const OPS = [
  { sym: "·", tex: "\\cdot" }, { sym: "×", tex: "\\times" }, { sym: "÷", tex: "\\div" },
  { sym: "±", tex: "\\pm" }, { sym: "∓", tex: "\\mp" },
  { sym: "≤", tex: "\\leq" }, { sym: "≥", tex: "\\geq" }, { sym: "≠", tex: "\\neq" },
  { sym: "≈", tex: "\\approx" }, { sym: "≡", tex: "\\equiv" },
  { sym: "→", tex: "\\to" }, { sym: "⇒", tex: "\\Rightarrow" }, { sym: "⇔", tex: "\\Leftrightarrow" },
  { sym: "∞", tex: "\\infty" }, { sym: "∂", tex: "\\partial" }, { sym: "∇", tex: "\\nabla" },
  { sym: "∫", tex: "\\int" }, { sym: "∑", tex: "\\sum" }, { sym: "∏", tex: "\\prod" },
  { sym: "√", tex: "\\sqrt{}" }, { sym: "∈", tex: "\\in" }, { sym: "∉", tex: "\\notin" },
  { sym: "⊂", tex: "\\subset" }, { sym: "∪", tex: "\\cup" }, { sym: "∩", tex: "\\cap" },
];

const UNITS = [
  { sym: "°", tex: "^\\circ" },
  { sym: "Ω", tex: "\\Omega" },
  { sym: "μ", tex: "\\mu" },
  { sym: "π", tex: "\\pi" },
];

// ── Small pieces ────────────────────────────────────────────────

/** Quick-insert button — bigger, more visual. Used in the math toolbar. */
function InsertBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="group h-9 rounded-md font-serif text-[13px] flex items-center justify-center transition-all bg-white/70 dark:bg-white/[0.04] border border-foreground/[0.06] hover:border-blue-500/40 hover:bg-blue-50/60 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 text-foreground/80"
    >
      {children}
    </button>
  );
}

/** Symbol palette button (compact, single character). */
function SymbolBtn({ sym, tex, onInsert }: { sym: string; tex: string; onInsert: (t: string) => void }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(tex)}
      title={sym}
      className="h-6 w-6 rounded text-[13px] font-serif text-foreground/75 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"
    >
      {sym}
    </button>
  );
}

/** Hint row showing a visual rendered preview + label + brief instruction. NO LaTeX code. */
function VisualHint({ preview, label, description }: {
  preview: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-7 flex items-center justify-center rounded bg-white dark:bg-white/[0.06] border border-foreground/[0.06] font-serif text-[13px] text-foreground/85 shrink-0">
        {preview}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-foreground/75 leading-tight">{label}</div>
        <div className="text-[9px] text-foreground/45 leading-tight">{description}</div>
      </div>
    </div>
  );
}

// ── 9-way position picker ───────────────────────────────────────

function PositionPicker({ value, onChange }: { value: LabelPosition; onChange: (p: LabelPosition) => void }) {
  return (
    <div className="inline-grid grid-cols-3 gap-0.5 p-1 rounded-md bg-foreground/[0.04] border border-foreground/[0.06]">
      {LABEL_POSITIONS.map((pos) => {
        const active = value === pos;
        return (
          <button key={pos} title={pos}
            onClick={() => onChange(pos)}
            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
              active ? "bg-blue-500 shadow-sm shadow-blue-500/40" : "bg-white dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <rect x="5" y="5" width="8" height="8" rx="1"
                fill="none" stroke={active ? "white" : "currentColor"}
                strokeWidth="1" opacity={active ? 1 : 0.4} />
              <circle
                cx={pos.includes("left") ? 3 : pos.includes("right") ? 15 : 9}
                cy={pos.includes("above") ? 3 : pos.includes("below") ? 15 : 9}
                r="1.6"
                fill={active ? "white" : "#3b82f6"}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN: LabelEditor
// ══════════════════════════════════════════════════════════════════

export function LabelEditor({
  shape, onUpdate, pushHistory,
}: {
  shape: FigureShape;
  onUpdate: (updates: Partial<FigureShape>) => void;
  pushHistory: () => void;
}) {
  const isJa = useIsJa();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(shape.label);
  const [showPalette, setShowPalette] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => { setValue(shape.label); }, [shape.id, shape.label]);

  // Commit label on blur / enter
  const commit = useCallback(() => {
    if (value !== shape.label) {
      pushHistory();
      onUpdate({ label: value });
    }
  }, [value, shape.label, pushHistory, onUpdate]);

  // Toggle math mode
  const toggleMath = useCallback(() => {
    pushHistory();
    onUpdate({ labelMathMode: !shape.labelMathMode });
  }, [shape.labelMathMode, pushHistory, onUpdate]);

  // Insert text at cursor, optionally wrapping selection
  const insertAt = useCallback((before: string, after = "", placeholder = "") => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const mid = selected || placeholder;
    const next = value.slice(0, start) + before + mid + after + value.slice(end);
    setValue(next);
    // Position cursor inside the brace: after 'before'+mid if no selection, else select 'mid'
    requestAnimationFrame(() => {
      input?.focus();
      if (selected) {
        // user had selection: cursor after 'after'
        const pos = start + before.length + selected.length + after.length;
        input?.setSelectionRange(pos, pos);
      } else {
        // select the placeholder so user can overwrite
        const s = start + before.length;
        const e = s + placeholder.length;
        input?.setSelectionRange(s, e);
      }
    });
    // Auto-commit after microtask
    requestAnimationFrame(() => {
      if (next !== shape.label) {
        pushHistory();
        onUpdate({ label: next });
      }
    });
  }, [value, shape.label, pushHistory, onUpdate]);

  const insertSymbol = useCallback((tex: string) => {
    // If input is unfocused, append
    const input = inputRef.current;
    if (document.activeElement !== input) {
      input?.focus();
    }
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + tex + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      input?.focus();
      const pos = start + tex.length;
      input?.setSelectionRange(pos, pos);
    });
    requestAnimationFrame(() => {
      if (next !== shape.label) {
        pushHistory();
        onUpdate({ label: next });
      }
    });
  }, [value, shape.label, pushHistory, onUpdate]);

  // Insert with auto math-mode enable
  const smartInsert = useCallback((action: InsertAction) => {
    if (action.requiresMath && !shape.labelMathMode) {
      onUpdate({ labelMathMode: true });
    }
    insertAt(action.before, action.after ?? "", action.placeholder ?? "");
  }, [shape.labelMathMode, onUpdate, insertAt]);

  // Live KaTeX preview
  const previewHtml = useMemo(() => {
    if (!value.trim()) return null;
    try {
      return renderInlineMathOrPlaceholder(value);
    } catch {
      return null;
    }
  }, [value]);

  return (
    <div className="space-y-2">

      {/* ── Input ── */}
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
          }}
          placeholder={shape.labelMathMode
            ? (isJa ? "数式を入力 (下のボタンを使用)" : "Enter expression (use buttons below)")
            : (isJa ? "テキストを入力..." : "Enter text...")}
          className={`w-full h-8 px-2.5 text-[12px] rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
            shape.labelMathMode
              ? "font-serif italic border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5 focus:border-blue-500/60"
              : "border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:border-blue-500/40"
          }`}
          spellCheck={!shape.labelMathMode}
        />
      </div>

      {/* ══ Mode selection: TWO BIG BUTTONS ══ */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06]">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { if (shape.labelMathMode) toggleMath(); }}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-all ${
            !shape.labelMathMode
              ? "bg-white dark:bg-white/[0.08] text-foreground shadow-sm ring-1 ring-foreground/[0.08]"
              : "text-foreground/45 hover:text-foreground/70 hover:bg-foreground/[0.03]"
          }`}
        >
          <span className="text-[15px] font-sans font-semibold leading-none">Aa</span>
          <span className="text-[9px] font-medium tracking-wide">{isJa ? "テキスト" : "Text"}</span>
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { if (!shape.labelMathMode) toggleMath(); }}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-all ${
            shape.labelMathMode
              ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
              : "text-foreground/45 hover:text-foreground/70 hover:bg-foreground/[0.03]"
          }`}
        >
          <span className="text-[15px] font-serif italic leading-none">𝑥</span>
          <span className="text-[9px] font-medium tracking-wide">{isJa ? "数式" : "Math"}</span>
        </button>
      </div>

      {/* ══ Math quick-insert (visual buttons, no code shown) ══ */}
      {shape.labelMathMode && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-wider text-foreground/40">
              {isJa ? "クイック挿入" : "Quick insert"}
            </span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowHint(!showHint)}
              title={isJa ? "使い方ヒント" : "How to use"}
              className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${
                showHint ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-foreground/30 hover:text-foreground/60"
              }`}
            >
              <Info size={10} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {QUICK_INSERTS.map((ins, i) => (
              <InsertBtn key={i} onClick={() => smartInsert(ins)} title={isJa ? ins.tooltipJa : ins.tooltip}>
                {ins.label}
              </InsertBtn>
            ))}
          </div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPalette(!showPalette)}
            title={isJa ? "ギリシャ文字・記号パレット" : "Greek letters & symbols"}
            className={`w-full h-7 rounded-md text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 ${
              showPalette
                ? "bg-blue-500 text-white"
                : "bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground/65 hover:text-foreground/85 border border-foreground/[0.06]"
            }`}
          >
            <span className="font-serif text-[12px]">α β γ ⋯</span>
            <span>{isJa ? "記号" : "Symbols"}</span>
            <ChevronDown size={10} className={`transition-transform ${showPalette ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}

      {/* ══ Visual usage hints (no LaTeX code shown — only rendered results) ══ */}
      {showHint && shape.labelMathMode && (
        <div className="bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-500/5 rounded-md px-3 py-2.5 border border-blue-500/15 space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-blue-500/70 mb-1">
            {isJa ? "使い方" : "How it works"}
          </div>
          <VisualHint
            preview={<>x<sub className="text-[0.65em]">1</sub></>}
            label={isJa ? "下付き文字" : "Subscript"}
            description={isJa ? "ボタン x_n を押す" : "Press the x_n button"}
          />
          <VisualHint
            preview={<>x<sup className="text-[0.65em]">2</sup></>}
            label={isJa ? "上付き文字" : "Superscript"}
            description={isJa ? "ボタン x^n を押す" : "Press the x^n button"}
          />
          <VisualHint
            preview={<span className="relative inline-block leading-none"><span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[10px]">→</span><span className="font-serif italic">v</span></span>}
            label={isJa ? "ベクトル" : "Vector"}
            description={isJa ? "矢印付きボタンを押す" : "Press the arrow button"}
          />
          <VisualHint
            preview={<span className="font-serif">α β γ</span>}
            label={isJa ? "ギリシャ文字" : "Greek letters"}
            description={isJa ? "「記号」ボタンから選択" : "Pick from symbol palette"}
          />
          <VisualHint
            preview={<span className="inline-flex flex-col items-center leading-[0.85] text-[10px] font-serif"><span>a</span><span className="border-t border-current w-3" /><span>b</span></span>}
            label={isJa ? "分数" : "Fraction"}
            description={isJa ? "分数ボタンを押す" : "Press the fraction button"}
          />
          <div className="pt-1.5 mt-1.5 border-t border-blue-500/15 text-[9px] text-foreground/45 leading-relaxed">
            {isJa
              ? "💡 ボタンを押すと自動で挿入されます。慣れてきたら直接 _ や ^ で入力もできます。"
              : "💡 Buttons insert at your cursor. Once familiar, you can also type _ or ^ directly."}
          </div>
        </div>
      )}

      {/* ── Live preview ── */}
      {previewHtml && value.trim() && (
        <div className="flex items-start gap-2 text-[10px] bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-500/5 rounded-md px-2.5 py-1.5 border border-blue-500/15">
          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500/60 pt-0.5 shrink-0">
            {isJa ? "プレビュー" : "Preview"}
          </span>
          <div className="flex-1 text-foreground/85" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}

      {/* ── Symbol palette (collapsible, non-intrusive) ── */}
      {showPalette && shape.labelMathMode && (
        <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-md p-2 space-y-2">
          <SymbolGroup title={isJa ? "ギリシャ (小)" : "Greek (lower)"} symbols={GREEK_LOWER} onInsert={insertSymbol} />
          <SymbolGroup title={isJa ? "ギリシャ (大)" : "Greek (upper)"} symbols={GREEK_UPPER} onInsert={insertSymbol} />
          <SymbolGroup title={isJa ? "演算子" : "Operators"} symbols={OPS} onInsert={insertSymbol} />
          <SymbolGroup title={isJa ? "単位" : "Units"} symbols={UNITS} onInsert={insertSymbol} />
          <div className="flex items-center justify-end pt-1">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPalette(false)}
              className="text-[9px] text-foreground/40 hover:text-foreground/70 flex items-center gap-0.5"
            >
              <X size={9} /> {isJa ? "閉じる" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* ── Position picker ── */}
      <div className="pt-1">
        <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
          {isJa ? "配置" : "Position"}
        </div>
        <PositionPicker
          value={shape.labelPos}
          onChange={(p) => { pushHistory(); onUpdate({ labelPos: p }); }}
        />
      </div>

      {/* ── Offset ── */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <OffsetRow label="dX" value={shape.labelOffset.x}
          onChange={(v) => { pushHistory(); onUpdate({ labelOffset: { ...shape.labelOffset, x: v } }); }} />
        <OffsetRow label="dY" value={shape.labelOffset.y}
          onChange={(v) => { pushHistory(); onUpdate({ labelOffset: { ...shape.labelOffset, y: v } }); }} />
      </div>
      {(shape.labelOffset.x !== 0 || shape.labelOffset.y !== 0) && (
        <button
          onClick={() => { pushHistory(); onUpdate({ labelOffset: { x: 0, y: 0 } }); }}
          className="text-[9px] text-blue-500 hover:text-blue-600 underline-offset-2 hover:underline transition-colors"
        >
          {isJa ? "オフセットをリセット" : "Reset offset"}
        </button>
      )}
    </div>
  );
}

// ── Small helpers ───────────────────────────────────────────────


function SymbolGroup({ title, symbols, onInsert }: { title: string; symbols: { sym: string; tex: string }[]; onInsert: (t: string) => void }) {
  return (
    <div>
      <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">{title}</div>
      <div className="grid grid-cols-12 gap-0.5">
        {symbols.map((s) => <SymbolBtn key={s.tex} sym={s.sym} tex={s.tex} onInsert={onInsert} />)}
      </div>
    </div>
  );
}

function OffsetRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-foreground/45 w-8 shrink-0 font-mono uppercase">{label}</span>
      <input type="number" step={0.05} value={value}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
        className="flex-1 h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
    </div>
  );
}
