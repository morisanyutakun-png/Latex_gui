import React from "react";
import { ThinkingStep } from "@/lib/types";
import {
  Sparkles, Brain, Terminal, AlertCircle,
  Search, Wrench, Eye, Hammer, BookOpen,
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

  return (
    <div className="flex gap-3">
      {/* Avatar — animated halo */}
      <div className="h-7 w-7 rounded-full chat-avatar-ai flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-white/90" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[12px] font-semibold tracking-wide text-foreground/60 uppercase">Eddivom AI</span>
          {activeRewriteKind && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full text-[9.5px] font-extrabold tracking-wider text-white shadow-sm shrink-0 ${
                activeRewriteKind === "variant"
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  : "bg-gradient-to-r from-blue-500 to-violet-500"
              }`}
              title={
                activeRewriteKind === "variant"
                  ? (isJa ? "REM ノウハウで類題を生成中" : "Generating variants via REM-style prompt")
                  : (isJa ? "REM ノウハウでプロンプトを強化中" : "Enhancing prompt via REM-style structure")
              }
            >
              <Sparkles className="h-2.5 w-2.5" />
              {activeRewriteKind === "variant"
                ? (isJa ? "類題生成中" : "Variant")
                : (isJa ? "強化送信中" : "Enhanced")}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[11px] text-amber-600/75 dark:text-amber-400/75 font-medium min-w-0 truncate">
            <span className="thinking-dot-ripple shrink-0">
              <span className="h-1.5 w-1.5 rounded-full inline-block bg-amber-500" />
            </span>
            <span className="truncate">{statusText}</span>
          </span>
          <span className="text-[10px] text-muted-foreground/30 tabular-nums ml-auto shrink-0">{elapsedSec}s</span>
        </div>
        {/* Progress bar — 「セッションが生きている」ことを伝える主要シグナル。
            非ストリーミング (ゲスト) でも live phase 推定で滑らかに伸びる。
            完了前に 100% にしないため上限は 95%。 */}
        <div
          className="h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden mb-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressFraction * 100)}
          aria-label={isJa ? "AI 生成の進行状況" : "AI generation progress"}
        >
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-violet-500 to-fuchsia-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>

        {/* Activity log card */}
        <div className="chat-thinking-card rounded-2xl rounded-tl-sm overflow-hidden">
          <div className="px-3.5 py-3 space-y-2 text-[12px] min-h-[44px] max-h-[260px] overflow-y-auto scroll-smooth scrollbar-thin">
            {hasSteps && liveSteps.map((step, i) => {
              const Icon = step.tool
                ? (TOOL_ICONS[step.tool] || Terminal)
                : step.type === "thinking" ? Brain
                : step.type === "error" ? AlertCircle
                : Eye;

              const isCompleted = step.type === "tool_result";
              const isError = step.type === "error";
              const isThinking = step.type === "thinking";

              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    isError   ? "bg-red-100/80 dark:bg-red-500/12" :
                    isCompleted ? "bg-emerald-100/80 dark:bg-emerald-500/12" :
                    isThinking  ? "bg-violet-100/60 dark:bg-violet-500/10" :
                    "bg-indigo-100/60 dark:bg-indigo-500/10"
                  }`}>
                    <Icon className={`h-3 w-3 ${
                      isError     ? "text-red-500" :
                      isCompleted ? "text-emerald-500" :
                      isThinking  ? "text-violet-400" :
                      "text-indigo-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`leading-relaxed break-all ${
                      isError     ? "text-red-500/80" :
                      isCompleted ? "text-emerald-600/80 dark:text-emerald-400/70" :
                      isThinking  ? "text-muted-foreground/50" :
                      "text-indigo-500/80 dark:text-indigo-400/70"
                    }`}>{step.text}</span>
                  </div>
                  {step.duration != null && step.duration > 0 && (
                    <span className="text-muted-foreground/25 shrink-0 text-[10px] tabular-nums">{formatDuration(step.duration)}</span>
                  )}
                </div>
              );
            })}

            {/* Currently running tool */}
            {currentTool && (
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-md bg-amber-100/70 dark:bg-amber-500/12 flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = TOOL_ICONS[currentTool] || Terminal;
                    return <Icon className="h-3 w-3 text-amber-600/80 dark:text-amber-400/80 animate-pulse" />;
                  })()}
                </div>
                <span className="text-amber-600/70 dark:text-amber-400/70 animate-pulse">
                  {getToolLabel(currentTool, t)}...
                </span>
              </div>
            )}

            {/* Generic thinking — 段階フェーズ + 想定タイム + 安心フッター */}
            {useSynthetic && (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-md bg-amber-100/60 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Brain className="h-3 w-3 text-amber-500/70 dark:text-amber-400/60 animate-pulse" />
                  </div>
                  <span className="text-foreground/70">{phase.label}</span>
                  <span className="ml-auto text-[10.5px] text-muted-foreground/50 tabular-nums shrink-0">
                    {Math.min(99, Math.round(progressFraction * 100))}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/55 leading-snug">
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
              <div className="flex items-center gap-2 pt-0.5 text-[11px] text-amber-500/70 border-t border-amber-200/20 dark:border-amber-500/10">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
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
    </div>
  );
}
