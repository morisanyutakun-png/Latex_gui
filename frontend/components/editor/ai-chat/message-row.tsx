import React from "react";
import { ChatMessage } from "@/lib/types";
import {
  Bot, ThumbsUp, ThumbsDown,
  AlertCircle, RotateCcw, ChevronDown,
  CheckCircle2, FileEdit,
} from "lucide-react";
import { ChatMarkdown } from "./chat-markdown";
import { ActionTimeline } from "./action-timeline";
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
      <div className="w-full">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <AlertCircle className="h-3 w-3 text-white" />
          </div>
          <span className="text-[11px] font-semibold text-red-400">Error</span>
          {msg.timestamp && (
            <span className="text-[10px] font-mono text-slate-500 ml-auto">{formatRelativeTime(msg.timestamp)}</span>
          )}
        </div>
        <div className="ml-7 border-l-2 border-red-400/50 pl-3">
          <p className="text-[13px] text-red-400 leading-relaxed">{msg.content}</p>
          {msg.requestId && (
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="flex items-center gap-1 mt-1 text-[10px] font-mono text-slate-500 hover:text-slate-400 transition-colors"
            >
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showErrorDetails ? "rotate-180" : ""}`} />
              詳細
            </button>
          )}
          {showErrorDetails && msg.requestId && (
            <p className="text-[10px] font-mono text-slate-500 mt-1">Request ID: {msg.requestId.slice(0, 8)}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {onRetryError && (
              <button
                onClick={() => onRetryError(msg.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
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
    <div className="w-full">
      {/* Role label + timestamp */}
      <div className="flex items-center gap-2 mb-1.5">
        {isUser ? (
          <>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">You</span>
            {msg.timestamp && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 ml-auto">
                {formatRelativeTime(msg.timestamp)}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-400">Eddivom AI</span>
            {msg.isStreaming && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-400/70">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                生成中...
              </span>
            )}
            {msg.duration != null && !msg.isStreaming && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                {formatDuration(msg.duration)}
              </span>
            )}
            {msg.timestamp && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 ml-auto">
                {formatRelativeTime(msg.timestamp)}
              </span>
            )}
          </>
        )}
      </div>

      {/* Message content */}
      <div className={`${isUser
        ? "ml-0 border-l-2 border-indigo-400/60 pl-3 py-0.5"
        : "ml-7"
      }`}>
        {isUser ? (
          <span className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
            {msg.content}
          </span>
        ) : msg.isStreaming && !msg.content ? (
          /* ストリーミング中でまだテキストが無い場合は非表示（ThinkingIndicatorが別で表示される） */
          null
        ) : (
          <div className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-100">
            <ChatMarkdown content={msg.content} />
            {msg.isStreaming && (
              <span className="inline-block w-[6px] h-[14px] bg-indigo-400/80 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        )}

        {/* Patch applied banner */}
        {!isUser && msg.patches && msg.patches.ops && msg.patches.ops.length > 0 && (
          <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
              {(() => {
                const ops = msg.patches!.ops;
                const added = ops.filter(o => o.op === "add_block").length;
                const updated = ops.filter(o => o.op === "update_block").length;
                const deleted = ops.filter(o => o.op === "delete_block").length;
                const parts: string[] = [];
                if (added) parts.push(`${added}ブロック追加`);
                if (updated) parts.push(`${updated}ブロック更新`);
                if (deleted) parts.push(`${deleted}ブロック削除`);
                return `文書に適用済み: ${parts.join(", ") || `${ops.length}件の操作`}`;
              })()}
            </span>
            <FileEdit className="h-3 w-3 text-emerald-400 ml-auto" />
          </div>
        )}

        {/* Action timeline (thinking steps) */}
        {!isUser && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
          <ActionTimeline steps={msg.thinkingSteps} />
        )}

        {/* Footer: feedback + token usage */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-1.5">
            {/* Feedback buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onFeedback(msg.id, "good")}
                className={`p-1 rounded transition-colors ${
                  msg.feedback === "good"
                    ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "text-slate-300 dark:text-slate-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => onFeedback(msg.id, "bad")}
                className={`p-1 rounded transition-colors ${
                  msg.feedback === "bad"
                    ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                    : "text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                }`}
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>

            {/* Token usage */}
            {msg.usage && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 ml-auto">
                {formatTokens(msg.usage.inputTokens)} in / {formatTokens(msg.usage.outputTokens)} out
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
