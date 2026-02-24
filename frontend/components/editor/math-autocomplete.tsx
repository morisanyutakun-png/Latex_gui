"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MathRenderer } from "./math-editor";

// ──── Snippet definitions ────
// User types shortcut → expands to LaTeX with cursor position
interface Snippet {
  trigger: string;         // what the user types
  latex: string;           // what gets inserted
  label: string;           // display label
  cursorOffset?: number;   // how many chars back from end to place cursor
  category?: string;
}

const SNIPPETS: Snippet[] = [
  // Fractions & roots
  { trigger: "//",   latex: "\\frac{$1}{$2}",           label: "分数",       category: "構造" },
  { trigger: "sq",   latex: "\\sqrt{$1}",                label: "平方根",     category: "構造" },
  { trigger: "nsq",  latex: "\\sqrt[$1]{$2}",            label: "n乗根",      category: "構造" },
  { trigger: "^",    latex: "^{$1}",                     label: "上付き",     category: "構造" },
  { trigger: "_",    latex: "_{$1}",                     label: "下付き",     category: "構造" },
  { trigger: "lr(",  latex: "\\left( $1 \\right)",       label: "括弧(大)",   category: "構造" },
  { trigger: "lr[",  latex: "\\left[ $1 \\right]",       label: "括弧[大]",   category: "構造" },
  { trigger: "lr|",  latex: "\\left| $1 \\right|",       label: "絶対値",     category: "構造" },
  { trigger: "abs",  latex: "\\left| $1 \\right|",       label: "絶対値",     category: "構造" },
  { trigger: "norm", latex: "\\left\\| $1 \\right\\|",   label: "ノルム",     category: "構造" },

  // Calculus
  { trigger: "sum",  latex: "\\sum_{$1}^{$2}",           label: "総和 Σ",     category: "微積" },
  { trigger: "prod", latex: "\\prod_{$1}^{$2}",          label: "総乗 Π",     category: "微積" },
  { trigger: "int",  latex: "\\int_{$1}^{$2}",           label: "積分",       category: "微積" },
  { trigger: "iint", latex: "\\iint_{$1}",               label: "二重積分",   category: "微積" },
  { trigger: "oint", latex: "\\oint_{$1}",               label: "周回積分",   category: "微積" },
  { trigger: "lim",  latex: "\\lim_{$1 \\to $2}",        label: "極限",       category: "微積" },
  { trigger: "dd",   latex: "\\frac{d}{d$1}",            label: "微分 d/dx",  category: "微積" },
  { trigger: "pp",   latex: "\\frac{\\partial}{\\partial $1}", label: "偏微分", category: "微積" },
  { trigger: "inf",  latex: "\\infty",                   label: "∞",          category: "微積" },

  // Decorations
  { trigger: "vec",  latex: "\\vec{$1}",                 label: "ベクトル",   category: "記号" },
  { trigger: "hat",  latex: "\\hat{$1}",                 label: "ハット",     category: "記号" },
  { trigger: "bar",  latex: "\\bar{$1}",                 label: "上線",       category: "記号" },
  { trigger: "dot",  latex: "\\dot{$1}",                 label: "ドット",     category: "記号" },
  { trigger: "ddot", latex: "\\ddot{$1}",                label: "二重ドット", category: "記号" },
  { trigger: "tild", latex: "\\tilde{$1}",               label: "チルダ",     category: "記号" },
  { trigger: "txt",  latex: "\\text{$1}",                label: "テキスト",   category: "記号" },
  { trigger: "bf",   latex: "\\mathbf{$1}",              label: "太字",       category: "記号" },
  { trigger: "bb",   latex: "\\mathbb{$1}",              label: "黒板太字",   category: "記号" },
  { trigger: "cal",  latex: "\\mathcal{$1}",             label: "筆記体",     category: "記号" },

  // Matrices
  { trigger: "pmat", latex: "\\begin{pmatrix} $1 & $2 \\\\\\ $3 & $4 \\end{pmatrix}", label: "2×2行列", category: "行列" },
  { trigger: "bmat", latex: "\\begin{bmatrix} $1 & $2 \\\\\\ $3 & $4 \\end{bmatrix}", label: "角括弧行列", category: "行列" },
  { trigger: "case", latex: "\\begin{cases} $1 & ($2) \\\\\\ $3 & ($4) \\end{cases}", label: "場合分け", category: "行列" },
  { trigger: "alig", latex: "\\begin{aligned} $1 &= $2 \\\\\\ &= $3 \\end{aligned}", label: "数式揃え", category: "行列" },

  // Greek (common)
  { trigger: "alp",  latex: "\\alpha",                   label: "α",          category: "ギリシャ" },
  { trigger: "bet",  latex: "\\beta",                    label: "β",          category: "ギリシャ" },
  { trigger: "gam",  latex: "\\gamma",                   label: "γ",          category: "ギリシャ" },
  { trigger: "del",  latex: "\\delta",                   label: "δ",          category: "ギリシャ" },
  { trigger: "eps",  latex: "\\epsilon",                 label: "ε",          category: "ギリシャ" },
  { trigger: "the",  latex: "\\theta",                   label: "θ",          category: "ギリシャ" },
  { trigger: "lam",  latex: "\\lambda",                  label: "λ",          category: "ギリシャ" },
  { trigger: "sig",  latex: "\\sigma",                   label: "σ",          category: "ギリシャ" },
  { trigger: "phi",  latex: "\\phi",                     label: "φ",          category: "ギリシャ" },
  { trigger: "ome",  latex: "\\omega",                   label: "ω",          category: "ギリシャ" },
  { trigger: "pi",   latex: "\\pi",                      label: "π",          category: "ギリシャ" },
  { trigger: "mu",   latex: "\\mu",                      label: "μ",          category: "ギリシャ" },
  { trigger: "tau",  latex: "\\tau",                     label: "τ",          category: "ギリシャ" },
  { trigger: "rho",  latex: "\\rho",                     label: "ρ",          category: "ギリシャ" },

  // Relations & operators
  { trigger: "neq",  latex: "\\neq",                     label: "≠",          category: "演算" },
  { trigger: "leq",  latex: "\\leq",                     label: "≤",          category: "演算" },
  { trigger: "geq",  latex: "\\geq",                     label: "≥",          category: "演算" },
  { trigger: "apx",  latex: "\\approx",                  label: "≈",          category: "演算" },
  { trigger: "eqv",  latex: "\\equiv",                   label: "≡",          category: "演算" },
  { trigger: "pm",   latex: "\\pm",                      label: "±",          category: "演算" },
  { trigger: "xx",   latex: "\\times",                   label: "×",          category: "演算" },
  { trigger: "cd",   latex: "\\cdot",                    label: "·",          category: "演算" },
  { trigger: "nab",  latex: "\\nabla",                   label: "∇",          category: "演算" },
  { trigger: "par",  latex: "\\partial",                 label: "∂",          category: "演算" },
  { trigger: "=>",   latex: "\\Rightarrow",              label: "⇒",          category: "演算" },
  { trigger: "<=>",  latex: "\\Leftrightarrow",          label: "⇔",          category: "演算" },
  { trigger: "->",   latex: "\\to",                      label: "→",          category: "演算" },
  { trigger: "fa",   latex: "\\forall",                  label: "∀",          category: "演算" },
  { trigger: "ex",   latex: "\\exists",                  label: "∃",          category: "演算" },
  { trigger: "inn",  latex: "\\in",                      label: "∈",          category: "演算" },
];

