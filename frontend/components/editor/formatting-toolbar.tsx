"use client";

/**
 * FormattingToolbar — VisualEditor の選択範囲に対してインライン装飾を直接適用する。
 *
 * 設計:
 *  - ボタンは mousedown で preventDefault し、contentEditable のフォーカス/選択を保持する。
 *  - 選択範囲に対して span.dataset.color 等を付ける DOM 操作を行い、そのあと
 *    COMMIT_EVENT を editable host に飛ばして serializeContentEditableDOM を走らせる。
 *  - 生 LaTeX を画面に出さない方針と両立させるため、serializer は既存の data 属性経路を
 *    使って `\textcolor{red}{X}` 等にラウンドトリップする。
 *
 * 追加できる形式:
 *  - 色: data-color="name"  → \textcolor{name}{...}
 *  - 太字 / 斜体 / 等幅: <strong> / <em> / <code>
 *  - 枠: data-fbox-cmd="fbox" → \fbox{...}
 *  - 数式: 空の math chip を挿入し、数式ポップオーバーを開く
 *  - カラーボックス (プレゼン等): \begin{alertblock}{...} 等のブロック挿入
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Code2,
  Palette,
  SquareDashed,
  Sigma,
  Box,
  ChevronDown,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useI18n } from "@/lib/i18n";

const COMMIT_EVENT = "latex-gui:commit-now";

// 1 クリックで付けられる色のプリセット。LaTeX 標準 color / xcolor で解釈できる名前を使う。
// テンプレ側で `\usepackage{xcolor}` を呼んでいるのでこれらは全テンプレで通る。
const COLOR_PRESETS: Array<{ name: string; css: string; label: string }> = [
  { name: "black",    css: "#000000", label: "黒 / Black" },
  { name: "red",      css: "#dc2626", label: "赤 / Red" },
  { name: "orange",   css: "#ea580c", label: "橙 / Orange" },
  { name: "olive",    css: "#808000", label: "黄土 / Olive" },
  { name: "green",    css: "#16a34a", label: "緑 / Green" },
  { name: "teal",     css: "#0d9488", label: "ティール / Teal" },
  { name: "cyan",     css: "#06b6d4", label: "シアン / Cyan" },
  { name: "blue",     css: "#2563eb", label: "青 / Blue" },
  { name: "violet",   css: "#7c3aed", label: "紫 / Violet" },
  { name: "magenta",  css: "#d946ef", label: "マゼンタ / Magenta" },
  { name: "pink",     css: "#ec4899", label: "ピンク / Pink" },
  { name: "gray",     css: "#6b7280", label: "灰 / Gray" },
];

// ブロックボックスのプリセット。テンプレが beamer か tcolorbox 系かで候補を出し分ける。
interface BoxPreset {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  snippet: string;
  templates?: string[];
}

const BOX_PRESETS: BoxPreset[] = [
  {
    id: "block",
    label: "ブロック", labelEn: "Block",
    description: "青帯付きの情報ブロック", descriptionEn: "Blue info block",
    snippet: "\\begin{block}{タイトル}\n  ここに内容を書きます。\n\\end{block}",
    templates: ["beamer"],
  },
  {
    id: "alertblock",
    label: "警告ブロック", labelEn: "Alert Block",
    description: "赤帯付きの強調ブロック", descriptionEn: "Red emphasis block",
    snippet: "\\begin{alertblock}{重要}\n  ここに内容を書きます。\n\\end{alertblock}",
    templates: ["beamer"],
  },
  {
    id: "exampleblock",
    label: "例ブロック", labelEn: "Example Block",
    description: "緑帯付きの例示ブロック", descriptionEn: "Green example block",
    snippet: "\\begin{exampleblock}{例}\n  ここに内容を書きます。\n\\end{exampleblock}",
    templates: ["beamer"],
  },
  {
    id: "columns",
    label: "2 カラム", labelEn: "2 Columns",
    description: "左右分割のレイアウト", descriptionEn: "Side-by-side layout",
    snippet:
      "\\begin{columns}[T]\n  \\begin{column}{0.48\\textwidth}\n    左側の内容\n  \\end{column}\n  \\begin{column}{0.48\\textwidth}\n    右側の内容\n  \\end{column}\n\\end{columns}",
    templates: ["beamer"],
  },
  {
    id: "note",
    label: "注記ボックス", labelEn: "Note Box",
    description: "参考情報を枠で囲む", descriptionEn: "Framed note for reference",
    snippet: "\\begin{note}\n  ここに注記を書きます。\n\\end{note}",
    templates: ["report"],
  },
  {
    id: "daimon",
    label: "大問ボックス", labelEn: "Question Box",
    description: "番号付きの大問枠", descriptionEn: "Numbered question frame",
    snippet:
      "\\begin{daimon}{第 N 問\\quad テーマ \\haiten{10}}\n  ここに問題文を書きます。\n\\end{daimon}",
    templates: ["common-test", "kokuko-niji", "school-test"],
  },
  {
    id: "displayMath",
    label: "数式ブロック", labelEn: "Math Block",
    description: "中央に表示する数式", descriptionEn: "Centered display math",
    snippet: "\\[\n  f(x) = \\frac{1}{1 + e^{-x}}\n\\]",
  },
];

// ── 選択範囲への DOM 操作ヘルパ ──

function findHostEditable(node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n && n.nodeType !== 1) n = n.parentNode;
  const el = n as Element | null;
  if (!el) return null;
  return (el.closest(".editable-text-box") as HTMLElement | null) ?? null;
}

function wrapSelectionWith(wrap: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const host = findHostEditable(range.commonAncestorContainer);
  if (!host) return false;

  if (range.collapsed) {
    wrap.appendChild(document.createTextNode("\u200B"));
    range.insertNode(wrap);
    const caret = document.createRange();
    caret.selectNodeContents(wrap);
    caret.collapse(false);
    sel.removeAllRanges();
    sel.addRange(caret);
  } else {
    const contents = range.extractContents();
    wrap.appendChild(contents);
    range.insertNode(wrap);
    const newRange = document.createRange();
    newRange.selectNodeContents(wrap);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  host.dispatchEvent(new CustomEvent(COMMIT_EVENT, { bubbles: false }));
  return true;
}

function applyColor(name: string) {
  const span = document.createElement("span");
  span.setAttribute("data-color", name);
  return wrapSelectionWith(span);
}

function applyBold() {
  return wrapSelectionWith(document.createElement("strong"));
}

function applyItalic() {
  return wrapSelectionWith(document.createElement("em"));
}

function applyCode() {
  return wrapSelectionWith(document.createElement("code"));
}

function applyFbox() {
  const span = document.createElement("span");
  span.setAttribute("data-fbox-cmd", "fbox");
  return wrapSelectionWith(span);
}

function insertMathChip() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const host = findHostEditable(range.commonAncestorContainer);
  if (!host) return false;
  // 空の math chip を挿入 → ContentEditableBlock の Cmd+M 経路と同じ流儀
  const chip = document.createElement("span");
  chip.setAttribute("data-math-chip", "1");
  chip.setAttribute("data-wrapper", "dollar");
  chip.setAttribute("data-source", "");
  chip.setAttribute("contenteditable", "false");
  chip.className = "math-chip";
  chip.textContent = "∅";
  if (!range.collapsed) range.deleteContents();
  range.insertNode(chip);
  // キャレットをチップの直後に移動
  const after = document.createRange();
  after.setStartAfter(chip);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  // チップをクリックしてポップオーバーを開かせるために mousedown を合成
  chip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  return true;
}

// ── ブロック挿入 (新しい段落を差し込む) ──
//
// 現在キャレットがある ContentEditableBlock を探して、そのセグメント range の直後に
// `\n\n<snippet>\n` を挿入する。既存のラウンドトリップ経路を使わず、直接 document store の
// setLatex を呼ぶ。

function insertBlockSnippet(snippet: string): boolean {
  const store = useDocumentStore.getState();
  const doc = store.document;
  if (!doc) return false;
  const latex = doc.latex;

  // キャレット位置を取得 (contentEditable 内 or 末尾挿入)
  const sel = window.getSelection();
  const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  let insertPos = -1;

  if (range) {
    const host = findHostEditable(range.commonAncestorContainer);
    // host から [data-seg-end] の属性... いや、VisualEditor は seg end を持っていない。
    // 代わりに、\begin{document} / \end{document} の直前に挿入する。
    void host;
  }

  // フォールバック: \end{document} の直前に挿入
  if (insertPos === -1) {
    const endDoc = latex.indexOf("\\end{document}");
    insertPos = endDoc !== -1 ? endDoc : latex.length;
  }

  const before = latex.slice(0, insertPos);
  const after = latex.slice(insertPos);
  // 直前に空行を入れる
  const pad = before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const padAfter = after.startsWith("\n") ? "\n" : "\n\n";
  const newLatex = before + pad + snippet + padAfter + after;
  store.setLatex(newLatex);
  return true;
}

// ── React コンポーネント本体 ──

interface PopoverProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}

function Popover({ triggerRef, open, onClose, children, widthClass }: PopoverProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open || !pos || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={popoverRef}
      className={`fixed rounded-xl border border-border/60 bg-popover shadow-2xl shadow-foreground/20 p-3 animate-in fade-in slide-in-from-top-1 duration-150 ${widthClass ?? "w-[232px]"}`}
      style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

interface ToolBtnProps {
  onClick: () => void;
  title: string;
  desc?: string;
  active?: boolean;
  children: React.ReactNode;
}

function ToolBtn({ onClick, title, desc, active, children }: ToolBtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`group relative inline-flex items-center justify-center h-7 w-7 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors ${
        active ? "bg-foreground/[0.08] text-foreground" : ""
      }`}
    >
      {children}
      {/* カスタム tooltip */}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[10000] flex flex-col items-center">
        <span>{title}</span>
        {desc && <span className="text-[9px] opacity-60 mt-0.5">{desc}</span>}
        <span className="absolute left-1/2 -translate-x-1/2 -top-1 h-2 w-2 rotate-45 bg-foreground" />
      </span>
    </button>
  );
}

