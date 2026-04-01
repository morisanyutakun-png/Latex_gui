"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Bot, Send, Paperclip, Trash2, Loader2, Check, X,
  ChevronDown, ChevronUp, KeyRound, Zap, ZapOff,
  BookOpen, Search, X as XIcon,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, LastAIAction } from "@/store/ui-store";
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

// ─── Build LastAIAction from patch + newly-added IDs ─────────────────────────

function buildLastAIAction(patch: DocumentPatch, newIds: string[]): LastAIAction {
  let added = 0, updated = 0, deleted = 0, reordered = 0;
  for (const op of patch.ops) {
    if (op.op === "add_block") added++;
    else if (op.op === "update_block") updated++;
    else if (op.op === "delete_block") deleted++;
    else if (op.op === "reorder") reordered++;
  }
  const parts: string[] = [];
  if (added) parts.push(`${added}件追加`);
  if (updated) parts.push(`${updated}件更新`);
  if (deleted) parts.push(`${deleted}件削除`);
  if (reordered && !added && !updated && !deleted) parts.push("並び替え");
  return {
    description: parts.join(" · ") || "変更を適用",
    blockIds: newIds,
    opCounts: { added, updated, deleted, reordered },
    timestamp: Date.now(),
  };
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
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const ops = patch.ops;
  const shown = expanded ? ops : ops.slice(0, 3);

  return (
    <div className="border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          {`${ops.length} ${t("chat.changes.title")}`}
        </span>
        {ops.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />{t("chat.collapse")}</> : <><ChevronDown className="h-3 w-3" />{t("chat.see.all")}</>}
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
          <Check className="h-3 w-3 mr-1" /> {t("chat.apply")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs text-slate-500 hover:text-slate-700">
          <X className="h-3 w-3 mr-1" /> {t("chat.cancel")}
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
  const { t } = useI18n();
  const isUser = msg.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mb-0.5 shadow-sm">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
          isUser
            ? "bg-violet-600 text-white rounded-br-md"
            : "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 rounded-bl-md"
        }`}>
          {msg.content}
        </div>

        {/* Patch actions */}
        {!isUser && msg.patches && msg.patches.ops.length > 0 && (
          <div className="w-full">
            {msg.appliedAt ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 px-1">
                <Check className="h-3 w-3" />
                <span>{t("chat.applied")}</span>
                <button onClick={() => msg.patches && onRetryPatches(msg.patches, msg.id)} className="underline hover:no-underline opacity-60">
                  {t("chat.retry")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => msg.patches && onApplyPatches(msg.patches, msg.id)}
                className="flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-400 hover:text-violet-700 px-1 transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
                {`${msg.patches.ops.length} ${t("chat.changes")}`}
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
    <div className="flex flex-col h-full bg-[#f5f5f5] dark:bg-[#1a1a1a]">
      {/* Header — Chat style */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-white dark:bg-[#242424] shrink-0 shadow-sm">
        <div className="h-9 w-9 rounded-full bg-violet-600 flex items-center justify-center shadow-sm shrink-0">
          <Bot className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-none">{t("chat.title")}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t("chat.subtitle")}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Agent mode toggle */}
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              agentMode
                ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
            }`}
            title={agentMode ? t("chat.auto") : t("chat.confirm")}
          >
            {agentMode ? <Zap className="h-2.5 w-2.5" /> : <ZapOff className="h-2.5 w-2.5" />}
            {agentMode ? t("chat.auto") : t("chat.confirm")}
          </button>
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              showMaterials ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/40"
            }`}
            title={t("chat.materials")}
          >
            <BookOpen className="h-3.5 w-3.5" />
          </button>
          {chatMessages.length > 0 && (
            <button
              onClick={() => { clearChat(); setApiKeyMissing(false); try { localStorage.removeItem("latex-gui-chat-v1"); } catch { /**/ } }}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors"
              title={t("chat.clear")}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {chatMessages.length === 0 && !showMaterials && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-8 select-none">
            <div className="h-14 w-14 rounded-2xl bg-violet-600/10 dark:bg-violet-600/20 flex items-center justify-center">
              <Bot className="h-7 w-7 text-violet-500" />
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
                  className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-border/40 bg-white dark:bg-slate-800/60 text-foreground/60 hover:text-violet-700 dark:hover:text-violet-300 hover:border-violet-300/60 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-all shadow-sm"
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
          <div className="flex items-end gap-2">
            <div className="h-7 w-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
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

      {/* Input area — iMessage style */}
      <div className="border-t border-border/15 px-3 py-3 shrink-0 bg-white dark:bg-[#242424]">
        {agentMode && (
          <div className="flex items-center gap-1 text-[10px] text-violet-500/70 mb-2 px-1">
            <Zap className="h-2.5 w-2.5" />
            {t("chat.agent.mode")}
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Attachment & materials buttons */}
          <div className="flex flex-col gap-1 pb-1">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleOMRUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isChatLoading}
              className="p-1.5 rounded-full text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-30"
              title="画像をアップロード (OMR)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowMaterials(!showMaterials)}
              className={`p-1.5 rounded-full transition-colors ${showMaterials ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/40"}`}
              title="教材DB"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          </div>

          {/* Text input bubble */}
          <div className="flex-1 flex items-end gap-2 rounded-2xl border border-border/40 bg-[#f0f0f0] dark:bg-slate-800/60 px-3 py-2 focus-within:border-violet-300/60 focus-within:ring-1 focus-within:ring-violet-200/40 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              className="min-h-[20px] max-h-32 text-[13px] resize-none flex-1 font-sans bg-transparent border-none shadow-none p-0 focus-visible:ring-0 placeholder:text-muted-foreground/35"
              disabled={isChatLoading}
            />
            <button
              onClick={handleSend}
              disabled={isChatLoading || !input.trim()}
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                input.trim() && !isChatLoading
                  ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                  : "bg-muted/60 text-muted-foreground/30"
              }`}
              title="送信 (Enter)"
            >
              {isChatLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />
              }
            </button>
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground/25 text-center mt-2">{t("chat.hint")}</p>
      </div>
    </div>
  );
}
