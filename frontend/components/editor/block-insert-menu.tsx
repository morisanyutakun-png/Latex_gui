"use client";

/**
 * BlockInsertMenu — Notion 風の「ブロックを挿入」コマンドメニュー。
 *
 * 用途:
 *  - VisualEditor の FAB ボタン (画面右下の「+ ブロックを追加」) から起動
 *  - 各セグメント横の hover「+」ハンドルから起動 (そのブロックの直後に挿入)
 *  - 末尾段落で `/` を打鍵したときの slash menu として起動
 *
 * 出力は LaTeX スニペットだけ。DOM への挿入処理は呼び出し側 (visual-editor) が行う。
 * 「数式」「インライン数式」のような特別な挙動は action 識別子で返し、呼び出し側で
 * 既存の MathEditPopover フローに繋ぐ。
 *
 * 設計方針:
 *  - 生 LaTeX を画面に出さない原則に沿って、項目ラベルは自然言語で表示する。
 *  - キーボード操作 (↑↓ で選択 / Enter で確定 / Esc で閉じる) を完備する。
 *  - 検索 (slash モード) では query で前方一致 + キーワード一致でソートする。
 */

import {
  AlignLeft, Heading1, Heading2, Heading3,
  Sigma, Calculator, ListOrdered, List as ListIcon,
  Table2, Minus, ArrowDownToLine, ScrollText,
  StickyNote, Quote, BookOpen, MoveRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** 挿入後にエディタ側でどう振る舞うかを示す action 識別子。
 *  - "snippet": そのまま `latex` を挿入する (デフォルト)
 *  - "inline-math": カーソル位置に空 math chip を挿入し、即座に MathEditPopover を開く
 *  - "display-math": 表示数式の枠を挿入し、即座に MathEditPopover を開く
 */
export type BlockInsertAction = "snippet" | "inline-math" | "display-math";

export interface BlockMenuItem {
  id: string;
  /** UI に出すローカライズ済みラベル (自然言語) */
  label: string;
  /** 1 行のサブテキスト (任意) */
  description?: string;
  /** 検索キーワード (slash menu で使う、ローカル + 英字混在) */
  keywords: string[];
  /** 実際に挿入する LaTeX。action="snippet" 以外では空文字でも良い */
  latex: string;
  /** 挿入時の特殊挙動 */
  action: BlockInsertAction;
  /** 左に出すアイコンコンポーネント */
  icon: React.ComponentType<{ className?: string }>;
  /** 4 種のアイコン色テーマ (Notion 風カテゴリ識別) */
  tone: "violet" | "amber" | "emerald" | "sky" | "rose" | "slate";
  /** カテゴリ見出し (一覧モードでのグルーピング用) */
  category: "basic" | "math" | "structure" | "advanced";
}

const TONE_BG: Record<BlockMenuItem["tone"], string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

/** ローカルテンプレートの素な LaTeX スニペット。
 *  幅は \linewidth ベースに揃え、本文余白に追従するようにしている。 */
function buildItems(locale: "ja" | "en"): BlockMenuItem[] {
  const ja = locale === "ja";
  return [
    // ── basic ───────────────────────────────────────────────
    {
      id: "paragraph",
      label: ja ? "段落 (テキスト)" : "Paragraph",
      description: ja ? "本文を書く" : "Write plain body text",
      keywords: ["text", "p", "paragraph", "段落", "テキスト", "ぱらぐらふ"],
      latex: ja ? "ここに本文を入力" : "Type body text here",
      action: "snippet",
      icon: AlignLeft,
      tone: "slate",
      category: "basic",
    },
    {
      id: "heading-section",
      label: ja ? "見出し (大)" : "Heading 1",
      description: ja ? "章の見出し" : "Top-level section",
      keywords: ["h1", "section", "見出し", "大見出し", "heading", "title"],
      latex: ja ? "\\section{見出し}" : "\\section{Heading}",
      action: "snippet",
      icon: Heading1,
      tone: "violet",
      category: "basic",
    },
    {
      id: "heading-subsection",
      label: ja ? "見出し (中)" : "Heading 2",
      description: ja ? "節の見出し" : "Subsection",
      keywords: ["h2", "subsection", "見出し", "中見出し", "heading"],
      latex: ja ? "\\subsection{見出し}" : "\\subsection{Heading}",
      action: "snippet",
      icon: Heading2,
      tone: "violet",
      category: "basic",
    },
    {
      id: "heading-subsubsection",
      label: ja ? "見出し (小)" : "Heading 3",
      description: ja ? "小節の見出し" : "Sub-subsection",
      keywords: ["h3", "subsubsection", "見出し", "小見出し"],
      latex: ja ? "\\subsubsection{見出し}" : "\\subsubsection{Heading}",
      action: "snippet",
      icon: Heading3,
      tone: "violet",
      category: "basic",
    },

    // ── math ────────────────────────────────────────────────
    {
      id: "math-display",
      label: ja ? "数式ブロック" : "Display math",
      description: ja ? "中央寄せの数式 (KaTeX)" : "Centered math block",
      keywords: ["math", "equation", "display", "数式", "ブロック", "式", "fraction"],
      latex: "\\[ \\quad \\]",
      action: "display-math",
      icon: Sigma,
      tone: "emerald",
      category: "math",
    },
    {
      id: "math-align",
      label: ja ? "連立 / 整列数式" : "Aligned equations",
      description: ja ? "= で揃う複数行" : "Multi-line aligned",
      keywords: ["align", "aligned", "system", "連立", "整列", "数式"],
      latex: "\\begin{align*}\n  a &= b + c \\\\\n  &= d\n\\end{align*}",
      action: "snippet",
      icon: Calculator,
      tone: "emerald",
      category: "math",
    },
    {
      id: "math-cases",
      label: ja ? "場合分け" : "Cases",
      description: ja ? "条件分岐の数式" : "Piecewise definition",
      keywords: ["cases", "場合分け", "条件", "piecewise"],
      latex: "\\[ f(x) = \\begin{cases} a & (x > 0) \\\\ b & (x \\leq 0) \\end{cases} \\]",
      action: "snippet",
      icon: Calculator,
      tone: "emerald",
      category: "math",
    },
    {
      id: "math-inline",
      label: ja ? "インライン数式" : "Inline math",
      description: ja ? "本文中に数式チップを挿入" : "Insert math inline",
      keywords: ["inline", "math", "数式", "インライン"],
      latex: "",
      action: "inline-math",
      icon: Sigma,
      tone: "emerald",
      category: "math",
    },

    // ── structure ───────────────────────────────────────────
    {
      id: "list-itemize",
      label: ja ? "箇条書き" : "Bulleted list",
      description: ja ? "・ から始まるリスト" : "Unordered list",
      keywords: ["bullet", "list", "itemize", "箇条書き", "リスト"],
      latex: ja
        ? "\\begin{itemize}\n  \\item 項目 1\n  \\item 項目 2\n\\end{itemize}"
        : "\\begin{itemize}\n  \\item Item 1\n  \\item Item 2\n\\end{itemize}",
      action: "snippet",
      icon: ListIcon,
      tone: "amber",
      category: "structure",
    },
    {
      id: "list-enumerate",
      label: ja ? "番号付きリスト" : "Numbered list",
      description: ja ? "(1), (2)... のリスト" : "Ordered list",
      keywords: ["number", "list", "enumerate", "番号", "順序", "リスト"],
      latex: ja
        ? "\\begin{enumerate}\n  \\item 項目 1\n  \\item 項目 2\n\\end{enumerate}"
        : "\\begin{enumerate}\n  \\item Item 1\n  \\item Item 2\n\\end{enumerate}",
      action: "snippet",
      icon: ListOrdered,
      tone: "amber",
      category: "structure",
    },
    {
      id: "table",
      label: ja ? "表 (2×2)" : "Table (2×2)",
      description: ja ? "罫線付きの簡易テーブル" : "Simple bordered table",
      keywords: ["table", "tabular", "表", "テーブル", "grid"],
      latex:
        "\\begin{center}\n\\begin{tabular}{|c|c|}\n\\hline\nA & B \\\\ \\hline\nC & D \\\\ \\hline\n\\end{tabular}\n\\end{center}",
      action: "snippet",
      icon: Table2,
      tone: "sky",
      category: "structure",
    },
    {
      id: "quote-box",
      label: ja ? "注意・補足ボックス" : "Note / quote box",
      description: ja ? "枠で囲んだ補足" : "Boxed note",
      keywords: ["note", "quote", "fbox", "注意", "補足", "ヒント"],
      latex: ja
        ? "\\noindent\\fbox{\\parbox{0.95\\linewidth}{\\textbf{ヒント}\\quad ここに補足を書く}}"
        : "\\noindent\\fbox{\\parbox{0.95\\linewidth}{\\textbf{Note}\\quad Add your hint here}}",
      action: "snippet",
      icon: StickyNote,
      tone: "amber",
      category: "structure",
    },

    // ── advanced ────────────────────────────────────────────
    {
      id: "divider",
      label: ja ? "区切り線" : "Divider",
      description: ja ? "横罫線" : "Horizontal rule",
      keywords: ["divider", "rule", "hr", "区切り", "罫線", "ライン"],
      latex: "\\noindent\\rule{0.95\\linewidth}{0.4pt}",
      action: "snippet",
      icon: Minus,
      tone: "slate",
      category: "advanced",
    },
    {
      id: "spacer",
      label: ja ? "余白" : "Spacer",
      description: ja ? "縦の空白を入れる" : "Vertical space",
      keywords: ["space", "spacer", "vspace", "余白", "スペース"],
      latex: "\\vspace{12pt}",
      action: "snippet",
      icon: ArrowDownToLine,
      tone: "slate",
      category: "advanced",
    },
    {
      id: "pagebreak",
      label: ja ? "改ページ" : "Page break",
      description: ja ? "次のページへ" : "Force a new page",
      keywords: ["page", "break", "改ページ", "newpage"],
      latex: "\\newpage",
      action: "snippet",
      icon: ScrollText,
      tone: "slate",
      category: "advanced",
    },
    {
      id: "answer-line",
      label: ja ? "解答欄" : "Answer line",
      description: ja ? "横線一本の記入欄" : "One blank answer line",
      keywords: ["answer", "blank", "解答欄", "記入"],
      latex: "\\noindent\\rule[-3pt]{0.85\\linewidth}{0.4pt}",
      action: "snippet",
      icon: MoveRight,
      tone: "rose",
      category: "advanced",
    },
    {
      id: "quote-block",
      label: ja ? "引用" : "Quote",
      description: ja ? "字下げした引用文" : "Indented quote",
      keywords: ["quote", "quotation", "引用"],
      latex: ja
        ? "\\begin{quote}\n  ここに引用文を書く\n\\end{quote}"
        : "\\begin{quote}\n  Quoted text here\n\\end{quote}",
      action: "snippet",
      icon: Quote,
      tone: "slate",
      category: "advanced",
    },
    {
      id: "problem-block",
      label: ja ? "問題ブロック" : "Problem block",
      description: ja ? "問題番号付きの章" : "Numbered problem section",
      keywords: ["problem", "question", "問題", "問", "章"],
      latex: ja
        ? "\\section*{第\\,N\\,問}\n\nここに問題文を書く。"
        : "\\section*{Problem N}\n\nWrite the problem statement here.",
      action: "snippet",
      icon: BookOpen,
      tone: "violet",
      category: "advanced",
    },
  ];
}

interface BlockInsertMenuProps {
  /** メニューを描画するアンカー位置 (画面座標 / px)。クリック起動の場合は元ボタンの中心。 */
  anchor: { x: number; y: number };
  /** メニューを画面のどちら側に開くか。
   *  "right-bottom" = アンカーの右下
   *  "left-bottom" = アンカーの左下
   *  "above" = アンカーの上 (FAB 用)
   */
  placement?: "right-bottom" | "left-bottom" | "above";
  /** 検索クエリ (slash menu などで初期入力済みの場合) */
  initialQuery?: string;
  onSelect: (item: BlockMenuItem) => void;
  onClose: () => void;
}

/** Notion 風コマンドメニュー本体。fixed positioning + キーボード操作 + 検索。 */
export function BlockInsertMenu({
  anchor,
  placement = "above",
  initialQuery = "",
  onSelect,
  onClose,
}: BlockInsertMenuProps) {
  const { locale } = useI18n();
  const items = useMemo(() => buildItems(locale === "en" ? "en" : "ja"), [locale]);

  const [query, setQuery] = useState(initialQuery);
  const [activeIdx, setActiveIdx] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // フィルタリング + カテゴリ並び替え。query が空のときは全件表示 (カテゴリ順)。
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      if (it.label.toLowerCase().includes(q)) return true;
      return it.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [items, query]);

  // フィルタが変わったら active を 0 に戻す
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // 自動スクロール: アクティブ項目を可視範囲に保つ
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // キーボード操作: ↑↓ で選択 / Enter で確定 / Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === "Enter") {
        const it = filtered[activeIdx];
        if (it) {
          e.preventDefault();
          onSelect(it);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filtered, activeIdx, onSelect, onClose]);

  // 起動直後に検索入力にフォーカス (slash menu 風の即タイピング体験)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 配置計算: anchor + placement → 画面内に収まる位置
  const MENU_W = 340;
  const MENU_MAX_H = 380;
  const MARGIN = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let top = 0;
  let left = 0;
  if (placement === "above") {
    left = Math.min(Math.max(MARGIN, anchor.x - MENU_W / 2), vw - MENU_W - MARGIN);
    top = Math.max(MARGIN, anchor.y - MENU_MAX_H - 14);
  } else if (placement === "left-bottom") {
    left = Math.min(Math.max(MARGIN, anchor.x - MENU_W), vw - MENU_W - MARGIN);
    top = Math.min(anchor.y + 8, vh - MENU_MAX_H - MARGIN);
  } else {
    left = Math.min(Math.max(MARGIN, anchor.x), vw - MENU_W - MARGIN);
    top = Math.min(anchor.y + 8, vh - MENU_MAX_H - MARGIN);
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1100]"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="block-insert-menu"
        style={{ top, left, width: MENU_W, maxHeight: MENU_MAX_H }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 検索入力 */}
        <div className="block-insert-menu-search">
          <span className="block-insert-menu-search-icon">/</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locale === "en" ? "Search blocks…" : "ブロックを検索..."
            }
            spellCheck={false}
            className="block-insert-menu-search-input"
          />
        </div>

        {/* 候補リスト (カテゴリ別グルーピング) */}
        <div className="block-insert-menu-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="block-insert-menu-empty">
              {locale === "en" ? "No matching block" : "一致するブロックがありません"}
            </div>
          ) : (
            renderGrouped(filtered, activeIdx, (item) => onSelect(item), setActiveIdx, locale === "en" ? "en" : "ja")
          )}
        </div>

        {/* フッタ — キーボードヒント */}
        <div className="block-insert-menu-footer">
          <span><kbd>↑↓</kbd> {locale === "en" ? "Move" : "選択"}</span>
          <span><kbd>↵</kbd> {locale === "en" ? "Insert" : "挿入"}</span>
          <span><kbd>Esc</kbd> {locale === "en" ? "Close" : "閉じる"}</span>
        </div>
      </div>
    </div>
  );

  function renderGrouped(
    list: BlockMenuItem[],
    activeIndex: number,
    onPick: (it: BlockMenuItem) => void,
    onHover: (idx: number) => void,
    loc: "ja" | "en",
  ) {
    const order: Array<BlockMenuItem["category"]> = ["basic", "math", "structure", "advanced"];
    const labels: Record<BlockMenuItem["category"], string> = loc === "en"
      ? { basic: "Basic", math: "Math", structure: "Structure", advanced: "Advanced" }
      : { basic: "基本", math: "数式", structure: "構造", advanced: "高度" };

    const groups = order
      .map((cat) => ({ cat, items: list.filter((it) => it.category === cat) }))
      .filter((g) => g.items.length > 0);

    let runningIdx = 0;
    return (
      <>
        {groups.map((g) => (
          <div key={g.cat} className="block-insert-menu-group">
            <div className="block-insert-menu-group-label">{labels[g.cat]}</div>
            {g.items.map((it) => {
              const idx = runningIdx++;
              const active = idx === activeIndex;
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  data-idx={idx}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => onHover(idx)}
                  onClick={() => onPick(it)}
                  className={`block-insert-menu-item ${active ? "is-active" : ""}`}
                >
                  <span className={`block-insert-menu-item-icon ${TONE_BG[it.tone]}`}>
                    <Icon className="h-[16px] w-[16px]" />
                  </span>
                  <span className="block-insert-menu-item-text">
                    <span className="block-insert-menu-item-label">{it.label}</span>
                    {it.description && (
                      <span className="block-insert-menu-item-desc">{it.description}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </>
    );
  }
}
