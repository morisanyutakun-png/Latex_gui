"use client";

/**
 * VariantStudio — 類題自動生成の独立パネル (チャット履歴を汚さない)。
 *
 * デザイン方針 (Apple / Linear / Stripe を参考):
 *   - PC:  右側 480px の slide-over (OMRSplitView と同様の独立モード)
 *   - モバイル: 全画面 bottom sheet
 *   - ambient な mesh gradient 背景で「核機能」感を出す
 *   - スタイルカードは active で発光、選択でリング + glow
 *   - 大型 CTA は violet→fuchsia→blue グラデ + 連射 CTA を主役
 *   - 進行中は shimmer overlay
 *   - **ユーザの自由入力 (追加メモ) は撤去**。REM ノウハウだけで完結させる UX
 *   - Pro+ 無制限、Free は localStorage で 1 回だけ体験 (フリーミアム)
 *
 * 履歴に乗せない実生成は `lib/variant-generate.ts` の `generateVariantSilently` が担う。
 */

import React from "react";
import {
  X, Sparkles, Lock, Crown, Loader2, Check,
  TrendingUp, TrendingDown, Shuffle, Plus, Minus, ArrowRight, AlertCircle,
  Zap, Wand2, FileText, FileSignature,
} from "lucide-react";
import { toast } from "sonner";

import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { usePlanStore } from "@/store/plan-store";
import { canUseFeature } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { hasUsedVariantTrial, markVariantTrialUsed } from "@/lib/variant-trial";
import {
  trackVariantGenClick, trackVariantGenUsed, trackVariantGenPaywallHit,
} from "@/lib/gtag";
import {
  VARIANT_STYLES,
  type VariantStyle,
} from "@/lib/rem-prompts";
import { generateVariantSilently } from "@/lib/variant-generate";

// ─── スタイル定義 ─────────────────────────────────────────
const ICONS = { Sparkles, TrendingUp, TrendingDown, Shuffle, Plus } as const;
const STYLE_ORDER: VariantStyle[] = ["same", "harder", "easier", "format", "more"];

interface StyleVisual {
  // 通常時のアイコン背景
  iconBg: string;
  // active 時のグラデーション (背景全面)
  activeGradient: string;
  // active 時のリング色
  activeRing: string;
  // active 時のシャドウ
  activeShadow: string;
}
const STYLE_VISUAL: Record<VariantStyle, StyleVisual> = {
  same: {
    iconBg: "bg-violet-500/12 text-violet-600",
    activeGradient: "from-violet-500/[0.14] via-fuchsia-500/[0.08] to-violet-500/[0.04]",
    activeRing: "ring-violet-500/40",
    activeShadow: "shadow-violet-500/20",
  },
  harder: {
    iconBg: "bg-rose-500/12 text-rose-600",
    activeGradient: "from-rose-500/[0.14] via-orange-500/[0.08] to-rose-500/[0.04]",
    activeRing: "ring-rose-500/40",
    activeShadow: "shadow-rose-500/20",
  },
  easier: {
    iconBg: "bg-emerald-500/12 text-emerald-600",
    activeGradient: "from-emerald-500/[0.14] via-teal-500/[0.08] to-emerald-500/[0.04]",
    activeRing: "ring-emerald-500/40",
    activeShadow: "shadow-emerald-500/20",
  },
  format: {
    iconBg: "bg-amber-500/12 text-amber-600",
    activeGradient: "from-amber-500/[0.14] via-orange-500/[0.08] to-amber-500/[0.04]",
    activeRing: "ring-amber-500/40",
    activeShadow: "shadow-amber-500/20",
  },
  more: {
    iconBg: "bg-blue-500/12 text-blue-600",
    activeGradient: "from-blue-500/[0.14] via-cyan-500/[0.08] to-blue-500/[0.04]",
    activeRing: "ring-blue-500/40",
    activeShadow: "shadow-blue-500/20",
  },
};

export function VariantStudio() {
  const open = useUIStore((s) => s.variantStudioOpen);
  if (!open) return null;
  return <VariantStudioContent />;
}

