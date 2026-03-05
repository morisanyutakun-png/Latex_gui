"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MathRenderer } from "./math-editor";
import {
  parseJapanesemath,
  getJapaneseSuggestions,
  MATH_DICTIONARY,
  SPACING_PRESETS,
  LATEX_TRANSLATIONS,
  normalizeForMatch,
  type SpacingPreset,
  type LatexTranslation,
  type MathDictEntry,
} from "@/lib/math-japanese";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, BookOpen, ChevronRight, ChevronDown, Lightbulb, ArrowRight, Clock, Star, Keyboard, Zap, X, Hash } from "lucide-react";
import { FORMULA_TEMPLATES, type FormulaTemplate } from "./math-dictionary";

// ══════════════════════════════════════════
// 統合数式入力コンポーネント v3
// ─ LaTeX を完全に隠蔽、日本語のみで数式を書ける体験
// ─ 辞書 + 予測変換 + 公式検索 を 1つの入力欄に統合
// ══════════════════════════════════════════

// ── 変換ヒントデータ ──
const CONVERSION_HINTS = [
  { input: "a/b", output: "\\frac{a}{b}", label: "分数（/記法）" },
  { input: "(a+b)/(c+d)", output: "\\frac{a+b}{c+d}", label: "括弧分数" },
  { input: "2分の1", output: "\\frac{1}{2}", label: "分数（日本語）" },
  { input: "xの2乗", output: "x^{2}", label: "累乗" },
  { input: "ルート2", output: "\\sqrt{2}", label: "平方根" },
  { input: "sin(x)", output: "\\sin\\left(x\\right)", label: "三角関数" },
  { input: "α (直接入力)", output: "\\alpha", label: "ギリシャ文字" },
  { input: "xは0より大きい", output: "x > 0", label: "自然言語" },
  { input: "R_2分のV", output: "\\frac{V}{R_{2}}", label: "複合分数" },
  { input: "xで微分", output: "\\frac{d}{dx}", label: "微分" },
  { input: "0からπまで積分", output: "\\int_{0}^{\\pi}", label: "定積分" },
  { input: "i=1からnまで総和", output: "\\sum_{i=1}^{n}", label: "総和" },
  { input: "->", output: "\\to", label: "矢印" },
  { input: "解の公式", output: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", label: "公式検索" },
];

// ── よく使う記号（クイックアクセス）── 日本語読みで挿入 ──
const QUICK_SYMBOLS = [
  { label: "α", reading: "アルファ", desc: "アルファ" },
  { label: "β", reading: "ベータ", desc: "ベータ" },
  { label: "θ", reading: "シータ", desc: "シータ" },
  { label: "π", reading: "パイ", desc: "パイ" },
  { label: "Σ", reading: "シグマ", desc: "総和記号" },
  { label: "∫", reading: "積分", desc: "積分記号" },
  { label: "√", reading: "ルート", desc: "平方根" },
  { label: "∞", reading: "無限大", desc: "無限大" },
  { label: "→", reading: "右矢印", desc: "右矢印" },
  { label: "×", reading: "かける", desc: "掛け算" },
  { label: "≤", reading: "小なりイコール", desc: "以下" },
  { label: "≥", reading: "大なりイコール", desc: "以上" },
  { label: "≠", reading: "ノットイコール", desc: "等しくない" },
  { label: "±", reading: "プラスマイナス", desc: "プラスマイナス" },
  { label: "∂", reading: "偏微分", desc: "偏微分" },
  { label: "∇", reading: "ナブラ", desc: "ナブラ" },
];

// ── カテゴリアイコンマッピング ──
const CATEGORY_ICONS: Record<string, string> = {
  "ギリシャ文字": "αβ",
  "演算": "±×",
  "関係": "≤≥",
  "構造": "分数",
  "括弧": "()",
  "微積分": "∫∂",
  "特殊": "∞∀",
  "集合": "∪∩",
  "関数": "sin",
  "線形代数": "行列",
  "確率統計": "P()",
  "環境": "{ }",
  "高校数学": "高校",
  "三角関数": "sin",
  "数列": "aₙ",
  "指数対数": "logₑ",
  "ベクトル": "→",
  "微分公式": "d/dx",
  "積分公式": "∫dx",
  "多変数解析": "∇²",
  "微分方程式": "ODE",
  "複素数": "ℂ",
  "力学": "F=ma",
  "波動": "〜",
  "電磁気学": "E⃗B⃗",
  "熱力学": "PV",
  "光学": "λ",
  "量子力学": "ℏ",
  "相対論": "c²",
  "行列": "[  ]",
  "高校公式": "公式",
  "力学公式": "力学",
  "電磁気公式": "電磁",
  "熱力学公式": "熱力",
  "量子・相対論": "量子",
  "解析": "解析",
  "工学": "工学",
};

interface JapaneseMathInputProps {
  onApply: (latex: string, sourceText: string) => void;
  initialSourceText?: string;
  className?: string;
}

/** 統合候補の型 */
interface UnifiedSuggestion {
  type: "parse" | "dict" | "formula";
  display: string;
  latex: string;
  preview: string;
  category: string;
  reading?: string;
  score: number;
  inputHint?: string;
}

// ── 使用履歴管理 ──
const HISTORY_KEY = "math-input-history";
const MAX_HISTORY = 20;

function getHistory(): { latex: string; display: string; timestamp: number }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
}

