import React from "react";
import { ChatMessage } from "@/lib/types";
import {
  Sparkles, ThumbsUp, ThumbsDown,
  AlertCircle, RotateCcw, ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { ChatMarkdown } from "./chat-markdown";
import { ActionTimeline } from "./action-timeline";
import { VariantButton } from "./variant-button";
import { formatRelativeTime, formatDuration, formatTokens, splitSummary } from "./utils";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDocumentStore } from "@/store/document-store";
import { ChatPdfPreviewCard } from "./chat-pdf-preview-card";

export function MessageRow({
  msg, onFeedback, onRetryError,
  showVariant, variantLocked, variantTrialBadge, variantBusy,
  onVariantTrigger, onVariantLockedClick,
}: {
  msg: ChatMessage;
  onFeedback: (msgId: string, feedback: "good" | "bad") => void;
  onRetryError?: (msgId: string) => void;
  /** REM 由来「✨ 類題をもう1枚」を assistant 末尾に出すかどうか。 */
  showVariant?: boolean;
  /** Free + 使用済 → ロック表示 + クリックで signup overlay */
  variantLocked?: boolean;
  /** Free + 未消費 → "お試し" バッジ付きで表示 */
  variantTrialBadge?: boolean;
  /** ストリーミング中などで二重発火を防ぐ */
  variantBusy?: boolean;
  /** active 状態でクリックされたとき: 親が handleSend(..., { mode:"variant" }) を呼ぶ */
  onVariantTrigger?: () => void;
  /** ロック状態でクリックされたとき: 親が signup overlay を開く */
  onVariantLockedClick?: () => void;
}) {
  const { t, locale } = useI18n();
  const isUser = msg.role === "user";
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);
  // モバイルのみ、AI が編集を確定したメッセージ直下に PDF プレビューカードを差し込む。
  // PC は既存サイドバー / プレビューパネルがあるので追加しない。
  const isMobile = useIsMobile();
  const docTitle = useDocumentStore((s) => s.document?.metadata.title || "");

  // AI メッセージは実施サマリーを本文から切り出し、別カードで下に表示する。
  // 検出されなかった場合は summary=null で従来通り全文を本文バブルに出す。
  const { body: aiBody, summary: aiSummary } = !isUser
    ? splitSummary(msg.content)
    : { body: msg.content, summary: null };

  // Error message display
  if (!isUser && msg.error) {
    return (
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="h-7 w-7 rounded-full bg-red-100/80 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5 border border-red-200/60 dark:border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12.5px] font-semibold text-foreground/70">Eddivom AI</span>
            {msg.timestamp && (
              <span className="text-[10px] text-muted-foreground/35 ml-auto tabular-nums">{formatRelativeTime(msg.timestamp, t, locale)}</span>
            )}
          </div>
          <div className="chat-error-bubble rounded-2xl rounded-tl-md px-4 py-3.5">
            <p className="text-[13px] text-red-600 dark:text-red-400 leading-relaxed">{msg.content}</p>
            {msg.requestId && (
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="flex items-center gap-1 mt-1.5 text-[11px] text-red-400/60 hover:text-red-400 transition-colors"
              >
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showErrorDetails ? "rotate-180" : ""}`} />
                {t("chat.error.details")}
              </button>
            )}
            {showErrorDetails && msg.requestId && (
              <p className="text-[11px] font-mono text-red-400/50 mt-1">ID: {msg.requestId.slice(0, 8)}</p>
            )}
          </div>
          {onRetryError && (
            <button
              onClick={() => onRetryError(msg.id)}
              className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground/55 hover:text-foreground/75 hover:bg-muted/40 transition-all duration-150"
            >
              <RotateCcw className="h-3 w-3" />
              {t("chat.error.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMobile ? "gap-2" : "gap-2.5"} ${isUser ? "flex-row-reverse" : ""}`}>
      {/* AI アバター
         · PC: 常時表示 (従来どおり)
         · モバイル: ストリーミング中だけ amber halo で出して "Eddivom が動いている" を強い識別シグナルに */}
      {!isUser && !isMobile && (
        <div className="h-7 w-7 rounded-lg chat-avatar-ai-static flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      {!isUser && isMobile && msg.isStreaming && (
        <div className="h-6 w-6 rounded-lg chat-avatar-ai flex items-center justify-center shrink-0 mt-1">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* AI meta row — モバイルでは streaming のときだけ控えめに表示 */}
        {!isUser && (!isMobile || msg.isStreaming) && (
          <div className={`flex items-center gap-2 ${isMobile ? "mb-0.5" : "mb-1"}`}>
            {!isMobile && (
              <span className="text-[11.5px] font-semibold text-foreground/50 tracking-tight">EddivomAI</span>
            )}
            {msg.isStreaming && (
              <span className="flex items-center gap-1 font-medium text-[11px] text-amber-600 dark:text-amber-400">
                <span className="thinking-dot-ripple">
                  <span className="h-1.5 w-1.5 rounded-full inline-block bg-amber-500" />
                </span>
                {t("chat.streaming")}
              </span>
            )}
            {!isMobile && msg.duration != null && !msg.isStreaming && (
              <span className="text-[10px] text-muted-foreground/30 tabular-nums">{formatDuration(msg.duration)}</span>
            )}
          </div>
        )}

        {/* Message bubble */}
        {isUser ? (
          <div className={`chat-msg-user rounded-2xl ${isMobile ? "rounded-tr-2xl px-3.5 py-2 max-w-[82%]" : "rounded-tr-sm px-4 py-2.5 max-w-[88%]"}`}>
            <span className={`whitespace-pre-wrap font-medium text-white ${
              isMobile ? "text-[15px] leading-[1.5]" : "text-[13.5px] leading-relaxed"
            }`}>{msg.content}</span>
          </div>
        ) : (
          <div className="max-w-full w-full">
            {msg.isStreaming && !msg.content ? null : aiBody || msg.isStreaming ? (
              <div className={`chat-msg-ai ${isMobile ? "" : "rounded-2xl rounded-tl-sm px-4 py-3.5"}`}>
                <div className={`text-foreground/90 chat-markdown ${
                  isMobile ? "text-[15.5px] leading-[1.55]" : "text-[13.5px] leading-[1.75]"
                }`}>
                  <ChatMarkdown content={aiBody || ""} />
                  {msg.isStreaming && <span className="stream-cursor" />}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* LaTeX applied — compact pill。モバイルでは文字数を省略してさらにミニマルに */}
        {!isUser && msg.latex && (
          <div className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/20 ${
            isMobile ? "mt-1.5 px-2 py-0.5 text-[10.5px]" : "mt-2 px-2.5 py-1 text-[11px] shadow-sm"
          }`}>
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>
              {isMobile
                ? t("chat.applied.label")
                : `${t("chat.applied.label")} — ${msg.latex.length.toLocaleString()} ${t("chat.applied.suffix")}`}
            </span>
          </div>
        )}

        {/* モバイルでは編集確定後に PDF プレビューを「チャット内のメッセージ」として差し込む。
            ストリーミング中は出さず、確定 (latex 入り) してから lazy にコンパイルする。 */}
        {!isUser && isMobile && msg.latex && !msg.isStreaming && (
          <ChatPdfPreviewCard
            latex={msg.latex}
            title={docTitle}
            msgId={msg.id}
          />
        )}

        {/* Action timeline */}
        {!isUser && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
          <ActionTimeline steps={msg.thinkingSteps} />
        )}

        {/* 実施サマリー — 思考ログのさらに下に表示。モバイルではよりフラット & コンパクト */}
        {!isUser && aiSummary && (
          <div
            className={
              isMobile
                ? "mt-2 rounded-xl border border-emerald-200/40 dark:border-emerald-500/15 bg-emerald-50/40 dark:bg-emerald-500/[0.04]"
                : "mt-2.5 rounded-xl border border-emerald-200/55 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/60 via-white to-amber-50/35 dark:from-emerald-500/[0.05] dark:via-white/[0.01] dark:to-amber-500/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_2px_rgba(6,95,70,0.04)]"
            }
            role="region"
            aria-label={locale === "en" ? "Execution summary" : "実施サマリー"}
          >
            <div className={`flex items-center gap-1.5 ${
              isMobile ? "px-3 pt-1.5 pb-0.5" : "px-3.5 pt-2 pb-1 border-b border-emerald-200/40 dark:border-emerald-500/15"
            }`}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <span className={`font-bold tracking-[0.08em] uppercase text-emerald-700/85 dark:text-emerald-300/80 ${
                isMobile ? "text-[9.5px]" : "text-[10.5px]"
              }`}>
                {locale === "en" ? "Summary" : "サマリー"}
              </span>
            </div>
            <div className={`chat-markdown ${
              isMobile ? "px-3 pb-2.5 pt-1 text-[13.5px] leading-[1.6] text-foreground/85" : "px-4 py-3 text-[13px] leading-[1.7] text-foreground/85"
            }`}>
              <ChatMarkdown content={aiSummary} />
            </div>
          </div>
        )}

        {/* Footer: feedback + token usage */}
        {!isUser && !msg.isStreaming && msg.content && (
          <div className="flex items-center gap-0.5 mt-2">
            <button
              onClick={() => onFeedback(msg.id, "good")}
              title={t("chat.feedback.good")}
              className={`p-1.5 rounded-full transition-all duration-150 ${
                msg.feedback === "good"
                  ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 shadow-sm"
                  : "text-muted-foreground/20 hover:text-emerald-500 hover:bg-emerald-50/80 dark:hover:bg-emerald-500/10"
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onFeedback(msg.id, "bad")}
              title={t("chat.feedback.bad")}
              className={`p-1.5 rounded-full transition-all duration-150 ${
                msg.feedback === "bad"
                  ? "text-rose-500 bg-rose-50 dark:bg-rose-500/15 shadow-sm"
                  : "text-muted-foreground/20 hover:text-rose-500 hover:bg-rose-50/80 dark:hover:bg-rose-500/10"
              }`}
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
            {msg.usage && (
              <span className="text-[9.5px] text-muted-foreground/25 ml-auto tabular-nums">
                {formatTokens(msg.usage.inputTokens)}↑ {formatTokens(msg.usage.outputTokens)}↓
              </span>
            )}
          </div>
        )}

        {/* REM ノウハウ由来「✨ 類題をもう1枚」: 末尾 assistant メッセージにだけ出す。
            Pro+ は常時 active、Free は 1 回だけ active、消費後は <Lock /> 付き。 */}
        {!isUser && showVariant && (onVariantTrigger || onVariantLockedClick) && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <VariantButton
              onTrigger={onVariantTrigger ?? (() => {})}
              onLockedClick={onVariantLockedClick ?? (() => {})}
              locked={!!variantLocked}
              busy={!!variantBusy}
              showProBadge={!!variantTrialBadge}
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
