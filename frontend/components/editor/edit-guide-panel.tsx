"use client";

import { Keyboard, MousePointer2, PenLine, Sigma, Command, Plus, Trash2, Copy, GripVertical } from "lucide-react";

const shortcuts = [
  { keys: ["Tab"], desc: "インライン数式 $...$ を挿入" },
  { keys: ["⌘", "Shift", "M"], desc: "数式モード 切替" },
  { keys: ["Enter"], desc: "ブロックの下に新しいテキストを追加" },
  { keys: ["↑", "↓"], desc: "ブロック間を移動" },
  { keys: ["/"], desc: "ブロック挿入メニューを開く" },
  { keys: ["⌘", "K"], desc: "ブロック挿入パレット" },
  { keys: ["⌘", "Z"], desc: "元に戻す" },
  { keys: ["⌘", "Shift", "Z"], desc: "やり直す" },
  { keys: ["⌘", "B"], desc: "太字" },
];

const blockTips = [
  { icon: MousePointer2, color: "text-sky-500", text: "クリックでブロックを選択・編集" },
  { icon: GripVertical, color: "text-slate-400", text: "左端のハンドルでドラッグ移動" },
  { icon: Copy, color: "text-blue-400", text: "右のアイコンから複製・削除" },
  { icon: Plus, color: "text-emerald-500", text: "最後の行をクリックして新規追加" },
  { icon: Sigma, color: "text-violet-500", text: "Tabキーで $...$ 数式モードに入る" },
];

function KeyBadge({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md text-[10px] font-mono font-medium bg-muted border border-border/60 text-foreground/70 leading-none select-none">
      {k}
    </kbd>
  );
}

export function EditGuidePanel() {
  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
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
          {blockTips.map((tip, i) => {
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

      {/* スラッシュコマンド */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Command className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">ブロックの種類</span>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mb-3 leading-relaxed">
          テキスト入力中に <KeyBadge k="/" /> を押してブロック種類を選択できます
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: "テキスト", color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
            { name: "見出し", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
            { name: "数式", color: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
            { name: "リスト", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
            { name: "表", color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
            { name: "コード", color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" },
            { name: "引用", color: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
            { name: "区切り線", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
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
