import React from "react";
import { ChatMessage } from "@/lib/types";
import {
  Sparkles, ThumbsUp, ThumbsDown,
  AlertCircle, RotateCcw, ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { ChatMarkdown } from "./chat-markdown";
import { ActionTimeline } from "./action-timeline";
import { formatRelativeTime, formatDuration, formatTokens } from "./utils";
import { useI18n } from "@/lib/i18n";

export function MessageRow({
  msg, onFeedback, onRetryError,
}: {
  msg: ChatMessage;
  onFeedback: (msgId: string, feedback: "good" | "bad") => void;
  onRetryError?: (msgId: string) => void;
}) {
  const { t, locale } = useI18n();
  const isUser = msg.role === "user";
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);

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
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar — AI only; user has no avatar (LP style) */}
      {!isUser && (
        <div className="h-7 w-7 rounded-lg chat-avatar-ai-static flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* AI meta row (streaming indicator / timing) */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11.5px] font-semibold text-foreground/50 tracking-tight">EddivomAI</span>
            {msg.isStreaming && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600/70 dark:text-amber-400/70 font-medium">
                <span className="thinking-dot-ripple">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                </span>
                {t("chat.streaming")}
              </span>
            )}
            {msg.duration != null && !msg.isStreaming && (
              <span className="text-[10px] text-muted-foreground/30 tabular-nums">{formatDuration(msg.duration)}</span>
            )}
          </div>
        )}

        {/* Message bubble */}
        {isUser ? (
          <div className="chat-msg-user rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[88%]">
            <span className="text-[13.5px] leading-relaxed text-white whitespace-pre-wrap font-medium">{msg.content}</span>
          </div>
        ) : (
          <div className="max-w-full w-full">
            {msg.isStreaming && !msg.content ? null : (
              <div className="chat-msg-ai rounded-2xl rounded-tl-sm px-4 py-3.5">
                <div className="text-[13.5px] leading-[1.75] text-foreground/85 chat-markdown">
                  <ChatMarkdown content={msg.content} />
                  {msg.isStreaming && <span className="stream-cursor" />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LaTeX applied — compact pill */}
        {!isUser && msg.latex && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>{t("chat.applied.label")} — {msg.latex.length.toLocaleString()} {t("chat.applied.suffix")}</span>
          </div>
        )}

        {/* Action timeline */}
        {!isUser && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
          <ActionTimeline steps={msg.thinkingSteps} />
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
      </div>
    </div>
  );
}
