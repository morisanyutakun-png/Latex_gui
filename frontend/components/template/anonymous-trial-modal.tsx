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
      <DialogContent className="max-w-2xl">
        <DialogTitle className="flex items-center gap-2 text-[16px] font-bold">
          <Sparkles className="h-4 w-4 text-violet-500" />
          {isJa ? "ログインなしで試す" : "Try without signing in"}
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

/** 上限到達時のプラン選択ブロック。閉じる → サインアップの 2 アクションを廃して、
 *  この場で Free / Starter / Pro を 1 タップで選べるようにする。
 *
 *  デザイン方針:
 *    - 説明文は最小限 (1 文)
 *    - Pro を highlight (おすすめ)、Starter は中間、Free は最下段
 *    - 各カードに代表的な特徴 2-3 行だけ。詳細比較は LP の料金表に任せる
 *    - 「閉じる」だけ右下に小さく残す (誤タップ回避)
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
  // 上限到達直後の選択肢としては Pro / Starter / Free の 3 段で十分
  // (Premium は組織契約ライク、ここで売り込むのは過剰)
  const order: PlanId[] = ["pro", "starter", "free"];

  // プラン別の「ここで売り込む 2-3 行」を絞り込む。features の頭から 3 件が
  // ちょうど「枠を超える価値」を表現できているのでそのまま使う。
  const featuresFor = (planId: PlanId): string[] => {
    const def = PLANS[planId];
    const list = isJa ? def.features : (def.featuresEn ?? def.features);
    return list.slice(0, 3);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/[0.25]">
        <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold mb-0.5">
            {isJa ? "無料お試しはこのブラウザで使い切りました" : "You've used your free trial on this browser"}
          </p>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            {isJa
              ? "プランを選ぶと、そのまま登録 → 続きから AI 生成・編集・PDF まで使えます。"
              : "Pick a plan to sign up and unlock AI editing & PDF in the same flow."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {order.map((planId) => {
          const def = PLANS[planId];
          const isHighlight = planId === "pro";
          const planName = isJa ? def.name : (def.nameEn ?? def.name);
          const tagline = isJa ? def.tagline : (def.taglineEn ?? def.tagline);
          const subLabel = planId === "free"
            ? (isJa ? "永久無料" : "Free forever")
            : (isJa ? "/ 月" : "/ mo");
          const ctaLabel = planId === "free"
            ? (isJa ? "無料で続ける" : "Continue free")
            : (isJa ? `${planName} で続ける` : `Continue with ${planName}`);

          return (
            <button
              key={planId}
              type="button"
              onClick={() => onSelect(planId)}
              className={`relative text-left rounded-xl p-4 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
                isHighlight
                  ? "bg-card border border-foreground/[0.18] shadow-[0_2px_12px_-6px_rgba(0,0,0,0.12)]"
                  : "bg-card border border-foreground/[0.08] hover:border-foreground/[0.14]"
              }`}
            >
              {isHighlight && (
                <>
                  <span aria-hidden className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-foreground" />
                  <span className="absolute -top-2 right-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground text-background text-[9.5px] font-semibold tracking-wide">
                    <Crown className="h-2.5 w-2.5" />
                    {isJa ? "おすすめ" : "RECOMMENDED"}
                  </span>
                </>
              )}

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[14px] font-semibold tracking-tight">{planName}</span>
                <span className="ml-auto text-[18px] font-bold tabular-nums">{def.priceLabel}</span>
                <span className="text-[10.5px] text-muted-foreground/70">{subLabel}</span>
              </div>
              {tagline && (
                <p className="text-[11px] text-muted-foreground/75 mb-2 leading-snug">{tagline}</p>
              )}
              <ul className="space-y-1 mb-3">
                {featuresFor(planId).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11.5px] text-foreground/80 leading-snug">
                    <Check className="h-3 w-3 mt-[2px] shrink-0 text-foreground/55" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <span
                className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${
                  isHighlight ? "text-foreground" : "text-foreground/75"
                }`}
              >
                {ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10.5px] text-muted-foreground/60 leading-relaxed">
        {isJa
          ? "クリック後、Google でサインイン → 自動的に決済画面 (Free はそのままエディタ) に進みます。"
          : "After clicking, sign in with Google — you'll go straight to checkout (or editor for Free)."}
      </p>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground/70">
          {isJa ? "閉じる" : "Close"}
        </Button>
      </div>
    </div>
  );
}
