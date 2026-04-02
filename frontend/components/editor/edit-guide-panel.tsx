"use client";

import { Keyboard, MousePointer2, PenLine, Sigma, Command, Heading, List, Table, Code } from "lucide-react";
import type { GuideContext } from "@/store/ui-store";

const shortcuts = [
  { keys: ["Enter"],        desc: "新しい段落を追加" },
  { keys: ["⌫"],           desc: "空行 → 行を削除して前に戻る" },
  { keys: ["Tab"],          desc: "インライン数式 $...$ を挿入" },
  { keys: ["/"],            desc: "要素挿入メニューを開く" },
  { keys: ["⌘", "K"],      desc: "要素挿入パレット" },
  { keys: ["↑", "↓"],     desc: "段落間を移動" },
  { keys: ["⌘", "Z"],      desc: "元に戻す" },
  { keys: ["⌘", "Shift", "Z"], desc: "やり直す" },
  { keys: ["⌘", "B"],      desc: "太字" },
];

const writingTips = [
  { icon: MousePointer2, color: "text-sky-500",    text: "クリックしてすぐ書ける — 選択ステップ不要" },
  { icon: PenLine,       color: "text-blue-400",   text: "見出しはツールバーから H1/H2/H3 を選択" },
  { icon: Sigma,         color: "text-violet-500", text: "Tab で数式 $...$ モードに（日本語→数式変換）" },
  { icon: Command,       color: "text-slate-400",  text: "右クリックで 削除・移動・種類変更" },
];

// コンテキスト別ガイド
const CONTEXT_GUIDES: Record<string, { icon: React.ElementType; color: string; title: string; tips: string[] }> = {
  heading: {
    icon: Heading,
    color: "text-blue-500",
    title: "見出しガイド",
    tips: [
      "H1: 文書タイトルに使用",
      "H2: セクション見出しに使用",
      "H3: サブセクションに使用",
      "ツールバーで見出しレベルを変更可能",
      "右クリック → 種類変更 で段落に戻せます",
    ],
  },
  list: {
    icon: List,
    color: "text-emerald-500",
    title: "リストガイド",
    tips: [
      "Enter で新しい項目を追加",
      "Backspace で空の項目を削除",
      "箇条書き（•）と番号付き（1.）を切替可能",
      "右クリック → 種類変更 でリスト形式を変更",
      "「+ 追加」ボタンで項目を末尾に追加",
    ],
  },
  table: {
    icon: Table,
    color: "text-amber-500",
    title: "表ガイド",
    tips: [
      "各セルをクリックして直接編集",
      "「+ 行」「+ 列」で表を拡張",
      "ヘッダー行は自動で太字表示",
      "キャプション欄で表の説明を追加可能",
      "セル内に $数式$ も入力可能",
    ],
  },
  code: {
    icon: Code,
    color: "text-gray-500",
    title: "コードブロックガイド",
    tips: [
      "左上のフィールドで言語名を指定（例: python, javascript）",
      "コードはそのまま等幅フォントで表示",
      "インデントは自動保持",
      "LaTeX の listings / minted パッケージで出力",
    ],
  },
};

function KeyBadge({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md text-[10px] font-mono font-medium bg-muted border border-border/60 text-foreground/70 leading-none select-none">
      {k}
    </kbd>
  );
}

export function EditGuidePanel({ context = "none" }: { context?: GuideContext }) {
  const ctxGuide = CONTEXT_GUIDES[context];

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      {/* コンテキスト別ガイド（該当時のみ表示） */}
      {ctxGuide && (
        <>
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ctxGuide.icon className={`h-3.5 w-3.5 ${ctxGuide.color} shrink-0`} />
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${ctxGuide.color}`}>{ctxGuide.title}</span>
            </div>
            <div className="space-y-2">
              {ctxGuide.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`text-[10px] mt-0.5 font-bold ${ctxGuide.color}`}>•</span>
                  <span className="text-[11px] text-muted-foreground/70 leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="h-px bg-border/20" />
        </>
      )}

      {/* キーボードショートカット */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">キーボード</span>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, j) => <KeyBadge key={j} k={k} />)}
              </div>
              <span className="text-[11px] text-muted-foreground/70 leading-tight">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-border/20" />

      {/* 操作ヒント */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <PenLine className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">操作ヒント</span>
        </div>
        <div className="space-y-2.5">
          {writingTips.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <div key={i} className="flex items-start gap-2.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tip.color}`} />
                <span className="text-[11px] text-muted-foreground/70 leading-relaxed">{tip.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-border/20" />

      {/* 要素の種類 */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Command className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">要素の種類</span>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mb-3 leading-relaxed">
          テキスト入力中に <KeyBadge k="/" /> を押して要素の種類を選択できます
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: "テキスト",  color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
            { name: "見出し",    color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
            { name: "数式",      color: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
            { name: "リスト",    color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
            { name: "表",        color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
            { name: "コード",    color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" },
            { name: "引用",      color: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
            { name: "区切り線",  color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
          ].map((b) => (
            <span key={b.name} className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-medium ${b.color}`}>
              {b.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
