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
  Superscript, Subscript, Sigma, ChevronDown, X, Info,
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

const QUICK_INSERTS: InsertAction[] = [
  { label: <>x<sub className="text-[0.75em]">n</sub></>, before: "_{", after: "}", placeholder: "n",
    tooltip: "Subscript (_{...})", tooltipJa: "下付き (_{…})", requiresMath: true },
  { label: <>x<sup className="text-[0.75em]">n</sup></>, before: "^{", after: "}", placeholder: "n",
    tooltip: "Superscript (^{...})", tooltipJa: "上付き (^{…})", requiresMath: true },
  { label: <span style={{ textDecoration: "overline" }}>x→</span>, before: "\\vec{", after: "}", placeholder: "v",
    tooltip: "Vector (\\vec{})", tooltipJa: "ベクトル (\\vec{})", requiresMath: true },
  { label: <>x̂</>, before: "\\hat{", after: "}", placeholder: "x",
    tooltip: "Hat (\\hat{})", tooltipJa: "ハット (\\hat{})", requiresMath: true },
  { label: <>ẋ</>, before: "\\dot{", after: "}", placeholder: "x",
    tooltip: "Dot (\\dot{}) — time derivative", tooltipJa: "ドット (\\dot{}) — 時間微分", requiresMath: true },
  { label: <>x̄</>, before: "\\bar{", after: "}", placeholder: "x",
    tooltip: "Bar (\\bar{}) — mean", tooltipJa: "バー (\\bar{}) — 平均", requiresMath: true },
  { label: <>½</>, before: "\\frac{", after: "}{}", placeholder: "a",
    tooltip: "Fraction (\\frac{a}{b})", tooltipJa: "分数 (\\frac{a}{b})", requiresMath: true },
  { label: <>√</>, before: "\\sqrt{", after: "}", placeholder: "x",
    tooltip: "Square root (\\sqrt{})", tooltipJa: "平方根 (\\sqrt{})", requiresMath: true },
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

function Chip({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}  // keep input focused
      onClick={onClick}
      title={title}
      className={`h-7 min-w-[28px] px-1.5 rounded-md text-[11px] font-serif transition-colors flex items-center justify-center ${
        active
          ? "bg-blue-500 text-white shadow-sm"
          : "bg-foreground/[0.04] hover:bg-foreground/[0.1] text-foreground/75 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SymbolBtn({ sym, tex, onInsert }: { sym: string; tex: string; onInsert: (t: string) => void }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(tex)}
      title={tex}
      className="h-6 w-6 rounded text-[13px] font-serif text-foreground/75 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"
    >
      {sym}
    </button>
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
          placeholder={shape.labelMathMode ? (isJa ? "LaTeX (例: V_1, \\vec{v}, \\alpha)" : "LaTeX (e.g. V_1, \\vec{v}, \\alpha)") : (isJa ? "テキスト..." : "Text...")}
          className={`w-full h-8 px-2.5 text-[12px] rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
            shape.labelMathMode
              ? "font-mono border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5 focus:border-blue-500/60"
              : "border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:border-blue-500/40"
          }`}
          spellCheck={!shape.labelMathMode}
        />
        {shape.labelMathMode && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold font-mono text-blue-500 select-none pointer-events-none">
            $ TEX
          </span>
        )}
      </div>

      {/* ── Mode toggles + hint ── */}
      <div className="flex items-center gap-1 flex-wrap">
        <Chip onClick={toggleMath} active={shape.labelMathMode} title={isJa ? "数式モード (LaTeX)" : "Math mode (LaTeX)"}>
          <span style={{ fontStyle: "italic" }}>𝑥</span>
          <span className="ml-1 text-[9px] font-sans font-semibold uppercase tracking-wide">
            {shape.labelMathMode ? "Math" : "Text"}
          </span>
        </Chip>

        {shape.labelMathMode && (
          <>
            <div className="w-px h-5 bg-foreground/[0.08] mx-0.5" />
            {QUICK_INSERTS.slice(0, 6).map((ins, i) => (
              <Chip key={i} onClick={() => smartInsert(ins)} title={isJa ? ins.tooltipJa : ins.tooltip}>
                {ins.label}
              </Chip>
            ))}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPalette(!showPalette)}
              title={isJa ? "記号パレット" : "Symbol palette"}
              className={`h-7 px-2 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-0.5 ${
                showPalette
                  ? "bg-blue-500 text-white"
                  : "bg-foreground/[0.04] hover:bg-foreground/[0.1] text-foreground/75"
              }`}
            >
              α β γ
              <ChevronDown size={10} className={`transition-transform ${showPalette ? "rotate-180" : ""}`} />
            </button>
          </>
        )}

        <div className="flex-1" />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowHint(!showHint)}
          title={isJa ? "構文ヒント" : "Syntax hints"}
          className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors ${
            showHint ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-foreground/30 hover:text-foreground/60"
          }`}
        >
          <Info size={11} />
        </button>
      </div>

      {/* ── Inline syntax hints (collapsible) ── */}
      {showHint && (
        <div className="text-[10px] leading-relaxed text-foreground/55 bg-foreground/[0.03] rounded-md px-2.5 py-2 border border-foreground/[0.05] space-y-0.5">
          <HintRow syntax="x_1"    meaning={isJa ? "下付き文字" : "Subscript"} />
          <HintRow syntax="x^2"    meaning={isJa ? "上付き文字" : "Superscript"} />
          <HintRow syntax="x_{12}" meaning={isJa ? "複数文字の下付き" : "Multi-char subscript — use braces"} />
          <HintRow syntax="\alpha" meaning={isJa ? "ギリシャ文字 (α)" : "Greek letter (α)"} />
          <HintRow syntax="\vec{v}" meaning={isJa ? "ベクトル" : "Vector with arrow"} />
          <HintRow syntax="\frac{a}{b}" meaning={isJa ? "分数" : "Fraction"} />
          <div className="pt-1 mt-1 border-t border-foreground/[0.06] text-[9px] text-foreground/35">
            {isJa ? "ボタンを押すと入力欄に自動で挿入されます" : "Click any button above — text is inserted at cursor position"}
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

function HintRow({ syntax, meaning }: { syntax: string; meaning: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-[10px] bg-foreground/[0.06] px-1.5 py-0.5 rounded text-foreground/80 whitespace-nowrap">
        {syntax}
      </code>
      <span className="text-foreground/50">→</span>
      <span className="text-foreground/70 flex-1">{meaning}</span>
    </div>
  );
}

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
