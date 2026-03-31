"use client";

import { useRef, useEffect, useState } from "react";
import { Bot, Send, Paperclip, Trash2, Loader2, Check, X, ChevronDown, ChevronUp, KeyRound } from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { sendAIMessage, analyzeImageOMR } from "@/lib/api";
import { ChatMessage, DocumentPatch, PatchOp } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Patch op human-readable description ─────────────────────────────────────

function describeOp(op: PatchOp): { icon: string; label: string; color: string } {
  switch (op.op) {
    case "add_block": {
      const c = op.block.content as Record<string, unknown>;
      const btype = c.type as string;
      const typeNames: Record<string, string> = {
        heading: "見出し", paragraph: "テキスト", math: "数式", list: "リスト",
        table: "表", image: "画像", divider: "区切り線", code: "コード", quote: "引用",
        circuit: "回路図", diagram: "ダイアグラム", chemistry: "化学式", chart: "グラフ",
      };
      const typeName = typeNames[btype] || btype;
      let preview = "";
      if (btype === "heading") preview = `"${String(c.text || "").slice(0, 30)}"`;
      else if (btype === "paragraph") preview = `"${String(c.text || "").slice(0, 30)}${String(c.text || "").length > 30 ? "..." : ""}"`;
      else if (btype === "math") preview = `$${String(c.latex || "")}$`;
      else if (btype === "list") preview = `${(c.items as string[] | undefined)?.length ?? 0}項目`;
      else if (btype === "table") preview = `${(c.headers as string[] | undefined)?.length ?? 0}列`;
      return { icon: "+", label: `${typeName}ブロックを追加${preview ? ": " + preview : ""}`, color: "text-emerald-600 dark:text-emerald-400" };
    }
    case "update_block":
      return { icon: "~", label: `ブロックを更新 (${op.blockId.slice(0, 8)}...)`, color: "text-blue-600 dark:text-blue-400" };
    case "delete_block":
      return { icon: "−", label: `ブロックを削除 (${op.blockId.slice(0, 8)}...)`, color: "text-red-600 dark:text-red-400" };
    case "reorder":
      return { icon: "↕", label: `${op.blockIds.length}件のブロックを並び替え`, color: "text-amber-600 dark:text-amber-400" };
  }
}

// ─── Patch Preview Drawer ─────────────────────────────────────────────────────

