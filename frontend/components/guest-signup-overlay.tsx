"use client";

/**
 * GuestSignupOverlay — 全画面 signup プロモーションモーダル。
 *
 * Toast より遥かに強い CVR シグナルを出すため、画面全体を覆う overlay として
 * 「Free 登録 / Starter / Pro」の 3 動線を 1 画面に集約する。
 *
 * 表示条件:
 *   - お試し AI が完走した直後 (reason="trial_complete")
 *   - 上限に当たった瞬間            (reason="trial_limit")
 *   - 保存・ダウンロード等のロック機能を押した瞬間 (reason="feature_locked")
 *   - 任意の signup CTA から手動で開いた場合 (reason="manual")
 *
 * GA4: open / 各 CTA クリックを `guest_signup_click` で計測 (placement で分解)。
 */
import React from "react";
import {
  Sparkles, Lock, X, Check, ArrowRight, Crown, Zap, FileDown,
  ScanLine, ClipboardCheck, Star, RefreshCw, Save,
} from "lucide-react";
import { signIn } from "next-auth/react";

import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { trackGuestSignupClick } from "@/lib/gtag";
import { PLANS } from "@/lib/plans";
import { createCheckoutSession } from "@/lib/subscription-api";
import { toast } from "sonner";

// ─── Reason 別ヘッドラインコピー ──────────────────────────────────────────
function headlineFor(
  reason: "trial_complete" | "trial_limit" | "feature_locked" | "manual",
  isJa: boolean,
): { eyebrow: string; title: string; sub: string } {
  if (reason === "trial_complete") {
    return isJa ? {
      eyebrow: "🎉 1 枚目の生成が完了しました",
      title: "このプリントを保存する",
      sub: "無料アカウントで保存・再編集・再ダウンロードできます。",
    } : {
      eyebrow: "🎉 First worksheet generated",
      title: "Save this worksheet for free",
      sub: "Create a free account to save, edit, and download it again later.",
    };
  }
  if (reason === "trial_limit") {
    return isJa ? {
      eyebrow: "⚡ 無料お試しは使い切りました",
      title: "登録すると AI を続けて使えます",
      sub: "Free で月 3 回・Starter なら月 150 回まで AI に依頼できます。",
    } : {
      eyebrow: "⚡ Free trial used",
      title: "Sign up to keep generating with AI",
      sub: "Free: 3 / month · Starter: 150 / month.",
    };
  }
  if (reason === "feature_locked") {
    return isJa ? {
      eyebrow: "💾 このプリントを残しておく",
      title: "このプリントを保存する",
      sub: "無料アカウントで保存・再編集・再ダウンロードできます。",
    } : {
      eyebrow: "💾 Keep this worksheet",
      title: "Save this worksheet for free",
      sub: "Create a free account to save, edit, and download it again later.",
    };
  }
  return isJa ? {
    eyebrow: "✨ Eddivom にようこそ",
    title: "登録して、教材作成を加速しよう",
    sub: "Free から始めて、必要に応じて Starter / Pro へ。",
  } : {
    eyebrow: "✨ Welcome to Eddivom",
    title: "Sign up and accelerate your worksheet workflow",
    sub: "Start free, upgrade when you need more.",
  };
}

// ─── プランカード共通 ─────────────────────────────────────────────────────
interface PlanCardProps {
  planId: "free" | "starter" | "pro";
  highlight?: boolean;
  badge?: string;
  ctaLabel: string;
  features: string[];
  onClick: () => void;
  loading?: boolean;
  isJa: boolean;
}

