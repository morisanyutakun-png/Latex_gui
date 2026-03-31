"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Bot, Send, Paperclip, Trash2, Loader2, Check, X,
  ChevronDown, ChevronUp, KeyRound, Zap, ZapOff,
  BookOpen, Search, X as XIcon,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { sendAIMessage, analyzeImageOMR } from "@/lib/api";
import { ChatMessage, DocumentPatch, PatchOp } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialTopic {
  id: string;
  subject: string;
  level: string;
  topic: string;
  keywords: string[];
  problems: Array<{
    type: string;
    text: string;
    answer: string;
    hint?: string;
    latex?: string;
  }>;
}

// ─── Patch op human-readable description ─────────────────────────────────────

function describeOp(op: PatchOp): { icon: string; label: string; color: string } {
  switch (op.op) {
    case "add_block": {
      const c = op.block.content as unknown as Record<string, unknown>;
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
  patch, onApply, onDismiss,
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
  msg, onApplyPatches, onRetryPatches,
}: {
  msg: ChatMessage;
  onApplyPatches: (patch: DocumentPatch, msgId: string) => void;
  onRetryPatches: (patch: DocumentPatch, msgId: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] space-y-1.5 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {!isUser && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Bot className="h-3 w-3" />
            <span>Agent</span>
          </div>
        )}
        <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-violet-600 text-white rounded-br-sm"
            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm"
        }`}>
          {msg.content}
        </div>
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
                  もう一度
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

// ─── Materials Search Panel ───────────────────────────────────────────────────

function MaterialsPanel({ onAttach }: { onAttach: (context: string) => void }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<MaterialTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/materials/meta")
      .then((r) => r.json())
      .then((d) => { if (d.subjects) setSubjects(d.subjects); })
      .catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/materials/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, subject, limit: 6 }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, subject]);

  const attachTopic = (topic: MaterialTopic) => {
    const lines = [
      `【教材DB参照: ${topic.subject} / ${topic.level} / ${topic.topic}】`,
      `キーワード: ${topic.keywords.join(", ")}`,
      "",
      ...topic.problems.map((p, i) =>
        `問題${i + 1}（${p.type}）: ${p.text}` +
        (p.hint ? `\nヒント: ${p.hint}` : "") +
        `\n解答: ${p.answer}`
      ),
    ];
    onAttach(lines.join("\n"));
  };

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <BookOpen className="h-3.5 w-3.5" />
        教材DB
      </div>
      <div className="flex gap-1.5">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="text-xs border border-border/40 rounded px-1.5 py-1 bg-background text-foreground"
        >
          <option value="">全科目</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="トピックを検索..."
          className="flex-1 text-xs border border-border/40 rounded px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={search}
          disabled={loading}
          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {results.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => attachTopic(t)}
                className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              >
                <span className="font-medium text-emerald-800 dark:text-emerald-200">{t.topic}</span>
                <span className="ml-1.5 text-slate-500">{t.subject} / {t.level}</span>
                <span className="ml-1 text-emerald-600 dark:text-emerald-400">({t.problems.length}問)</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length === 0 && query && !loading && (
        <p className="text-xs text-slate-400 text-center py-1">該当なし</p>
      )}
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
  const [agentMode, setAgentMode] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
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
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist chat history to localStorage
  useEffect(() => {
    if (chatMessages.length === 0) return;
    try {
      const toSave = chatMessages.slice(-50).map(({ id, role, content, appliedAt }) => ({ id, role, content, appliedAt }));
      localStorage.setItem("latex-gui-chat-v1", JSON.stringify(toSave));
    } catch { /* ignore */ }
  }, [chatMessages]);

  // Auto-scroll
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
      const history = [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));
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
        if (agentMode) {
          // エージェントモード: 自動適用
          applyPatch(result.patches);
          updateChatMessage(assistantMsgId, { appliedAt: Date.now() });
        } else {
          setPendingPatch(result.patches);
          setPendingMsgId(assistantMsgId);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "エラーが発生しました。もう一度お試しください。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) setApiKeyMissing(true);
      addChatMessage({ id: crypto.randomUUID(), role: "assistant", content: msg, patches: null });
    } finally {
      setChatLoading(false);
    }
  };

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
    applyPatch(pendingPatch);
    if (pendingMsgId) updateChatMessage(pendingMsgId, { appliedAt: Date.now() });
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
    addChatMessage({ id: crypto.randomUUID(), role: "user", content: `📎 ${file.name}` });
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
        if (agentMode) {
          applyPatch(result.patches);
          updateChatMessage(assistantMsgId, { appliedAt: Date.now() });
        } else {
          setPendingPatch(result.patches);
          setPendingMsgId(assistantMsgId);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "画像解析中にエラーが発生しました。";
      if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("MISSING_API_KEY")) setApiKeyMissing(true);
      addChatMessage({ id: crypto.randomUUID(), role: "assistant", content: msg, patches: null });
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
    <div className="flex flex-col h-full font-mono text-sm">
      {/* Header — CLI style */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 select-none">
            ▸ agent
          </span>
          {/* Agent mode toggle */}
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              agentMode
                ? "bg-violet-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border/40"
            }`}
            title={agentMode ? "自動適用モード（クリックで無効化）" : "確認モード（クリックで自動適用に切替）"}
          >
            {agentMode ? <Zap className="h-2.5 w-2.5" /> : <ZapOff className="h-2.5 w-2.5" />}
            {agentMode ? "自動" : "確認"}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className={`p-1 rounded text-xs transition-colors ${
              showMaterials
                ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="教材DB"
          >
            <BookOpen className="h-3.5 w-3.5" />
          </button>
          {chatMessages.length > 0 && (
            <button
              onClick={() => {
                clearChat();
                setApiKeyMissing(false);
                try { localStorage.removeItem("latex-gui-chat-v1"); } catch { /* ignore */ }
              }}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="チャット履歴をクリア"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

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

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatMessages.length === 0 && !showMaterials && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-500 space-y-3 py-8">
            <div className="text-left font-mono text-xs space-y-1 text-slate-400 dark:text-slate-500 select-none">
              <p><span className="text-violet-400">$</span> agent --mode=document-builder</p>
              <p><span className="text-emerald-400">✓</span> Claude API connected</p>
              <p><span className="text-emerald-400">✓</span> Document context loaded</p>
              <p><span className="text-emerald-400">✓</span> Materials DB ready</p>
              <p className="text-slate-500">{">"} Waiting for instructions...</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {[
                "数学プリントを作って",
                "二次方程式の問題を5つ",
                "模試形式にして",
                "表を見やすくして",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-xs px-2 py-1 rounded border border-border/40 bg-muted/30 text-muted-foreground hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300 hover:border-violet-300 transition-colors font-sans"
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
          <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
            <span>{agentMode ? "実行中..." : "考え中..."}</span>
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
      <div className="border-t border-border/20 p-2 shrink-0 space-y-1.5 bg-muted/10">
        {agentMode && (
          <div className="flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400 font-mono">
            <Zap className="h-2.5 w-2.5" />
            自動適用モード — 変更は確認なしで即時反映されます
          </div>
        )}
        <div className="flex gap-1.5">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="指示を入力... (Enter で実行、Shift+Enter で改行)"
            className="min-h-[60px] max-h-32 text-sm resize-none flex-1 font-sans"
            disabled={isChatLoading}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleOMRUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isChatLoading}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="画像をアップロードしてOCR・OMR"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowMaterials(!showMaterials)}
              className={`p-1.5 rounded transition-colors ${showMaterials ? "text-emerald-600" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              title="教材DBから問題を参照"
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isChatLoading || !input.trim()}
            className={`h-7 px-3 text-xs text-white ${agentMode ? "bg-violet-700 hover:bg-violet-800" : "bg-violet-600 hover:bg-violet-700"}`}
          >
            {isChatLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : agentMode
                ? <><Zap className="h-3 w-3 mr-1" />実行</>
                : <Send className="h-3.5 w-3.5" />
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
