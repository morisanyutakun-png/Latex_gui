"use client";

/**
 * VariantStudio — 類題自動生成の独立パネル (チャット履歴を汚さない)。
 *
 * 設計:
 *   - PC:  右側に 480px の slide-over (OMRSplitView と同様の独立モード)
 *   - モバイル: 全画面 bottom sheet
 *   - 「瞬時に何枚でも」を核体験にするため、生成完了後はパネルを閉じず
 *     「もう1枚」連射 CTA に切り替える
 *   - チャット (`useUIStore.chatMessages`) には一切触らない
 *   - Pro+ 無制限、Free は localStorage で 1 回だけ体験 (フリーミアム)
 *
 * 履歴に乗せない実生成は `lib/variant-generate.ts` の `generateVariantSilently` が担う。
 */

import React from "react";
import {
  X, Sparkles, Lock, Crown, Loader2, Check, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Shuffle, Plus, Minus, ArrowRight, AlertCircle, Layers,
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
  extractProblemsSection,
  type VariantStyle,
} from "@/lib/rem-prompts";
import { generateVariantSilently } from "@/lib/variant-generate";

// ─── スタイルアイコン ──
const ICONS = { Sparkles, TrendingUp, TrendingDown, Shuffle, Plus } as const;
const STYLE_ORDER: VariantStyle[] = ["same", "harder", "easier", "format", "more"];
const STYLE_TINT: Record<VariantStyle, string> = {
  same:   "bg-violet-500/10 text-violet-600 ring-violet-500/30",
  harder: "bg-rose-500/10 text-rose-600 ring-rose-500/30",
  easier: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30",
  format: "bg-amber-500/10 text-amber-600 ring-amber-500/30",
  more:   "bg-blue-500/10 text-blue-600 ring-blue-500/30",
};

export function VariantStudio() {
  const open = useUIStore((s) => s.variantStudioOpen);
  if (!open) return null;
  // open 中だけ実コンポーネントをマウント (閉じている間は state を持たないため)
  return <VariantStudioContent />;
}

