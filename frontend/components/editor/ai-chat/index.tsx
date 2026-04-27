"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Sparkles, Trash2, KeyRound, PenLine, Calculator, TableProperties, Bug } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { usePlanStore } from "@/store/plan-store";
import { PLANS } from "@/lib/plans";
import { sendAIMessage, streamAIMessage, StreamEvent, StreamDiagnostics } from "@/lib/api";
import { ChatMessage, ThinkingStep } from "@/lib/types";
import { chatLog } from "@/lib/logger";
import { compressHistory } from "@/lib/chat-compression";
import { buildDocumentContext } from "@/lib/document-context";
import { buildLastAIAction } from "./utils";
import { toast } from "sonner";
import { hasUsedAnonymousTrial, markAnonymousTrialUsed } from "@/lib/anonymous-trial";
import {
  trackFreeGenerateStart,
  trackFreeGenerateComplete,
  trackFreeGenerateError,
  trackFreeGenerateLimitReached,
  trackGuestSignupClick,
} from "@/lib/gtag";

import { MessageRow } from "./message-row";
import { ThinkingIndicator } from "./thinking-indicator";
import { UsageBar } from "./usage-bar";
import { InputArea } from "./input-area";
import { ModeSwitcher } from "./mode-switcher";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ChevronDown, Eye } from "lucide-react";