function addToHistory(latex: string, display: string) {
  if (typeof window === "undefined") return;
  try {
    const history = getHistory().filter(h => h.latex !== latex);
    history.unshift({ latex, display, timestamp: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export function JapaneseMathInput({ onApply, initialSourceText = "", className = "" }: JapaneseMathInputProps) {
  const [inputText, setInputText] = useState(initialSourceText);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [browserCategory, setBrowserCategory] = useState("すべて");
  const [spacings, setSpacings] = useState<string[]>([]);
  const [overrideLatex, setOverrideLatex] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(!initialSourceText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── リアルタイム変換結果（内部のみ、ユーザには見せない） ──
  const baseLatex = useMemo(() => {
    if (overrideLatex) return overrideLatex;
    if (inputText.trim()) return parseJapanesemath(inputText);
    return "";
  }, [inputText, overrideLatex]);

  const currentLatex = useMemo(() => {
    if (!baseLatex) return "";
    return spacings.length === 0 ? baseLatex : baseLatex + " " + spacings.join(" ");
  }, [baseLatex, spacings]);

  // ── 反映ハンドラ ──
  const handleApply = useCallback(() => {
    if (currentLatex.trim()) {
      onApply(currentLatex, inputText);
      addToHistory(currentLatex, inputText);
      setSpacings([]);
      setOverrideLatex(null);
      setShowHints(false);
    }
  }, [currentLatex, inputText, onApply]);

  const addSpacing = useCallback((spacingLatex: string) => {
    setSpacings(prev => [...prev, spacingLatex]);
  }, []);

  // ── 統合候補生成 ──
  const suggestions = useMemo((): UnifiedSuggestion[] => {
    if (!inputText.trim()) return [];
    const results: UnifiedSuggestion[] = [];
    const seen = new Set<string>();
    const q = inputText.trim().toLowerCase();
    const normQ = normalizeForMatch(inputText.trim());

    // 1. パーサーベースの予測変換
    const jpSuggestions = getJapaneseSuggestions(inputText);
    for (const s of jpSuggestions) {
      const key = s.latex;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          type: "parse",
          display: s.reading,
          latex: s.latex,
          preview: s.preview,
          category: s.category,
          reading: s.reading,
          score: 100,
          inputHint: s.reading,
        });
      }
    }

    // 2. 辞書全文検索
    for (const entry of MATH_DICTIONARY) {
      const key = entry.latex;
      if (seen.has(key)) continue;
      const normR = normalizeForMatch(entry.reading);
      const latexLower = entry.latex.toLowerCase();

      let score = 0;
      if (normR.startsWith(normQ)) score = 90;
      else if (normR.includes(normQ)) score = 60;
      else if (entry.description.toLowerCase().includes(q)) score = 40;
      else if (latexLower.includes(q) || latexLower.includes(normQ)) score = 30;
      else if (entry.category.toLowerCase().includes(q)) score = 20;
      else {
        for (const alias of entry.aliases) {
          const normA = normalizeForMatch(alias);
          if (normA.startsWith(normQ)) { score = 85; break; }
          if (normA.includes(normQ)) { score = 50; break; }
        }
      }

      if (score > 0) {
        seen.add(key);
        const preview = entry.latex.replace(/\{[AB]\}/g, "").replace(/\{N\}/g, "");
        results.push({
          type: "dict",
          display: entry.reading,
          latex: entry.kind === "binary" || entry.kind === "unary"
            ? entry.latex.replace(/\{[A-Z]\}/g, "").replace(/_\s*\^/g, "").trim()
            : entry.latex,
          preview,
          category: entry.category,
          score,
          inputHint: entry.example?.input,
        });
      }
    }

    // 3. 公式テンプレート検索
    for (const f of FORMULA_TEMPLATES) {
      const key = f.latex;
      if (seen.has(key)) continue;

      let score = 0;
      const normJp = normalizeForMatch(f.japanese);
      if (f.label.toLowerCase().includes(q)) score = 70;
      else if (normJp.includes(normQ)) score = 65;
      else if (f.category.toLowerCase().includes(q)) score = 15;

      if (score > 0) {
        seen.add(key);
        results.push({
          type: "formula",
          display: f.label,
          latex: f.latex,
          preview: f.latex,
          category: f.category,
          score,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 15);
  }, [inputText]);

  // ── 候補選択ハンドラ ──
  const acceptSuggestion = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      if (s.reading) {
        const words = inputText.split(/[\s　]+/);
        words[words.length - 1] = s.reading;
        setInputText(words.join(" ") + " ");
        setOverrideLatex(null);
      } else {
        // 公式テンプレート: 日本語名を入力欄に表示し、内部でLaTeXを保持
        setInputText(s.display);
        setOverrideLatex(s.latex);
      }
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [suggestions, inputText]
  );

  // ── キーボード操作（IME風：スペースで変換確定） ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === " ") {
        // スペースキーで候補を確定（日本語IME風）
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
      handleApply();
    }
  };

  // ── Auto-resize ──
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.max(40, inputRef.current.scrollHeight) + "px";
    }
  }, [inputText]);

  // ── ブラウザ用カテゴリグループ ──
  type BrowserItem = { kind: "dict"; entry: MathDictEntry } | { kind: "formula"; entry: FormulaTemplate };

  const groupedBrowserItems = useMemo(() => {
    const allItems: BrowserItem[] = [
      ...MATH_DICTIONARY.map((e) => ({ kind: "dict" as const, entry: e })),
      ...FORMULA_TEMPLATES.map((f) => ({ kind: "formula" as const, entry: f })),
    ];

    const groups = new Map<string, BrowserItem[]>();
    for (const item of allItems) {
      const cat = item.kind === "dict" ? item.entry.category : item.entry.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }

    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  }, []);

  // ── フィルタ済みブラウザ用カテゴリグループ ──
  const filteredGroups = useMemo(() => {
    const filterText = inputText.trim();
    if (!filterText || !browserCategory) return groupedBrowserItems;

    // browserCategoryが「すべて」以外ならカテゴリでフィルタ
    let groups = groupedBrowserItems;
    if (browserCategory !== "すべて") {
      groups = groups.filter(g => g.category === browserCategory);
    }
    return groups;
  }, [groupedBrowserItems, browserCategory, inputText]);

  // ── 辞書アイテム挿入 → 日本語名を入力欄に表示 ──
  const handleBrowserInsert = useCallback((item: BrowserItem) => {
    let latex: string;
    let displayName: string;
    if (item.kind === "dict") {
      const entry = item.entry;
      latex = (entry.kind === "binary" || entry.kind === "unary")
        ? entry.latex.replace(/\{[A-Z]\}/g, "").replace(/_\s*\^/g, "").trim()
        : entry.latex;
      displayName = entry.reading;
    } else {
      latex = item.entry.latex;
      // 公式テンプレートは日本語名を入力欄に表示
      displayName = item.entry.japanese || item.entry.label;
    }
    setInputText(displayName);
    setOverrideLatex(latex);
    addToHistory(latex, displayName);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ── クイック記号挿入 → 日本語読みで挿入 ──
  const insertQuickSymbol = useCallback((reading: string) => {
    const newText = inputText ? inputText + " " + reading : reading;
    setInputText(newText);
    setOverrideLatex(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [inputText]);

  return (
    <div className={`space-y-0 ${className}`}>
      {/* ═══ 変換ヒント（初回表示 or 空入力時） ═══ */}
      {showHints && !inputText && (
        <div className="mb-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent overflow-hidden">
          <button
            onClick={() => setShowHints(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] font-medium text-foreground/80">こう入力 → この数式に変換</span>
            <X className="h-3 w-3 text-muted-foreground/40 ml-auto hover:text-foreground" />
          </button>
          <div className="px-2 pb-2 grid grid-cols-2 gap-1">
            {CONVERSION_HINTS.slice(0, 8).map((hint, i) => (
              <button
                key={i}
                onClick={() => {
                  setInputText(hint.input);
                  setOverrideLatex(null);
                  setShowHints(false);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-emerald-900/20 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate">{hint.input}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                  </div>
                  <span className="text-[8px] text-muted-foreground/60">{hint.label}</span>
                </div>
                <div className="w-12 shrink-0 flex justify-center overflow-hidden">
                  <MathRenderer latex={hint.output} displayMode={false} className="scale-[0.5] origin-center" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 入力バー ═══ */}
      <div className="relative">
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 pointer-events-none z-10">
          <Search className="h-3.5 w-3.5 text-emerald-500/70" />
        </div>

        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setSelectedIdx(0);
            setOverrideLatex(null);
            setShowHints(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="数式入力: a/b, sin(x), xの2乗, xは0より大きい, →, α …"
          className={`w-full pl-8 pr-4 py-2.5 text-sm rounded-xl border-2 focus:ring-2 focus:outline-none bg-background resize-none overflow-hidden font-sans transition-all ${
            overrideLatex
              ? "border-amber-300 dark:border-amber-700 focus:ring-amber-400/40"
              : "border-emerald-200 dark:border-emerald-800 focus:ring-emerald-400/40"
          }`}
          rows={1}
        />

        {/* ═══ 統合ドロップダウン候補 ═══ */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* リアルタイム変換プレビュー */}
            {currentLatex && !overrideLatex && (
              <div className="px-3 py-2 bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-950/30 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <Zap className="h-3 w-3 text-violet-500" />
                    <span className="text-[9px] text-violet-500 font-medium">変換プレビュー</span>
                  </div>
                  <div className="flex-1 flex justify-center overflow-auto py-0.5">
                    <MathRenderer latex={currentLatex} displayMode={false} className="text-base" />
                  </div>
                  <kbd className="text-[8px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-mono shrink-0">
                    Enter
                  </kbd>
                </div>
              </div>
            )}

            <ScrollArea className={suggestions.length > 6 ? "max-h-[280px]" : ""}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === selectedIdx
                      ? "bg-emerald-50 dark:bg-emerald-950/30"
                      : "hover:bg-muted/50"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    acceptSuggestion(i);
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <div className="w-14 shrink-0 flex justify-center overflow-hidden">
                    <MathRenderer latex={s.preview} displayMode={false} className="scale-[0.55] origin-center" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{s.display}</span>
                      <span className={`px-1 py-0 rounded text-[7px] shrink-0 ${
                        s.type === "parse"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : s.type === "formula"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      }`}>
                        {s.type === "parse" ? "変換" : s.type === "formula" ? "公式" : "辞書"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground/60">{s.category}</span>
                      {s.inputHint && (
                        <span className="text-[8px] text-emerald-500/60">
                          入力例: {s.inputHint}
                        </span>
                      )}
                    </div>
                  </div>
                  {i === selectedIdx && (
                    <kbd className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                      Space
                    </kbd>
                  )}
                </button>
              ))}
            </ScrollArea>

            <div className="px-3 py-1.5 bg-muted/30 border-t text-[9px] text-muted-foreground flex items-center gap-3">
              <span><kbd className="px-1 rounded bg-muted font-mono">Space</kbd> 変換</span>
              <span><kbd className="px-1 rounded bg-muted font-mono">↑↓</kbd> 候補移動</span>
              <span><kbd className="px-1 rounded bg-muted font-mono">Enter</kbd> 反映</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ライブプレビュー ═══ */}
      {currentLatex && (
        <div className="flex items-center gap-2 px-3 py-2.5 mt-1.5 rounded-xl bg-gradient-to-r from-violet-50/60 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-fuchsia-950/10 border border-violet-200/50 dark:border-violet-800/40">
          <span className="text-[9px] text-violet-500 font-semibold shrink-0">プレビュー</span>
          <div className="flex-1 flex justify-center overflow-auto py-1">
            <MathRenderer latex={currentLatex} displayMode={false} className="text-lg" />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {spacings.length > 0 && (
              <button
                onClick={() => setSpacings([])}
                className="text-[8px] text-muted-foreground/50 hover:text-foreground transition-colors px-1"
              >
                間隔リセット
              </button>
            )}
            <button
              onClick={handleApply}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
            >
              反映 ↩
            </button>
          </div>
        </div>
      )}

      {/* ═══ クイック記号バー ═══ */}
      <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <span className="text-[8px] text-muted-foreground/40 shrink-0 mr-0.5">記号:</span>
        {QUICK_SYMBOLS.map((sym, i) => (
          <TooltipProvider key={i} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => insertQuickSymbol(sym.reading)}
                  className="px-1.5 py-0.5 rounded-md text-[11px] border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all whitespace-nowrap"
                >
                  {sym.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                {sym.desc}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {/* ═══ アクションバー ═══ */}
      <div className="flex items-center gap-1.5 mt-1">
        {inputText && (
          <button
            onClick={() => { setInputText(""); setSpacings([]); setOverrideLatex(null); }}
            className="px-2 py-1 rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-3 w-3 inline mr-0.5" />クリア
          </button>
        )}
        {!showHints && !inputText && (
          <button
            onClick={() => setShowHints(true)}
            className="px-2 py-1 rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Lightbulb className="h-3 w-3 inline mr-0.5" />入力ヒント
          </button>
        )}
        <span className="text-[9px] text-muted-foreground/40 ml-auto flex items-center gap-1">
          <kbd className="px-1 rounded bg-muted font-mono text-[8px]">Enter</kbd>
          <span>で反映</span>
        </span>
      </div>

      {/* ═══ 入力ルール（折りたたみ） ═══ */}
      <details className="group mt-1">
        <summary className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none rounded-lg hover:bg-muted/50">
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          入力ルール・構文ガイド
        </summary>
        <div className="mt-1.5 p-3 rounded-xl bg-muted/30 border border-border/50 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <p className="text-[9px] font-semibold text-foreground/70 pb-1 border-b border-border/30 flex items-center gap-1">
                <Hash className="h-3 w-3" /> 基本ルール
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-medium">スペースなし</span>
                  <span className="text-muted-foreground/60">= ひとまとまり</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-medium">スペースあり</span>
                  <span className="text-muted-foreground/60">= 項の区切り</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 font-medium">_</span>
                  <span className="text-muted-foreground/60">= 下付き添え字</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 font-medium">^</span>
                  <span className="text-muted-foreground/60">= 上付き</span>
                </div>
              </div>
            </div>

            <ConversionExamples
              title="分数"
              examples={[
                { input: "2分の1", result: "\\frac{1}{2}" },
                { input: "R+R_2分のV", result: "\\frac{V}{R+R_{2}}" },
                { input: "1+ 2分の3", result: "1+\\frac{3}{2}", note: "スペースで分断" },
              ]}
            />
            <ConversionExamples
              title="累乗・根号"
              examples={[
                { input: "a+bのc乗", result: "(a+b)^{c}" },
                { input: "ルートa+b", result: "\\sqrt{a+b}" },
                { input: "ルートa +b", result: "\\sqrt{a}+b", note: "スペースで分断" },
              ]}
            />
            <ConversionExamples
              title="微積分"
              examples={[
                { input: "xで微分", result: "\\frac{d}{dx}" },
                { input: "0からパイまで積分", result: "\\int_{0}^{\\pi}" },
                { input: "i=1からnまで総和", result: "\\sum_{i=1}^{n}" },
              ]}
            />
          </div>
        </div>
      </details>

      {/* ═══ スペース調整（折りたたみ） ═══ */}
      <details className="group mt-0.5">
        <summary className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none rounded-lg hover:bg-muted/50">
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          スペース調整
          {spacings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-primary/15 text-primary">{spacings.length}</span>
          )}
        </summary>
        <div className="mt-1.5">
          <SpacingControl onInsert={addSpacing} />
        </div>
      </details>

      {/* ═══ 公式・記号辞書一覧（折りたたみ） ═══ */}
      <details className="group mt-0.5">
        <summary className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none rounded-lg hover:bg-muted/50">
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          <BookOpen className="h-3 w-3" />
          公式・記号辞書一覧
          <span className="text-[9px] text-muted-foreground/40 ml-1">クリックで入力</span>
        </summary>

        <div className="mt-1.5 rounded-xl border border-blue-200/60 dark:border-blue-800/40 overflow-hidden bg-background">
          {/* カテゴリフィルタ */}
          <div className="px-2 py-1.5 overflow-x-auto border-b border-border/30 scrollbar-none bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
            <div className="flex gap-1 min-w-max">
              {["すべて", ...groupedBrowserItems.map(g => g.category)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setBrowserCategory(cat)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                    browserCategory === cat
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {CATEGORY_ICONS[cat] && (
                    <span className="text-[8px] opacity-60">{CATEGORY_ICONS[cat]}</span>
                  )}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* カテゴリ別折りたたみ一覧 */}
          <ScrollArea className="max-h-[400px]">
            <div className="p-1.5">
              {filteredGroups.map(({ category, items }) => (
                <details key={category} className="group/cat mb-1">
                  <summary className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors select-none">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-open/cat:rotate-90 shrink-0" />
                    <span className="text-[8px] opacity-50">{CATEGORY_ICONS[category] || "📐"}</span>
                    <span className="text-[11px] font-semibold text-foreground/80">{category}</span>
                    <span className="text-[9px] text-muted-foreground/40 ml-auto">{items.length}件</span>
                  </summary>

                  <div className="ml-2 pl-3 border-l-2 border-blue-100 dark:border-blue-900/30 space-y-0.5 pb-1.5">
                    {items.map((item, i) => {
                      const isFormula = item.kind === "formula";
                      const displayLatex = isFormula
                        ? item.entry.latex
                        : item.entry.latex.replace(/\{[AB]\}/g, "").replace(/\{N\}/g, "");
                      const title = isFormula ? item.entry.label : item.entry.reading;
                      const subtitle = isFormula
                        ? (item.entry as FormulaTemplate).japanese
                        : (item.entry as MathDictEntry).description;

                      return (
                        <button
                          key={i}
                          onClick={() => handleBrowserInsert(item)}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-blue-50/60 dark:hover:bg-blue-950/20 active:bg-blue-100/80 dark:active:bg-blue-900/30 transition-colors text-left group/item"
                        >
                          <div className="w-14 shrink-0 flex justify-center overflow-hidden bg-muted/20 rounded-md py-0.5">
                            <MathRenderer
                              latex={displayLatex}
                              displayMode={false}
                              className={isFormula ? "scale-[0.4] origin-center" : "scale-[0.6] origin-center"}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium truncate">{title}</span>
                              {isFormula && (
                                <span className="px-1 py-0 rounded text-[7px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                                  公式
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-muted-foreground/60 truncate block">{subtitle}</span>
                            {!isFormula && (item.entry as MathDictEntry).example && (
                              <span className="text-[8px] text-emerald-500/60">
                                入力例: {(item.entry as MathDictEntry).example!.input}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </details>
              ))}

              {filteredGroups.length === 0 && (
                <div className="py-8 text-center space-y-1">
                  <Search className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground/40">該当する数式が見つかりません</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </details>

      {/* ═══ フッターヒント（LaTeX非表示） ═══ */}
      <div className="text-[9px] text-muted-foreground/50 leading-relaxed mt-1.5 px-1">
        <span className="text-emerald-600 font-medium">分数</span>: a/b
        <span className="mx-1.5">|</span>
        <span className="text-orange-600 font-medium">関数</span>: sin(x)
        <span className="mx-1.5">|</span>
        <span className="text-purple-600 font-medium">自然言語</span>: xは0より大きい
        <span className="mx-1.5">|</span>
        <span className="text-blue-600 font-medium">記号</span>: α, →, Σ
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 変換例コンポーネント
// ══════════════════════════════════════════

function ConversionExamples({ title, examples }: {
  title: string;
  examples: { input: string; result: string; note?: string }[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-semibold text-foreground/60 pb-0.5 border-b border-border/20">{title}</p>
      <div className="space-y-1">
        {examples.map((ex, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-background border border-border/50 text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-[9px]">
              {ex.input}
            </span>
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
            <div className="w-24 shrink-0 flex justify-center overflow-hidden">
              <MathRenderer latex={ex.result} displayMode={false} className="scale-[0.55] origin-center" />
            </div>
            {ex.note && (
              <span className="text-muted-foreground/50 text-[8px]">{ex.note}</span>
            )}
          </div>
        ))}
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
    <div className={`space-y-3 p-3 rounded-xl bg-muted/20 border border-border/40 ${className}`}>
      <p className="text-[10px] font-medium text-muted-foreground">数式内スペース調整</p>

      <div className="flex flex-wrap gap-1.5">
        <TooltipProvider delayDuration={200}>
          {SPACING_PRESETS.map((preset: SpacingPreset) => (
            <Tooltip key={preset.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onInsert(preset.latex)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs"
                >
                  <div className="h-3 bg-primary/30 rounded-sm" style={{ width: `${Math.max(2, Math.abs(preset.widthEm) * 16)}px` }} />
                  <span className="text-[10px] font-medium">{preset.name}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{preset.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

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
        <span className="text-[10px] w-10 text-right">{customPt}pt</span>
        <button
          onClick={() => onInsert(`\\hspace{${customPt}pt}`)}
          className="text-[10px] px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
        >
          挿入
        </button>
      </div>

      <div className="flex items-center gap-0 px-3 py-2 rounded-lg bg-background border">
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
