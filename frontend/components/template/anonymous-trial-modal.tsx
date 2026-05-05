"use client";

/**
 * 「ログインなしで1枚作ってみる」モーダル。
 *
 * フロー:
 *   1. CTA から開く → トピックを入力 (例「二次関数の問題を5問」)。
 *   2. 「無料で1枚作ってみる」を押す → /api/anonymous-trial/generate-pdf 経由で PDF 取得。
 *   3. 取得 PDF を <iframe> で inline 表示。保存・再生成・ダウンロード・履歴は
 *      ログイン必須で、結果画面下部から自然に登録 CTA を出す。
 *   4. localStorage で「使用済み」を記録 (1 ユーザ 1 回)。
 *
 * GA4 計測:
 *   - free_generate_start         submit 直後
 *   - free_generate_complete      iframe 表示できる状態になった瞬間
 *   - free_generate_error         API 失敗 or バリデーション失敗
 *   - free_generate_limit_reached モーダルを開いた段階で既に使用済みだったとき
 */
import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Lock, ArrowRight, AlertCircle, Check, Crown } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  generateAnonymousTrialPDF,
  AnonymousTrialError,
} from "@/lib/api";
import { markAnonymousTrialUsed } from "@/lib/anonymous-trial";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  trackFreeGenerateStart,
  trackFreeGenerateComplete,
  trackFreeGenerateError,
  trackFreeGenerateLimitReached,
} from "@/lib/gtag";

interface AnonymousTrialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ログイン CTA を押されたときに発火 (signIn 等を呼び出す)。
   *  「上限到達」画面で Free を選んだときも、この関数が呼ばれる (= サインアップで Free 開始)。 */
  onLoginRequested: () => void;
  /** 親が open するタイミングで `hasUsedAnonymousTrial()` を評価して渡す。
   *  true なら入力フェーズの代わりに「上限到達 + プラン選択」UI を出す。
   *  state を effect で書き換えなくて済むようにフェーズ計算を props から導出する。 */
  alreadyUsed: boolean;
  /** 「上限到達」画面で有料プランを選んだときに発火。
   *  親側で Stripe Checkout (未ログインなら signIn → ?plan=xxx → checkout) に飛ばす。
   *  未指定なら Free の場合と同じく onLoginRequested を呼ぶ (= 後方互換)。 */
  onPlanSelect?: (planId: PlanId) => void;
}

type Phase = "input" | "loading" | "result";

const SAMPLE_TOPICS_JA = [
  "中学2年・連立方程式の文章題を5問 (難易度ふつう)",
  "高1・三角比 (sin/cos/tan の基本) を4問",
  "高2・指数対数の方程式を6問、解答付き",
];
const SAMPLE_TOPICS_EN = [
  "Algebra 1 — quadratic equations, 5 problems with answers",
  "Geometry — Pythagorean theorem word problems, 4 items",
  "Pre-calc — logarithmic equations, 6 items with solutions",
];

