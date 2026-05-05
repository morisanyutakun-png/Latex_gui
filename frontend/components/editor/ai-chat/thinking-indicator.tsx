import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Sparkles, Brain, Terminal, AlertCircle,
  Search, Wrench, Eye, Hammer, BookOpen, CheckCircle2, Loader2,
} from "lucide-react";
import { formatDuration } from "./utils";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/store/ui-store";

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_latex: BookOpen,
  set_latex: Wrench,
  replace_in_latex: Search,
  compile_check: Hammer,
};

function getToolLabel(name: string, t: (k: string) => string): string {
  switch (name) {
    case "read_latex": return t("chat.tool.read.label");
    case "set_latex": return t("chat.tool.write.label");
    case "replace_in_latex": return t("chat.tool.replace.label");
    case "compile_check": return t("chat.tool.compile.label");
    default: return `${name} ${t("chat.tool.executing")}`;
  }
}

export function ThinkingIndicator({
  userMessage,
  liveSteps,
  currentTool,
}: {
  userMessage: string;
  liveSteps?: ThinkingStep[];
  currentTool?: string | null;
}) {
  const { t, locale } = useI18n();
  const isJa = locale !== "en";
  // ゲスト (LP からのお試し) は streaming endpoint を使えないので、
  // 「分析中」しか出ない時間が長く「壊れている」と誤解されやすい。
  // store-fresh で読んでゲスト時のみ「30〜60秒で完成します」のヒントを足す。
  const isGuest = useUIStore((s) => s.isGuest);
  // 類題生成 / プロンプト強化中は「目的の見える」ラベルに差し替える (Claude/ChatGPT 風)。
  const activeRewriteKind = useUIStore((s) => s.activeRewriteKind);
  const [elapsed, setElapsed] = React.useState(0);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // 100ms 刻みで小数の経過時間を保持して progress bar を滑らかに動かす。
    // 表示用の整数秒は Math.floor で別途算出する。
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveSteps, currentTool]);

  const hasSteps = liveSteps && liveSteps.length > 0;
  const elapsedSec = Math.floor(elapsed);
  const isLongWait = elapsedSec >= 30;

  /**
   * 段階ベースの進捗フェーズ。
   * ─────────────────────────
   * 非ストリーミング経路 (ゲストお試し / sync fallback) では SSE による live progress が
   * 取れないため、ユーザに「セッションが進行中」を体感させる目的で時間ベースの
   * 疑似フェーズを出す。経験則的なワークシート生成タイムライン (60s 想定) を
   * もとに、phase / 進捗率 / メッセージを返す。
   * 進捗率は 95% で頭打ちにして、完了前に 100% にしないことで「あと少し」感を保つ。
   */
  function syntheticPhase(sec: number) {
    const phases = isJa
      ? [
          { until: 3,  label: "リクエスト送信中…",         pct: 0.05 },
          { until: 10, label: "AI が問題を構成中…",        pct: 0.20 },
          { until: 25, label: "問題と解答を生成中…",       pct: 0.45 },
          { until: 45, label: "LaTeX を組版しています…",   pct: 0.70 },
          { until: 60, label: "もう少しで完成します…",     pct: 0.85 },
          { until: 999, label: "サーバが混雑しています。お待ちください…", pct: 0.95 },
        ]
      : [
          { until: 3,  label: "Sending request…",                 pct: 0.05 },
          { until: 10, label: "AI is structuring the problems…",  pct: 0.20 },
          { until: 25, label: "Generating problems & answers…",   pct: 0.45 },
          { until: 45, label: "Typesetting LaTeX…",               pct: 0.70 },
          { until: 60, label: "Almost done…",                      pct: 0.85 },
          { until: 999, label: "Server is busy. Hang tight…",      pct: 0.95 },
        ];
    for (const p of phases) {
      if (sec < p.until) return p;
    }
    return phases[phases.length - 1];
  }
  const phase = syntheticPhase(elapsed);
  // ステップ / ツール実行が始まったら現実の進捗が見えるので、合成ヘッダはそちらに譲る。
  const useSynthetic = !hasSteps && !currentTool;
  const statusText = currentTool
    ? getToolLabel(currentTool, t)
    : hasSteps
    ? t("chat.thinking.processing")
    : useSynthetic
    ? phase.label
    : t("chat.thinking.thinking");
  // progress bar 表示用 (0..1)。実 progress が見えるストリーミング時もインジケータとして
  // フェーズ推定を流用する (= 「何秒かかってる」を体感してもらう)。
  const progressFraction = Math.min(0.95, Math.max(0.04, elapsed / 60));

  const pctNow = Math.min(99, Math.round(progressFraction * 100));

  return (
    <div className="thinking-indicator-row">
      {/* Avatar — animated halo + concentric pulse */}
      <div className="thinking-avatar">
        <div className="h-7 w-7 rounded-full chat-avatar-ai flex items-center justify-center relative">
          <Sparkles className="h-3.5 w-3.5 text-white/95 thinking-avatar-spark" />
        </div>
        <span className="thinking-avatar-pulse" aria-hidden />
      </div>

      <div className="thinking-card">
        {/* sheen overlay (CSS animated) */}
        <span className="thinking-card-sheen" aria-hidden />

        {/* Top header strip — brand + status + elapsed */}
        <div className="thinking-card-head">
          <div className="thinking-card-head-left">
            <span className="thinking-card-brand">
              <span className="thinking-card-brand-dot" aria-hidden />
              EDDIVOM AI
            </span>
            {activeRewriteKind && (
              <span
                className={`thinking-card-tag ${
                  activeRewriteKind === "variant" ? "is-variant" : "is-enhance"
                }`}
                title={
                  activeRewriteKind === "variant"
                    ? (isJa ? "高精度エンジンで類題を生成中" : "Generating variants via Precision Variant Engine")
                    : (isJa ? "出題ノウハウでプロンプトを強化中" : "Enhancing prompt with authoring playbook")
                }
              >
                <Sparkles className="h-2.5 w-2.5" />
                {activeRewriteKind === "variant"
                  ? (isJa ? "類題生成" : "Variant")
                  : (isJa ? "強化送信" : "Enhanced")}
              </span>
            )}
          </div>
          <span className="thinking-card-elapsed tabular-nums">
            <span className="thinking-card-elapsed-tick" aria-hidden />
            {elapsedSec}s
          </span>
        </div>

        {/* Status row — current activity */}
        <div className="thinking-card-status">
          <span className="thinking-status-glyph" aria-hidden>
            <Loader2 className="h-3.5 w-3.5 thinking-status-spin" />
          </span>
          <span className="thinking-status-text">{statusText}</span>
          <span className="thinking-status-pct tabular-nums">{pctNow}%</span>
        </div>

        {/* Premium progress bar — gradient track + comet head + ambient glow */}
        <div
          className="thinking-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pctNow}
          aria-label={isJa ? "AI 生成の進行状況" : "AI generation progress"}
        >
          <div
            className="thinking-progress-fill"
            style={{ width: `${progressFraction * 100}%` }}
          >
            <span className="thinking-progress-shimmer" aria-hidden />
            <span className="thinking-progress-head" aria-hidden />
          </div>
        </div>

        {/* Activity log */}
        <div className="thinking-card-log scrollbar-thin">
          {hasSteps && liveSteps.map((step, i) => {
            const Icon = step.tool
              ? (TOOL_ICONS[step.tool] || Terminal)
              : step.type === "thinking" ? Brain
              : step.type === "error" ? AlertCircle
              : Eye;

            const isCompleted = step.type === "tool_result";
            const isError = step.type === "error";
            const isThinking = step.type === "thinking";
            const variant = isError
              ? "is-error"
              : isCompleted
                ? "is-done"
                : isThinking
                  ? "is-think"
                  : "is-run";

            return (
              <div key={i} className={`thinking-step ${variant}`}>
                <span className="thinking-step-rail" aria-hidden />
                <span className="thinking-step-icon">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </span>
                <span className="thinking-step-text">{step.text}</span>
                {step.duration != null && step.duration > 0 && (
                  <span className="thinking-step-time tabular-nums">{formatDuration(step.duration)}</span>
                )}
              </div>
            );
          })}

          {/* Currently running tool */}
          {currentTool && (
            <div className="thinking-step is-running">
              <span className="thinking-step-rail is-pulsing" aria-hidden />
              <span className="thinking-step-icon">
                {(() => {
                  const Icon = TOOL_ICONS[currentTool] || Terminal;
                  return <Icon className="h-3 w-3" />;
                })()}
              </span>
              <span className="thinking-step-text">{getToolLabel(currentTool, t)}…</span>
              <span className="thinking-step-dots" aria-hidden>
                <span /><span /><span />
              </span>
            </div>
          )}

          {/* Synthetic phase — non-streaming (guest / sync fallback) */}
          {useSynthetic && (
            <>
              <div className="thinking-step is-think">
                <span className="thinking-step-rail" aria-hidden />
                <span className="thinking-step-icon">
                  <Brain className="h-3 w-3" />
                </span>
                <span className="thinking-step-text">{phase.label}</span>
                <span className="thinking-step-dots" aria-hidden>
                  <span /><span /><span />
                </span>
              </div>
              <p className="thinking-card-note">
                {isGuest
                  ? (isJa
                      ? "ログインなしで生成中。通常 30〜60 秒で完成し、自動でプレビューに切り替わります。"
                      : "Generating without sign-in. Typically completes in 30–60s and auto-opens the preview.")
                  : (isJa
                      ? "セッション接続中です。完了するまでこの画面のままお待ちください。"
                      : "Session is alive — please keep this screen open until completion.")}
              </p>
            </>
          )}

          {isLongWait && (
            <div className="thinking-card-longwait">
              <span className="thinking-card-longwait-dot" aria-hidden />
              <span className="leading-snug">
                {isJa
                  ? `${elapsedSec} 秒経過 — AI サーバとの接続は維持されています。途中で閉じないでください。`
                  : `${elapsedSec}s elapsed — connection to the AI server is alive. Please keep this tab open.`}
              </span>
            </div>
          )}

          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
