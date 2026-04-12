"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MathRenderer } from "./math-editor";
import { useI18n } from "@/lib/i18n";
import {
  Check,
  Sparkles,
  Search,
  ChevronRight,
  BookOpen,
  Sigma,
  Zap,
  X,
} from "lucide-react";

interface EnglishMathInputProps {
  initialLatex?: string;
  onApply: (latex: string) => void;
}

// ─── Quick symbols ─────────────────────────────────────────────
type SymbolEntry = { label: string; latex: string; desc: string };

const QUICK_SYMBOLS: SymbolEntry[] = [
  { label: "α", latex: "\\alpha", desc: "Alpha" },
  { label: "β", latex: "\\beta", desc: "Beta" },
  { label: "γ", latex: "\\gamma", desc: "Gamma" },
  { label: "θ", latex: "\\theta", desc: "Theta" },
  { label: "λ", latex: "\\lambda", desc: "Lambda" },
  { label: "μ", latex: "\\mu", desc: "Mu" },
  { label: "π", latex: "\\pi", desc: "Pi" },
  { label: "σ", latex: "\\sigma", desc: "Sigma" },
  { label: "φ", latex: "\\phi", desc: "Phi" },
  { label: "ω", latex: "\\omega", desc: "Omega" },
  { label: "Σ", latex: "\\Sigma", desc: "Capital sigma" },
  { label: "Π", latex: "\\Pi", desc: "Capital pi" },
  { label: "Δ", latex: "\\Delta", desc: "Capital delta" },
  { label: "∞", latex: "\\infty", desc: "Infinity" },
  { label: "∂", latex: "\\partial", desc: "Partial" },
  { label: "∇", latex: "\\nabla", desc: "Nabla" },
  { label: "∫", latex: "\\int", desc: "Integral" },
  { label: "∮", latex: "\\oint", desc: "Contour integral" },
  { label: "∑", latex: "\\sum", desc: "Sum" },
  { label: "∏", latex: "\\prod", desc: "Product" },
  { label: "√", latex: "\\sqrt{}", desc: "Square root" },
  { label: "≤", latex: "\\le", desc: "Less or equal" },
  { label: "≥", latex: "\\ge", desc: "Greater or equal" },
  { label: "≠", latex: "\\ne", desc: "Not equal" },
  { label: "≈", latex: "\\approx", desc: "Approximately" },
  { label: "±", latex: "\\pm", desc: "Plus minus" },
  { label: "×", latex: "\\times", desc: "Multiply" },
  { label: "÷", latex: "\\div", desc: "Divide" },
  { label: "→", latex: "\\to", desc: "To" },
  { label: "⇒", latex: "\\Rightarrow", desc: "Implies" },
  { label: "∈", latex: "\\in", desc: "Element of" },
  { label: "⊂", latex: "\\subset", desc: "Subset" },
];

// ─── Snippet hints (shown above input as cards) ───────────────
type Hint = {
  trigger: string;
  latex: string;
  kind: "structure" | "calculus" | "function" | "logic";
  desc: string;
};

const HINTS: Hint[] = [
  { trigger: "//", latex: "\\frac{a}{b}", kind: "structure", desc: "Fraction" },
  { trigger: "sq", latex: "\\sqrt{x}", kind: "structure", desc: "Square root" },
  { trigger: "x^2", latex: "x^{2}", kind: "structure", desc: "Superscript" },
  { trigger: "x_i", latex: "x_{i}", kind: "structure", desc: "Subscript" },
  { trigger: "sum", latex: "\\sum_{i=1}^{n}", kind: "calculus", desc: "Sum" },
  { trigger: "int", latex: "\\int_{a}^{b}", kind: "calculus", desc: "Integral" },
  { trigger: "lim", latex: "\\lim_{x \\to 0}", kind: "calculus", desc: "Limit" },
  { trigger: "frac", latex: "\\frac{d}{dx}", kind: "calculus", desc: "Derivative" },
  { trigger: "sin", latex: "\\sin(x)", kind: "function", desc: "Sine" },
  { trigger: "log", latex: "\\log(x)", kind: "function", desc: "Logarithm" },
  { trigger: "exp", latex: "e^{x}", kind: "function", desc: "Exponential" },
  { trigger: "vec", latex: "\\vec{v}", kind: "function", desc: "Vector" },
];