// ──── LaTeX command completions (triggered by \) ────

const LATEX_COMMANDS: { cmd: string; label: string }[] = [
  { cmd: "\\frac{}{}", label: "分数" },
  { cmd: "\\sqrt{}", label: "平方根" },
  { cmd: "\\sqrt[]{}", label: "n乗根" },
  { cmd: "\\sum_{i=1}^{n}", label: "総和" },
  { cmd: "\\prod_{i=1}^{n}", label: "総乗" },
  { cmd: "\\int_{}^{}", label: "積分" },
  { cmd: "\\lim_{x \\to }", label: "極限" },
  { cmd: "\\vec{}", label: "ベクトル" },
  { cmd: "\\hat{}", label: "ハット" },
  { cmd: "\\bar{}", label: "上線" },
  { cmd: "\\dot{}", label: "ドット" },
  { cmd: "\\tilde{}", label: "チルダ" },
  { cmd: "\\text{}", label: "テキスト" },
  { cmd: "\\mathbf{}", label: "太字" },
  { cmd: "\\mathbb{}", label: "黒板太字" },
  { cmd: "\\left( \\right)", label: "括弧(大)" },
  { cmd: "\\left[ \\right]", label: "括弧[大]" },
  { cmd: "\\left| \\right|", label: "絶対値" },
  { cmd: "\\begin{pmatrix}  \\end{pmatrix}", label: "丸括弧行列" },
  { cmd: "\\begin{bmatrix}  \\end{bmatrix}", label: "角括弧行列" },
  { cmd: "\\begin{cases}  \\end{cases}", label: "場合分け" },
  { cmd: "\\begin{aligned}  \\end{aligned}", label: "数式揃え" },
  { cmd: "\\alpha", label: "alpha α" },
  { cmd: "\\beta", label: "beta β" },
  { cmd: "\\gamma", label: "gamma γ" },
  { cmd: "\\delta", label: "delta δ" },
  { cmd: "\\epsilon", label: "epsilon ε" },
  { cmd: "\\theta", label: "theta θ" },
  { cmd: "\\lambda", label: "lambda λ" },
  { cmd: "\\mu", label: "mu μ" },
  { cmd: "\\pi", label: "pi π" },
  { cmd: "\\sigma", label: "sigma σ" },
  { cmd: "\\omega", label: "omega ω" },
  { cmd: "\\phi", label: "phi φ" },
  { cmd: "\\partial", label: "partial ∂" },
  { cmd: "\\nabla", label: "nabla ∇" },
  { cmd: "\\infty", label: "infinity ∞" },
  { cmd: "\\hbar", label: "hbar ℏ" },
  { cmd: "\\forall", label: "forall ∀" },
  { cmd: "\\exists", label: "exists ∃" },
  { cmd: "\\in", label: "in ∈" },
  { cmd: "\\notin", label: "notin ∉" },
  { cmd: "\\subset", label: "subset ⊂" },
  { cmd: "\\cup", label: "cup ∪" },
  { cmd: "\\cap", label: "cap ∩" },
  { cmd: "\\times", label: "times ×" },
  { cmd: "\\cdot", label: "cdot ·" },
  { cmd: "\\pm", label: "pm ±" },
  { cmd: "\\neq", label: "neq ≠" },
  { cmd: "\\leq", label: "leq ≤" },
  { cmd: "\\geq", label: "geq ≥" },
  { cmd: "\\approx", label: "approx ≈" },
  { cmd: "\\equiv", label: "equiv ≡" },
  { cmd: "\\Rightarrow", label: "⇒" },
  { cmd: "\\Leftrightarrow", label: "⇔" },
  { cmd: "\\to", label: "→" },
];

