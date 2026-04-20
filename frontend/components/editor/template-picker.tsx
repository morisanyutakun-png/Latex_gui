"use client";

/**
 * TemplatePicker — テンプレ選択ポップオーバー
 *
 * ・トリガーボタン: 現在のテンプレ名 + タグ
 * ・展開後: カテゴリタブ + ビジュアルプレビュー中心のカードグリッド
 * ・各カードは TemplatePreview (実際の出力に近いミニチュア) を主役にする
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateDefinition,
  type TemplateCategory,
} from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { ChevronDown, Check, Sparkles, Lock } from "lucide-react";
import { TemplatePreview } from "./template-previews";
import { usePlanStore } from "@/store/plan-store";
import { PLANS } from "@/lib/plans";

interface TemplatePickerProps {
  currentId: string;
  onSelect: (id: string) => void;
  label: string;
  /** Render a minimal pill-style trigger instead of the full toolbar button */
  compact?: boolean;
  /** Large prominent trigger for toolbar hero placement */
  large?: boolean;
}

export function TemplatePicker({ currentId, onSelect, label, compact, large }: TemplatePickerProps) {
  const { locale } = useI18n();
  const isJa = locale === "ja";
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<TemplateCategory | "all">("all");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // LP の「テンプレート解放」に対応するためプラン情報を購読する。
  //   - tier:"pro"     → Pro / Premium で解放
  //   - tier:"premium" → Premium のみで解放
  // いずれも未解放のテンプレを選ぶと pricing modal に誘導する。
  // subscribe to currentPlan so UI re-renders on plan changes (value read via checkFeature)
  usePlanStore((s) => s.currentPlan);
  const checkFeature = usePlanStore((s) => s.checkFeature);
  const setShowPricing = usePlanStore((s) => s.setShowPricing);
  const proTemplatesAllowed = checkFeature("allTemplates").allowed;
  const premiumTemplatesAllowed = checkFeature("premiumTemplates").allowed;
  // ポップオーバーをツールバー (backdrop-blur で stacking context が固定される) の外に
  // 描画するため createPortal + fixed positioning を使う。
  const [pos, setPos] = useState<{ top: number; left: number; maxWidth: number } | null>(null);

  const current = TEMPLATES.find((tpl) => tpl.id === currentId) ?? TEMPLATES[0];

  const visible = useMemo(() => {
    if (activeCat === "all") return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeCat);
  }, [activeCat]);

  // open 中はトリガーの位置を追跡 (resize / scroll に追従)
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const desired = 920;
      const margin = 16;
      const maxWidth = Math.min(desired, window.innerWidth - margin * 2);
      // トリガー左端を起点に左寄せ。右端がはみ出すなら左方向に押し戻す。
      let left = rect.left;
      if (left + maxWidth + margin > window.innerWidth) {
        left = window.innerWidth - maxWidth - margin;
      }
      if (left < margin) left = margin;
      setPos({ top: rect.bottom + 6, left, maxWidth });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // 外側クリック / Esc で閉じる (portal 経由でも triggerRef と popoverRef で判定)
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
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
      {large ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-center gap-3 h-12 px-4 rounded-xl border-2 border-dashed border-violet-300/50 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/[0.06] hover:bg-violet-100/70 dark:hover:bg-violet-500/[0.12] hover:border-violet-400/70 dark:hover:border-violet-500/50 transition-all duration-200"
        >
          <span className="text-2xl leading-none">{current.icon}</span>
          <div className="flex flex-col items-start">
            <span className="text-[13px] font-bold text-foreground/80 group-hover:text-foreground">{isJa ? current.name : current.nameEn}</span>
            <span className="text-[10px] text-violet-500/60 group-hover:text-violet-500">{isJa ? "クリックして変更" : "Click to change"}</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-violet-400/50 group-hover:text-violet-500 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      ) : compact ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10.5px] font-medium bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition-colors shrink-0"
        >
          <span className="text-[12px] leading-none">{current.icon}</span>
          <span>{label}</span>
          <ChevronDown className={`h-2.5 w-2.5 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/40 font-mono select-none hidden sm:inline">
            {label}
          </span>
          <button
            ref={triggerRef}
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
      )}

      {/* ── Popover (portal でツールバーの stacking context 外に描画) ── */}
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="fixed rounded-2xl border border-border/60 bg-popover shadow-2xl shadow-foreground/20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ top: pos.top, left: pos.left, width: pos.maxWidth, zIndex: 9999 }}
        >
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
              {visible.map((tpl) => {
                // tier:"pro"     → Pro/Premium で解放、未満は pro ロック (紫バッジ)
                // tier:"premium" → Premium のみ解放、未満は premium ロック (金バッジ)
                const lockedBy: "pro" | "premium" | null =
                  tpl.tier === "premium" && !premiumTemplatesAllowed
                    ? "premium"
                    : tpl.tier === "pro" && !proTemplatesAllowed
                      ? "pro"
                      : null;
                return (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    isJa={isJa}
                    selected={tpl.id === currentId}
                    lockedBy={lockedBy}
                    onSelect={() => {
                      if (lockedBy) {
                        // 未解放テンプレを選択 → pricing modal へ誘導
                        setOpen(false);
                        setShowPricing(true);
                        return;
                      }
                      onSelect(tpl.id);
                      setOpen(false);
                    }}
                  />
                );
              })}
            </div>
            {/* Pro 未満の人向け: Pro 解放テンプレの案内 */}
            {!proTemplatesAllowed && (
              <div className="mt-4 rounded-xl border border-violet-400/30 bg-violet-50/60 dark:bg-violet-500/[0.08] px-4 py-3 flex items-center gap-3">
                <Lock className="h-4 w-4 text-violet-500 shrink-0" />
                <div className="flex-1 text-[11.5px] text-foreground/75 leading-snug">
                  {isJa
                    ? `入試・発表・塾プリント・英語・技術報告書 の 6 種テンプレートは ${PLANS.pro.name} プラン以上でご利用いただけます。`
                    : `6 Pro templates (exams, slides, reading, reports…) are available on ${PLANS.pro.name} and above.`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowPricing(true);
                  }}
                  className="shrink-0 h-7 px-3 rounded-lg text-[11px] font-bold bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow hover:opacity-90 transition"
                >
                  {isJa ? "Pro にアップグレード" : `Upgrade to ${PLANS.pro.name}`}
                </button>
              </div>
            )}
            {/* Premium 未満の人向け: Premium 限定テンプレ (卒論・ポスター 等) の案内 */}
            {!premiumTemplatesAllowed && (
              <div className="mt-3 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-50/70 to-orange-50/50 dark:from-amber-500/[0.08] dark:to-orange-500/[0.06] px-4 py-3 flex items-center gap-3">
                <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 text-[11.5px] text-foreground/80 leading-snug">
                  {isJa
                    ? `卒論・学会ポスター・学術論文・総合模試冊子・問題集・教科書 の Premium 限定 6 テンプレは ${PLANS.premium.name} プランでご利用いただけます。`
                    : `Thesis, academic poster, journal paper, full mock-exam, problem book, textbook — these ${PLANS.premium.name}-only templates require ${PLANS.premium.name}.`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowPricing(true);
                  }}
                  className="shrink-0 h-7 px-3 rounded-lg text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow hover:opacity-90 transition"
                >
                  {isJa ? `${PLANS.premium.name} にアップグレード` : `Upgrade to ${PLANS.premium.name}`}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
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
  /**
   * どのプランが未解放でこのカードをロックしているか。
   *   - "pro"     → Pro で解放可能な Pro テンプレ
   *   - "premium" → Premium 専用テンプレ
   *   - null      → 解放済み (選択可能)
   */
  lockedBy?: "pro" | "premium" | null;
  onSelect: () => void;
}

function TemplateCard({ tpl, isJa, selected, lockedBy = null, onSelect }: TemplateCardProps) {
  const name = isJa ? tpl.name : tpl.nameEn;
  const tag = isJa ? tpl.tag : tpl.tagEn;
  const locked = lockedBy !== null;

  // ロックバッジの見た目はプラン階層で差をつける。
  //   Pro     → ブランドの紫/青グラデ (既存の視覚言語)
  //   Premium → 金/オレンジグラデ (最上位プラン = 特別感)
  const lockBadge = lockedBy === "premium"
    ? {
        bg: "bg-gradient-to-r from-amber-500 to-orange-500",
        ring: "ring-1 ring-amber-400/50 hover:ring-amber-500/70 hover:shadow-md hover:shadow-amber-500/15",
        label: isJa ? "Premium 限定" : "Premium only",
        title: isJa ? "Premium プランで利用可能" : "Requires Premium plan",
      }
    : {
        bg: "bg-gradient-to-r from-blue-600 to-violet-600",
        ring: "ring-1 ring-violet-400/40 hover:ring-violet-500/60 hover:shadow-md hover:shadow-violet-500/10",
        label: isJa ? "Pro 以上" : "Pro only",
        title: isJa ? "Pro プラン以上で利用可能" : "Requires Pro plan or higher",
      };

  return (
    <button
      type="button"
      onClick={onSelect}
      title={locked ? lockBadge.title : undefined}
      className={`group relative text-left rounded-xl transition-all duration-200 overflow-hidden hover:-translate-y-0.5 ${
        selected
          ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/15"
          : locked
          ? lockBadge.ring
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
        {locked && (
          <div className="absolute inset-3 rounded-md bg-foreground/[0.35] dark:bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${lockBadge.bg} text-white text-[10px] font-bold shadow`}>
              <Lock className="h-3 w-3" />
              {lockBadge.label}
            </span>
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
