"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
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

// ── 変換ヒントデータ（演算子種類で色分け） ──
type OperatorKind = "unary" | "binary" | "ternary" | "bracket" | "other";
const HINT_KIND_STYLES: Record<OperatorKind, { label: string; badge: string; dot: string }> = {
  unary:   { label: "1項", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-400" },
  binary:  { label: "2項", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300", dot: "bg-blue-400" },
  ternary: { label: "3項", badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
  bracket: { label: "括弧", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300", dot: "bg-amber-400" },
  other:   { label: "他", badge: "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300", dot: "bg-gray-400" },
};

const CONVERSION_HINTS: { input: string; output: string; kind: OperatorKind; desc: string }[] = [
  // ── 1項演算 (unary): OP 引数 ──
  { input: "ルート x", output: "\\sqrt{x}", kind: "unary", desc: "1項: OP 引数" },
  { input: "絶対値 x+1", output: "\\left| x+1 \\right|", kind: "unary", desc: "1項: OP 引数" },
  { input: "ベクトル a", output: "\\vec{a}", kind: "unary", desc: "1項: OP 引数" },
  // ── 2項演算 (binary): 引数 OP 引数 ──
  { input: "a たす b", output: "a + b", kind: "binary", desc: "2項: A OP B" },
  { input: "x イコール 0", output: "x = 0", kind: "binary", desc: "2項: A OP B" },
  { input: "2分の1", output: "\\frac{1}{2}", kind: "binary", desc: "2項: A分のB" },
  { input: "xの2乗", output: "x^{2}", kind: "binary", desc: "2項: Aの B乗" },
  // ── 3項演算 (ternary): 下限 上限 OP 本体 ──
  { input: "0 π 積分 sinx", output: "\\int_{0}^{\\pi} \\sin x", kind: "ternary", desc: "3項: A B OP C" },
  { input: "i=1 n 総和 a_i", output: "\\sum_{i=1}^{n} a_i", kind: "ternary", desc: "3項: A B OP C" },
  { input: "x 0 極限 f(x)", output: "\\lim_{x \\to 0} f(x)", kind: "ternary", desc: "3項: A B OP C" },
  // ── 括弧・その他 ──
  { input: "かっこa+b", output: "\\left(a+b\\right)", kind: "bracket", desc: "かっこ+内容" },
  { input: "sin(x)", output: "\\sin\\left(x\\right)", kind: "other", desc: "関数認識" },
  { input: "α, →, Σ", output: "\\alpha, \\to, \\Sigma", kind: "other", desc: "記号直接入力" },
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

/** 外部からJapaneseMathInputを操作するためのハンドル */
export interface JapaneseMathInputHandle {
  setInput: (text: string) => void;
  focus: () => void;
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
  /** 辞書のkindに基づく演算子種類（ビジュアルドット用） */
  opKind?: OperatorKind;
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

export const JapaneseMathInput = forwardRef<JapaneseMathInputHandle, JapaneseMathInputProps>(function JapaneseMathInput({ onApply, initialSourceText = "", className = "" }, ref) {
  const [inputText, setInputText] = useState(initialSourceText);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [browserCategory, setBrowserCategory] = useState("すべて");
  const [spacings, setSpacings] = useState<string[]>([]);
  const [overrideLatex, setOverrideLatex] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── 外部から操作できるハンドル ──
  useImperativeHandle(ref, () => ({
    setInput: (text: string) => {
      setInputText(text);
      setOverrideLatex(null);
    },
    focus: () => {
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }));

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
      setShowGuide(false);
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
          opKind: entry.kind === "unary" ? "unary"
               : entry.kind === "binary" ? "binary"
               : entry.kind === "ternary" ? "ternary"
               : entry.kind === "operator" || entry.kind === "relation" ? "binary"
               : undefined,
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

  // ── IME変換中フラグ ──
  const [isComposing, setIsComposing] = useState(false);

  // ── キーボード操作（IME変換中は全てスキップ） ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME変換中は全てのキー操作をブラウザ/IMEに委譲
    // （矢印キーでの候補選択、Enterでの文字確定など）
    if (e.nativeEvent.isComposing || isComposing) return;

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
    // 文字確定済みの状態でEnter → 数式として反映（コンパイル実行）
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

      {/* ═══ 入力バー（最上位 — 常に一番上） ═══ */}
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
            setShowGuide(false);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="日本語で数式を入力 — ルートx, a/b, かっこa+b, 0からπまで積分 …"
          className={`w-full pl-8 pr-4 py-2.5 text-sm rounded-xl border-2 focus:ring-2 focus:outline-none bg-background resize-none overflow-hidden font-sans transition-all ${
            overrideLatex
              ? "border-amber-300 dark:border-amber-700 focus:ring-amber-400/40"
              : "border-emerald-200 dark:border-emerald-800 focus:ring-emerald-400/40"
          }`}
          rows={1}
          autoFocus
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
                      {s.opKind && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${HINT_KIND_STYLES[s.opKind].dot}`} />
                      )}
                      <span className="text-xs font-medium truncate">{s.display}</span>
                      {s.opKind && (
                        <span className={`px-1 py-0 rounded text-[7px] shrink-0 ${HINT_KIND_STYLES[s.opKind].badge}`}>
                          {HINT_KIND_STYLES[s.opKind].label}
                        </span>
                      )}
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
              <span><kbd className="px-1 rounded bg-muted font-mono">↑↓</kbd> 選択</span>
              <span><kbd className="px-1 rounded bg-muted font-mono">Enter</kbd> 確定</span>
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
        <span className="text-[9px] text-muted-foreground/40 ml-auto flex items-center gap-1">
          <kbd className="px-1 rounded bg-muted font-mono text-[8px]">Space</kbd>
          <span>変換</span>
          <kbd className="px-1 rounded bg-muted font-mono text-[8px] ml-1">Enter</kbd>
          <span>反映</span>
        </span>
      </div>

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

      {/* ═══ フッター — 構造ルールダッシュボード ═══ */}
      <div className="mt-1.5 px-1.5 py-1.5 rounded-lg bg-gradient-to-r from-muted/20 to-muted/10 border border-border/15">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider shrink-0">規則:</span>
          {[
            { dot: "bg-emerald-400", badge: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/40 dark:border-emerald-800/30", text: "操作+対象", example: "ルートx" },
            { dot: "bg-blue-400", badge: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200/40 dark:border-blue-800/30", text: "A操作B", example: "a/b" },
            { dot: "bg-violet-400", badge: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200/40 dark:border-violet-800/30", text: "AからBまで", example: "0〜π積分" },
            { dot: "bg-amber-400", badge: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/40 dark:border-amber-800/30", text: "かっこ+内容", example: "かっこa+b" },
          ].map((pill, i) => (
            <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[7px] font-medium border ${pill.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pill.dot} shrink-0`} />
              <span className="font-semibold">{pill.text}</span>
              <span className="text-muted-foreground/40 font-normal">例:{pill.example}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

// ══════════════════════════════════════════
// 書き方ガイド — ビジュアル構造マップ（独立パネル）
// ══════════════════════════════════════════
//
// 設計方針:
//   ① 4つの演算子パターンを1画面で同時表示（タブ切替なし＝認知コスト0）
//   ② 色×形で構造を即座に識別（言語に頼らない視覚伝達）
//   ③ 例はクリック可能（体験で学習）
//   ④ 入力欄と独立した領域に配置（被りなし）

interface MathWritingGuideProps {
  onTryExample?: (input: string) => void;
  onClose?: () => void;
  className?: string;
}

/** 1つのパターンセル */
function PatternCell({ color, label, pattern, example, onTry }: {
  color: string;         // tailwind color name (emerald, blue, violet, amber)
  label: string;         // "1項" etc
  pattern: React.ReactNode;
  example: { input: string; latex: string };
  onTry: (input: string) => void;
}) {
  const colorMap: Record<string, { label: string; bg: string; patBg: string; exHover: string; input: string; tryText: string }> = {
    emerald: {
      label: "bg-emerald-500 text-white",
      bg: "bg-emerald-50/60 dark:bg-emerald-950/15 border-emerald-200/40 dark:border-emerald-800/30",
      patBg: "bg-white/80 dark:bg-black/10",
      exHover: "hover:bg-emerald-100/70 dark:hover:bg-emerald-900/25",
      input: "text-emerald-700 dark:text-emerald-400",
      tryText: "text-emerald-500/0 group-hover/ex:text-emerald-500",
    },
    blue: {
      label: "bg-blue-500 text-white",
      bg: "bg-blue-50/60 dark:bg-blue-950/15 border-blue-200/40 dark:border-blue-800/30",
      patBg: "bg-white/80 dark:bg-black/10",
      exHover: "hover:bg-blue-100/70 dark:hover:bg-blue-900/25",
      input: "text-blue-700 dark:text-blue-400",
      tryText: "text-blue-500/0 group-hover/ex:text-blue-500",
    },
    violet: {
      label: "bg-violet-500 text-white",
      bg: "bg-violet-50/60 dark:bg-violet-950/15 border-violet-200/40 dark:border-violet-800/30",
      patBg: "bg-white/80 dark:bg-black/10",
      exHover: "hover:bg-violet-100/70 dark:hover:bg-violet-900/25",
      input: "text-violet-700 dark:text-violet-400",
      tryText: "text-violet-500/0 group-hover/ex:text-violet-500",
    },
    amber: {
      label: "bg-amber-500 text-white",
      bg: "bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/40 dark:border-amber-800/30",
      patBg: "bg-white/80 dark:bg-black/10",
      exHover: "hover:bg-amber-100/70 dark:hover:bg-amber-900/25",
      input: "text-amber-700 dark:text-amber-400",
      tryText: "text-amber-500/0 group-hover/ex:text-amber-500",
    },
  };
  const c = colorMap[color] ?? colorMap.emerald;

  return (
    <div className={`rounded-lg border ${c.bg} overflow-hidden`}>
      {/* ラベル + パターン図 */}
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span className={`text-[7px] font-bold px-1 py-px rounded ${c.label} shrink-0 leading-tight`}>{label}</span>
        <div className={`flex-1 flex items-center justify-center rounded px-1.5 py-0.5 ${c.patBg}`}>
          {pattern}
        </div>
      </div>
      {/* 例（クリックで入力） */}
      <button
        onClick={() => onTry(example.input)}
        className={`w-full flex items-center gap-1 px-2 py-[2px] border-t border-black/[0.03] dark:border-white/[0.03] transition-colors group/ex ${c.exHover}`}
      >
        <span className={`text-[8px] font-mono font-medium ${c.input} shrink-0`}>{example.input}</span>
        <ArrowRight className="h-1.5 w-1.5 text-muted-foreground/20 shrink-0" />
        <div className="flex-1 flex justify-end overflow-hidden">
          <MathRenderer latex={example.latex} displayMode={false} className="scale-[0.45] origin-right" />
        </div>
        <span className={`text-[6px] font-medium transition-all ${c.tryText} shrink-0`}>試す</span>
      </button>
    </div>
  );
}

export function MathWritingGuide({ onTryExample, onClose, className = "" }: MathWritingGuideProps) {
  const [expanded, setExpanded] = useState(false);

  const handleTry = (input: string) => {
    onTryExample?.(input);
  };

  return (
    <div className={`rounded-xl border border-border/30 bg-muted/10 overflow-hidden ${className}`}>
      {/* ── ヘッダー: パイプライン図 ── */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/15 bg-gradient-to-r from-emerald-50/30 via-violet-50/20 to-amber-50/30 dark:from-emerald-950/10 dark:via-violet-950/10 dark:to-amber-950/10">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[8px] text-foreground/60 bg-background/80 px-1.5 py-0.5 rounded border border-border/20">数式ルール</span>
          <div className="flex items-center gap-0.5 text-[7px] text-muted-foreground/50">
            <span className="px-1 py-0 rounded bg-emerald-100/60 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium">日本語入力</span>
            <ArrowRight className="h-1.5 w-1.5 text-muted-foreground/25" />
            <kbd className="px-0.5 rounded bg-muted/50 text-[6px] font-mono border border-border/20">Space</kbd>
            <ArrowRight className="h-1.5 w-1.5 text-muted-foreground/25" />
            <span className="px-1 py-0 rounded bg-violet-100/60 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 font-medium">LaTeX変換</span>
            <ArrowRight className="h-1.5 w-1.5 text-muted-foreground/25" />
            <kbd className="px-0.5 rounded bg-muted/50 text-[6px] font-mono border border-border/20">Enter</kbd>
            <ArrowRight className="h-1.5 w-1.5 text-muted-foreground/25" />
            <span className="px-1 py-0 rounded bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium">反映</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[7px] text-muted-foreground/40 hover:text-foreground/60 transition-colors px-1 py-0.5 rounded hover:bg-muted/40"
          >
            {expanded ? "簡略" : "詳細"}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 厳密ルール4パターン (2×2 グリッド → 4列) ── */}
      <div className="p-1.5">
        {/* ルール概要 —「構造ルール」を視覚的に提示 */}
        <div className="flex items-center gap-1 mb-1 px-1">
          <Hash className="h-2.5 w-2.5 text-muted-foreground/40" />
          <span className="text-[7px] font-bold text-foreground/50 tracking-wider uppercase">構造パターン — 全ての数式はこの4型に従う</span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <PatternCell
            color="emerald"
            label="1項 (単項)"
            pattern={
              <div className="flex items-center gap-1">
                <span className="px-1 rounded bg-emerald-200/80 dark:bg-emerald-800/60 text-[7px] font-bold text-emerald-700 dark:text-emerald-300">操作</span>
                <span className="text-[7px] text-emerald-500/60 dark:text-emerald-400/50 border-b border-dashed border-emerald-400/40">対象</span>
              </div>
            }
            example={{ input: "ルートx", latex: "\\sqrt{x}" }}
            onTry={handleTry}
          />
          <PatternCell
            color="blue"
            label="2項 (二項)"
            pattern={
              <div className="flex items-center gap-0.5">
                <span className="text-[7px] text-blue-500/60 dark:text-blue-400/50 border-b border-dashed border-blue-400/40">A</span>
                <span className="px-1 rounded bg-blue-200/80 dark:bg-blue-800/60 text-[7px] font-bold text-blue-700 dark:text-blue-300">操作</span>
                <span className="text-[7px] text-blue-500/60 dark:text-blue-400/50 border-b border-dashed border-blue-400/40">B</span>
              </div>
            }
            example={{ input: "2分の1", latex: "\\frac{1}{2}" }}
            onTry={handleTry}
          />
          <PatternCell
            color="violet"
            label="3項 (三項)"
            pattern={
              <div className="flex items-center gap-0.5">
                <span className="text-[7px] text-violet-500/60 border-b border-dashed border-violet-400/40">A</span>
                <span className="text-[6px] text-violet-400 font-bold">→</span>
                <span className="text-[7px] text-violet-500/60 border-b border-dashed border-violet-400/40">B</span>
                <span className="px-0.5 rounded bg-violet-200/80 dark:bg-violet-800/60 text-[7px] font-bold text-violet-700 dark:text-violet-300">操作</span>
              </div>
            }
            example={{ input: "0からπまで積分", latex: "\\int_{0}^{\\pi}" }}
            onTry={handleTry}
          />
          <PatternCell
            color="amber"
            label="括弧 (包含)"
            pattern={
              <div className="flex items-center gap-0.5">
                <span className="px-0.5 rounded bg-amber-200/80 dark:bg-amber-800/60 text-[7px] font-bold text-amber-700 dark:text-amber-300">かっこ</span>
                <span className="text-[8px] text-amber-400/70 font-bold">(</span>
                <span className="text-[7px] text-amber-500/60 border-b border-dashed border-amber-400/40">内容</span>
                <span className="text-[8px] text-amber-400/70 font-bold">)</span>
              </div>
            }
            example={{ input: "かっこa+b", latex: "\\left(a+b\\right)" }}
            onTry={handleTry}
          />
        </div>
      </div>

      {/* ── 展開時: 厳密ルール詳細 + ネスト + 追加例 ── */}
      {expanded && (
        <div className="px-2 pb-2 pt-1 border-t border-border/10 space-y-2">
          {/* ルール: LaTeXの強み */}
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-50/50 to-violet-50/50 dark:from-blue-950/15 dark:to-violet-950/15 border border-blue-200/30 dark:border-blue-800/30">
            <div className="flex items-center gap-1 mb-1.5">
              <Lightbulb className="h-2.5 w-2.5 text-blue-400" />
              <span className="text-[8px] font-bold text-blue-700 dark:text-blue-300">LaTeX の 3 つの強み</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="text-[7px] text-blue-600/80 dark:text-blue-400/70 space-y-0.5">
                <span className="font-bold block">① テンプレート固定</span>
                <span className="block text-muted-foreground/60">書式のブレが起きない</span>
              </div>
              <div className="text-[7px] text-violet-600/80 dark:text-violet-400/70 space-y-0.5">
                <span className="font-bold block">② 数式の美しさ</span>
                <span className="block text-muted-foreground/60">厳密な組版規則</span>
              </div>
              <div className="text-[7px] text-emerald-600/80 dark:text-emerald-400/70 space-y-0.5">
                <span className="font-bold block">③ 長文の堅牢性</span>
                <span className="block text-muted-foreground/60">何ページでも崩れない</span>
              </div>
            </div>
          </div>

          {/* ネストルール */}
          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-muted/20 text-[7px] text-muted-foreground/60">
            <Lightbulb className="h-2.5 w-2.5 text-amber-400/60 shrink-0" />
            <span><strong className="text-foreground/70">ネスト規則</strong>: スペースで区切ると入れ子になる「ルート かっこa+b」→ √(a+b)</span>
          </div>

          {/* 厳密な構造マップ */}
          <div className="p-2 rounded-lg bg-muted/15 border border-border/15">
            <div className="flex items-center gap-1 mb-1.5">
              <Hash className="h-2.5 w-2.5 text-muted-foreground/40" />
              <span className="text-[8px] font-bold text-foreground/50">各型の演算子一覧</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[7px]">
              <div className="space-y-0.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">■ 1項型 (操作+対象):</span>
                <span className="text-muted-foreground/70 block">ルート, 絶対値, ベクトル, ハット, バー, チルダ, 太字, 斜体</span>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-blue-600 dark:text-blue-400">■ 2項型 (A操作B):</span>
                <span className="text-muted-foreground/70 block">分の(/), の乗(^), の添字(_), の上, の下</span>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-violet-600 dark:text-violet-400">■ 3項型 (AからBまで操作):</span>
                <span className="text-muted-foreground/70 block">積分, 総和, 総乗, 極限</span>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-amber-600 dark:text-amber-400">■ 括弧型 (かっこ+内容):</span>
                <span className="text-muted-foreground/70 block">かっこ, かくかっこ, なみかっこ, 絶対値</span>
              </div>
            </div>
          </div>

          {/* 追加例グリッド */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-0">
            {[
              { input: "ルート かっこa+b", latex: "\\sqrt{\\left(a+b\\right)}", color: "emerald" },
              { input: "xの2乗", latex: "x^{2}", color: "blue" },
              { input: "絶対値x", latex: "\\left| x \\right|", color: "emerald" },
              { input: "i=1からnまで総和", latex: "\\sum_{i=1}^{n}", color: "violet" },
              { input: "ベクトルa", latex: "\\vec{a}", color: "emerald" },
              { input: "かくかっこx", latex: "\\left[x\\right]", color: "amber" },
            ].map((ex, i) => {
              const colorStyles: Record<string, string> = {
                emerald: "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/20",
                blue: "text-blue-700 dark:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-950/20",
                violet: "text-violet-700 dark:text-violet-400 hover:bg-violet-50/70 dark:hover:bg-violet-950/20",
                amber: "text-amber-700 dark:text-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/20",
              };
              return (
                <button
                  key={i}
                  onClick={() => handleTry(ex.input)}
                  className={`flex items-center gap-1 px-1 py-[2px] rounded transition-colors group/ex ${colorStyles[ex.color] ?? ""}`}
                >
                  <span className="text-[8px] font-mono font-medium shrink-0">{ex.input}</span>
                  <ArrowRight className="h-1.5 w-1.5 text-muted-foreground/15 shrink-0" />
                  <div className="flex-1 flex justify-end overflow-hidden">
                    <MathRenderer latex={ex.latex} displayMode={false} className="scale-[0.45] origin-right" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