export function AIChatPanel({ onOpenPreview }: { onOpenPreview?: () => void } = {}) {
  const { t, locale } = useI18n();
  const document = useDocumentStore((s) => s.document);
  const applyAiLatex = useDocumentStore((s) => s.applyAiLatex);
  const {
    chatMessages,
    isChatLoading,
    addChatMessage,
    updateChatMessage,
    setChatLoading,
    clearChat,
    setLastAIAction,
    agentMode,
    setAgentMode,
  } = useUIStore();

  const {
    canMakeRequest, incrementUsage, setShowPricing,
    todayUsage, dailyLimit, monthUsage, monthlyLimit, currentPlan, usagePercent,
  } = usePlanStore();

  const isGuest = useUIStore((s) => s.isGuest);
  const guestTrialUsed = useUIStore((s) => s.guestTrialUsed);
  const setGuestTrialUsed = useUIStore((s) => s.setGuestTrialUsed);

  const [input, setInput] = useState("");
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [liveSteps, setLiveSteps] = useState<ThinkingStep[]>([]);
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isMobile = useIsMobile();
  // 「下までスクロールして戻る」FAB を出すフラグ (ChatGPT モバイル風)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // 停止ボタン: ストリーミング中に押すと AbortController を切り、表示を更新する。
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // スクロール状態を監視: 下から離れたら FAB を表示
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJumpToBottom(distance > 220);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [chatMessages.length]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // OMR (画像/PDF → LaTeX) は独立した全画面 SplitView に張り替えた。
  // ここ (チャットパネル) ではファイル入力を持たず、サイドバーの「読み取り」ボタンは
  // 親ページ (app/editor/page.tsx) の hidden input に委譲される。
  // 「決してチャットに OMR 結果を流さない」という要件を満たすため、旧 setOMRTrigger
  // バインドと handleOMRUpload は撤去した。
  const triggerOMR = useUIStore((s) => s.triggerOMR);

  // プランとクオータの取得は <SubscriptionInitializer> (layout.tsx) に一元化。
  // ここで initFromStorage() を呼ぶと、先に解決した fetchSubscription() の
  // "pro" 状態を "free" で上書きしてしまう race があった (Stripe 成功直後に顕著)。

  // Restore chat history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("latex-gui-chat-v3");
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && chatMessages.length === 0) {
          parsed.forEach((m) => addChatMessage(m));
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist chat history
  useEffect(() => {
    if (chatMessages.length === 0) return;
    try {
      const toSave = chatMessages.slice(-50).map(({
        id, role, content, thinkingSteps, timestamp, duration, usage, requestId, error,
      }) => ({
        id, role, content, thinkingSteps, timestamp, duration, usage, requestId, error,
      }));
      localStorage.setItem("latex-gui-chat-v3", JSON.stringify(toSave));
    } catch { /* ignore */ }
  }, [chatMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading, liveSteps]);

  const pendingChatMessage = useUIStore((s) => s.pendingChatMessage);
  useEffect(() => {
    if (pendingChatMessage && !isChatLoading) {
      useUIStore.getState().setPendingChatMessage(null);
      handleSend(pendingChatMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatMessage, isChatLoading]);

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
    return `\n\n[user feedback]\n${feedbacks.join("\n")}\nUse the above to improve future responses.`;
  };

  /**
   * Apply latex from agent — replaces document.latex with AI's edit.
   */
  const applyLatex = useCallback((latex: string) => {
    try {
      applyAiLatex(latex);
      setLastAIAction(buildLastAIAction(latex, t));
    } catch (e) {
      console.error("[agent:apply-latex] Failed:", e);
    }
  }, [applyAiLatex, setLastAIAction, t]);

  /**
   * ゲスト単発 AI コール (ログインなしお試し)。
   * 通常のストリーミング flow の代わりに anonymous プロキシで非ストリーミング呼出を 1 回だけ行う。
   * 成功時は localStorage と ui-store の両方に「使用済み」を記録 → 次回以降は登録 CTA に切り替わる。
   */
  const runGuestSingleShot = async (text: string) => {
    if (!document) return;
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
    trackFreeGenerateStart();

    const assistantMsgId = crypto.randomUUID();
    addChatMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
      requestId,
      timestamp: Date.now(),
    });

    try {
      const docContext = buildDocumentContext(document, locale);
      const enhanced: ChatMessage = {
        ...userMsg,
        content: docContext ? `${docContext}\n\n${userMsg.content}` : userMsg.content,
      };
      const history = compressHistory(chatMessages, enhanced);
      const result = await sendAIMessage(history, document, locale, agentMode, { anonymous: true });
      const duration = Date.now() - startTime;

      if (result.latex) {
        applyLatex(result.latex);
      }

      updateChatMessage(assistantMsgId, {
        content: result.message || (locale === "en" ? "Done." : "完了しました。"),
        latex: result.latex,
        thinkingSteps: result.thinking as ThinkingStep[],
        isStreaming: false,
        duration,
        usage: result.usage,
      });

      // お試し消費を確定 (localStorage + store)
      markAnonymousTrialUsed();
      setGuestTrialUsed(true);
      trackFreeGenerateComplete({ duration_ms: duration });

      // 続けたい人向けのフォロー toast (登録 CTA を即座に見せる)
      toast.success(
        locale === "en"
          ? "AI generation complete. Sign up free to keep editing, save, and download PDF."
          : "AI 生成が完了しました。続けて編集・保存・PDF ダウンロードするには無料登録 (30秒) を。",
        {
          duration: 9000,
          action: {
            label: locale === "en" ? "Sign up free" : "無料登録",
            onClick: () => {
              trackGuestSignupClick({ placement: "chat_toast" });
              import("next-auth/react").then(({ signIn }) =>
                signIn("google", { callbackUrl: "/editor" }),
              );
            },
          },
        },
      );
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const reason = err instanceof Error ? err.message : "unknown";
      trackFreeGenerateError({ reason, status });
      updateChatMessage(assistantMsgId, {
        content: locale === "en"
          ? `Generation failed: ${reason}`
          : `生成に失敗しました: ${reason}`,
        isStreaming: false,
        error: reason,
      });
      toast.error(
        locale === "en" ? "Trial generation failed. Please try again." : "お試し生成に失敗しました。もう一度お試しください。",
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const raw = typeof overrideText === "string" ? overrideText : input;
    const text = raw.trim();
    if (!text || isChatLoading || !document) return;

    // ── ゲスト (ログインなしお試し) 経路 ───────────────────────────
    // 1 回だけ AI を叩ける。すでに使い切っていれば登録 CTA を出す。
    if (isGuest) {
      if (guestTrialUsed || hasUsedAnonymousTrial()) {
        trackFreeGenerateLimitReached();
        toast.error(
          locale === "en"
            ? "Free trial complete. Sign up free to keep editing with AI."
            : "無料お試しは完了しました。続けて AI を使うには無料登録 (30秒) をお願いします。",
          {
            duration: 8000,
            action: {
              label: locale === "en" ? "Sign up free" : "無料登録",
              onClick: () => {
                import("next-auth/react").then(({ signIn }) =>
                  signIn("google", { callbackUrl: "/editor" }),
                );
              },
            },
          },
        );
        return;
      }
      await runGuestSingleShot(text);
      return;
    }

    const limitCheck = canMakeRequest();
    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason, {
        duration: 6000,
        action: {
          label: "アップグレード",
          onClick: () => setShowPricing(true),
        },
      });
      return;
    }
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

    const assistantMsgId = crypto.randomUUID();

    // buildDocumentContext / compressHistory で万一例外が起きても isChatLoading が
    // 永久 true で残らないよう、前処理も含めて 1 つの try/finally に包む。
    try {
      const feedbackCtx = buildFeedbackContext();
      const docContext = document ? buildDocumentContext(document, locale) : "";
      const enhancedContent = docContext
        ? `${docContext}\n\n${userMsg.content}${feedbackCtx}`
        : `${userMsg.content}${feedbackCtx}`;
      const enhancedUserMsg: ChatMessage = { ...userMsg, content: enhancedContent };
      const history = compressHistory(chatMessages, enhancedUserMsg);

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
      let finalLatex: string | null = null;
      let streamSucceeded = false;
      let streamDiag: StreamDiagnostics | null = null;
      const accumulatedSteps: ThinkingStep[] = [];
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
                text: `${event.name} ${t("chat.tool.executing")}...`,
                tool: event.name,
              };
              accumulatedSteps.push(step);
              setLiveSteps([...accumulatedSteps]);
              break;
            }

            case "tool_result": {
              setCurrentTool(null);
              let lastToolIdx = -1;
              for (let j = accumulatedSteps.length - 1; j >= 0; j--) {
                if (accumulatedSteps[j].type === "tool_call" && accumulatedSteps[j].tool === event.name) {
                  lastToolIdx = j;
                  break;
                }
              }
              if (lastToolIdx >= 0) {
                const resultSummary = _summarizeToolResult(event.name, event.result, t);
                accumulatedSteps[lastToolIdx] = {
                  ...accumulatedSteps[lastToolIdx],
                  text: `${event.name}: ${resultSummary}`,
                  duration: event.duration,
                };
              }
              setLiveSteps([...accumulatedSteps]);
              updateChatMessage(assistantMsgId, { thinkingSteps: [...accumulatedSteps] });
              break;
            }

            case "latex": {
              // Apply latex live
              if (typeof event.latex === "string") {
                finalLatex = event.latex;
                applyLatex(event.latex);
              }
              break;
            }

            case "done":
              finalMessage = event.message;
              finalThinking = (event.thinking || []) as ThinkingStep[];
              finalUsage = event.usage || { inputTokens: 0, outputTokens: 0 };
              if (event.latex !== null && event.latex !== undefined) {
                finalLatex = event.latex;
              }
              streamSucceeded = true;
              break;

            case "error":
              lastStreamError = event.message;
              break;
          }
        }, controller.signal, locale, agentMode);
      } catch (streamErr) {
        if (!streamSucceeded) {
          const currentContent = useUIStore.getState().chatMessages.find(m => m.id === assistantMsgId)?.content || "";
          const hasPartialContent = currentContent.length > 0 || finalLatex !== null;

          if (hasPartialContent) {
            chatLog.stream(requestId, "partial-content-recovered");
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
                const result = await sendAIMessage(history, document, locale, agentMode);
                const duration = Date.now() - startTime;
                incrementUsage();

                if (result.latex) {
                  applyLatex(result.latex);
                }

                updateChatMessage(assistantMsgId, {
                  content: result.message,
                  latex: result.latex,
                  thinkingSteps: result.thinking as ThinkingStep[],
                  isStreaming: false,
                  duration,
                  usage: result.usage,
                });

                chatLog.receive(requestId, duration, false);
                return;
              } catch (syncErr) {
                throw syncErr;
              }
            }
            throw streamErr;
          }
        }
      } finally {
        abortControllerRef.current = null;
      }

      const duration = Date.now() - startTime;

      if (streamSucceeded) {
        incrementUsage();

        // Final apply (in case "done" carried latex but no live "latex" event)
        if (finalLatex && document.latex !== finalLatex) {
          applyLatex(finalLatex);
        }

        const mergedSteps: ThinkingStep[] = accumulatedSteps.length > 0
          ? [...accumulatedSteps]
          : finalThinking.length > 0
          ? [...finalThinking]
          : [];
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
          latex: finalLatex,
          thinkingSteps,
          isStreaming: false,
          duration,
          usage: finalUsage,
        });

        setLiveSteps([]);
        setCurrentTool(null);
        chatLog.receive(requestId, duration, false);
      } else {
        incrementUsage();
        const streamedContent = useUIStore.getState().chatMessages.find(m => m.id === assistantMsgId)?.content || "";
        const hasContent = streamedContent.length > 0 || finalLatex !== null;

        let errorDetail: string;
        if (hasContent) {
          errorDetail = streamedContent || t("chat.assistant.updated");
        } else if (streamDiag) {
          if (streamDiag.eventsReceived === 0) {
            errorDetail = t("error.no_response");
          } else if (lastStreamError || streamDiag.errorMessage) {
            errorDetail = lastStreamError || streamDiag.errorMessage!;
          } else {
            errorDetail = `${t("error.stream.partial.prefix")} ${streamDiag.eventsReceived}${t("error.stream.partial.suffix")}`;
          }
        } else {
          errorDetail = t("error.stream.interrupted");
        }

        const thinkingSteps = accumulatedSteps.length > 0 ? [...accumulatedSteps] : undefined;

        updateChatMessage(assistantMsgId, {
          content: errorDetail,
          latex: finalLatex,
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
      let msg = e instanceof Error ? e.message : t("error.generic");
      const rawMsg = msg;
      if (msg.includes("Failed to fetch") || msg.includes("fetch")) {
        msg = t("error.fetch");
      } else if (msg.includes("AbortError") || msg.includes("abort")) {
        msg = t("error.aborted");
      } else if (msg.includes("タイムアウト") || msg.includes("timeout") || msg.includes("Timeout")) {
        msg = t("error.timeout");
      }
      if (rawMsg.includes("401") || rawMsg.toUpperCase().includes("UNAUTHORIZED")) {
        // セッションが切れた場合: 再ログインを促す toast を出す。
        msg = locale === "en"
          ? "Session expired. Please sign in again."
          : "セッションが切れました。再度サインインしてください。";
        toast.error(msg, {
          duration: 8000,
          action: {
            label: locale === "en" ? "Sign in" : "サインイン",
            onClick: () => { window.location.href = "/login?next=/editor"; },
          },
        });
      } else if (rawMsg.includes("429") || rawMsg.includes("RATE_LIMITED") || rawMsg.toUpperCase().includes("QUOTA")) {
        // 429 は quota / rate limit どちらかの可能性。toast で明示 + upgrade 誘導。
        const isQuota = rawMsg.toUpperCase().includes("QUOTA") || rawMsg.includes("上限");
        msg = isQuota
          ? (locale === "en" ? "Plan limit reached." : "プラン上限に達しました。")
          : (locale === "en" ? "Too many requests. Please slow down." : "リクエストが集中しています。少し待ってください。");
        toast.error(msg, {
          duration: 6000,
          action: isQuota ? {
            label: locale === "en" ? "Upgrade" : "アップグレード",
            onClick: () => setShowPricing(true),
          } : undefined,
        });
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

  // 旧 handleOMRUpload (チャットに画像/PDF 取り込み結果を書き込む実装) は
  // 廃止した。添付ボタンは読み取り (OMR) SplitView を開く動線に張り替えている。

  // モバイルでは usage bar を near-limit (>=60%) のときだけ表示してスペース節約
  const dailyPct = usagePercent().daily;
  const showUsageOnMobile = dailyPct >= 60;

  return (
    <div
      className="flex flex-col h-full chat-aurora-panel"
      data-mobile={isMobile ? "1" : undefined}
    >
      {/* PC: 既存の internal ヘッダーを維持。モバイル: 上位ページのヘッダーで賄うので
          ここでは非表示にして縦スペースを稼ぐ (ChatGPT モバイル風)。 */}
      {!isMobile && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-black/[0.08] dark:border-white/[0.06] shrink-0 chat-panel-bar dark:bg-white/[0.03] backdrop-blur-sm">
          <div className="h-7 w-7 rounded-lg chat-avatar-ai-static flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="flex-1 text-[13.5px] font-bold text-foreground/85 tracking-tight truncate">EddivomAI</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]" title={t("chat.online")} />
            {chatMessages.length > 0 && (
              <button
                onClick={() => { clearChat(); setApiKeyMissing(false); try { localStorage.removeItem("latex-gui-chat-v3"); } catch { /**/ } }}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-foreground/25 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-all duration-150"
                title={t("chat.clear")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Usage bar — モバイルは 60% 以上のときだけ */}
      {(!isMobile || showUsageOnMobile) && (
        <UsageBar
          todayUsage={todayUsage()}
          dailyLimit={dailyLimit()}
          monthUsage={monthUsage()}
          monthlyLimit={monthlyLimit()}
          planName={PLANS[currentPlan].name}
          dailyPercent={dailyPct}
          onUpgrade={() => setShowPricing(true)}
        />
      )}

      {apiKeyMissing && (
        <div className="mx-3 mt-2 shrink-0 rounded-xl border border-amber-400/50 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            {t("chat.api_key.missing")}
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            {t("chat.api_key.message")}
          </p>
          <button onClick={() => setApiKeyMissing(false)} className="text-xs text-amber-600 dark:text-amber-400 hover:underline">
            {t("chat.api_key.close")}
          </button>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto min-h-0 scrollbar-thin ${
          isMobile ? "px-4 py-3 space-y-5" : "px-3.5 py-4 space-y-4"
        }`}
        // モバイルで慣性スクロールを効かせる
        style={isMobile ? { WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" } as React.CSSProperties : undefined}
      >
        {chatMessages.length === 0 && !isMobile && (
          // PC の空状態 — 既存 UI を維持
          <div className="flex flex-col items-center justify-center h-full select-none gap-5 py-6 px-1">
            <div className="relative flex items-center justify-center">
              <div className="h-12 w-12 rounded-xl chat-empty-orb flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-[13px] font-medium text-foreground/50 text-center">
              {t("chat.empty.title")}
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {([
                { text: t("chat.suggestion.1"), icon: PenLine },
                { text: t("chat.suggestion.2"), icon: Calculator },
              ] as const).map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => { setInput(text); textareaRef.current?.focus(); }}
                  className="flex items-center gap-2.5 text-left text-[12px] px-3 py-2 rounded-lg text-foreground/55 hover:text-foreground/80 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-transparent hover:border-amber-200/50 dark:hover:border-amber-500/20 transition-all"
                >
                  <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.length === 0 && isMobile && (
          // Eddivom モバイル空状態: 上半分は余白、下半分にブランドオーブ + 質問・アクション
          <div className="flex flex-col h-full select-none">
            {/* 画面上半分は意図的に余白 */}
            <div className="flex-1" />

            {/* Eddivom ブランドオーブ + 1 行のささやき */}
            <div className="flex flex-col items-center gap-2 mb-3 px-3">
              <div className="h-10 w-10 rounded-2xl chat-avatar-ai flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <p className="text-[13px] text-foreground/55 font-medium text-center">
                {locale === "en"
                  ? "What can EddivomAI help with?"
                  : "EddivomAI に何を頼みますか？"}
              </p>
            </div>

            {/* 下部のアクションリスト — amber tinted icon chips */}
            <div className="flex flex-col gap-0 px-1 pb-2">
              {([
                {
                  fallback: locale === "en" ? "Create a worksheet" : "教材を作る",
                  icon: PenLine,
                  prompt: t("chat.suggestion.1"),
                },
                {
                  fallback: locale === "en" ? "Edit or rewrite" : "記述または編集",
                  icon: Calculator,
                  prompt: t("chat.suggestion.2"),
                },
                {
                  fallback: locale === "en" ? "Look something up" : "何かを調べる",
                  icon: Bug,
                  prompt: locale === "en"
                    ? "Find practice problems on quadratic equations"
                    : "二次方程式の練習問題を調べて",
                },
              ]).map(({ fallback, icon: Icon, prompt }) => (
                <button
                  key={fallback}
                  type="button"
                  onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left active:bg-amber-50/60 dark:active:bg-amber-500/10 transition group"
                >
                  <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400/15 to-orange-400/10 dark:from-amber-500/15 dark:to-orange-500/10 border border-amber-400/20 dark:border-amber-500/20 flex items-center justify-center shrink-0 group-active:scale-95 transition-transform">
                    <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.8} />
                  </span>
                  <span className="text-[15px] text-foreground/85 font-medium">{fallback}</span>
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

      {/* モバイル: スクロールが下から離れたら「最新へ」FAB を出す (ChatGPT 風) */}
      {isMobile && showJumpToBottom && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label={locale === "en" ? "Jump to latest" : "最新へ移動"}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 h-9 w-9 rounded-full bg-foreground/85 text-background shadow-lg shadow-black/20 flex items-center justify-center active:scale-95 transition"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* モバイル: Composer の直上に「プレビュー」を出す (Eddivom amber アクセント付き)。
          画面右下に absolute すると Safari の URL バーやホームバーと干渉するので、
          flex column の一員として配置することで常に Composer の上に来る。 */}
      {isMobile && onOpenPreview && (
        <div className="px-3 pt-1 pb-1 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onOpenPreview}
            aria-label={locale === "en" ? "Open preview" : "プレビューを開く"}
            className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/15 dark:to-orange-500/10 border border-amber-300/45 dark:border-amber-500/30 hover:border-amber-400/65 active:scale-95 transition shadow-sm shadow-amber-500/10"
          >
            <Eye className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2} />
            <span className="text-[12px] font-semibold bg-gradient-to-r from-amber-700 to-orange-700 dark:from-amber-300 dark:to-orange-300 bg-clip-text text-transparent">
              {locale === "en" ? "Preview" : "プレビュー"}
            </span>
          </button>
        </div>
      )}

      {/* PC: ModeSwitcher を Composer の上に出す。モバイル: Composer の `[+]` シートに格納する。 */}
      {!isMobile && (
        <div className="shrink-0 border-t border-black/[0.08] dark:border-white/[0.05] chat-panel-bar dark:bg-white/[0.02] backdrop-blur-sm px-3 pt-1.5">
          <ModeSwitcher
            mode={agentMode}
            onChange={setAgentMode}
            disabled={isChatLoading}
          />
        </div>
      )}

      <InputArea
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onStop={handleStop}
        onKeyDown={handleKeyDown}
        isChatLoading={isChatLoading}
        agentMode={true}
        mode={agentMode}
        onModeChange={setAgentMode}
        textareaRef={textareaRef}
        // 添付ボタンは読み取り (OMR) SplitView を開く動線に振り替えた。
        // チャットへ画像/PDF の内容を流し込むことはしない。
        onAttach={triggerOMR}
      />
    </div>
  );
}

function _summarizeToolResult(name: string, result: Record<string, unknown>, t: (key: string) => string): string {
  switch (name) {
    case "read_latex":
      return `Read: ${result.latex_length || 0} ${t("chat.tool.read.suffix")}`;
    case "set_latex":
      return `Write: ${(result.message as string) || t("chat.tool.write.summary")}`;
    case "replace_in_latex": {
      if (result.error) return `Replace ✗: ${(result.message as string) || result.error}`;
      return `Replace: ${(result.message as string) || t("chat.tool.replace.summary")}`;
    }
    case "compile_check": {
      const msg = result.message as string;
      if (result.success) {
        const pdfSize = result.pdf_size ? ` (PDF ${Math.round((result.pdf_size as number) / 1024)}KB)` : "";
        return `Build ✓: ${msg || t("chat.tool.compile.success")}${pdfSize}`;
      }
      const errors = result.issues as string[] | undefined;
      const firstError = errors?.[0] || msg || t("chat.tool.compile.error");
      return `Build ✗: ${firstError.slice(0, 100)}`;
    }
    default:
      return JSON.stringify(result).slice(0, 80);
  }
}
