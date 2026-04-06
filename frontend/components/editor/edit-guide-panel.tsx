"use client";

import { Keyboard, MousePointer2, PenLine, Sigma, Command, Heading, List, Table, Code } from "lucide-react";
import type { GuideContext } from "@/store/ui-store";

/* ──────────────────────────────────────────────
   現在の実装に厳密に一致するショートカット一覧
   （use-keyboard.ts と各 BlockEditor の handleKeyDown を反映）
   ────────────────────────────────────────────── */

// グローバルショートカット (use-keyboard.ts)
const globalShortcuts = [
  { keys: ["Ctrl/⌘", "S"],         desc: "JSONとして保存" },
  { keys: ["Ctrl/⌘", "P"],         desc: "PDFを生成" },
  { keys: ["Ctrl/⌘", "Z"],         desc: "元に戻す" },
  { keys: ["Ctrl/⌘", "Shift", "Z"], desc: "やり直す" },
  { keys: ["Ctrl/⌘", "K"],         desc: "ブロック挿入パレットを開く" },
  { keys: ["Ctrl/⌘", "D"],         desc: "選択ブロックを複製" },
  { keys: ["⌫"],                    desc: "選択ブロックを削除（編集中でない時）" },
  { keys: ["Esc"],                  desc: "編集を抜ける／選択を解除" },
];

// 編集中のショートカット（textarea にフォーカスがある時）
const editingShortcuts = [
  { keys: ["Tab"],   desc: "段落内：日本語数式モードに入る／確定して抜ける" },
  { keys: ["Esc"],   desc: "数式モード中：未確定の入力を破棄してキャンセル" },
  { keys: ["⌫"],    desc: "空のブロックで押すと、ブロック削除＋前の行へ移動" },
  { keys: ["↑", "↓"], desc: "段落の先頭／末尾で押すと、前後の段落へ移動" },
  { keys: [";;"],    desc: "本文中に入力するとブロック挿入パレットが開く" },
];

// 操作ヒント — UI の動きの中で覚えておくと便利なもの
const writingTips = [
  { icon: MousePointer2, color: "text-sky-500",    text: "クリックでそのまま編集開始 — 選択ステップ不要" },
  { icon: PenLine,       color: "text-blue-400",   text: "見出しのレベルはツールバーの H1/H2/H3 セレクターで変更" },
  { icon: Sigma,         color: "text-violet-500", text: "段落で Tab → 日本語で入力 → Tab で LaTeX に確定 / Esc でキャンセル" },
  { icon: Command,       color: "text-slate-400",  text: "右クリックで「上下移動・複製・種類変更・削除」が呼べる" },
];

/* ──────────────────────────────────────────────
   コンテキスト別ガイド — 各 BlockEditor の実装を直接反映
   ────────────────────────────────────────────── */
const CONTEXT_GUIDES: Record<string, { icon: React.ElementType; color: string; title: string; tips: string[] }> = {
  heading: {
    icon: Heading,
    color: "text-blue-500",
    title: "見出しガイド",
    tips: [
      "H1 / H2 / H3 はツールバーのセレクターで切替",
      "Tab を押すと見出し内に $...$ の数式デリミタを挿入",
      "Enter で続きに段落を追加",
      "空にして ⌫ を押すと前の段落に戻る",
      "右クリック →「種類変更」で他のブロックに変換",
    ],
  },
  list: {
    icon: List,
    color: "text-emerald-500",
    title: "リストガイド",
    tips: [
      "Enter で新しい項目を追加",
      "空の項目で ⌫ を押すと項目を削除",
      "箇条書き（•）と番号付き（1.）はツールバーで切替",
      "ホバーで現れる「+ 追加」で項目を末尾に追加",
    ],
  },
  table: {
    icon: Table,
    color: "text-amber-500",
    title: "表ガイド",
    tips: [
      "セルをクリックして直接編集",
      "ホバーで現れる「+ 行」「+ 列」で表を拡張",
      "1 行目は自動的にヘッダー（太字）として扱われる",
      "セル内に $数式$ を直接書ける",
    ],
  },
  code: {
    icon: Code,
    color: "text-gray-500",
    title: "コードブロックガイド",
    tips: [
      "左上のフィールドで言語名を指定（例: python, javascript）",
      "等幅フォントで表示、インデントはそのまま保持",
      "PDF 出力時は LaTeX の listings パッケージで組版",
    ],
  },
};

/* ──────────────────────────────────────────────
   ブロックタイプ — lib/types.ts BLOCK_TYPES と完全一致
   ────────────────────────────────────────────── */
const BLOCK_PALETTE: { name: string; color: string }[] = [
  { name: "テキスト",     color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
  { name: "見出し",       color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  { name: "数式",         color: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
  { name: "リスト",       color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  { name: "表",           color: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
  { name: "画像",         color: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300" },
  { name: "コード",       color: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" },
  { name: "引用",         color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  { name: "区切り線",     color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  { name: "回路図",       color: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300" },
  { name: "ダイアグラム", color: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" },
  { name: "化学式",       color: "bg-lime-100 dark:bg-lime-900/40 text-lime-700 dark:text-lime-300" },
  { name: "グラフ",       color: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" },
  { name: "LaTeXコード",  color: "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300" },
];

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

      {/* グローバルショートカット */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">グローバル</span>
        </div>
        <div className="space-y-2">
          {globalShortcuts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0 min-w-[110px]">
                {s.keys.map((k, j) => <KeyBadge key={j} k={k} />)}
              </div>
              <span className="text-[11px] text-muted-foreground/70 leading-tight">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-border/20" />

      {/* 編集中のショートカット */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">編集中</span>
        </div>
        <div className="space-y-2">
          {editingShortcuts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0 min-w-[110px]">
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

      {/* ブロック挿入 */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Command className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">挿入できるブロック</span>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mb-3 leading-relaxed">
          <KeyBadge k="Ctrl/⌘" /><KeyBadge k="K" /> または 編集中に <KeyBadge k=";;" /> でパレットを開く
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {BLOCK_PALETTE.map((b) => (
            <span key={b.name} className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-medium ${b.color}`}>
              {b.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
