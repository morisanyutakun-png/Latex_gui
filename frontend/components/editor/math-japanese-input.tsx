"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MathRenderer } from "./math-editor";
import {
  parseJapanesemath,
  getJapaneseSuggestions,
  SPACING_PRESETS,
  LATEX_TRANSLATIONS,
  type SpacingPreset,
  type LatexTranslation,
} from "@/lib/math-japanese";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ══════════════════════════════════════════
// 日本語数式入力コンポーネント
// ══════════════════════════════════════════

interface JapaneseMathInputProps {
  onSubmit: (latex: string) => void;
  initialLatex?: string;
  className?: string;
}

export function JapaneseMathInput({ onSubmit, initialLatex = "", className = "" }: JapaneseMathInputProps) {
  const [japaneseText, setJapaneseText] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Derive preview latex from japanese text
  const previewLatex = useMemo(() => {
    if (japaneseText.trim()) {
      return parseJapanesemath(japaneseText);
    }
    return initialLatex;
  }, [japaneseText, initialLatex]);

  // Derive suggestions from japanese text
  const suggestions = useMemo(() => {
    return getJapaneseSuggestions(japaneseText);
  }, [japaneseText]);

  const acceptSuggestion = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      const words = japaneseText.split(/[\s　]+/);
      words[words.length - 1] = s.reading;
      setJapaneseText(words.join(" ") + " ");
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [suggestions, japaneseText]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "Tab") {
        e.preventDefault();
        acceptSuggestion(selectedIdx);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((p) => Math.min(p + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((p) => Math.max(p - 1, 0));
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (previewLatex.trim()) {
        onSubmit(previewLatex);
        setJapaneseText("");
      }
    }
  };

  // Auto-resize
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.max(36, inputRef.current.scrollHeight) + "px";
    }
  }, [japaneseText]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Japanese input */}
      <div className="relative">
        <div className="absolute left-2.5 top-2 text-[10px] font-medium text-emerald-500 select-none pointer-events-none z-10">
          日本語
        </div>
        <textarea
          ref={inputRef}
          value={japaneseText}
          onChange={(e) => { setJapaneseText(e.target.value); setSelectedIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder="例: 2分の1 たす ルート3  |  xの2乗 たす yの2乗 イコール rの2乗"
          className="w-full pl-12 pr-3 py-2 text-sm rounded-lg border border-emerald-200 dark:border-emerald-800 focus:ring-emerald-400 focus:ring-2 focus:outline-none bg-background resize-none overflow-hidden font-sans"
          rows={1}
        />

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {suggestions.map((s: { preview: string; display: string; category: string; reading: string; latex: string }, i: number) => (
              <button
                key={i}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === selectedIdx ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(i);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <div className="w-14 flex-shrink-0 flex justify-center overflow-hidden">
                  <MathRenderer latex={s.preview} displayMode={false} className="scale-[0.6] origin-center" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">{s.display}</span>
                  <span className="text-[9px] text-muted-foreground">{s.category}</span>
                </div>
                {i === selectedIdx && (
                  <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                    Tab
                  </kbd>
                )}
              </button>
            ))}
            <div className="px-3 py-1.5 bg-muted/30 border-t text-[9px] text-muted-foreground">
              <kbd className="px-1 rounded bg-muted font-mono">Tab</kbd> で選択
              <kbd className="px-1 rounded bg-muted font-mono">Enter</kbd> で確定
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      {previewLatex && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/50">
          <span className="text-[9px] text-violet-400 font-medium shrink-0">プレビュー</span>
          <div className="flex-1 flex justify-center overflow-auto">
            <MathRenderer latex={previewLatex} displayMode={false} />
          </div>
        </div>
      )}

      {/* Usage hints */}
      <div className="text-[9px] text-muted-foreground/60 leading-relaxed">
        💡 「<span className="text-emerald-600 font-medium">2分の1</span>」→ ½
        「<span className="text-emerald-600 font-medium">xの2乗</span>」→ x²
        「<span className="text-emerald-600 font-medium">ルート2</span>」→ √2
        「<span className="text-emerald-600 font-medium">アルファ たす ベータ</span>」→ α+β
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// スペーシングGUIコントロール
// ══════════════════════════════════════════

interface SpacingControlProps {
  onInsert: (latex: string) => void;
  className?: string;
}

export function SpacingControl({ onInsert, className = "" }: SpacingControlProps) {
  const [customPt, setCustomPt] = useState(5);

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-[10px] font-medium text-muted-foreground">数式内スペース調整</p>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        <TooltipProvider delayDuration={200}>
          {SPACING_PRESETS.map((preset: SpacingPreset) => (
            <Tooltip key={preset.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onInsert(preset.latex)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs"
                >
                  {/* Visual width indicator */}
                  <div className="h-3 bg-primary/30 rounded-sm" style={{ width: `${Math.max(2, Math.abs(preset.widthEm) * 16)}px` }} />
                  <span className="text-[10px] font-medium">{preset.name}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{preset.description}</p>
                <p className="font-mono text-muted-foreground text-[10px]">{preset.latex}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {/* Custom spacing slider */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0 w-16">カスタム:</span>
        <input
          type="range"
          min={-10}
          max={40}
          value={customPt}
          onChange={(e) => setCustomPt(Number(e.target.value))}
          className="flex-1 h-1.5 accent-primary"
        />
        <span className="text-[10px] font-mono w-10 text-right">{customPt}pt</span>
        <button
          onClick={() => onInsert(`\\hspace{${customPt}pt}`)}
          className="text-[10px] px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
        >
          挿入
        </button>
      </div>

      {/* Visual preview of the spacing */}
      <div className="flex items-center gap-0 px-3 py-2 rounded-lg bg-muted/30 border">
        <span className="text-xs">a</span>
        <div
          className="bg-primary/20 border border-primary/40 rounded-sm h-4"
          style={{ width: `${Math.max(1, customPt * 1.33)}px` }}
        />
        <span className="text-xs">b</span>
        <span className="ml-3 text-[9px] text-muted-foreground">
          ← {customPt}pt のスペース
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// LaTeX日本語訳リファレンス
// ══════════════════════════════════════════

export function LatexJapaneseReference({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("構造");
  const categories = Array.from(new Set(LATEX_TRANSLATIONS.map((t: LatexTranslation) => t.category))) as string[];

  return (
    <div className={`bg-background border rounded-xl shadow-sm ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-2 pt-2 border-b">
          <TabsList className="w-full h-7 bg-muted/50">
            {categories.map((cat: string) => (
              <TabsTrigger key={cat} value={cat} className="text-[10px] h-5 px-2">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ScrollArea className="h-44 p-2">
          {categories.map((cat: string) => (
            <TabsContent key={cat} value={cat} className="mt-0 space-y-1">
              {LATEX_TRANSLATIONS.filter((t: LatexTranslation) => t.category === cat).map((t: LatexTranslation, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="w-24 flex-shrink-0 flex justify-center overflow-hidden">
                    <MathRenderer
                      latex={t.latex.replace(/[AB]/g, "x").replace(/[N]/g, "n")}
                      displayMode={false}
                      className="scale-[0.65] origin-center"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t.japanese}</span>
                  </div>
                </div>
              ))}
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
