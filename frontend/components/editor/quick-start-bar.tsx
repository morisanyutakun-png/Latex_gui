"use client";

import { useState, useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import {
  Sparkles,
  ScanLine,
  ClipboardCheck,
  X,
  LayoutTemplate,
  ArrowRight,
} from "lucide-react";
import { TemplatePicker } from "./template-picker";
import { createFromTemplate, TEMPLATES } from "@/lib/templates";

const DISMISS_KEY = "lx-quickstart-dismissed-v1";

// 主要テンプレをクイックアクセスに並べる
const QUICK_TEMPLATES = [
  { id: "school-test", icon: "📝" },
  { id: "worksheet", icon: "📓" },
  { id: "common-test", icon: "🎓" },
  { id: "article", icon: "📑" },
];

/**
 * QuickStartBar — ドキュメントが空の時、ツールバー下に表示される
 * 目立つアクションカード。4つの入り口を視覚的に案内する。
 */
export function QuickStartBar() {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const latex = useDocumentStore((s) => s.document?.latex);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const template = useDocumentStore((s) => s.document?.template ?? "blank");
  const triggerOMR = useUIStore((s) => s.triggerOMR);
  const openGrading = useUIStore((s) => s.openGrading);
  const doc = useDocumentStore((s) => s.document);

  const [dismissed, setDismissed] = useState(false);
  const [persistDismissed, setPersistDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setPersistDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setPersistDismissed(false);
    }
  }, []);

  if (persistDismissed === null) return null;
  if (persistDismissed || dismissed) return null;

  const isEmpty = !latex || latex.trim().length === 0;
  if (!isEmpty) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  const handleTemplate = (id: string) => {
    setDocument(createFromTemplate(id, locale));
    setDismissed(true);
  };

  return (
    <div className="shrink-0 border-b border-foreground/[0.06] bg-gradient-to-r from-amber-50/60 via-violet-50/40 to-sky-50/40 dark:from-amber-950/15 dark:via-violet-950/10 dark:to-sky-950/10 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-[12px] font-bold text-foreground/70">
              {isJa ? "さあ、始めましょう" : "Let's get started"}
            </span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="h-6 w-6 flex items-center justify-center rounded-md text-foreground/25 hover:text-foreground/60 hover:bg-foreground/[0.05] transition-colors"
            title={isJa ? "閉じる" : "Dismiss"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action cards — 2行: テンプレ行 + 機能行 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {/* AI チャット */}
          <button
            type="button"
            onClick={dismiss}
            className="group flex items-center gap-2.5 min-w-[180px] px-3 py-2 rounded-lg border border-amber-300/40 dark:border-amber-500/20 bg-white/80 dark:bg-white/[0.04] hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-400/60 transition-all shrink-0"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[12px] font-bold text-foreground/80">{isJa ? "AIに頼む" : "Ask AI"}</div>
              <div className="text-[10px] text-muted-foreground/50 leading-snug">{isJa ? "右のチャットで話しかける →" : "Chat in the sidebar →"}</div>
            </div>
          </button>

          {/* クイック テンプレート */}
          {QUICK_TEMPLATES.map(({ id, icon }) => {
            const tpl = TEMPLATES.find((t) => t.id === id);
            if (!tpl) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTemplate(id)}
                className="group flex items-center gap-2 min-w-[140px] px-3 py-2 rounded-lg border border-violet-300/30 dark:border-violet-500/15 bg-white/80 dark:bg-white/[0.04] hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:border-violet-400/50 transition-all shrink-0"
              >
                <span className="text-xl shrink-0">{icon}</span>
                <div className="text-left min-w-0">
                  <div className="text-[11px] font-semibold text-foreground/75 truncate">{isJa ? tpl.name : tpl.nameEn}</div>
                  <div className="text-[9px] text-muted-foreground/40">{isJa ? "テンプレート" : "Template"}</div>
                </div>
              </button>
            );
          })}

          {/* もっとテンプレ */}
          <TemplatePicker
            currentId={template}
            onSelect={handleTemplate}
            label={isJa ? "もっと見る…" : "More…"}
            compact
          />

          {/* 区切り */}
          <div className="w-px bg-foreground/[0.06] shrink-0 my-1" />

          {/* 画像読取 */}
          <button
            type="button"
            onClick={() => { triggerOMR(); dismiss(); }}
            className="group flex items-center gap-2.5 min-w-[150px] px-3 py-2 rounded-lg border border-emerald-300/30 dark:border-emerald-500/15 bg-white/80 dark:bg-white/[0.04] hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400/50 transition-all shrink-0"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ScanLine className="h-4 w-4 text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[12px] font-bold text-foreground/80">{isJa ? "画像を読む" : "Scan image"}</div>
              <div className="text-[10px] text-muted-foreground/50 leading-snug">{isJa ? "PDF/画像→教材に変換" : "PDF/image → worksheet"}</div>
            </div>
          </button>

          {/* 採点 */}
          <button
            type="button"
            onClick={() => { openGrading(doc?.latex || "", doc?.metadata.title || ""); dismiss(); }}
            className="group flex items-center gap-2.5 min-w-[150px] px-3 py-2 rounded-lg border border-rose-300/30 dark:border-rose-500/15 bg-white/80 dark:bg-white/[0.04] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-400/50 transition-all shrink-0"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardCheck className="h-4 w-4 text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[12px] font-bold text-foreground/80">{isJa ? "採点する" : "Grade answers"}</div>
              <div className="text-[10px] text-muted-foreground/50 leading-snug">{isJa ? "答案→AI採点→赤入れ" : "AI grading + markup"}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
