"use client";

/**
 * TemplatePicker — テンプレ選択ポップオーバー
 *
 * ・トリガーボタン: 現在のテンプレ名 + タグ
 * ・展開後: カテゴリタブ + ビジュアルプレビュー中心のカードグリッド
 * ・各カードは TemplatePreview (実際の出力に近いミニチュア) を主役にする
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateDefinition,
  type TemplateCategory,
} from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { TemplatePreview } from "./template-previews";

interface TemplatePickerProps {
  currentId: string;
  onSelect: (id: string) => void;
  label: string;
}

export function TemplatePicker({ currentId, onSelect, label }: TemplatePickerProps) {
  const { locale } = useI18n();
  const isJa = locale === "ja";
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<TemplateCategory | "all">("all");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = TEMPLATES.find((tpl) => tpl.id === currentId) ?? TEMPLATES[0];

  const visible = useMemo(() => {
    if (activeCat === "all") return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeCat);
  }, [activeCat]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const categoryCount = (cat: TemplateCategory) =>
    TEMPLATES.filter((t) => t.category === cat).length;

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      {/* ── Trigger ── */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/40 font-mono select-none hidden sm:inline">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-foreground/[0.10] bg-white/70 dark:bg-white/5 text-[11px] text-foreground/85 hover:bg-white dark:hover:bg-white/10 transition-colors"
        >
          <span className="text-[13px] leading-none">{current.icon}</span>
          <span className="font-medium">{isJa ? current.name : current.nameEn}</span>
          {(isJa ? current.tag : current.tagEn) && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-foreground/[0.06] text-foreground/55 font-mono uppercase tracking-wider">
              {isJa ? current.tag : current.tagEn}
            </span>
          )}
          <ChevronDown
            className={`h-3 w-3 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* ── Popover ── */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-[920px] max-w-[calc(100vw-2rem)] z-50 rounded-2xl border border-border/60 bg-popover shadow-2xl shadow-foreground/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-r from-muted/40 to-transparent">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">
                {isJa ? "テンプレートを選ぶ" : "Pick a template"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {TEMPLATES.length} {isJa ? "種類" : "templates"}
            </span>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40 bg-background overflow-x-auto scrollbar-none">
            <CategoryTab
              icon="✨"
              label={isJa ? "すべて" : "All"}
              count={TEMPLATES.length}
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
            />
            {TEMPLATE_CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat.id}
                icon={cat.icon}
                label={isJa ? cat.label : cat.labelEn}
                count={categoryCount(cat.id)}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
              />
            ))}
          </div>

          {/* Card grid — visual previews are the centerpiece */}
          <div className="max-h-[68vh] overflow-y-auto p-4 bg-stone-100/50 dark:bg-stone-950/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {visible.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  isJa={isJa}
                  selected={tpl.id === currentId}
                  onSelect={() => {
                    onSelect(tpl.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────
// CategoryTab
// ─────────────────────────────────────

interface CategoryTabProps {
  icon: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryTab({ icon, label, count, active, onClick }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 ${
        active
          ? "bg-foreground/[0.08] text-foreground shadow-sm border border-foreground/[0.10]"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] border border-transparent"
      }`}
    >
      <span className="text-[13px] leading-none">{icon}</span>
      <span>{label}</span>
      <span
        className={`text-[9px] font-mono px-1 py-0.5 rounded ${
          active ? "bg-foreground/[0.10] text-foreground/70" : "bg-foreground/[0.05] text-muted-foreground/60"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────
// TemplateCard — ビジュアルプレビュー中心
// ─────────────────────────────────────

interface TemplateCardProps {
  tpl: TemplateDefinition;
  isJa: boolean;
  selected: boolean;
  onSelect: () => void;
}

function TemplateCard({ tpl, isJa, selected, onSelect }: TemplateCardProps) {
  const name = isJa ? tpl.name : tpl.nameEn;
  const tag = isJa ? tpl.tag : tpl.tagEn;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-xl transition-all duration-200 overflow-hidden hover:-translate-y-0.5 ${
        selected
          ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/15"
          : "ring-1 ring-border/40 hover:ring-foreground/30 hover:shadow-md hover:shadow-foreground/10"
      }`}
    >
      {/* Visual preview takes the whole card top */}
      <div className="relative bg-stone-200/40 dark:bg-stone-900/40 p-3">
        <TemplatePreview id={tpl.id} />
        {selected && (
          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow ring-2 ring-white">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Footer label only — name + tag */}
      <div className="px-3 py-2 bg-background border-t border-border/40 flex items-center gap-2">
        <span className="text-[14px] leading-none">{tpl.icon}</span>
        <span className="text-[12px] font-bold text-foreground truncate flex-1">{name}</span>
        {tag && (
          <span className="shrink-0 text-[8.5px] px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/60 font-mono uppercase tracking-wider">
            {tag}
          </span>
        )}
      </div>
    </button>
  );
}
