"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Bot, Trash2, Zap, ZapOff, BookOpen, KeyRound,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { usePlanStore } from "@/store/plan-store";
import { PLANS } from "@/lib/plans";
import { sendAIMessage, streamAIMessage, analyzeImageOMR, StreamEvent } from "@/lib/api";
import { ChatMessage, DocumentPatch, ThinkingStep } from "@/lib/types";
import { chatLog } from "@/lib/logger";

import { MessageRow } from "./message-row";
import { PatchPreviewDrawer } from "./patch-preview";
import { ThinkingIndicator } from "./thinking-indicator";
import { UsageBar } from "./usage-bar";
import { MaterialsPanel } from "./materials-panel";
import { InputArea } from "./input-area";
import { buildLastAIAction } from "./utils";

export function AIChatPanel() {
  const { t } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const applyPatch = useDocumentStore((s) => s.applyPatch);
  const {
    chatMessages,
    pendingPatch,
    isChatLoading,
    addChatMessage,
    updateChatMessage,
    setPendingPatch,
    setChatLoading,
    clearChat,
    setLastAIAction,
  } = useUIStore();

  const { canMakeRequest, incrementUsage, setShowPricing, initFromStorage, todayUsage, dailyLimit, monthUsage, monthlyLimit, currentPlan, usagePercent } = usePlanStore();

  const [input, setInput] = useState("");
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const [showMaterials, setShowMaterials] = useState(false);
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
        // Migrate from v1
        const v1 = localStorage.getItem("latex-gui-chat-v1");
        if (v1) {
          const parsed = JSON.parse(v1);
          if (Array.isArray(parsed) && parsed.length > 0 && chatMessages.length === 0) {
            parsed.forEach((m: ChatMessage) => addChatMessage({
              id: m.id, role: m.role, content: m.content,
              appliedAt: m.appliedAt, thinkingSteps: m.thinkingSteps,
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
        id, role, content, appliedAt, thinkingSteps, timestamp, duration, usage, requestId, error,
      }) => ({
        id, role, content, appliedAt, thinkingSteps, timestamp, duration, usage, requestId, error,
      }));
      localStorage.setItem("latex-gui-chat-v2", JSON.stringify(toSave));
    } catch { /* ignore */ }
  }, [chatMessages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isChatLoading || !document) return;

    const limitCheck = canMakeRequest();
    if (!limitCheck.allowed) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${limitCheck.reason}\n\nプランをアップグレードするとリクエスト上限を増やせます。`,
        patches: null,
        timestamp: Date.now(),
      });
      setShowPricing(true);
      return;
    }

    const requestId = crypto.randomUUID();
    const userMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text, timestamp: Date.now() };
    addChatMessage(userMsg);
    setInput("");
    setChatLoading(true);

    chatLog.send(requestId, text);
    const startTime = Date.now();

    const feedbackCtx = buildFeedbackContext();
    const history = [...chatMessages, userMsg].map((m) => ({
      role: m.role,
      content: m.role === "user" && m.id === userMsgId ? m.content + feedbackCtx : m.content,
    }));

    const assistantMsgId = crypto.randomUUID();

    // Try streaming first, fallback to synchronous
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

      let finalPatches: DocumentPatch | null = null;
      let finalThinking: ThinkingStep[] = [];
      let finalUsage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };
      let finalMessage: string = "";
      let streamSucceeded = false;

      try {
        await streamAIMessage(history, document, (event: StreamEvent) => {
          chatLog.stream(requestId, event.type);

          switch (event.type) {
            case "text":
              // Append streaming text
              useUIStore.getState().updateStreamingContent(assistantMsgId, event.delta);
              break;
            case "thinking":
              // Could update thinking steps in real-time in future
              break;
            case "tool_call":
              break;
            case "done":
              finalMessage = event.message;
              finalPatches = event.patches;
              finalThinking = (event.thinking || []) as ThinkingStep[];
              finalUsage = event.usage || { inputTokens: 0, outputTokens: 0 };
              streamSucceeded = true;
              break;
            case "error":
              throw new Error(event.message);
          }
        }, controller.signal);
      } catch (streamErr) {
        // If streaming failed at connection level (404, network error), fallback to sync
        if (!streamSucceeded) {
          const isConnectionError = streamErr instanceof Error &&
            (streamErr.message.includes("404") || streamErr.message.includes("fetch") ||
             streamErr.message.includes("Failed") || streamErr.message.includes("ストリーミング"));

          if (isConnectionError) {
            chatLog.stream(requestId, "fallback-to-sync");
            // Remove the streaming placeholder
            updateChatMessage(assistantMsgId, { content: "", isStreaming: false });

            // Fallback to synchronous API
            const result = await sendAIMessage(history, document);
            const duration = Date.now() - startTime;
            incrementUsage();

            updateChatMessage(assistantMsgId, {
              content: result.message,
              patches: result.patches,
              thinkingSteps: result.thinking as ThinkingStep[],
              isStreaming: false,
              duration,
              usage: result.usage,
            });

            chatLog.receive(requestId, duration, !!(result.patches && result.patches.ops.length > 0));

            if (result.patches && result.patches.ops.length > 0) {
              chatLog.apply(requestId, result.patches.ops.length);
              if (agentMode) {
                const idsBefore = new Set(useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? []);
                applyPatch(result.patches);
                const idsAfter = useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? [];
                const newIds = idsAfter.filter((id) => !idsBefore.has(id));
                setLastAIAction(buildLastAIAction(result.patches, newIds));
                updateChatMessage(assistantMsgId, { appliedAt: Date.now() });
              } else {
                setPendingPatch(result.patches);
                setPendingMsgId(assistantMsgId);
              }
            }
            return; // Done via fallback
          }
          throw streamErr; // Re-throw non-connection errors
        }
      } finally {
        abortControllerRef.current = null;
      }

      if (streamSucceeded) {
        const duration = Date.now() - startTime;
        incrementUsage();

        // Finalize the streaming message with complete data
        updateChatMessage(assistantMsgId, {
          content: finalMessage,
          patches: finalPatches,
          thinkingSteps: finalThinking,
          isStreaming: false,
          duration,
          usage: finalUsage,
        });

        const fp = finalPatches as DocumentPatch | null;
        chatLog.receive(requestId, duration, !!(fp && fp.ops.length > 0));

        if (fp && fp.ops.length > 0) {
          chatLog.apply(requestId, fp.ops.length);
          if (agentMode) {
            const idsBefore = new Set(useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? []);
            applyPatch(fp);
            const idsAfter = useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? [];
            const newIds = idsAfter.filter((id) => !idsBefore.has(id));
            setLastAIAction(buildLastAIAction(fp, newIds));
            updateChatMessage(assistantMsgId, { appliedAt: Date.now() });
          } else {
            setPendingPatch(fp);
            setPendingMsgId(assistantMsgId);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "エラーが発生しました。もう一度お試しください。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) setApiKeyMissing(true);
      chatLog.error(requestId, msg);

      // Check if we already created the assistant message (streaming case)
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
          patches: null,
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
    // Find the preceding user message
    for (let i = errorIdx - 1; i >= 0; i--) {
      if (chatMessages[i].role === "user") {
        setInput(chatMessages[i].content);
        textareaRef.current?.focus();
        break;
      }
    }
  }, [chatMessages]);

  const handleApplyPatches = (patch: DocumentPatch, msgId: string) => {
    setPendingPatch(patch);
    setPendingMsgId(msgId);
  };

  const handleRetryPatches = (patch: DocumentPatch, msgId: string) => {
    updateChatMessage(msgId, { appliedAt: undefined });
    setPendingPatch(patch);
    setPendingMsgId(msgId);
  };

  const handleConfirmApply = () => {
    if (!pendingPatch) return;
    const idsBefore = new Set(useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? []);
    applyPatch(pendingPatch);
    const idsAfter = useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? [];
    const newIds = idsAfter.filter((id) => !idsBefore.has(id));
    setLastAIAction(buildLastAIAction(pendingPatch, newIds));
    if (pendingMsgId) updateChatMessage(pendingMsgId, { appliedAt: Date.now() });
    setPendingPatch(null);
    setPendingMsgId(null);
  };

  const handleDismissPatch = () => {
    setPendingPatch(null);
    setPendingMsgId(null);
  };

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

    const limitCheck = canMakeRequest();
    if (!limitCheck.allowed) {
      addChatMessage({
        id: crypto.randomUUID(), role: "assistant",
        content: `${limitCheck.reason}\n\nプランをアップグレードするとリクエスト上限を増やせます。`,
        patches: null, timestamp: Date.now(),
      });
      setShowPricing(true);
      return;
    }

    const requestId = crypto.randomUUID();
    addChatMessage({ id: crypto.randomUUID(), role: "user", content: `📎 ${file.name}`, timestamp: Date.now() });
    setChatLoading(true);
    const startTime = Date.now();

    try {
      const result = await analyzeImageOMR(file, document);
      incrementUsage();
      const duration = Date.now() - startTime;
      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: result.description || "画像を解析しました。",
        patches: result.patches,
        requestId, timestamp: Date.now(), duration,
      };
      addChatMessage(assistantMsg);

      if (result.patches && result.patches.ops.length > 0) {
        if (agentMode) {
          const idsBefore = new Set(useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? []);
          applyPatch(result.patches);
          const idsAfter = useDocumentStore.getState().document?.blocks.map((b) => b.id) ?? [];
          const newIds = idsAfter.filter((id) => !idsBefore.has(id));
          setLastAIAction(buildLastAIAction(result.patches, newIds));
          updateChatMessage(assistantMsgId, { appliedAt: Date.now() });
        } else {
          setPendingPatch(result.patches);
          setPendingMsgId(assistantMsgId);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "画像解析中にエラーが発生しました。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) setApiKeyMissing(true);
      chatLog.error(requestId, msg);
      addChatMessage({
        id: crypto.randomUUID(), role: "assistant", content: msg,
        patches: null, error: msg, requestId, timestamp: Date.now(),
        duration: Date.now() - startTime,
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleMaterialsAttach = (context: string) => {
    setInput((prev) => (prev ? prev + "\n\n" + context : context));
    setShowMaterials(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f3f5] dark:bg-[#16181c]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0f1117] dark:bg-[#0a0c10] shrink-0 shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-900/40 shrink-0 ring-1 ring-white/10">
          <Bot className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-tight leading-none bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
            {t("chat.title")}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[10px] text-slate-400">{t("chat.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              agentMode
                ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
            title={agentMode ? t("chat.auto") : t("chat.confirm")}
          >
            {agentMode ? <Zap className="h-2.5 w-2.5" /> : <ZapOff className="h-2.5 w-2.5" />}
            {agentMode ? t("chat.auto") : t("chat.confirm")}
          </button>
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              showMaterials ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
            title={t("chat.materials")}
          >
            <BookOpen className="h-3.5 w-3.5" />
          </button>
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

      {/* Materials panel */}
      {showMaterials && (
        <div className="px-3 pt-2 shrink-0">
          <MaterialsPanel onAttach={handleMaterialsAttach} />
        </div>
      )}

      {/* Message list — left-aligned Claude Code style */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0 bg-[#f2f3f5] dark:bg-[#16181c]">
        {chatMessages.length === 0 && !showMaterials && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-8 select-none">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-600/15 dark:from-indigo-500/20 dark:to-violet-600/20 flex items-center justify-center ring-1 ring-indigo-400/20 shadow-lg shadow-indigo-900/10">
              <Bot className="h-7 w-7 text-indigo-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground/60">{t("chat.empty.title")}</p>
              <p className="text-xs text-muted-foreground/40">{t("chat.empty.sub")}</p>
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
                  className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-[#1e2027] text-foreground/60 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-300/50 dark:hover:border-indigo-700/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all shadow-sm"
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
            onApplyPatches={handleApplyPatches}
            onRetryPatches={handleRetryPatches}
            onFeedback={handleFeedback}
            onRetryError={handleRetryError}
          />
        ))}

        {isChatLoading && <ThinkingIndicator userMessage={chatMessages.filter(m => m.role === "user").at(-1)?.content || ""} />}

        <div ref={bottomRef} />
      </div>

      {/* Pending patch drawer */}
      {pendingPatch && (
        <div className="px-3 pb-2 shrink-0">
          <PatchPreviewDrawer
            patch={pendingPatch}
            onApply={handleConfirmApply}
            onDismiss={handleDismissPatch}
          />
        </div>
      )}

      {/* Input area */}
      <InputArea
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isChatLoading={isChatLoading}
        agentMode={agentMode}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        onOMRUpload={handleOMRUpload}
        showMaterials={showMaterials}
        setShowMaterials={setShowMaterials}
      />
    </div>
  );
}