function PlanCard({ planId, highlight, badge, ctaLabel, features, onClick, loading, isJa }: PlanCardProps) {
  const def = PLANS[planId];
  const isFree = planId === "free";

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl p-5 backdrop-blur-sm transition-all",
        highlight
          ? "bg-gradient-to-br from-violet-500/[0.10] to-blue-500/[0.06] border-2 border-violet-500/40 shadow-xl shadow-violet-500/10"
          : "bg-card/60 border border-foreground/[0.08] hover:border-foreground/[0.18]",
      ].join(" ")}
    >
      {badge && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10.5px] font-bold tracking-wide">
          <Crown className="h-3 w-3" />
          {badge}
        </span>
      )}

      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="text-[18px] font-bold tracking-tight">{def.name}</h3>
        {isFree && (
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 font-semibold">
            {isJa ? "ずっと無料" : "Always free"}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[24px] font-bold tracking-tighter">{def.priceLabel}</span>
        {!isFree && (
          <span className="text-[12px] text-muted-foreground font-medium">{isJa ? "/ 月" : "/ mo"}</span>
        )}
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-3 line-clamp-1">
        {isJa ? def.tagline : def.taglineEn}
      </p>

      <ul className="flex flex-col gap-1.5 mb-4 text-[12px] text-foreground/80 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-500 mt-[2px] shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        disabled={loading}
        className={[
          "w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait",
          highlight
            ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
            : isFree
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14] border border-foreground/[0.1]",
        ].join(" ")}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {isJa ? "読み込み中…" : "Loading…"}
          </span>
        ) : (
          <>
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </div>
  );
}