function VariantStudioContent() {
  const { locale } = useI18n();
  const isJa = !(locale || "ja").toLowerCase().startsWith("en");
  const isMobile = useIsMobile();

  const close = useUIStore((s) => s.closeVariantStudio);
  const preselectedStyle = useUIStore((s) => s.variantStudioPreselectedStyle);
  const activeRewriteKind = useUIStore((s) => s.activeRewriteKind);
  const openSignupOverlay = useUIStore((s) => s.openSignupOverlay);

  const docLatex = useDocumentStore((s) => s.document?.latex || "");
  const docTitle = useDocumentStore((s) => s.document?.metadata.title || "");
  const currentPlan = usePlanStore((s) => s.currentPlan);

  const isPro = canUseFeature(currentPlan, "variantGen");
  const trialUsed = hasUsedVariantTrial();
  const locked = !isPro && trialUsed;
  const trialAvailable = !isPro && !trialUsed;

  // ── State ──
  const [style, setStyle] = React.useState<VariantStyle>(
    (preselectedStyle as VariantStyle) || "same",
  );
  const [count, setCount] = React.useState<number>(5);
  const [outputMode, setOutputMode] = React.useState<"replace" | "append">("replace");
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  /** 生成成功回数 (連射 CTA 表示制御用) */
  const [generatedCount, setGeneratedCount] = React.useState(0);

  // ── キーボード操作 ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isFormField = tag === "input" || tag === "textarea" || tag === "select";
      if (!isFormField) {
        const idx = "12345".indexOf(e.key);
        if (idx >= 0 && idx < STYLE_ORDER.length) {
          e.preventDefault();
          setStyle(STYLE_ORDER[idx]);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, style, count, outputMode, busy, locked]);

  // ── 生成実行 ──
  const run = async () => {
    setErrorMsg(null);
    if (busy) return;
    if (!docLatex) {
      setErrorMsg(isJa
        ? "ドキュメントが空です。先にエディタで 1 枚作ってからお試しください。"
        : "Document is empty. Please create a worksheet first.");
      return;
    }
    if (locked) {
      trackVariantGenPaywallHit({ placement: "studio" });
      openSignupOverlay({ reason: "feature_locked", placement: "variant_studio" });
      return;
    }
    trackVariantGenClick({ placement: "studio_run", plan: currentPlan });
    setBusy(true);
    try {
      await generateVariantSilently(style, {
        count,
        outputMode,
        locale: locale || (isJa ? "ja" : "en"),
      });
      trackVariantGenUsed({ placement: "studio_run", plan: currentPlan, trial: !isPro });
      if (!isPro) markVariantTrialUsed();
      setGeneratedCount((n) => n + 1);
      toast.success(isJa ? "類題プリントを生成しました" : "Variant worksheet generated", {
        description: isJa
          ? `${VARIANT_STYLES[style].jaTitle} で ${count} 問程度`
          : `${VARIANT_STYLES[style].enTitle} · ~${count} problems`,
        duration: 3500,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (isJa ? "生成に失敗しました" : "Generation failed");
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex"
      role="dialog"
      aria-modal="true"
      aria-label={isJa ? "類題ジェネレータ" : "Variant Studio"}
    >
      {/* ── 背景 (deep blur + subtle mesh gradient) ── */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md animate-page-fade-in"
        onClick={busy ? undefined : close}
        aria-hidden
      />

      {/* ── パネル ── */}
      <div
        className={
          isMobile
            ? "relative w-full h-full bg-background flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden"
            : "relative w-[520px] max-w-full h-full ml-auto bg-background border-l border-foreground/[0.08] shadow-[-24px_0_60px_-12px_rgba(0,0,0,0.25)] flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden"
        }
        style={isMobile ? { paddingTop: "env(safe-area-inset-top, 0px)" } : undefined}
      >
        {/* Ambient mesh gradient (重なって奥行きを出す) */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-20 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent blur-3xl" />
          <div className="absolute top-1/3 -left-32 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-blue-500/10 via-cyan-500/8 to-transparent blur-3xl" />
          <div className="absolute -bottom-40 left-1/4 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-fuchsia-500/8 via-violet-500/6 to-transparent blur-3xl" />
        </div>

        {/* ── Hero ヘッダ ── */}
        <div className="relative shrink-0 border-b border-foreground/[0.06] bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.05] to-blue-500/[0.08]">
          {/* ノイズ風グリッド */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative flex items-start gap-3 px-5 pt-4 pb-3.5">
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Wand2 className="h-4 w-4 text-white" strokeWidth={2.2} />
              </div>
              {/* Sparkle ピップ */}
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-background animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15.5px] font-bold tracking-tight">
                  {isJa ? "類題ジェネレータ" : "Variant Studio"}
                </h2>
                {trialAvailable && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-sm animate-pulse">
                    {isJa ? "お試し残 1" : "TRIAL 1"}
                  </span>
                )}
                {isPro && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wider text-violet-700 dark:text-violet-300 bg-violet-500/12 border border-violet-500/35">
                    <Crown className="h-2.5 w-2.5" />
                    {isJa ? "Pro" : "PRO"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/85 leading-snug mt-0.5 inline-flex items-center gap-1">
                <Zap className="h-2.5 w-2.5 text-amber-500" />
                {isJa ? "瞬時に何枚でも・REM 出題ノウハウ駆動" : "Instant variants · powered by REM authoring"}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="h-8 w-8 rounded-full hover:bg-foreground/[0.08] active:scale-95 transition flex items-center justify-center disabled:opacity-50"
              aria-label={isJa ? "閉じる" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ベース問題ピル — 「現在のドキュメントから自動取得」を明示 */}
          {docLatex && (
            <div className="relative px-5 pb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-[10.5px] text-foreground/75 max-w-full">
                <FileText className="h-3 w-3 text-foreground/55 shrink-0" />
                <span className="font-medium tracking-tight truncate">
                  {isJa ? "ベース: " : "Seed: "}
                  <span className="text-foreground/90">{docTitle || (isJa ? "現在のドキュメント" : "current doc")}</span>
                </span>
                <span className="ml-1 inline-flex items-center gap-0.5 text-[9.5px] text-emerald-700 dark:text-emerald-300 font-bold">
                  <Check className="h-2.5 w-2.5" />
                  {isJa ? "自動取得" : "auto"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scrollbar-thin relative">
          {/* Locked state */}
          {locked && (
            <div className="rounded-2xl border-2 border-violet-500/35 bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.05] to-blue-500/[0.06] p-5 text-center shadow-lg shadow-violet-500/10">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/35 mb-3">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <p className="text-[15px] font-bold mb-1 tracking-tight">
                {isJa ? "Pro で類題を無制限に" : "Unlimited variants on Pro"}
              </p>
              <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
                {isJa
                  ? "Free プランの 1 回お試しは使用済みです。Pro なら 1 ボタンで何枚でも類題を量産できます。"
                  : "Your free trial has been used. On Pro you can crank out unlimited variants with one tap."}
              </p>
              <button
                type="button"
                onClick={() => {
                  trackVariantGenPaywallHit({ placement: "studio" });
                  openSignupOverlay({ reason: "feature_locked", placement: "variant_studio" });
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-white text-[13.5px] font-bold shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 active:scale-[0.97] transition"
              >
                <Crown className="h-3.5 w-3.5" />
                {isJa ? "Pro を見る" : "See Pro"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ① スタイル選択 — 主役、最初に出す */}
          <section>
            <SectionHeader
              num={1}
              titleJa="スタイルを選ぶ"
              titleEn="Pick a style"
              hintJa="1〜5 キーで切替"
              hintEn="press 1–5 to switch"
              isJa={isJa}
            />
            <div className="grid grid-cols-1 gap-2">
              {STYLE_ORDER.map((s, idx) => {
                const spec = VARIANT_STYLES[s];
                const Icon = ICONS[spec.iconKey];
                const isActive = style === s;
                const v = STYLE_VISUAL[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    aria-pressed={isActive}
                    className={`group relative text-left rounded-2xl px-3.5 py-3 border transition-all duration-300 active:scale-[0.99] overflow-hidden ${
                      isActive
                        ? `border-foreground/15 bg-gradient-to-br ${v.activeGradient} shadow-lg ${v.activeShadow} ring-1 ${v.activeRing} -translate-y-0.5`
                        : "border-foreground/[0.08] hover:border-foreground/[0.18] hover:bg-foreground/[0.02] hover:-translate-y-0.5"
                    }`}
                  >
                    {/* active 時の発光 */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute -inset-1 rounded-2xl opacity-30 blur-xl pointer-events-none"
                        style={{
                          background: `linear-gradient(135deg, var(--variant-glow-from, #a78bfa), var(--variant-glow-to, #f472b6))`,
                        }}
                      />
                    )}
                    <div className="relative flex items-start gap-3">
                      <span className={`h-9 w-9 shrink-0 rounded-xl ${v.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[13.5px] font-bold tracking-tight leading-tight">
                            {isJa ? spec.jaTitle : spec.enTitle}
                          </span>
                          {s === "same" && (
                            <span className="text-[8.5px] tracking-wider font-bold uppercase text-violet-600/80 dark:text-violet-400/80 px-1 rounded border border-violet-500/30">
                              {isJa ? "標準" : "DEFAULT"}
                            </span>
                          )}
                          <span className={`ml-auto text-[9.5px] tracking-wider font-bold w-5 h-5 inline-flex items-center justify-center rounded transition ${
                            isActive ? "bg-foreground text-background" : "text-foreground/35 border border-foreground/15"
                          }`}>
                            {idx + 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/85 leading-snug">
                          {isJa ? spec.jaDesc : spec.enDesc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ② オプション — 問題数のみ (hint は撤去) */}
          <section>
            <SectionHeader
              num={2}
              titleJa="問題数"
              titleEn="Problem count"
              hintJa="目安・配点は AI が 100 点に揃える"
              hintEn="guideline · AI rebalances to 100 pts"
              isJa={isJa}
            />
            <div className="rounded-2xl border border-foreground/[0.08] bg-gradient-to-br from-foreground/[0.02] to-transparent p-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCount((v) => Math.max(1, v - 1))}
                  disabled={count <= 1}
                  className="h-10 w-10 rounded-xl border border-foreground/15 hover:bg-foreground/[0.06] active:scale-95 transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={isJa ? "減らす" : "Decrease"}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[28px] font-black tabular-nums tracking-tight leading-none bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {count}
                  </span>
                  <span className="text-[10px] text-muted-foreground/65 mt-0.5 tracking-wider uppercase">
                    {isJa ? "問" : "problems"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCount((v) => Math.min(20, v + 1))}
                  disabled={count >= 20}
                  className="h-10 w-10 rounded-xl border border-foreground/15 hover:bg-foreground/[0.06] active:scale-95 transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={isJa ? "増やす" : "Increase"}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {/* スライダー風プリセット */}
              <div className="flex items-center justify-between gap-1 mt-3 pt-3 border-t border-foreground/[0.05]">
                {[3, 5, 8, 10, 15].map((n) => {
                  const isActive = count === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`flex-1 h-7 rounded-md text-[11px] font-bold tabular-nums transition ${
                        isActive
                          ? "bg-foreground text-background shadow-sm"
                          : "text-foreground/55 hover:bg-foreground/[0.05]"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ③ 出力先 — segmented control */}
          <section>
            <SectionHeader
              num={3}
              titleJa="出力先"
              titleEn="Output target"
              isJa={isJa}
            />
            <div className="relative grid grid-cols-2 gap-1 p-1 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03]">
              {/* スライドする active バッジ (segmented control) */}
              <div
                aria-hidden
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-background shadow-md transition-transform duration-300 ease-out"
                style={{
                  left: 4,
                  transform: outputMode === "replace" ? "translateX(0)" : "translateX(calc(100% + 4px))",
                }}
              />
              {([
                { id: "replace" as const, jaT: "置き換える", enT: "Replace", icon: Wand2, jaD: "現在の doc を上書き", enD: "Overwrite current" },
                { id: "append"  as const, jaT: "末尾に追記", enT: "Append",  icon: Plus,  jaD: "新セクションとして追加", enD: "As a new section" },
              ]).map((opt) => {
                const isActive = outputMode === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOutputMode(opt.id)}
                    aria-pressed={isActive}
                    className={`relative z-10 px-3 py-2 rounded-xl text-left transition active:scale-[0.98] ${
                      isActive ? "text-foreground" : "text-foreground/55 hover:text-foreground/75"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className="h-3 w-3" strokeWidth={2.2} />
                      <span className="text-[12px] font-bold">{isJa ? opt.jaT : opt.enT}</span>
                    </div>
                    <p className="text-[10px] leading-snug">{isJa ? opt.jaD : opt.enD}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* エラー */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/[0.06] px-3 py-2.5 text-[11.5px] text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* 連射 CTA — 1 回でも生成成功した後はこれを最上段に出す */}
          {generatedCount > 0 && !busy && !locked && (
            <div className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.05] to-blue-500/[0.06] p-3.5 shadow-lg shadow-violet-500/10">
              <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.12em] uppercase text-violet-700 dark:text-violet-300 mb-2">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white shadow-sm">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {isJa
                  ? `${generatedCount} 枚目 完成 — もう1枚？`
                  : `${generatedCount} sheet${generatedCount > 1 ? "s" : ""} ready — make more?`}
              </div>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="relative w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-white text-[14.5px] font-bold shadow-xl shadow-violet-500/30 active:scale-[0.98] hover:shadow-violet-500/50 transition overflow-hidden group"
              >
                <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Sparkles className="h-4 w-4" />
                {isJa
                  ? `もう1枚 (${VARIANT_STYLES[style].jaTitle})`
                  : `One more (${VARIANT_STYLES[style].enTitle})`}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-[10.5px] text-center text-muted-foreground/70 mt-2">
                {isJa ? "他のスタイルに切替: 上のカード or 1〜5 キー" : "Switch style: cards above or press 1–5"}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer (sticky CTA) ── */}
        <div
          className="relative shrink-0 border-t border-foreground/[0.06] bg-gradient-to-t from-background via-background/98 to-background/95 backdrop-blur-md px-5 py-3.5"
          style={isMobile ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.875rem)" } : undefined}
        >
          {locked ? (
            <button
              type="button"
              onClick={() => {
                trackVariantGenPaywallHit({ placement: "studio" });
                openSignupOverlay({ reason: "feature_locked", placement: "variant_studio" });
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 h-13 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[14.5px] font-bold shadow-xl shadow-violet-500/30 active:scale-[0.97] transition"
            >
              <Lock className="h-4 w-4" />
              {isJa ? "Pro にアップグレード" : "Upgrade to Pro"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy || !docLatex}
                className="relative w-full inline-flex items-center justify-center gap-1.5 h-13 py-3 rounded-xl bg-foreground text-background text-[15px] font-bold shadow-2xl shadow-foreground/20 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden group"
              >
                {!busy && !locked && (
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                )}
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isJa ? "類題を生成中…" : "Generating variants…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {generatedCount > 0
                      ? (isJa ? "再生成" : "Regenerate")
                      : (isJa ? "類題を生成" : "Generate variants")}
                    <span className="text-[10px] opacity-50 ml-0.5 font-mono">⌘↵</span>
                  </>
                )}
              </button>
              {/* フッター下マイクロコピー */}
              <div className="flex items-center justify-center gap-2 mt-2 text-[10.5px]">
                {trialAvailable && (
                  <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold">
                    <Sparkles className="h-3 w-3" />
                    {isJa ? "Pro 機能を無料お試し中" : "Free trial of a Pro feature"}
                  </span>
                )}
                {isPro && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/65 font-medium">
                    <Zap className="h-3 w-3 text-amber-500" />
                    {isJa ? "Pro: 何枚でも無制限" : "Pro: unlimited"}
                  </span>
                )}
                <span className="text-muted-foreground/30">·</span>
                <span className="text-muted-foreground/55 font-medium inline-flex items-center gap-1">
                  <FileSignature className="h-3 w-3" />
                  {isJa ? "解答付き" : "with answers"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── 進行中 overlay (shimmer) ── */}
        {(busy || activeRewriteKind === "variant") && (
          <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none animate-page-fade-in">
            <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-blue-600 text-white shadow-2xl shadow-violet-500/40 max-w-[80%]">
              <div className="relative">
                <Loader2 className="h-6 w-6 animate-spin" />
                <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-300 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-bold tracking-tight">
                  {isJa ? "類題を生成中…" : "Generating variants…"}
                </p>
                <p className="text-[10.5px] text-white/80 mt-0.5">
                  {isJa ? `スタイル: ${VARIANT_STYLES[style].jaTitle}` : `Style: ${VARIANT_STYLES[style].enTitle}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 小コンポーネント ─────────────────────────────────────

function SectionHeader({
  num, titleJa, titleEn, hintJa, hintEn, isJa,
}: {
  num: number;
  titleJa: string;
  titleEn: string;
  hintJa?: string;
  hintEn?: string;
  isJa: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-gradient-to-br from-foreground/[0.07] to-foreground/[0.04] border border-foreground/10 text-[10px] font-extrabold tabular-nums text-foreground/75">
        {num}
      </span>
      <span className="text-[12px] font-bold tracking-[0.05em] text-foreground/85">
        {isJa ? titleJa : titleEn}
      </span>
      {(hintJa || hintEn) && (
        <span className="ml-auto text-[10px] text-muted-foreground/60 italic">
          {isJa ? hintJa : hintEn}
        </span>
      )}
    </div>
  );
}
