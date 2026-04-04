"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Sparkles, Trash2, KeyRound,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { usePlanStore } from "@/store/plan-store";
import { PLANS } from "@/lib/plans";
import { sendAIMessage, streamAIMessage, StreamEvent, StreamDiagnostics } from "@/lib/api";
import { ChatMessage, ThinkingStep, DocumentPatch } from "@/lib/types";
import { chatLog } from "@/lib/logger";
import { compressHistory } from "@/lib/chat-compression";
import { buildDocumentContext } from "@/lib/document-context";
import { buildLastAIAction } from "./utils";

import { MessageRow } from "./message-row";
import { ThinkingIndicator } from "./thinking-indicator";
import { UsageBar } from "./usage-bar";
import { InputArea } from "./input-area";

export function AIChatPanel() {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const applyPatch = useDocumentStore((s) => s.applyPatch);
  const {
    chatMessages,
    isChatLoading,
    addChatMessage,
    updateChatMessage,
    setChatLoading,
    clearChat,
    setLastAIAction,
  } = useUIStore();

  const { canMakeRequest, incrementUsage, setShowPricing, initFromStorage, todayUsage, dailyLimit, monthUsage, monthlyLimit, currentPlan, usagePercent } = usePlanStore();

  const [input, setInput] = useState("");
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  // Live agent state — displayed during streaming
  const [liveSteps, setLiveSteps] = useState<ThinkingStep[]>([]);
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => { initFromStorage(); }, [initFromStorage]);

  // Restore chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("latex-gui-chat-v2");
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && chatMessages.length === 0) {
          parsed.forEach((m) => addChatMessage(m));
        }
      } else {
        const v1 = localStorage.getItem("latex-gui-chat-v1");
        if (v1) {
          const parsed = JSON.parse(v1);
          if (Array.isArray(parsed) && parsed.length > 0 && chatMessages.length === 0) {
            parsed.forEach((m: ChatMessage) => addChatMessage({
              id: m.id, role: m.role, content: m.content,
              thinkingSteps: m.thinkingSteps,
              timestamp: m.appliedAt || Date.now(),
            }));
          }
          localStorage.removeItem("latex-gui-chat-v1");
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist chat history to localStorage
  useEffect(() => {
    if (chatMessages.length === 0) return;
    try {
      const toSave = chatMessages.slice(-50).map(({
        id, role, content, thinkingSteps, timestamp, duration, usage, requestId, error,
      }) => ({
        id, role, content, thinkingSteps, timestamp, duration, usage, requestId, error,
      }));
      localStorage.setItem("latex-gui-chat-v2", JSON.stringify(toSave));
    } catch { /* ignore */ }
  }, [chatMessages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading, liveSteps]);

  const handleFeedback = (msgId: string, feedback: "good" | "bad") => {
    const existing = chatMessages.find((m) => m.id === msgId);
    const newFeedback = existing?.feedback === feedback ? null : feedback;
    updateChatMessage(msgId, { feedback: newFeedback });
  };

  const buildFeedbackContext = (): string => {
    const recent = chatMessages.slice(-10);
    const feedbacks = recent
      .filter((m) => m.role === "assistant" && m.feedback)
      .map((m) => {
        const label = m.feedback === "good" ? "GOOD" : "NEEDS_IMPROVEMENT";
        const summary = m.content.slice(0, 80);
        return `[${label}] "${summary}..."`;
      });
    if (feedbacks.length === 0) return "";
    return `\n\n[ユーザーフィードバック]\n${feedbacks.join("\n")}\n上記を参考に応答を改善してください。`;
  };

  /**
   * Auto-apply patches from agent — applies to document with undo support
   */
  const autoApplyPatches = useCallback((patch: DocumentPatch) => {
    if (!patch || !patch.ops || patch.ops.length === 0) return;
    try {
      applyPatch(patch);
      // Extract new block IDs from add_block ops
      const newIds = patch.ops
        .filter((op): op is Extract<typeof op, { op: "add_block" }> => op.op === "add_block")
        .map((op) => op.block.id);
      const action = buildLastAIAction(patch, newIds);
      setLastAIAction(action);
    } catch (e) {
      console.error("[agent:auto-apply] Failed:", e);
    }
  }, [applyPatch, setLastAIAction]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isChatLoading || !document) return;

    const limitCheck = canMakeRequest();
    if (limitCheck.reason) {
      console.warn("[chat:limit]", limitCheck.reason);
    }

    const requestId = crypto.randomUUID();
    const userMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text, timestamp: Date.now() };
    addChatMessage(userMsg);
    setInput("");
    setChatLoading(true);
    setLiveSteps([]);
    setCurrentTool(null);

    chatLog.send(requestId, text);
    const startTime = Date.now();

    const feedbackCtx = buildFeedbackContext();
    // 文書構��サマリーをフロントエンド側で生成（AIのread_documentツール呼び出しを省略）
    const docContext = document ? buildDocumentContext(document) : "";
    // フィード��ック + 文書構造をユーザーメッセージに付加
    const enhancedContent = docContext
      ? `${docContext}\n\n${userMsg.content}${feedbackCtx}`
      : `${userMsg.content}${feedbackCtx}`;
    const enhancedUserMsg: ChatMessage = {
      ...userMsg,
      content: enhancedContent,
    };
    // チャット履歴を圧縮して送信（直近3ペアのみフル、古い応答は切り詰め）
    const history = compressHistory(chatMessages, enhancedUserMsg);

    const assistantMsgId = crypto.randomUUID();

    try {
      // Create placeholder streaming message
      addChatMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        requestId,
        timestamp: Date.now(),
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let finalThinking: ThinkingStep[] = [];
      let finalUsage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };
      let finalMessage: string = "";
      let finalPatches: DocumentPatch | null = null;
      let streamSucceeded = false;
      let streamDiag: StreamDiagnostics | null = null;
      const accumulatedSteps: ThinkingStep[] = [];
      const accumulatedOps: Record<string, unknown>[] = [];
      let lastStreamError: string | null = null;

      try {
        streamDiag = await streamAIMessage(history, document, (event: StreamEvent) => {
          chatLog.stream(requestId, event.type);

          switch (event.type) {
            case "text":
              useUIStore.getState().updateStreamingContent(assistantMsgId, event.delta);
              break;

            case "thinking": {
              const step: ThinkingStep = { type: "thinking", text: event.text };
              accumulatedSteps.push(step);
              setLiveSteps([...accumulatedSteps]);
              break;
            }

            case "tool_call": {
              setCurrentTool(event.name);
              const step: ThinkingStep = {
                type: "tool_call",
                text: `${event.name} を実行中...`,
                tool: event.name,
              };
              accumulatedSteps.push(step);
              setLiveSteps([...accumulatedSteps]);
              break;
            }

            case "tool_result": {
              setCurrentTool(null);
              // Update the last tool_call step with result info
              let lastToolIdx = -1;
              for (let j = accumulatedSteps.length - 1; j >= 0; j--) {
                if (accumulatedSteps[j].type === "tool_call" && accumulatedSteps[j].tool === event.name) {
                  lastToolIdx = j;
                  break;
                }
              }
              if (lastToolIdx >= 0) {
                const resultSummary = _summarizeToolResult(event.name, event.result);
                accumulatedSteps[lastToolIdx] = {
                  ...accumulatedSteps[lastToolIdx],
                  text: `${event.name}: ${resultSummary}`,
                  duration: event.duration,
                };
              }
              setLiveSteps([...accumulatedSteps]);
              // Also persist thinking steps into the message in real-time
              // so they survive even if streaming ends unexpectedly
              updateChatMessage(assistantMsgId, {
                thinkingSteps: [...accumulatedSteps],
              });
              break;
            }

            case "patch": {
              // Accumulate patch ops and auto-apply immediately
              if (event.ops) {
                accumulatedOps.push(...event.ops);
                autoApplyPatches({ ops: event.ops } as unknown as DocumentPatch);
              }
              break;
            }

            case "done":
              finalMessage = event.message;
              finalThinking = (event.thinking || []) as ThinkingStep[];
              finalUsage = event.usage || { inputTokens: 0, outputTokens: 0 };
              finalPatches = event.patches || null;
              streamSucceeded = true;
              break;

            case "error":
              // Don't throw immediately — backend will send "done" after error.
              // Record the error and keep listening for the "done" event.
              lastStreamError = event.message;
              break;
          }
        }, controller.signal);
      } catch (streamErr) {
        if (!streamSucceeded) {
          // Check if we already got partial content
          const currentContent = useUIStore.getState().chatMessages.find(m => m.id === assistantMsgId)?.content || "";
          const hasPartialContent = currentContent.length > 0 || accumulatedOps.length > 0;

          // If we have partial content, don't fallback — use what we have
          if (hasPartialContent) {
            chatLog.stream(requestId, "partial-content-recovered");
            // streamSucceeded stays false, will be handled below
          } else {
            const isConnectionError = streamErr instanceof Error &&
              (streamErr.message.includes("404") || streamErr.message.includes("fetch") ||
               streamErr.message.includes("Failed") || streamErr.message.includes("ストリーミング") ||
               streamErr.message.includes("AbortError") || streamErr.message.includes("network"));

            if (isConnectionError) {
              chatLog.stream(requestId, "fallback-to-sync");
              updateChatMessage(assistantMsgId, { content: "", isStreaming: false });
              setLiveSteps([]);
              setCurrentTool(null);

              try {
                const result = await sendAIMessage(history, document);
                const duration = Date.now() - startTime;
                incrementUsage();

                if (result.patches) {
                  autoApplyPatches(result.patches);
                }

                updateChatMessage(assistantMsgId, {
                  content: result.message,
                  patches: result.patches,
                  thinkingSteps: result.thinking as ThinkingStep[],
                  isStreaming: false,
                  duration,
                  usage: result.usage,
                });

                chatLog.receive(requestId, duration, false);
                return;
              } catch (syncErr) {
                // Sync fallback also failed
                throw syncErr;
              }
            }
            throw streamErr;
          }
        }
      } finally {
        abortControllerRef.current = null;
      }

      // Finalize the message — whether "done" was received or the stream ended early
      const duration = Date.now() - startTime;
      const currentMsg = useUIStore.getState().chatMessages.find(m => m.id === assistantMsgId);
      const streamedContent = currentMsg?.content || "";

      if (streamSucceeded) {
        incrementUsage();

        // Use finalPatches from done event, or build from accumulated ops
        const patches = finalPatches ||
          (accumulatedOps.length > 0 ? { ops: accumulatedOps } as unknown as DocumentPatch : null);

        // Auto-apply any patches from "done" that weren't already applied via "patch" events
        if (finalPatches) {
          const doneOps = (finalPatches as DocumentPatch).ops || [];
          const newOps = doneOps.filter(
            (op) => !accumulatedOps.some(
              (aOp) => JSON.stringify(aOp) === JSON.stringify(op)
            )
          );
          if (newOps.length > 0) {
            autoApplyPatches({ ops: newOps } as DocumentPatch);
          }
        }

        // Merge: prefer accumulated live steps (richer), supplement with server steps
        const mergedSteps: ThinkingStep[] = accumulatedSteps.length > 0
          ? [...accumulatedSteps]
          : finalThinking.length > 0
          ? [...finalThinking]
          : [];
        // Add any server-side steps not already captured in live steps
        if (finalThinking.length > 0 && accumulatedSteps.length > 0) {
          for (const st of finalThinking) {
            const alreadyHas = accumulatedSteps.some(
              (a) => a.tool === st.tool && a.text === st.text
            );
            if (!alreadyHas) mergedSteps.push(st);
          }
        }
        const thinkingSteps = mergedSteps.length > 0 ? mergedSteps : undefined;

        updateChatMessage(assistantMsgId, {
          content: finalMessage,
          patches,
          thinkingSteps,
          isStreaming: false,
          duration,
          usage: finalUsage,
        });

        setLiveSteps([]);
        setCurrentTool(null);
        chatLog.receive(requestId, duration, false);
      } else {
        // Stream ended without "done" event — build diagnostic error message
        incrementUsage();
        const hasContent = streamedContent.length > 0 || accumulatedOps.length > 0;
        const patches = accumulatedOps.length > 0
          ? { ops: accumulatedOps } as unknown as DocumentPatch
          : null;

        // Build a descriptive error message based on diagnostics
        let errorDetail: string;
        if (hasContent) {
          errorDetail = streamedContent || `${accumulatedOps.length}件の変更を適用しました。`;
        } else if (streamDiag) {
          if (streamDiag.eventsReceived === 0) {
            errorDetail = "バックエンドからの応答がありませんでした。サーバーが起動中か、接続に問題がある可能性があります。";
          } else if (lastStreamError || streamDiag.errorMessage) {
            errorDetail = lastStreamError || streamDiag.errorMessage!;
          } else if (streamDiag.lastEventType === "thinking") {
            errorDetail = "AIの思考中に接続が切断されました。サーバー側でエラーが発生した可能性があります（APIの使用量超過・レート制限等）。";
          } else if (streamDiag.lastEventType === "tool_call" || streamDiag.lastEventType === "tool_result") {
            errorDetail = "ツール実行中に接続が切断されました。処理がタイムアウトした可能性があります。";
          } else {
            errorDetail = `ス��リーミングが途中で終了しました（受信イベント: ${streamDiag.eventsReceived}件, 最後: ${streamDiag.lastEventType || "なし"}）。`;
          }
        } else {
          errorDetail = "ストリーミングが中断されました。ネットワーク接続を確認してください。";
        }

        const thinkingSteps = accumulatedSteps.length > 0 ? [...accumulatedSteps] : undefined;

        updateChatMessage(assistantMsgId, {
          content: errorDetail,
          patches,
          thinkingSteps,
          isStreaming: false,
          duration,
          error: hasContent ? undefined : errorDetail,
        });

        setLiveSteps([]);
        setCurrentTool(null);
        chatLog.receive(requestId, duration, !hasContent);
      }
    } catch (e) {
      let msg = e instanceof Error ? e.message : "エラーが発生しました。もう一度お試しください。";
      // Enhance generic error messages with context
      if (msg.includes("Failed to fetch") || msg.includes("fetch")) {
        msg = "サーバーへの接続に失敗しました。バックエンドが起動しているか確認してください。";
      } else if (msg.includes("AbortError") || msg.includes("abort")) {
        msg = "リクエストがキャンセルされました。";
      } else if (msg.includes("タイムアウト")) {
        msg = "AIサービスの応答がタイムアウトしました。しばらく待ってから再試行してください。";
      }
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) setApiKeyMissing(true);
      chatLog.error(requestId, msg);
      setLiveSteps([]);
      setCurrentTool(null);

      const existingMsg = useUIStore.getState().chatMessages.find(m => m.id === assistantMsgId);
      if (existingMsg) {
        updateChatMessage(assistantMsgId, {
          content: msg,
          error: msg,
          isStreaming: false,
          duration: Date.now() - startTime,
        });
      } else {
        addChatMessage({
          id: assistantMsgId,
          role: "assistant",
          content: msg,
          error: msg,
          requestId,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        });
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleRetryError = useCallback((errorMsgId: string) => {
    const errorIdx = chatMessages.findIndex(m => m.id === errorMsgId);
    if (errorIdx < 1) return;
    for (let i = errorIdx - 1; i >= 0; i--) {
      if (chatMessages[i].role === "user") {
        setInput(chatMessages[i].content);
        textareaRef.current?.focus();
        break;
      }
    }
  }, [chatMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleOMRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !document) return;
    e.target.value = "";

    addChatMessage({ id: crypto.randomUUID(), role: "user", content: `📎 ${file.name}`, timestamp: Date.now() });
    setChatLoading(true);
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const { analyzeImageOMR } = await import("@/lib/api");
      const result = await analyzeImageOMR(file, document);
      incrementUsage();
      if (result.patches) {
        autoApplyPatches(result.patches);
      }
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.description || "ファイルを解析しました。",
        requestId, timestamp: Date.now(), duration: Date.now() - startTime,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ファイル解析中にエラーが発生しました。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) setApiKeyMissing(true);
      chatLog.error(requestId, msg);
      addChatMessage({
        id: crypto.randomUUID(), role: "assistant", content: msg,
        error: msg, requestId, timestamp: Date.now(), duration: Date.now() - startTime,
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-2 dark:bg-surface-2">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-surface-1/95 dark:bg-surface-0/95 backdrop-blur-xl shrink-0 shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0 ring-1 ring-white/10">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold tracking-wide leading-none text-indigo-300">
            EddivomAI
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[10px] text-slate-400/70">Agent Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {chatMessages.length > 0 && (
            <button
              onClick={() => { clearChat(); setApiKeyMissing(false); try { localStorage.removeItem("latex-gui-chat-v2"); } catch { /**/ } }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              title={t("chat.clear")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Usage bar */}
      <UsageBar
        todayUsage={todayUsage()}
        dailyLimit={dailyLimit()}
        monthUsage={monthUsage()}
        monthlyLimit={monthlyLimit()}
        planName={PLANS[currentPlan].name}
        dailyPercent={usagePercent().daily}
        onUpgrade={() => setShowPricing(true)}
      />

      {/* API Key banner */}
      {apiKeyMissing && (
        <div className="mx-3 mt-2 shrink-0 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            API キーが未設定です
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ANTHROPIC_API_KEY</code> をバックエンド (Koyeb) 環境変数に設定してください。
          </p>
          <button onClick={() => setApiKeyMissing(false)} className="text-xs text-amber-600 dark:text-amber-400 hover:underline">
            閉じる
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0 bg-surface-2 dark:bg-surface-2">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-8 select-none">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-600/15 dark:from-indigo-500/20 dark:to-violet-600/20 flex items-center justify-center ring-1 ring-indigo-400/20 shadow-lg shadow-indigo-900/10">
              <Sparkles className="h-7 w-7 text-indigo-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground/60">{t("chat.empty.title")}</p>
              <p className="text-xs text-muted-foreground/40">Agent Mode — 自動で文書を読み、編集し、検証します</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {[
                t("chat.suggestion.1"),
                t("chat.suggestion.2"),
                t("chat.suggestion.3"),
                t("chat.suggestion.4"),
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-surface-4 text-foreground/60 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-300/50 dark:hover:border-indigo-700/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all shadow-sm hover:shadow-md animate-scale-in"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <MessageRow
            key={msg.id}
            msg={msg}
            onFeedback={handleFeedback}
            onRetryError={handleRetryError}
          />
        ))}

        {isChatLoading && (
          <ThinkingIndicator
            userMessage={chatMessages.filter(m => m.role === "user").at(-1)?.content || ""}
            liveSteps={liveSteps}
            currentTool={currentTool}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <InputArea
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isChatLoading={isChatLoading}
        agentMode={true}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        onOMRUpload={handleOMRUpload}
      />
    </div>
  );
}

/** Summarize a tool result for the live thinking display */
function _summarizeToolResult(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case "read_document":
      return `${result.blockCount || 0}ブロックの文書を読み込み`;
    case "search_blocks":
      return `${result.count || 0}件の一致`;
    case "edit_document": {
      const summary = (result.summary as string) || "適用完了";
      const bc = result.current_block_count;
      return bc ? `${summary} (計${bc}ブロック)` : summary;
    }
    case "compile_check":
      return result.success ? "OK" : (result.message as string) || "エラーあり";
    case "get_latex_source":
      return `${result.total_length || 0}文字のLaTeX`;
    default:
      return JSON.stringify(result).slice(0, 60);
  }
}