// ─── オーバーレイ本体 ────────────────────────────────────────────────────
export function GuestSignupOverlay() {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const overlay = useUIStore((s) => s.signupOverlay);
  const close = useUIStore((s) => s.closeSignupOverlay);
  const [pendingPlan, setPendingPlan] = React.useState<"starter" | "pro" | null>(null);

  // overlay open 時に GA4 計測
  React.useEffect(() => {
    if (!overlay.open) return;
    trackGuestSignupClick({ placement: `overlay_open:${overlay.reason}:${overlay.placement}` });
  }, [overlay.open, overlay.reason, overlay.placement]);

  // overlay 表示中は body の縦スクロールを止める (没入感)
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (overlay.open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [overlay.open]);

  if (!overlay.open) return null;

  const copy = headlineFor(overlay.reason, isJa);

  // ── CTA ハンドラ ──
  const handleFreeSignup = () => {
    trackGuestSignupClick({ placement: `overlay_free:${overlay.placement}` });
    // Google サインイン → 戻り先は /editor (お試し編集中ならそのドキュメントが残る想定)
    signIn("google", { callbackUrl: "/editor" });
  };

  const handlePaidCheckout = async (planId: "starter" | "pro") => {
    trackGuestSignupClick({ placement: `overlay_${planId}:${overlay.placement}` });
    setPendingPlan(planId);
    try {
      // 認証必須エンドポイントなので、未ログインなら sessionStorage に pending_plan を
      // 残してから signIn → 戻ってきた LP の useEffect が自動で checkout を再実行する。
      sessionStorage.setItem("pending_plan", planId);
      // セッションがある可能性も考慮し、まずは直接 checkout。401 ならフォールバックで signIn。
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      if (!session) {
        signIn("google", { callbackUrl: `/?plan=${planId}` });
        return;
      }
      const result = await createCheckoutSession(planId);
      if (result.action === "already_on_plan") {
        toast.success(
          isJa ? "すでに同等以上のプランをご契約中です。" : "You already have this plan or higher.",
        );
        close();
        return;
      }
      window.location.href = result.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        isJa ? `決済ページの取得に失敗: ${msg}` : `Checkout failed: ${msg}`,
      );
      setPendingPlan(null);
    }
  };

  // ─── プランカードの表示内容 (簡略化版 — 詳細は LP の pricing) ───
  const freeFeatures = isJa ? [
    "AI 月 3 回・PDF 出力 月 1 回",
    "基本テンプレ 6 種・TikZ 無制限",
    "保存 / リアルタイムプレビュー",
  ] : [
    "AI: 3 / month · PDF: 1 / month",
    "6 templates · Unlimited TikZ",
    "Save / Live preview",
  ];
  const starterFeatures = isJa ? [
    "AI 月 150 回 (Free の 50 倍)",
    "教材 PDF 出力 無制限",
    "LaTeX ソース書き出し",
  ] : [
    "AI: 150 / month (50× Free)",
    "Unlimited PDF export",
    "LaTeX source export",
  ];
  const proFeatures = isJa ? [
    "AI 月 500 回・優先処理",
    "OMR 読み取り + 採点 + バッチ",
    "Pro テンプレ 12 種",
  ] : [
    "AI: 500 / month · Priority",
    "OMR + Grading + Batch",
    "12 Pro templates",
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-page-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* 背景クリックで閉じる (ただし trial_limit の場合は閉じにくくする — 最終 funnel) */}
      <div
        className="absolute inset-0"
        onClick={() => {
          if (overlay.reason !== "trial_limit") close();
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-4xl sm:m-4 sm:rounded-2xl bg-background shadow-2xl border border-foreground/[0.08] overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[92dvh]">
        {/* 閉じるボタン */}
        <button
          onClick={close}
          aria-label={isJa ? "閉じる" : "Close"}
          className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] flex items-center justify-center text-foreground/60 hover:text-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Hero ヘッダ */}
        <div className="relative px-6 sm:px-8 pt-7 pb-5 bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.05] to-blue-500/[0.08] border-b border-foreground/[0.05]">
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '28px 28px' }}
            aria-hidden
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/[0.05] border border-foreground/[0.08] text-[11px] font-bold tracking-wide mb-3">
              <Sparkles className="h-3 w-3 text-violet-500" />
              <span>{copy.eyebrow}</span>
            </div>
            <h2 className="text-[20px] sm:text-[26px] leading-[1.2] font-bold tracking-tight mb-2 whitespace-pre-line">
              {copy.title}
            </h2>
            <p className="text-[13px] sm:text-[14px] text-muted-foreground">
              {copy.sub}
            </p>
          </div>
        </div>

        {/* スクロール領域 (本体) */}
        <div className="flex-1 overflow-y-auto">
          {/* ベネフィットチップ */}
          <div className="flex flex-wrap gap-1.5 px-6 sm:px-8 pt-4">
            {[
              { icon: <Save className="h-3 w-3" />, label: isJa ? "保存" : "Save" },
              { icon: <FileDown className="h-3 w-3" />, label: isJa ? "PDF ダウンロード" : "PDF download" },
              { icon: <RefreshCw className="h-3 w-3" />, label: isJa ? "再生成・類題量産" : "Regenerate / variants" },
              { icon: <ScanLine className="h-3 w-3" />, label: isJa ? "OMR (Pro)" : "OMR (Pro)" },
              { icon: <ClipboardCheck className="h-3 w-3" />, label: isJa ? "採点 (Pro)" : "Grading (Pro)" },
              { icon: <Zap className="h-3 w-3" />, label: isJa ? "AI 月 150〜500 回" : "150–500 AI / mo" },
            ].map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.06] text-[10.5px] text-foreground/70 font-medium"
              >
                <span className="text-violet-500">{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>

          {/* プラン 3 枚 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 sm:px-8 py-5">
            <PlanCard
              planId="free"
              ctaLabel={isJa ? "このプリントを保存する" : "Save this worksheet for free"}
              features={freeFeatures}
              onClick={handleFreeSignup}
              isJa={isJa}
            />
            <PlanCard
              planId="starter"
              highlight
              badge={isJa ? "おすすめ" : "Popular"}
              ctaLabel={isJa ? "Starter に進む" : "Get Starter"}
              features={starterFeatures}
              onClick={() => handlePaidCheckout("starter")}
              loading={pendingPlan === "starter"}
              isJa={isJa}
            />
            <PlanCard
              planId="pro"
              ctaLabel={isJa ? "Pro に進む" : "Get Pro"}
              features={proFeatures}
              onClick={() => handlePaidCheckout("pro")}
              loading={pendingPlan === "pro"}
              isJa={isJa}
            />
          </div>

          {/* 信頼バー */}
          <div className="flex flex-wrap items-center justify-center gap-3 px-6 sm:px-8 pb-5 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {isJa ? "Stripe 決済 · いつでも解約" : "Stripe · Cancel anytime"}
            </span>
            <span className="text-foreground/15">·</span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3" />
              {isJa ? "登録不要で 1 枚 試せます" : "1 free trial without signup"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