export function FormattingToolbar() {
  const { t, locale } = useI18n();
  const isJa = locale !== "en";
  const [colorOpen, setColorOpen] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const colorRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLButtonElement>(null);
  const document = useDocumentStore((s) => s.document);
  const templateId = document?.template ?? "blank";

  const handleColor = useCallback((name: string) => {
    applyColor(name);
    setColorOpen(false);
  }, []);

  const handleBox = useCallback((snippet: string) => {
    insertBlockSnippet(snippet);
    setBoxOpen(false);
  }, []);

  const availableBoxes = BOX_PRESETS.filter(
    (b) => !b.templates || b.templates.includes(templateId),
  );

  return (
    <div className="flex items-center gap-0.5 shrink-0" role="toolbar" aria-label={t("fmt.toolbar.label")}>
      <ToolBtn onClick={applyBold} title={t("fmt.bold")} desc={isJa ? "選択テキストを太字にする" : "Make selected text bold"}>
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={applyItalic} title={t("fmt.italic")} desc={isJa ? "選択テキストを斜体にする" : "Make selected text italic"}>
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={applyCode} title={t("fmt.code")} desc={isJa ? "等幅フォントで表示する" : "Display in monospace font"}>
        <Code2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={applyFbox} title={t("fmt.frame")} desc={isJa ? "選択部分を枠線で囲む" : "Add a border frame"}>
        <SquareDashed className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={insertMathChip} title={t("fmt.math")} desc={isJa ? "数式エディタを開く" : "Open math editor"}>
        <Sigma className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border/30 mx-1 shrink-0" />

      {/* カラーパレット */}
      <button
        ref={colorRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setColorOpen((v) => !v)}
        className="group relative inline-flex items-center gap-1 h-7 px-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
      >
        <Palette className="h-3.5 w-3.5" />
        <ChevronDown className={`h-3 w-3 transition-transform ${colorOpen ? "rotate-180" : ""}`} />
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[10000] flex flex-col items-center">
          <span>{t("fmt.color")}</span>
          <span className="text-[9px] opacity-60 mt-0.5">{isJa ? "文字の色を変更する" : "Change text color"}</span>
          <span className="absolute left-1/2 -translate-x-1/2 -top-1 h-2 w-2 rotate-45 bg-foreground" />
        </span>
      </button>

      {/* ボックス挿入 */}
      {availableBoxes.length > 0 && (
        <button
          ref={boxRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setBoxOpen((v) => !v)}
          className="group relative inline-flex items-center gap-1 h-7 px-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
        >
          <Box className="h-3.5 w-3.5" />
          <ChevronDown className={`h-3 w-3 transition-transform ${boxOpen ? "rotate-180" : ""}`} />
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[10000] flex flex-col items-center">
            <span>{t("fmt.box")}</span>
            <span className="text-[9px] opacity-60 mt-0.5">{isJa ? "装飾ブロックを追加する" : "Add a styled block"}</span>
            <span className="absolute left-1/2 -translate-x-1/2 -top-1 h-2 w-2 rotate-45 bg-foreground" />
          </span>
        </button>
      )}

      <Popover triggerRef={colorRef} open={colorOpen} onClose={() => setColorOpen(false)}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2 px-0.5">
          {isJa ? "文字色" : "Text Color"}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleColor(c.name)}
              className="h-7 w-7 rounded-md border border-foreground/15 hover:scale-110 transition-transform relative shadow-sm"
              style={{ backgroundColor: c.css }}
              aria-label={c.label}
            />
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-border/40 text-[10.5px] text-muted-foreground/70 leading-snug">
          {isJa
            ? <>選択した文字に <span className="font-mono">\textcolor</span> を適用します。</>
            : <>Applies <span className="font-mono">\textcolor</span> to selected text.</>
          }
        </div>
      </Popover>

      <Popover triggerRef={boxRef} open={boxOpen} onClose={() => setBoxOpen(false)} widthClass="w-[280px]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2 px-0.5">
          {isJa ? "ボックスを挿入" : "Insert Box"}
        </div>
        <div className="flex flex-col gap-1">
          {availableBoxes.map((b) => (
            <button
              key={b.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleBox(b.snippet)}
              className="flex flex-col items-start text-left px-2 py-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors"
            >
              <span className="text-[12px] font-semibold text-foreground/90">{isJa ? b.label : b.labelEn}</span>
              <span className="text-[10.5px] text-muted-foreground/70">{isJa ? b.description : b.descriptionEn}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border/40 text-[10.5px] text-muted-foreground/70 leading-snug">
          {isJa ? "本文の末尾にブロックが追加されます。" : "The block will be added at the end of the document."}
        </div>
      </Popover>
    </div>
  );
}