function VariantStudioContent() {
  const { locale } = useI18n();
  const isJa = !(locale || "ja").toLowerCase().startsWith("en");
  const isMobile = useIsMobile();

  const close = useUIStore((s) => s.closeVariantStudio);
  const seedFromStore = useUIStore((s) => s.variantStudioSeed);
  const preselectedStyle = useUIStore((s) => s.variantStudioPreselectedStyle);
  const activeRewriteKind = useUIStore((s) => s.activeRewriteKind);
  const openSignupOverlay = useUIStore((s) => s.openSignupOverlay);

  const docLatex = useDocumentStore((s) => s.document?.latex || "");
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
  const [hint, setHint] = React.useState("");
  const [outputMode, setOutputMode] = React.useState<"replace" | "append">("replace");
  const [seedExpanded, setSeedExpanded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  /** 生成成功回数 (連射 CTA 表示制御用)。Studio を開いている間ローカルにカウント。 */
  const [generatedCount, setGeneratedCount] = React.useState(0);

  // Studio 起動時に seed (= 表示用の問題本文抜粋) を計算
  const seedForDisplay = React.useMemo(() => {
    const baseLatex = seedFromStore || docLatex || "";
    return extractProblemsSection(baseLatex);
  }, [seedFromStore, docLatex]);

  // ── キーボード操作 ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      // 1〜5 でスタイル選択 (number キーが入力フィールドにフォーカスされてないときだけ)
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isFormField = tag === "input" || tag === "textarea" || tag === "select";
      if (!isFormField) {
        const idx = "12345".indexOf(e.key);
        if (idx >= 0 && idx < STYLE_ORDER.length) {
          e.preventDefault();
          setStyle(STYLE_ORDER[idx]);
        }
      }
      // ⌘+Enter / Ctrl+Enter で生成実行
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, style, count, hint, outputMode, busy, locked]);

  // ── 生成実行 ──
  const run = async () => {
    setErrorMsg(null);
    if (busy) return;
    if (!docLatex && !seedFromStore) {
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
        hint,
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

  // ── レイアウト: モバイル = 全画面 bottom sheet, PC = 右 480px slide-over ──
  return (
    <div
      className="fixed inset-0 z-[60] flex"
      role="dialog"
      aria-modal="true"
      aria-label={isJa ? "類題ジェネレータ" : "Variant Studio"}
    >
      {/* 背景 — クリックで閉じる (mobile sheet スタイル) */}
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px] animate-page-fade-in"
        onClick={busy ? undefined : close}
        aria-hidden
      />

      <div
        className={
          isMobile
            ? "relative w-full h-full bg-background flex flex-col animate-in slide-in-from-bottom duration-200 overflow-hidden"
            : "relative w-[480px] max-w-full h-full ml-auto bg-background border-l border-foreground/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden"
        }
        style={isMobile ? { paddingTop: "env(safe-area-inset-top, 0px)" } : undefined}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.06] shrink-0 bg-gradient-to-r from-violet-500/[0.06] via-fuchsia-500/[0.04] to-blue-500/[0.06]">
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/30">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold tracking-tight">
              {isJa ? "類題ジェネレータ" : "Variant Studio"}
            </p>
            <p className="text-[10.5px] text-muted-foreground/70 leading-tight">
              {isJa ? "瞬時に何枚でも・REM ノウハウ駆動" : "Instant variants · REM-style"}
            </p>
          </div>
          {trialAvailable && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-sm">
              {isJa ? "お試し残 1" : "TRIAL 1"}
            </span>
          )}
          {isPro && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wider text-violet-700 dark:text-violet-300 bg-violet-500/10 border border-violet-500/30">
              <Crown className="h-2.5 w-2.5" />
              {isJa ? "Pro" : "PRO"}
            </span>
          )}
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="h-8 w-8 rounded-full hover:bg-foreground/[0.06] active:scale-95 transition flex items-center justify-center disabled:opacity-50"
            aria-label={isJa ? "閉じる" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Locked overlay */}
          {locked && (
            <div className="rounded-xl border border-violet-500/35 bg-gradient-to-br from-violet-500/[0.06] to-fuchsia-500/[0.04] p-4 text-center">
              <Lock className="h-6 w-6 text-violet-500 mx-auto mb-2" />
              <p className="text-[14px] font-bold mb-1">
                {isJa ? "類題ジェネレータは Pro 機能です" : "Variant Studio is a Pro feature"}
              </p>
              <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
                {isJa
                  ? "Free プランの 1 回お試しは使用済みです。Pro にアップグレードすると無制限に類題を量産できます。"
                  : "Your free trial has been used. Upgrade to Pro for unlimited variants."}
              </p>
              <button
                type="button"
                onClick={() => {
                  trackVariantGenPaywallHit({ placement: "studio" });
                  openSignupOverlay({ reason: "feature_locked", placement: "variant_studio" });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[13px] font-bold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 active:scale-[0.97] transition"
              >
                <Crown className="h-3.5 w-3.5" />
                {isJa ? "Pro を見る" : "See Pro"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 1. ベースの問題 */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground/70">
                {isJa ? "① ベース問題" : "① Seed problem"}
              </p>
              <button
                type="button"
                onClick={() => setSeedExpanded((v) => !v)}
                className="text-[10.5px] text-violet-600 hover:underline inline-flex items-center gap-0.5"
              >
                {seedExpanded
                  ? <><ChevronUp className="h-3 w-3" />{isJa ? "畳む" : "Collapse"}</>
                  : <><ChevronDown className="h-3 w-3" />{isJa ? "全文見る" : "Expand"}</>
                }
              </button>
            </div>
            <div className={`rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] text-[11.5px] font-mono leading-snug overflow-hidden transition-all ${
              seedExpanded ? "max-h-[260px] overflow-y-auto" : "max-h-[64px]"
            }`}>
              <pre className="px-2.5 py-2 whitespace-pre-wrap break-words text-foreground/75">
                {seedForDisplay || (isJa ? "(ドキュメントが空です — 先にエディタで 1 枚作ってください)" : "(Document is empty — generate a worksheet first)")}
              </pre>
            </div>
          </section>

          {/* 2. スタイル */}
          <section>
            <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground/70 mb-2">
              {isJa ? "② スタイルを選ぶ (1〜5 キー)" : "② Pick a style (keys 1–5)"}
            </p>
            <div className={isMobile
              ? "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x scrollbar-thin"
              : "grid grid-cols-2 gap-2"
            } style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}>
              {STYLE_ORDER.map((s, idx) => {
                const spec = VARIANT_STYLES[s];
                const Icon = ICONS[spec.iconKey];
                const isActive = style === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    aria-pressed={isActive}
                    className={`group text-left rounded-xl px-3 py-2.5 border transition active:scale-[0.98] shrink-0 ${isMobile ? "snap-start min-w-[170px]" : ""} ${
                      isActive
                        ? "border-violet-500/45 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.04] shadow-md shadow-violet-500/10 ring-1 ring-violet-500/30"
                        : "border-foreground/[0.08] hover:border-foreground/[0.18] hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`h-7 w-7 shrink-0 rounded-md ring-1 flex items-center justify-center ${STYLE_TINT[s]}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[12.5px] font-bold leading-tight">
                            {isJa ? spec.jaTitle : spec.enTitle}
                          </span>
                          <span className="ml-auto text-[9px] tracking-wider font-bold text-foreground/35 px-1 py-[1px] rounded border border-foreground/15">
                            {idx + 1}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">
                          {isJa ? spec.jaDesc : spec.enDesc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. オプション */}
          <section>
            <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground/70 mb-2">
              {isJa ? "③ オプション" : "③ Options"}
            </p>
            <div className="space-y-2.5">
              {/* 問題数 */}
              <div className="flex items-center gap-3 rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] px-3 py-2">
                <span className="text-[12px] font-medium text-foreground/80 shrink-0">
                  {isJa ? "問題数" : "Count"}
                </span>
                <button
                  type="button"
                  onClick={() => setCount((v) => Math.max(1, v - 1))}
                  className="h-6 w-6 rounded-md border border-foreground/15 hover:bg-foreground/[0.04] active:scale-95 transition flex items-center justify-center"
                  aria-label={isJa ? "減らす" : "Decrease"}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="tabular-nums font-bold text-[14px] w-7 text-center">{count}</span>
                <button
                  type="button"
                  onClick={() => setCount((v) => Math.min(20, v + 1))}
                  className="h-6 w-6 rounded-md border border-foreground/15 hover:bg-foreground/[0.04] active:scale-95 transition flex items-center justify-center"
                  aria-label={isJa ? "増やす" : "Increase"}
                >
                  <Plus className="h-3 w-3" />
                </button>
                <span className="ml-auto text-[10px] text-muted-foreground/70">
                  {isJa ? "目安 (AI が調整)" : "guideline"}
                </span>
              </div>

              {/* 追加メモ */}
              <div className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] px-3 py-2">
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder={isJa
                    ? "追加メモ (任意): 「多項式に絞って」「証明問題で」など"
                    : "Hint (optional): \"focus on polynomials\" or \"prove instead\""}
                  className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/45"
                  // iOS auto-zoom 防止
                  style={{ fontSize: isMobile ? 16 : 13 }}
                />
              </div>
            </div>
          </section>

          {/* 4. 出力先 */}
          <section>
            <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground/70 mb-2">
              {isJa ? "④ 出力先" : "④ Output target"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "replace" as const, jaT: "置き換える", enT: "Replace", jaD: "現在のドキュメントを上書き", enD: "Overwrite the current doc" },
                { id: "append"  as const, jaT: "末尾に追記", enT: "Append",  jaD: "既存の末尾に新セクションとして追加", enD: "Append as a new section" },
              ]).map((opt) => {
                const isActive = outputMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOutputMode(opt.id)}
                    aria-pressed={isActive}
                    className={`text-left rounded-xl px-3 py-2 border transition active:scale-[0.98] ${
                      isActive
                        ? "border-foreground/30 bg-foreground/[0.04]"
                        : "border-foreground/[0.08] hover:border-foreground/[0.18]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`h-3 w-3 rounded-full border-2 ${
                        isActive ? "border-violet-500 bg-violet-500" : "border-foreground/30"
                      }`} />
                      <span className="text-[12px] font-semibold">{isJa ? opt.jaT : opt.enT}</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground leading-snug">
                      {isJa ? opt.jaD : opt.enD}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* エラー */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-3 py-2 text-[11.5px] text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* 連射 CTA — 1 回でも生成成功した後はこれを最上段に出して「もう1枚」を主役に */}
          {generatedCount > 0 && !busy && !locked && (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.05] p-3">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider uppercase text-violet-700 dark:text-violet-300 mb-1.5">
                <Check className="h-3 w-3" />
                {isJa ? `${generatedCount} 枚目 完成 — もう1枚作る？` : `${generatedCount} sheet${generatedCount > 1 ? "s" : ""} ready — make more?`}
              </div>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-white text-[14px] font-bold shadow-lg shadow-violet-500/25 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isJa
                  ? `もう1枚 (${VARIANT_STYLES[style].jaTitle})`
                  : `One more (${VARIANT_STYLES[style].enTitle})`}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-[10px] text-center text-muted-foreground/70 mt-1.5">
                {isJa ? "他のスタイルに切替: 上のカード or 1〜5 キー" : "Switch style above or press 1–5"}
              </p>
            </div>
          )}
        </div>

        {/* Footer (sticky CTA) */}
        <div
          className="shrink-0 border-t border-foreground/[0.06] bg-background/98 backdrop-blur-sm px-4 py-3"
          style={isMobile ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" } : undefined}
        >
          {locked ? (
            <button
              type="button"
              onClick={() => {
                trackVariantGenPaywallHit({ placement: "studio" });
                openSignupOverlay({ reason: "feature_locked", placement: "variant_studio" });
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[14px] font-bold shadow-lg shadow-violet-500/30 active:scale-[0.97] transition"
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
                disabled={busy || (!docLatex && !seedFromStore)}
                className="w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-foreground text-background text-[14.5px] font-bold shadow-xl shadow-foreground/20 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isJa ? "生成中…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {generatedCount > 0
                      ? (isJa ? "再生成 (このスタイルで)" : "Regenerate (this style)")
                      : (isJa ? "類題を生成" : "Generate variants")}
                    <span className="text-[10px] opacity-60 ml-1">⌘↵</span>
                  </>
                )}
              </button>
              {trialAvailable && (
                <p className="text-center text-[10.5px] text-muted-foreground/70 mt-2">
                  {isJa ? "✨ Pro 機能を 1 回だけ無料でお試し中" : "✨ Free trial of a Pro feature (1 use)"}
                </p>
              )}
              {isPro && (
                <p className="text-center text-[10.5px] text-muted-foreground/55 mt-2 inline-flex items-center justify-center gap-1 w-full">
                  <Layers className="h-3 w-3" />
                  {isJa ? "Pro: 何枚でも無制限に量産できます" : "Pro: unlimited variant generation"}
                </p>
              )}
            </>
          )}
        </div>

        {/* 進行中の glass overlay */}
        {(busy || activeRewriteKind === "variant") && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/95 text-background shadow-2xl">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[12px] font-semibold">
                {isJa ? "類題を生成中…" : "Generating variants…"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
