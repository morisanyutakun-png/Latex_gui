"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MathRenderer } from "./math-editor";
import {
  parseSmartMath,
  MATH_TOOLBAR,
  CHEAT_SHEET,
  type MathToolbarItem,
} from "@/lib/math-smart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ══════════════════════════════════════════
// Smart Math Input — 直感的数式エディタ
// ──
// キーボードだけで全ての数式が書ける。
// Excel/Python/電卓の要領で入力 → リアルタイムLaTeX変換
// ══════════════════════════════════════════

interface SmartMathInputProps {
  onSubmit: (latex: string) => void;
  initialLatex?: string;
  className?: string;
}

export function SmartMathInput({ onSubmit, initialLatex = "", className = "" }: SmartMathInputProps) {
  const [rawText, setRawText] = useState("");
  const [previewLatex, setPreviewLatex] = useState(initialLatex);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Real-time parse
  useEffect(() => {
    if (rawText.trim()) {
      const latex = parseSmartMath(rawText);
      setPreviewLatex(latex);
    } else {
      setPreviewLatex(initialLatex);
    }
  }, [rawText, initialLatex]);

  // Auto-resize
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.max(36, inputRef.current.scrollHeight) + "px";
    }
  }, [rawText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (previewLatex.trim()) {
        onSubmit(previewLatex);
        setRawText("");
      }
    }
  };

  const insertTemplate = useCallback((template: string) => {
    const ta = inputRef.current;
    if (!ta) {
      setRawText((prev) => prev + template);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = rawText.slice(0, start);
    const after = rawText.slice(end);
    const newText = before + template + after;
    setRawText(newText);

    // Place cursor inside parentheses if template ends with ()
    requestAnimationFrame(() => {
      ta.focus();
      if (template.endsWith("()") || template.endsWith("())")) {
        const curPos = start + template.length - 1;
        ta.setSelectionRange(curPos, curPos);
      } else {
        const curPos = start + template.length;
        ta.setSelectionRange(curPos, curPos);
      }
    });
  }, [rawText]);

  // Toolbar categories
  const toolbarCategories = [
    { id: "structure", label: "構造" },
    { id: "decoration", label: "装飾" },
    { id: "calculus", label: "微積分" },
    { id: "set", label: "記号" },
  ] as const;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ── Visual Toolbar ── */}
      <div className="space-y-1">
        <TooltipProvider delayDuration={150}>
          {toolbarCategories.map((cat) => {
            const items = MATH_TOOLBAR.filter((t) => t.category === cat.id);
            return (
              <div key={cat.id} className="flex items-center gap-1">
                <span className="text-[8px] text-muted-foreground/50 w-8 shrink-0 text-right font-medium select-none">{cat.label}</span>
                <div className="flex flex-wrap gap-0.5">
                  {items.map((item) => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => insertTemplate(item.template)}
                          className="group flex items-center justify-center h-7 min-w-[32px] px-1.5 rounded-md border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          <div className="scale-[0.55] origin-center pointer-events-none">
                            <MathRenderer latex={item.icon} displayMode={false} />
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-48">
                        <p className="font-semibold text-foreground">{item.description}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          入力: <span className="text-primary">{item.template}</span>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            );
          })}
        </TooltipProvider>
      </div>

      {/* ── Text Input ── */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="x^2 + y^2 = r^2  |  a/b  |  sqrt(x)  |  int(0,pi)  |  sum(i=1,n)"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none bg-background resize-none overflow-hidden font-mono"
          rows={1}
        />
      </div>

      {/* ── Live Preview ── */}
      {previewLatex && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/30 dark:border-violet-800/30">
          <div className="flex-1 flex justify-center overflow-auto py-1">
            <MathRenderer latex={previewLatex} displayMode={true} />
          </div>
        </div>
      )}

      {/* ── Cheat Sheet Toggle ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowCheatSheet(!showCheatSheet)}
          className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-1"
        >
          {showCheatSheet ? "▼" : "▶"} 入力ガイド
        </button>
        <div className="text-[9px] text-muted-foreground/40">
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[8px]">Enter</kbd> で確定
        </div>
      </div>

      {/* ── Cheat Sheet ── */}
      {showCheatSheet && (
        <CheatSheetPanel />
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Cheat Sheet Panel — 入力方法一覧
// ──────────────────────────────────────────

function CheatSheetPanel() {
  const categories = [...new Set(CHEAT_SHEET.map((e) => e.category))];

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <ScrollArea className="h-52">
        <div className="p-2 space-y-3">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1 px-1">{cat}</p>
              <div className="grid grid-cols-1 gap-px bg-border/30 rounded-md overflow-hidden">
                {CHEAT_SHEET.filter((e) => e.category === cat).map((entry, i) => (
                  <div key={i} className="flex items-center bg-background px-2 py-1.5 gap-3">
                    <code className="text-[11px] font-mono text-primary font-medium w-36 shrink-0">
                      {entry.input}
                    </code>
                    <div className="text-[10px] text-muted-foreground">→</div>
                    <div className="flex-1 flex justify-center overflow-hidden">
                      <div className="scale-[0.7] origin-center">
                        <MathRenderer latex={entry.output} displayMode={false} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ──────────────────────────────────────────
// Greek Letter Quick Picker
// ──────────────────────────────────────────

const GREEK_QUICK = [
  { name: "alpha", display: "α" }, { name: "beta", display: "β" }, { name: "gamma", display: "γ" },
  { name: "delta", display: "δ" }, { name: "epsilon", display: "ε" }, { name: "theta", display: "θ" },
  { name: "lambda", display: "λ" }, { name: "mu", display: "μ" }, { name: "pi", display: "π" },
  { name: "sigma", display: "σ" }, { name: "tau", display: "τ" }, { name: "phi", display: "φ" },
  { name: "omega", display: "ω" }, { name: "Gamma", display: "Γ" }, { name: "Delta", display: "Δ" },
  { name: "Sigma", display: "Σ" }, { name: "Omega", display: "Ω" },
];

export function GreekPicker({ onSelect }: { onSelect: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {GREEK_QUICK.map((g) => (
        <button
          key={g.name}
          onClick={() => onSelect(g.name)}
          className="h-7 w-7 flex items-center justify-center rounded text-sm hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/30"
          title={g.name}
        >
          {g.display}
        </button>
      ))}
    </div>
  );
}
