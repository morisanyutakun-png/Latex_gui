import React from "react";
import { ChatMessage } from "@/lib/types";
import {
  Sparkles, ThumbsUp, ThumbsDown,
  AlertCircle, RotateCcw, ChevronDown,
  CheckCircle2, FileEdit, User,
} from "lucide-react";
import { ChatMarkdown } from "./chat-markdown";
import { ActionTimeline } from "./action-timeline";
import { DiffViewer } from "./diff-viewer";
import { formatRelativeTime, formatDuration, formatTokens } from "./utils";

export function MessageRow({
  msg, onFeedback, onRetryError,
}: {
  msg: ChatMessage;
  onFeedback: (msgId: string, feedback: "good" | "bad") => void;
  onRetryError?: (msgId: string) => void;
}) {
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
              <span className="text-[10px] text-muted-foreground/35 ml-auto tabular-nums">{formatRelativeTime(msg.timestamp)}</span>
            )}
          </div>
          <div className="chat-error-bubble rounded-2xl rounded-tl-sm px-3.5 py-2.5">
            <p className="text-[13px] text-red-600/90 dark:text-red-400 leading-relaxed">{msg.content}</p>
            {msg.requestId && (
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="flex items-center gap-1 mt-1.5 text-[11px] text-red-400/60 hover:text-red-400 transition-colors"
              >
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showErrorDetails ? "rotate-180" : ""}`} />
                詳細
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
              リトライ
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <User className="h-3.5 w-3.5 text-white dark:text-slate-300" />
        </div>
      ) : (
        <div className="h-7 w-7 rounded-full chat-avatar-ai-static flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white/90" />
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Name + meta row */}
        <div className={`flex items-center gap-2 mb-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-[12px] font-semibold tracking-wide text-foreground/60 uppercase">
            {isUser ? "You" : "Eddivom AI"}
          </span>
          {!isUser && msg.isStreaming && (
            <span className="flex items-center gap-1.5 text-[11px] text-violet-500/80 font-medium">
              <span className="thinking-dot-ripple">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 inline-block" />
              </span>
              生成中
            </span>
          )}
          {!isUser && msg.duration != null && !msg.isStreaming && (
            <span className="text-[10px] text-muted-foreground/35 tabular-nums">{formatDuration(msg.duration)}</span>
          )}
          {msg.timestamp && (
            <span className={`text-[10px] text-muted-foreground/35 tabular-nums ${isUser ? "mr-auto" : "ml-auto"}`}>
              {formatRelativeTime(msg.timestamp)}
            </span>
          )}
        </div>

        {/* Message bubble */}
        {isUser ? (
          <div className="chat-msg-user rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[86%]">
            <span className="text-[13.5px] leading-relaxed text-white/95 whitespace-pre-wrap font-[450]">{msg.content}</span>
          </div>
        ) : (
          <div className="max-w-full w-full">
            {msg.isStreaming && !msg.content ? null : (
              <div className="chat-msg-ai rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="text-[13.5px] leading-[1.75] text-foreground/88 chat-markdown">
                  <ChatMarkdown content={msg.content} />
                  {msg.isStreaming && <span className="stream-cursor" />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Patch applied card */}
        {!isUser && msg.patches && msg.patches.ops && msg.patches.ops.length > 0 && (
          <div className="mt-2.5 chat-patch-card rounded-xl overflow-hidden w-full">
            <div className="flex items-center gap-2 px-3.5 py-2">
              <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[12px] text-emerald-700 dark:text-emerald-300 font-medium flex-1">
                {(() => {
                  const ops = msg.patches!.ops;
                  const added = ops.filter(o => o.op === "add_block").length;
                  const updated = ops.filter(o => o.op === "update_block").length;
                  const deleted = ops.filter(o => o.op === "delete_block").length;
                  const parts: string[] = [];
                  if (added) parts.push(`${added}ブロック追加`);
                  if (updated) parts.push(`${updated}件更新`);
                  if (deleted) parts.push(`${deleted}件削除`);
                  return `文書に適用 — ${parts.join(" · ") || `${ops.length}件の操作`}`;
                })()}
              </span>
              <FileEdit className="h-3.5 w-3.5 text-emerald-400/70 shrink-0" />
            </div>
            <DiffViewer patches={msg.patches!} />
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
              title="良い回答"
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
              title="改善が必要"
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
