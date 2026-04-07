"use client";

/**
 * TemplatePicker — テンプレ選択ポップオーバー
 *
 * ・トリガーボタン: 現在のテンプレ名 + タグ
 * ・展開後: カテゴリタブ + テンプレカードグリッド
 * ・カードに gradient プレビュー / アイコン / タグ / 説明 / ハイライト
 * ・キーボード操作 (Esc 閉じる)
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

  // Filtered templates by category
  const visible = useMemo(() => {
    if (activeCat === "all") return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeCat);
  }, [activeCat]);

  // Click-outside / Escape to close
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
        <div className="absolute left-0 top-full mt-1.5 w-[760px] max-w-[calc(100vw-2rem)] z-50 rounded-2xl border border-border/60 bg-popover shadow-2xl shadow-foreground/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
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

          {/* Card grid */}
          <div className="max-h-[64vh] overflow-y-auto p-4 bg-muted/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
        active ? "bg-foreground/[0.10] text-foreground/70" : "bg-foreground/[0.05] text-muted-foreground/60"
      }`}>
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────
// TemplateCard
// ─────────────────────────────────────

interface TemplateCardProps {
  tpl: TemplateDefinition;
  isJa: boolean;
  selected: boolean;
  onSelect: () => void;
}

function TemplateCard({ tpl, isJa, selected, onSelect }: TemplateCardProps) {
  const name = isJa ? tpl.name : tpl.nameEn;
  const desc = isJa ? tpl.description : tpl.descriptionEn;
  const tag = isJa ? tpl.tag : tpl.tagEn;
  const contents = isJa ? tpl.contents : tpl.contentsEn;
  const includesLabel = isJa ? "出力に含まれるもの" : "What you get";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-xl border transition-all duration-200 overflow-hidden bg-background hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-px ${
        selected
          ? "border-emerald-400/60 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/30"
          : "border-border/50 hover:border-foreground/20"
      }`}
    >
      {/* Gradient header bar */}
      <div className={`h-12 bg-gradient-to-br ${tpl.gradient} relative flex items-center justify-between px-3`}>
        <div className="text-[26px] leading-none drop-shadow-sm">{tpl.icon}</div>
        {tag && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-white font-bold uppercase tracking-wider">
            {tag}
          </span>
        )}
        {selected && (
          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="text-[13px] font-bold text-foreground leading-tight">{name}</div>
        <div className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
          {desc}
        </div>

        {contents && contents.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-border/40">
            <div className="text-[8.5px] font-bold uppercase tracking-wider text-foreground/45 mb-1">
              {includesLabel}
            </div>
            <ul className="space-y-0.5">
              {contents.slice(0, 6).map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10.5px] text-foreground/65">
                  <span className="text-foreground/25 mt-px shrink-0">▸</span>
                  <span className="leading-snug">{c}</span>
                </li>
              ))}
              {contents.length > 6 && (
                <li className="text-[9.5px] text-muted-foreground/50 italic pl-3">
                  {isJa ? `+ さらに ${contents.length - 6} 項目` : `+ ${contents.length - 6} more`}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </button>
  );
}