export function AnonymousTrialModal({
  open,
  onOpenChange,
  onLoginRequested,
  alreadyUsed,
  onPlanSelect,
}: AnonymousTrialModalProps) {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  // フェーズは「使用済み」props と内部 state の合成で決める。
  // 「使用済み」のときは入力フェーズを完全に隠し、CTA を限定到達 UI に差し替える。
  const [phase, setPhase] = useState<Phase>("input");
  const [topic, setTopic] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // 「上限到達」表示は alreadyUsed && まだ result/loading に進んでいない場合。
  // 生成成功後は phase=result のまま結果画面を維持する (alreadyUsed が true でも)。
  const showLimitReached = alreadyUsed && phase === "input";

  // 閉じるときに blob URL を片付ける (メモリリーク防止)
  const lastUrlRef = useRef<string | null>(null);
  useEffect(() => {
    lastUrlRef.current = pdfUrl;
  }, [pdfUrl]);
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  const handleSubmit = async () => {
    setErrorMsg(null);
    const trimmed = topic.trim();
    if (!trimmed) {
      setErrorMsg(isJa ? "作りたい教材を一行で入力してください" : "Describe what you'd like to generate");
      return;
    }

    setPhase("loading");
    trackFreeGenerateStart();

    try {
      const { pdf, durationMs } = await generateAnonymousTrialPDF(trimmed, isJa ? "ja" : "en");
      const url = URL.createObjectURL(pdf);
      // 直前の URL があれば破棄してから差し替え
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      setPdfUrl(url);
      setPhase("result");
      markAnonymousTrialUsed();
      trackFreeGenerateComplete({ duration_ms: durationMs });
    } catch (e: unknown) {
      const isLimit = e instanceof AnonymousTrialError && (e.code === "TRIAL_LIMIT_REACHED" || e.status === 429);
      if (isLimit) {
        // サーバ側で弾かれた = この cookie はもう試行できない。フロントの localStorage も
        // 同期して、次回開いたときに開始画面を出さないようにする。
        markAnonymousTrialUsed();
        setPhase("input");
        // 親に「使用済みになった」ことを伝えたいが、props 駆動なので close→reopen で
        // 親が再評価する。即時に限度メッセージを出すため errorMsg にフォールバック。
        setErrorMsg(isJa
          ? "無料お試しの上限に達しました。続きは無料登録 (30秒) でご利用ください。"
          : "You've reached the free trial limit. Sign up free to continue.");
        trackFreeGenerateLimitReached();
        return;
      }
      const msg = e instanceof Error ? e.message : isJa
        ? "生成に失敗しました。もう一度お試しください。"
        : "Generation failed. Please try again.";
      const code = e instanceof AnonymousTrialError ? e.code : undefined;
      const status = e instanceof AnonymousTrialError ? e.status : undefined;
      setErrorMsg(msg);
      setPhase("input");
      trackFreeGenerateError({ reason: code || "unknown", status });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showLimitReached ? "max-w-xl sm:max-w-[560px]" : "max-w-2xl"}>
        <DialogTitle className="flex items-center gap-2 text-[16px] font-bold">
          <Sparkles className="h-4 w-4 text-violet-500" />
          {showLimitReached
            ? (isJa ? "プランを選んで続ける" : "Pick a plan to continue")
            : (isJa ? "ログインなしで試す" : "Try without signing in")}
        </DialogTitle>

        {phase === "input" && !showLimitReached && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {isJa
                ? "作りたい教材を一行で書くと、AI が LaTeX 組版の PDF を 1 枚作ります。登録なしで 1 回だけ試せます。"
                : "Describe what you want — AI generates one beautifully typeset LaTeX PDF. One try, no signup."}
            </p>

            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={isJa
                ? "例: 高1・二次関数の最大最小を4問、難易度ふつう、解答付き"
                : "e.g. Algebra 1 — solving linear equations, 5 problems with answers"}
              className="min-h-[88px] text-[14px]"
              maxLength={200}
              autoFocus
            />

            <div className="flex flex-wrap gap-1.5">
              {(isJa ? SAMPLE_TOPICS_JA : SAMPLE_TOPICS_EN).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTopic(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-foreground/[0.1] text-muted-foreground hover:border-violet-500/30 hover:text-foreground transition"
                >
                  {s}
                </button>
              ))}
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground/80">
                {isJa ? "登録なし · 30〜60秒で1枚" : "No signup · 30–60s per sheet"}
              </p>
              <Button onClick={handleSubmit} className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                {isJa ? "無料で1枚作ってみる" : "Generate one for free"}
              </Button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <p className="text-[13px] font-medium">
              {isJa ? "AI が問題を考えています…" : "AI is composing your worksheet…"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isJa ? "通常 30〜60 秒ほどかかります" : "Usually takes 30–60 seconds"}
            </p>
          </div>
        )}

        {phase === "result" && pdfUrl && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg overflow-hidden border border-foreground/[0.08] bg-foreground/[0.02]">
              <iframe
                src={pdfUrl}
                title={isJa ? "お試し生成 PDF" : "Trial PDF"}
                className="w-full h-[420px] bg-white"
              />
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-violet-500/[0.05] border border-violet-500/[0.18]">
              <Lock className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[12.5px] font-semibold mb-0.5">
                  {isJa
                    ? "このプリントを保存する"
                    : "Save this worksheet for free"}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {isJa
                    ? "無料アカウントで保存・再編集・再ダウンロードできます。"
                    : "Create a free account to save, edit, and download it again later."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {isJa ? "閉じる" : "Close"}
              </Button>
              <Button onClick={onLoginRequested} className="gap-2">
                {isJa ? "このプリントを保存する" : "Save this worksheet for free"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {showLimitReached && (
          <LimitReachedPlanPicker
            isJa={isJa}
            onClose={() => onOpenChange(false)}
            onSelect={(planId) => {
              // Free は従来通り signIn 経路、有料は親の onPlanSelect (Stripe Checkout) へ
              if (planId === "free" || !onPlanSelect) {
                onLoginRequested();
              } else {
                onPlanSelect(planId);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 上限到達時のプラン選択ブロック。
 *
 *  デザイン方針 (前回までの 2-3 列レイアウトが幅不足で潰れていた反省):
 *    - **縦スタック構造** に変更。Pro を full-width hero として大きく見せて、
 *      Starter / Free は その下に「もう少し控えめな選択肢」として並べる
 *    - Pro は **黒地白字 + 大きい価格 + full-width filled CTA** でドミナント
 *    - Starter / Free は同サイズの 2 カラム slim カード
 *    - dialog 幅も `max-w-[560px]` に絞って、横の窮屈さを完全排除
 *    - 折返しが起きない短文に絞る (「月500回・1日40回」を「月500回 (40/日)」等)
 */
function LimitReachedPlanPicker({
  isJa,
  onClose,
  onSelect,
}: {
  isJa: boolean;
  onClose: () => void;
  onSelect: (planId: PlanId) => void;
}) {
  const proDef = PLANS.pro;
  const starterDef = PLANS.starter;
  const freeDef = PLANS.free;
  const proName = isJa ? proDef.name : (proDef.nameEn ?? proDef.name);
  const starterName = isJa ? starterDef.name : (starterDef.nameEn ?? starterDef.name);
  const freeName = isJa ? freeDef.name : (freeDef.nameEn ?? freeDef.name);

  // 折返しを起こさない短い文言に厳選 (full-width Pro なら 3 行入る)
  const proFeatures = isJa
    ? ["高性能AI 月500回 (1日40回まで)", "教材PDF・Pro テンプレ 無制限", "採点・OCR・バッチ生成まで全機能"]
    : ["Premium AI 500/mo (40/day)", "Unlimited PDF & Pro templates", "Grading, OCR, batch — everything"];

  return (
    <div className="flex flex-col gap-4">
      {/* 上限到達アラート — slim な 1 段 */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/30">
        <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-[3px] shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-tight leading-snug">
            {isJa ? "無料お試しはこのブラウザで使い切りました" : "You've used your free trial on this browser"}
          </p>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
            {isJa
              ? "プランを選ぶと、Google サインインからそのまま続きが使えます。"
              : "Pick a plan to sign up with Google and continue right away."}
          </p>
        </div>
      </div>

      {/* ── Pro Hero (full width / 黒地白字 / 価格大) ── */}
      <button
        type="button"
        onClick={() => onSelect("pro")}
        className="group relative text-left rounded-2xl px-6 py-6 bg-foreground text-background overflow-hidden transition active:scale-[0.995] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
      >
        {/* 微妙な装飾 — 右上の角に光のグラデを敷いて完全な黒を回避 (生っぽさ) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl"
        />

        <div className="relative flex flex-col gap-5">
          {/* 上段: 「おすすめ」スタンプ + tagline + 価格 */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold tracking-[0.22em] uppercase text-background/55 mb-2 flex items-center gap-1.5">
                <Crown className="h-3 w-3" />
                {isJa ? "毎日使うならこのプラン" : "For daily users — recommended"}
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[24px] font-bold tracking-tight leading-none">{proName}</span>
                <span className="text-[10.5px] text-background/55">
                  {isJa ? "Eddivom の主力プラン" : "Eddivom's flagship plan"}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[40px] font-bold tabular-nums tracking-tight leading-none">{proDef.priceLabel}</span>
                <span className="text-[13px] text-background/65">{isJa ? "/ 月 (税込)" : "/ mo"}</span>
              </div>
            </div>
          </div>

          {/* 中段: 特徴 3 行 (full width なので折返しなし) */}
          <ul className="space-y-2">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-background/95">
                <Check className="h-4 w-4 mt-[3px] shrink-0 text-background" strokeWidth={2.6} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* 下段: full-width filled CTA — 押せる場所が明確 */}
          <span className="inline-flex items-center justify-center gap-2 w-full h-12 px-6 rounded-full bg-background text-foreground text-[14px] font-semibold group-hover:bg-background/90 transition">
            {isJa ? `${proName} で登録 / 決済へ進む` : `Sign up with ${proName} & continue`}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
          <p className="text-[11px] text-background/55 text-center -mt-2">
            {isJa ? "Google サインイン後、Stripe 決済画面に直行します" : "Sign in with Google → straight to Stripe checkout"}
          </p>
        </div>
      </button>

      {/* "もしくは" ディバイダ */}
      <div className="flex items-center gap-3 my-1">
        <span aria-hidden className="h-px flex-1 bg-foreground/[0.08]" />
        <span className="text-[10.5px] font-medium tracking-[0.22em] uppercase text-muted-foreground/55">
          {isJa ? "もしくは" : "or"}
        </span>
        <span aria-hidden className="h-px flex-1 bg-foreground/[0.08]" />
      </div>

      {/* Starter / Free の slim 2 カラム — 同サイズで control の対称性を出す */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onSelect("starter")}
          className="group relative text-left rounded-xl p-4 bg-card border border-foreground/[0.1] hover:border-foreground/[0.22] hover:shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08)] transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[14.5px] font-bold tracking-tight">{starterName}</span>
            <span className="ml-auto text-[18px] font-bold tabular-nums">{starterDef.priceLabel}</span>
            <span className="text-[10.5px] text-muted-foreground/65">{isJa ? "/ 月" : "/ mo"}</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground/80 leading-snug mb-3">
            {isJa ? "高性能AI 月150回 / PDF 出力 無制限" : "Premium AI 150/mo · unlimited PDF"}
          </p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground/85 group-hover:text-foreground transition">
            {isJa ? `${starterName} で続ける` : `Continue with ${starterName}`}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("free")}
          className="group relative text-left rounded-xl p-4 bg-card border border-foreground/[0.07] hover:border-foreground/[0.18] transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          {/* タイトル行 — 価格と「ずっと無料」サブラベルを 1 ペアに統合して
              "¥0 + 永久無料" の重複を解消 */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[14.5px] font-bold tracking-tight">{freeName}</span>
            <span
              className="ml-auto text-[15px] font-bold tracking-tight"
              style={{ fontFamily: 'ui-serif, "Iowan Old Style", Georgia, serif' }}
            >
              {isJa ? "ずっと無料" : "Always free"}
            </span>
          </div>

          {/* 信頼感を底上げする一行 — クレカ不要を明示 */}
          <p className="text-[10.5px] font-medium text-emerald-700/85 dark:text-emerald-400/85 mb-2">
            {isJa ? "クレジットカード登録なしで開始" : "No credit card required"}
          </p>

          <p className="text-[11.5px] text-muted-foreground/80 leading-snug mb-3">
            {isJa
              ? "高性能AI 月3回・PDF 月1回。気に入ったら後でアップグレード。"
              : "Premium AI 3/mo, 1 PDF/mo. Upgrade later when you're ready."}
          </p>

          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground/80 group-hover:text-foreground transition">
            {isJa ? "このまま無料で登録する" : "Sign up free →"}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      </div>

      {/* フッター */}
      <div className="flex items-center justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground/60">
          {isJa ? "閉じる" : "Close"}
        </Button>
      </div>
    </div>
  );
}