// ──── Suggestion item type ────

interface Suggestion {
  display: string;       // shown text
  insertText: string;    // what gets inserted
  preview: string;       // LaTeX for KaTeX preview
  cursorPlaceholder?: boolean; // has $1 etc
}

// ──── Process snippet template ($1, $2 etc) ────

function processSnippet(latex: string): { text: string; cursorPos: number } {
  // Replace $1 with empty string, set cursor there
  const firstPlaceholder = latex.indexOf("$1");
  const cleaned = latex.replace(/\$\d/g, "");
  const cursorPos = firstPlaceholder >= 0 ? firstPlaceholder : cleaned.length;
  return { text: cleaned, cursorPos };
}

// ──── The Main Component ────

interface MathAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

export function MathAutocompleteInput({
  value,
  onChange,
  placeholder,
  className = "",
  onFocus,
}: MathAutocompleteInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [triggerPos, setTriggerPos] = useState<number | null>(null);
  const [triggerType, setTriggerType] = useState<"snippet" | "command" | null>(null);

  // Find matching suggestions based on current input
  const updateSuggestions = useCallback((text: string, cursorPos: number) => {
    // Check for backslash command completion
    const textBeforeCursor = text.slice(0, cursorPos);
    const backslashMatch = textBeforeCursor.match(/\\([a-zA-Z]*)$/);

    if (backslashMatch) {
      const partial = backslashMatch[1].toLowerCase();
      if (partial.length > 0) {
        const matches = LATEX_COMMANDS.filter(
          (c) => c.cmd.slice(1).toLowerCase().startsWith(partial) || c.label.toLowerCase().includes(partial)
        ).slice(0, 8);

        if (matches.length > 0) {
          setSuggestions(
            matches.map((m) => ({
              display: `${m.label}`,
              insertText: m.cmd,
              preview: m.cmd.replace(/\{\}/g, "{\\square}"),
            }))
          );
          setTriggerPos(backslashMatch.index!);
          setTriggerType("command");
          setSelectedIdx(0);
          return;
        }
      }
    }

    // Check for snippet triggers (word before cursor)
    const snippetMatch = textBeforeCursor.match(/(?:^|[^a-zA-Z\\])([a-zA-Z/=<>_^]{1,5})$/);
    if (snippetMatch) {
      const partial = snippetMatch[1];
      const matches = SNIPPETS.filter(
        (s) => s.trigger.startsWith(partial) && s.trigger !== partial
      ).slice(0, 6);

      // Also check for exact match (show as first item for Tab expansion)
      const exact = SNIPPETS.find((s) => s.trigger === partial);

      if (exact || matches.length > 0) {
        const items: Suggestion[] = [];
        if (exact) {
          const preview = exact.latex.replace(/\$\d/g, "\\square");
          items.push({
            display: `${exact.trigger} → ${exact.label}`,
            insertText: exact.latex,
            preview,
            cursorPlaceholder: exact.latex.includes("$1"),
          });
        }
        for (const m of matches) {
          if (m === exact) continue;
          const preview = m.latex.replace(/\$\d/g, "\\square");
          items.push({
            display: `${m.trigger} → ${m.label}`,
            insertText: m.latex,
            preview,
            cursorPlaceholder: m.latex.includes("$1"),
          });
        }
        setSuggestions(items);
        setTriggerPos(snippetMatch.index! + (snippetMatch[0].length - snippetMatch[1].length));
        setTriggerType("snippet");
        setSelectedIdx(0);
        return;
      }
    }

    // No matches
    setSuggestions([]);
    setTriggerPos(null);
    setTriggerType(null);
  }, []);

  const acceptSuggestion = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s || triggerPos === null || !inputRef.current) return;

      const cursor = inputRef.current.selectionStart ?? value.length;
      const before = value.slice(0, triggerPos);
      const after = value.slice(cursor);

      let insertText = s.insertText;
      let newCursorPos: number;

      if (s.cursorPlaceholder) {
        const { text, cursorPos } = processSnippet(insertText);
        insertText = text;
        newCursorPos = triggerPos + cursorPos;
      } else if (triggerType === "command") {
        // For \command completions, find first {} and put cursor inside
        const bracePos = insertText.indexOf("{}");
        if (bracePos >= 0) {
          newCursorPos = triggerPos + bracePos + 1;
        } else {
          newCursorPos = triggerPos + insertText.length;
        }
      } else {
        newCursorPos = triggerPos + insertText.length;
      }

      const newValue = before + insertText + after;
      onChange(newValue);

      setSuggestions([]);
      setTriggerPos(null);

      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [suggestions, triggerPos, triggerType, value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      acceptSuggestion(selectedIdx);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setTriggerPos(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    onChange(newValue);

    // Debounce suggestions slightly
    requestAnimationFrame(() => {
      updateSuggestions(newValue, cursorPos);
    });
  };

  const handleClick = () => {
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart ?? value.length;
      updateSuggestions(value, cursorPos);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.max(36, inputRef.current.scrollHeight) + "px";
    }
  }, [value]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`w-full font-mono text-sm resize-none overflow-hidden bg-background rounded-lg border border-violet-200 dark:border-violet-800 focus:ring-violet-400 focus:ring-2 focus:outline-none px-3 py-2 ${className}`}
        rows={1}
      />

      {/* Suggestion dropdown */}
      {suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                i === selectedIdx
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                acceptSuggestion(i);
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              {/* Mini KaTeX preview */}
              <div className="w-16 flex-shrink-0 flex justify-center overflow-hidden">
                <MathRenderer latex={s.preview} displayMode={false} className="scale-[0.65] origin-center" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{s.display}</span>
              </div>
              {i === selectedIdx && (
                <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                  Tab
                </kbd>
              )}
            </button>
          ))}
          <div className="px-3 py-1.5 bg-muted/30 border-t text-[9px] text-muted-foreground flex items-center gap-2">
            <kbd className="px-1 rounded bg-muted font-mono">Tab</kbd> で確定
            <kbd className="px-1 rounded bg-muted font-mono">↑↓</kbd> で選択
            <kbd className="px-1 rounded bg-muted font-mono">Esc</kbd> で閉じる
          </div>
        </div>
      )}
    </div>
  );
}

// ──── Shortcut Reference (shown below input) ────

export function SnippetReference({ className = "" }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const categories = [...new Set(SNIPPETS.map((s) => s.category))];

  return (
    <div className={`text-[10px] ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>ショートカット一覧</span>
        <span className="text-muted-foreground/50">（例: // → 分数, sum → 総和, alp → α）</span>
      </button>

      {expanded && (
        <div className="mt-2 grid gap-2 p-3 rounded-lg bg-muted/30 border animate-in fade-in slide-in-from-top-1 duration-150">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="font-semibold text-[10px] text-foreground/70 mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1">
                {SNIPPETS.filter((s) => s.category === cat).map((s) => (
                  <span
                    key={s.trigger}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border border-border/50"
                  >
                    <kbd className="font-mono text-primary font-bold">{s.trigger}</kbd>
                    <span className="text-muted-foreground">→</span>
                    <span>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