function PatchPreviewDrawer({
  patch,
  onApply,
  onDismiss,
}: {
  patch: DocumentPatch;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ops = patch.ops;
  const shown = expanded ? ops : ops.slice(0, 3);

  return (
    <div className="border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          {ops.length}件の変更案
        </span>
        {ops.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />折りたたむ</> : <><ChevronDown className="h-3 w-3" />すべて見る</>}
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {shown.map((op, i) => {
          const { icon, label, color } = describeOp(op);
          return (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className={`font-mono font-bold mt-0.5 ${color}`}>{icon}</span>
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApply} className="flex-1 h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white">
          <Check className="h-3 w-3 mr-1" /> 適用する
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs text-slate-500 hover:text-slate-700">
          <X className="h-3 w-3 mr-1" /> キャンセル
        </Button>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onApplyPatches,
  onRetryPatches,
}: {
  msg: ChatMessage;
  onApplyPatches: (patch: DocumentPatch, msgId: string) => void;
  onRetryPatches: (patch: DocumentPatch, msgId: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] space-y-1.5 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {!isUser && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Bot className="h-3 w-3" />
            <span>AI</span>
          </div>
        )}

        <div
          className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-violet-600 text-white rounded-br-sm"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm"
          }`}
        >
          {msg.content}
        </div>

        {/* Patch badge / drawer for assistant messages */}
        {!isUser && msg.patches && msg.patches.ops.length > 0 && (
          <div className="w-full">
            {msg.appliedAt ? (
              <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                <span>適用済み</span>
                <button
                  onClick={() => msg.patches && onRetryPatches(msg.patches, msg.id)}
                  className="ml-1 underline hover:no-underline"
                >
                  もう一度適用
                </button>
              </div>
            ) : (
              <button
                onClick={() => msg.patches && onApplyPatches(msg.patches, msg.id)}
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
              >
                <ChevronDown className="h-3 w-3" />
                {msg.patches.ops.length}件の変更を確認・適用
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Chat Panel ──────────────────────────────────────────────────────────

export function AIChatPanel() {
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
  } = useUIStore();

  const [input, setInput] = useState("");
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("latex-gui-chat-v1");
      if (saved) {
        const parsed: Array<{ id: string; role: "user" | "assistant"; content: string; appliedAt?: number }> = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && chatMessages.length === 0) {
          parsed.forEach((m) => addChatMessage({ id: m.id, role: m.role, content: m.content, appliedAt: m.appliedAt }));
        }
      }
    } catch {
      // ignore malformed storage
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (chatMessages.length === 0) return;
    try {
      const toSave = chatMessages.slice(-50).map(({ id, role, content, appliedAt }) => ({ id, role, content, appliedAt }));
      localStorage.setItem("latex-gui-chat-v1", JSON.stringify(toSave));
    } catch {
      // ignore storage errors (quota exceeded, etc.)
    }
  }, [chatMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isChatLoading || !document) return;

    const userMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text };
    addChatMessage(userMsg);
    setInput("");
    setChatLoading(true);

    try {
      // Build messages history for API (role + content only)
      const history = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await sendAIMessage(history, document);

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: result.message,
        patches: result.patches,
      };
      addChatMessage(assistantMsg);

      if (result.patches && result.patches.ops.length > 0) {
        setPendingPatch(result.patches);
        setPendingMsgId(assistantMsgId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "エラーが発生しました。もう一度お試しください。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) {
        setApiKeyMissing(true);
      }
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: msg,
        patches: null,
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleApplyPatches = (patch: DocumentPatch, msgId: string) => {
    setPendingPatch(patch);
    setPendingMsgId(msgId);
  };

  const handleRetryPatches = (patch: DocumentPatch, msgId: string) => {
    // Reset appliedAt so user can re-apply
    updateChatMessage(msgId, { appliedAt: undefined });
    setPendingPatch(patch);
    setPendingMsgId(msgId);
  };

  const handleConfirmApply = () => {
    if (!pendingPatch) return;
    applyPatch(pendingPatch);
    if (pendingMsgId) {
      updateChatMessage(pendingMsgId, { appliedAt: Date.now() });
    }
    setPendingPatch(null);
    setPendingMsgId(null);
  };

  const handleDismissPatch = () => {
    setPendingPatch(null);
    setPendingMsgId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOMRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !document) return;
    e.target.value = "";

    const userMsgId = crypto.randomUUID();
    addChatMessage({
      id: userMsgId,
      role: "user",
      content: `📎 画像をアップロードしました: ${file.name}`,
    });
    setChatLoading(true);

    try {
      const result = await analyzeImageOMR(file, document);
      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: result.description || "画像を解析しました。",
        patches: result.patches,
      };
      addChatMessage(assistantMsg);

      if (result.patches && result.patches.ops.length > 0) {
        setPendingPatch(result.patches);
        setPendingMsgId(assistantMsgId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "画像解析中にエラーが発生しました。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) {
        setApiKeyMissing(true);
      }
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: msg,
        patches: null,
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Bot className="h-4 w-4 text-violet-500" />
          AI アシスタント
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={() => {
              clearChat();
              setApiKeyMissing(false);
              try { localStorage.removeItem("latex-gui-chat-v1"); } catch { /* ignore */ }
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded"
            title="チャット履歴をクリア"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* MISSING_API_KEY banner */}
      {apiKeyMissing && (
        <div className="mx-3 mt-2 shrink-0 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            API キーが未設定です
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            AI 機能を使うには <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ANTHROPIC_API_KEY</code> をバックエンド (Koyeb) の環境変数に設定してください。
          </p>
          <button
            onClick={() => setApiKeyMissing(false)}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-500 space-y-3 py-8">
            <Bot className="h-10 w-10 opacity-30" />
            <div className="space-y-1">
              <p className="text-sm font-medium">AI に相談しながら文書を作ろう</p>
              <p className="text-xs">例: 「問題を3つ追加して」</p>
              <p className="text-xs">「この文書を模試形式にして」</p>
              <p className="text-xs">「解説をわかりやすくして」</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {["問題を3つ追加して", "章立てを整理して", "表を見やすくして"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-xs px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onApplyPatches={handleApplyPatches}
            onRetryPatches={handleRetryPatches}
          />
        ))}

        {isChatLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Bot className="h-4 w-4 text-violet-400" />
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">考え中...</span>
          </div>
        )}

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
      <div className="border-t border-slate-200 dark:border-slate-700 p-2 shrink-0 space-y-2">
        <div className="flex gap-1.5">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AIに依頼する... (Enter で送信、Shift+Enter で改行)"
            className="min-h-[64px] max-h-32 text-sm resize-none flex-1"
            disabled={isChatLoading}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleOMRUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isChatLoading}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="画像をアップロードして解析（OMR）"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400">画像を読み取る</span>
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isChatLoading || !input.trim()}
            className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isChatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