const HINT_KIND_STYLES: Record<Hint["kind"], { badge: string; dot: string; label: string }> = {
  structure: { badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-400", label: "structure" },
  calculus: { badge: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300", dot: "bg-violet-400", label: "calculus" },
  function: { badge: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300", dot: "bg-sky-400", label: "function" },
  logic: { badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-400", label: "logic" },
};

// ─── Common formulas ──────────────────────────────────────────
type FormulaTpl = { name: string; latex: string; category: string };

const FORMULA_LIBRARY: FormulaTpl[] = [
  // Algebra
  { name: "Quadratic formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", category: "Algebra" },
  { name: "Binomial expansion", latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^{k}", category: "Algebra" },
  { name: "Arithmetic sum", latex: "S_n = \\frac{n(a_1 + a_n)}{2}", category: "Algebra" },
  { name: "Geometric sum", latex: "S_n = a_1 \\cdot \\frac{1 - r^n}{1 - r}", category: "Algebra" },
  // Calculus
  { name: "Derivative definition", latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}", category: "Calculus" },
  { name: "Fundamental theorem", latex: "\\int_{a}^{b} f'(x)\\, dx = f(b) - f(a)", category: "Calculus" },
  { name: "Taylor series", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n", category: "Calculus" },
  { name: "Integration by parts", latex: "\\int u\\, dv = uv - \\int v\\, du", category: "Calculus" },
  // Trigonometry
  { name: "Pythagorean identity", latex: "\\sin^2 \\theta + \\cos^2 \\theta = 1", category: "Trigonometry" },
  { name: "Law of cosines", latex: "c^2 = a^2 + b^2 - 2ab \\cos C", category: "Trigonometry" },
  { name: "Law of sines", latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}", category: "Trigonometry" },
  { name: "Euler's formula", latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta", category: "Trigonometry" },
  // Statistics
  { name: "Mean", latex: "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i", category: "Statistics" },
  { name: "Variance", latex: "\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^{n} (x_i - \\bar{x})^2", category: "Statistics" },
  { name: "Normal distribution", latex: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", category: "Statistics" },
  { name: "Bayes' theorem", latex: "P(A|B) = \\frac{P(B|A) P(A)}{P(B)}", category: "Statistics" },
  // Linear algebra
  { name: "2×2 determinant", latex: "\\det \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc", category: "Linear algebra" },
  { name: "Dot product", latex: "\\vec{a} \\cdot \\vec{b} = \\sum_{i=1}^{n} a_i b_i", category: "Linear algebra" },
  { name: "Identity matrix", latex: "I_n = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}", category: "Linear algebra" },
  // Physics
  { name: "Newton's second law", latex: "\\vec{F} = m\\vec{a}", category: "Physics" },
  { name: "Kinetic energy", latex: "E_k = \\tfrac{1}{2} m v^2", category: "Physics" },
  { name: "Schrödinger eq.", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi", category: "Physics" },
];

const CATEGORIES = ["All", "Algebra", "Calculus", "Trigonometry", "Statistics", "Linear algebra", "Physics"];

/**
 * English-first math input — direct LaTeX editor with live KaTeX preview,
 * Greek/operator palette, hint cards, and a searchable formula library.
 *
 * Used when the UI locale is English. Japanese users still get the
 * JapaneseMathInput which converts Japanese phrases to LaTeX.
 */
export function EnglishMathInput({ initialLatex = "", onApply }: EnglishMathInputProps) {
  const { t } = useI18n();
  const [latex, setLatex] = useState(initialLatex);
  const [previewError, setPreviewError] = useState(false);
  const [browserCat, setBrowserCat] = useState<string>("All");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLatex(initialLatex);
  }, [initialLatex]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(40, Math.min(ta.scrollHeight, 160)) + "px";
  }, [latex]);

  const handleApply = () => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    onApply(trimmed);
  };

  const insertAtCursor = (snippet: string, cursorOffset: number | null = null) => {
    const ta = inputRef.current;
    if (!ta) {
      setLatex((cur) => cur + snippet);
      return;
    }
    const start = ta.selectionStart ?? latex.length;
    const end = ta.selectionEnd ?? latex.length;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = cursorOffset != null
        ? start + snippet.length + cursorOffset
        : start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleSymbolClick = (sym: SymbolEntry) => {
    // Place cursor between {} for \sqrt{}
    const cursorOffset = sym.latex.endsWith("{}") ? -1 : 0;
    insertAtCursor(sym.latex, cursorOffset);
  };

  const handleHintClick = (h: Hint) => {
    insertAtCursor(h.latex);
  };

  const handleFormulaClick = (f: FormulaTpl) => {
    setLatex(f.latex);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleApply();
    }
  };

  const filteredFormulas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FORMULA_LIBRARY.filter((f) => {
      if (browserCat !== "All" && f.category !== browserCat) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.latex.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [browserCat, search]);

  return (
    <div className="space-y-3">
      {/* ── Live preview card ── */}
      <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/50 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-fuchsia-950/10 px-4 py-4 min-h-[72px] flex items-center justify-center overflow-auto">
        {latex.trim() ? (
          <div onError={() => setPreviewError(true)}>
            <MathRenderer latex={latex} displayMode={true} />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Sigma className="h-3.5 w-3.5" />
            <span>{t("math.en.preview_empty")}</span>
          </div>
        )}
      </div>

      {/* ── Direct LaTeX input ── */}
      <div className="relative">
        <div className="absolute top-2 left-3 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-violet-500/60 pointer-events-none">
          <Zap className="h-2.5 w-2.5" />
          <span>LaTeX</span>
        </div>
        <textarea
          ref={inputRef}
          value={latex}
          onChange={(e) => {
            setLatex(e.target.value);
            setPreviewError(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("math.en.input_placeholder")}
          className="w-full min-h-[72px] max-h-[160px] pt-6 pb-2 px-3 text-[13px] font-mono resize-none rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-background focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all"
        />
      </div>

      {/* ── Quick symbols palette ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {t("math.en.symbols")}
          </span>
          <span className="text-[9px] text-muted-foreground/40">{t("math.en.symbols.hint")}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {QUICK_SYMBOLS.map((sym) => (
            <button
              key={sym.label}
              type="button"
              onClick={() => handleSymbolClick(sym)}
              title={sym.desc}
              className="h-7 min-w-[28px] px-1.5 rounded-md text-[13px] font-medium border border-border/40 bg-background hover:border-violet-400/60 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
            >
              {sym.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Snippet hints ── */}
      <details className="group" open>
        <summary className="flex items-center gap-1.5 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-foreground transition-colors select-none">
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          <Sparkles className="h-3 w-3" />
          {t("math.en.hints")}
          <span className="ml-1 normal-case font-normal text-muted-foreground/40 text-[9px]">
            {t("math.en.hints.sub")}
          </span>
        </summary>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {HINTS.map((h) => {
            const style = HINT_KIND_STYLES[h.kind];
            return (
              <button
                key={h.trigger}
                type="button"
                onClick={() => handleHintClick(h)}
                className="group/item flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/30 bg-background hover:border-violet-400/40 hover:bg-violet-50/40 dark:hover:bg-violet-500/5 transition-all text-left"
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
                <code className="text-[10px] font-mono text-foreground/70 shrink-0">{h.trigger}</code>
                <span className="text-foreground/30 text-[10px] shrink-0">→</span>
                <span className="text-[11px] text-foreground/70 truncate flex-1">{h.desc}</span>
              </button>
            );
          })}
        </div>
      </details>

      {/* ── Formula library ── */}
      <details className="group">
        <summary className="flex items-center gap-1.5 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-foreground transition-colors select-none">
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          <BookOpen className="h-3 w-3" />
          {t("math.en.library")}
          <span className="ml-1 normal-case font-normal text-muted-foreground/40 text-[9px]">
            {t("math.en.library.sub")}
          </span>
        </summary>

        <div className="mt-1.5 rounded-xl border border-border/40 bg-background overflow-hidden">
          {/* Search + category filter */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 bg-muted/20">
            <Search className="h-3 w-3 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("math.en.library.search")}
              className="flex-1 h-6 bg-transparent text-[11px] focus:outline-none placeholder:text-muted-foreground/40"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="px-2 py-1.5 border-b border-border/20 overflow-x-auto scrollbar-none">
            <div className="flex gap-1 min-w-max">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setBrowserCat(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                    browserCat === cat
                      ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Formula list */}
          <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-1">
            {filteredFormulas.length === 0 ? (
              <div className="text-center py-4 text-[11px] text-muted-foreground/50">
                {t("math.en.library.empty")}
              </div>
            ) : (
              filteredFormulas.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => handleFormulaClick(f)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-violet-50/40 dark:hover:bg-violet-500/5 transition-colors text-left group/f"
                >
                  <div className="w-20 shrink-0 overflow-hidden flex justify-center">
                    <div className="scale-[0.72] origin-center">
                      <MathRenderer latex={f.latex} displayMode={false} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-foreground/80 truncate">{f.name}</div>
                    <div className="text-[9px] text-muted-foreground/50">{f.category}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </details>

      {/* ── Footer: hint + apply ── */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground/50">
          <kbd className="px-1 rounded bg-muted font-mono text-[9px]">⌘/Ctrl</kbd>
          <span> + </span>
          <kbd className="px-1 rounded bg-muted font-mono text-[9px]">Enter</kbd>
          <span> {t("math.en.apply.hint")}</span>
        </span>
        <button
          type="button"
          onClick={handleApply}
          disabled={!latex.trim() || previewError}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium shadow-md shadow-violet-500/20"
        >
          <Check className="h-3.5 w-3.5" />
          {t("doc.editor.math.insert")}
        </button>
      </div>
    </div>
  );
}
