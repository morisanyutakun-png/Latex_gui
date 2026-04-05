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
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="h-7 w-7 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-medium text-foreground/80">Eddivom AI</span>
            {msg.timestamp && (
              <span className="text-[11px] text-muted-foreground/40 ml-auto">{formatRelativeTime(msg.timestamp)}</span>
            )}
          </div>
          <div className="rounded-2xl rounded-tl-md bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/15 px-3.5 py-2.5">
            <p className="text-[13px] text-red-600 dark:text-red-400 leading-relaxed">{msg.content}</p>
            {msg.requestId && (
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="flex items-center gap-1 mt-1.5 text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showErrorDetails ? "rotate-180" : ""}`} />
                詳細
              </button>
            )}
            {showErrorDetails && msg.requestId && (
              <p className="text-[11px] font-mono text-red-400/60 mt-1">ID: {msg.requestId.slice(0, 8)}</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {onRetryError && (
              <button
                onClick={() => onRetryError(msg.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                リトライ
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
        </div>
      ) : (
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-violet-500/30">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Name + meta */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-[13px] font-medium text-foreground/80">
            {isUser ? "あなた" : "Eddivom AI"}
          </span>
          {!isUser && msg.isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-violet-500/70">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
              考え中...
            </span>
          )}
          {!isUser && msg.duration != null && !msg.isStreaming && (
            <span className="text-[11px] text-muted-foreground/40">{formatDuration(msg.duration)}</span>
          )}
          {msg.timestamp && (
            <span className={`text-[11px] text-muted-foreground/40 ${isUser ? "mr-auto" : "ml-auto"}`}>
              {formatRelativeTime(msg.timestamp)}
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div className={`${
          isUser
            ? "rounded-2xl rounded-tr-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white px-3.5 py-2.5 max-w-[85%] shadow-sm shadow-violet-500/20"
            : "max-w-full ai-message-bubble"
        }`}>
          {isUser ? (
            <span className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</span>
          ) : msg.isStreaming && !msg.content ? (
            null
          ) : (
            <div className="text-[13px] leading-relaxed text-foreground/85 chat-markdown">
              <ChatMarkdown content={msg.content} />
              {msg.isStreaming && (
                <span className="inline-block w-[5px] h-[15px] bg-violet-500/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
              )}
            </div>
          )}
        </div>

        {/* Patch applied banner */}
        {!isUser && msg.patches && msg.patches.ops && msg.patches.ops.length > 0 && (
          <div className="mt-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-500/15 bg-emerald-50/80 dark:bg-emerald-500/[0.06] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
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
                  return `文書に適用しました — ${parts.join("・") || `${ops.length}件の操作`}`;
                })()}
              </span>
              <FileEdit className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
            </div>
            <DiffViewer patches={msg.patches!} />
          </div>
        )}

        {/* Action timeline (thinking steps) */}
        {!isUser && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
          <ActionTimeline steps={msg.thinkingSteps} />
        )}

        {/* Footer: feedback + token usage */}
        {!isUser && !msg.isStreaming && msg.content && (
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={() => onFeedback(msg.id, "good")}
              className={`p-1.5 rounded-full transition-colors ${
                msg.feedback === "good"
                  ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/15"
                  : "text-muted-foreground/25 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onFeedback(msg.id, "bad")}
              className={`p-1.5 rounded-full transition-colors ${
                msg.feedback === "bad"
                  ? "text-red-500 bg-red-50 dark:bg-red-500/15"
                  : "text-muted-foreground/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              }`}
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
            {msg.usage && (
              <span className="text-[10px] text-muted-foreground/30 ml-auto">
                {formatTokens(msg.usage.inputTokens)} / {formatTokens(msg.usage.outputTokens)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
