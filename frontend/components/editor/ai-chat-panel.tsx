"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Bot, Send, Paperclip, Trash2, Loader2, Check, X,
  ChevronDown, ChevronUp, KeyRound, Zap, ZapOff,
  BookOpen, Search, X as XIcon,
  ThumbsUp, ThumbsDown, FileEdit, Sparkles,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore, LastAIAction } from "@/store/ui-store";
import { sendAIMessage, analyzeImageOMR } from "@/lib/api";
import { ChatMessage, DocumentPatch, PatchOp } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

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
    case "update_design":
      return { icon: "🎨", label: "紙のデザインを変更", color: "text-violet-600 dark:text-violet-400" };
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
        <Button size="sm" onClick={onApply} className="flex-1 h-7 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0">
          <Check className="h-3 w-3 mr-1" /> {t("chat.apply")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs text-slate-500 hover:text-slate-700">
          <X className="h-3 w-3 mr-1" /> {t("chat.cancel")}
        </Button>
      </div>
    </div>
  );
}

// ─── Markdown Renderer for chat messages ─────────────────────────────────────

function ChatMarkdown({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // コードブロック
        pre: ({ children }) => (
          <pre className={`rounded-lg p-3 my-2 overflow-x-auto text-[12px] font-mono ${
            isUser
              ? "bg-white/10 text-indigo-100"
              : "bg-slate-100 dark:bg-[#1a1d24] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/40"
          }`}>{children}</pre>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className={`px-1.5 py-0.5 rounded text-[12px] font-mono ${
                isUser
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300"
              }`}>{children}</code>
            );
          }
          return <code className={className}>{children}</code>;
        },
        // リンク
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className={isUser ? "underline text-indigo-200" : "text-indigo-600 dark:text-indigo-400 hover:underline"}>
            {children}
          </a>
        ),
        // リスト
        ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // 強調
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        // 見出し (チャット内なのでサイズ控えめ)
        h1: ({ children }) => <p className="font-bold text-[14px] mt-2 mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-bold text-[13px] mt-2 mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold text-[13px] mt-1.5 mb-0.5">{children}</p>,
        // 段落
        p: ({ children }) => <p className="leading-relaxed my-0.5">{children}</p>,
        // 引用
        blockquote: ({ children }) => (
          <blockquote className={`border-l-2 pl-3 my-1.5 italic ${
            isUser ? "border-indigo-300/50 text-indigo-100" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
          }`}>{children}</blockquote>
        ),
        // テーブル
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className={`text-[11px] border-collapse w-full ${
              isUser ? "text-indigo-100" : ""
            }`}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className={`px-2 py-1 text-left font-semibold border-b ${
            isUser ? "border-indigo-400/30" : "border-slate-300 dark:border-slate-600"
          }`}>{children}</th>
        ),
        td: ({ children }) => (
          <td className={`px-2 py-1 border-b ${
            isUser ? "border-indigo-400/20" : "border-slate-200 dark:border-slate-700"
          }`}>{children}</td>
        ),
        // 水平線
        hr: () => (
          <hr className={`my-2 ${isUser ? "border-indigo-400/30" : "border-slate-200 dark:border-slate-700"}`} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Change Summary Badge ���───────────────────────────────────────────────────

function ChangeSummaryBadge({ patches }: { patches: DocumentPatch }) {
  const ops = patches.ops;
  let added = 0, updated = 0, deleted = 0;
  for (const op of ops) {
    if (op.op === "add_block") added++;
    else if (op.op === "update_block") updated++;
    else if (op.op === "delete_block") deleted++;
  }
  const parts: string[] = [];
  if (added) parts.push(`+${added}`);
  if (updated) parts.push(`~${updated}`);
  if (deleted) parts.push(`-${deleted}`);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
      <FileEdit className="h-3 w-3 text-indigo-500" />
      <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
        {parts.join(" ")}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500">
        {ops.length}件の編集
      </span>
    </div>
  );
}

// ─── Strip leaked JSON from AI message content ──────────────────────────────

function cleanAIContent(content: string, hasPatches: boolean): string {
  if (!hasPatches) return content;
  // パッチ抽出済みの場合、残留JSONを除去
  let cleaned = content
    // コードブロック内のJSON除去
    .replace(/```(?:json)?\s*\n?[\s\S]*?```/g, "")
    // 生のJSONオブジェクト/配列除去 (50文字以上のものだけ)
    .replace(/^\s*[\[{][\s\S]{50,}?[\]}]\s*$/gm, "")
    .trim();
  // 完全に空になった場合のフォールバック
  if (!cleaned) {
    const opsCount = content.match(/"(?:op|type)"\s*:/g)?.length || 0;
    cleaned = `${opsCount || ""}件の変更を適用しました。`;
  }
  return cleaned;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg, onApplyPatches, onRetryPatches, onFeedback,
}: {
  msg: ChatMessage;
  onApplyPatches: (patch: DocumentPatch, msgId: string) => void;
  onRetryPatches: (patch: DocumentPatch, msgId: string) => void;
  onFeedback: (msgId: string, feedback: "good" | "bad") => void;
}) {
  const { t } = useI18n();
  const isUser = msg.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shrink-0 mb-0.5 shadow-md shadow-indigo-900/30 ring-1 ring-white/10">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* ���ッセージバブル */}
        <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed break-words shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-br-sm shadow-indigo-900/30"
            : "bg-white dark:bg-[#23262e] border border-slate-200/60 dark:border-slate-700/40 text-slate-800 dark:text-slate-100 rounded-bl-sm"
        }`}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <div className="chat-markdown">
              <ChatMarkdown content={cleanAIContent(msg.content, !!(msg.patches && msg.patches.ops.length > 0))} isUser={false} />
            </div>
          )}
        </div>

        {/* 変更サマリー + パッチアクション */}
        {!isUser && msg.patches && msg.patches.ops.length > 0 && (
          <div className="w-full space-y-1">
            <ChangeSummaryBadge patches={msg.patches} />
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
                className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 px-1 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                {`${msg.patches.ops.length} ${t("chat.changes")}`}
              </button>
            )}
          </div>
        )}

        {/* フィードバックボタン (AIメッセージのみ) */}
        {!isUser && (
          <div className="flex items-center gap-0.5 px-1 -mt-0.5">
            <button
              onClick={() => onFeedback(msg.id, "good")}
              className={`p-1 rounded transition-colors ${
                msg.feedback === "good"
                  ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "text-slate-300 dark:text-slate-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              }`}
              title="良い���答"
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
              title="改善が必要"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
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

// ─── Thinking Indicator (Claude Code / Codex style) ──────────────────────────

/** ユーザーメッセージからコンテキストに応じた思考ラインを生成 */
function getThinkingLines(userMessage: string): string[] {
  const msg = userMessage.toLowerCase();

  // キーワードマッチで日本語+英語の混合ステータスを返す
  if (msg.includes("プリント") || msg.includes("問題") || msg.includes("テスト")) {
    return [
      "問題作成中... Generating problems",
      "Analyzing difficulty level...",
      "構成を設計中... Structuring layout",
      "数式を生成中... Creating equations",
      "解答欄を配置中... Adding answer fields",
      "レイアウト最適化中... Optimizing layout",
      "最終チェック中... Finalizing document",
    ];
  }
  if (msg.includes("数式") || msg.includes("math") || msg.includes("方程式") || msg.includes("計算")) {
    return [
      "数式を解析中... Parsing math expressions",
      "LaTeX記法を生成中... Generating LaTeX notation",
      "数式ブロック構築中... Building math blocks",
      "表示モードを確認中... Checking display modes",
      "出力を最適化中... Optimizing output",
    ];
  }
  if (msg.includes("表") || msg.includes("テーブル") || msg.includes("table")) {
    return [
      "表を作成中... Creating table structure",
      "セルデータを生成中... Generating cell data",
      "列幅を調整中... Adjusting column widths",
      "レイアウト最適化中... Optimizing layout",
    ];
  }
  if (msg.includes("グラフ") || msg.includes("chart") || msg.includes("図")) {
    return [
      "グラフを設計中... Designing chart",
      "データを分析中... Analyzing data structure",
      "描画パラメータ生成中... Generating render params",
      "出力を最適化中... Optimizing output",
    ];
  }
  if (msg.includes("修正") || msg.includes("変更") || msg.includes("編集") || msg.includes("更新")) {
    return [
      "変更箇所を特定中... Identifying changes",
      "ドキュメント解析中... Analyzing document",
      "パッチを生成中... Generating patches",
      "変更を検証中... Validating changes",
      "適用準備中... Preparing to apply",
    ];
  }
  if (msg.includes("削除") || msg.includes("消して") || msg.includes("remove")) {
    return [
      "対象ブロックを検索中... Finding target blocks",
      "依存関係を確認中... Checking dependencies",
      "削除パッチ生成中... Generating removal patch",
      "最終確認中... Final verification",
    ];
  }
  // デフォルト
  return [
    "リクエストを解析中... Analyzing request",
    "ドキュメント構造を確認中... Checking document structure",
    "コンテンツを生成中... Generating content",
    "ブロックを構築中... Building blocks",
    "レイアウトを調整中... Adjusting layout",
    "出力を最適化中... Optimizing output",
    "最終処理中... Finalizing response",
  ];
}

function ThinkingIndicator({ userMessage }: { userMessage: string }) {
  const lines = React.useMemo(() => getThinkingLines(userMessage), [userMessage]);
  const [lineIdx, setLineIdx] = React.useState(0);
  const [charCount, setCharCount] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  // 経過時間カウンター
  React.useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // タイプライター効果でラインを切り替え
  React.useEffect(() => {
    const line = lines[lineIdx % lines.length];
    if (charCount < line.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), 18);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setLineIdx((i) => (i + 1) % lines.length);
        setCharCount(0);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [lineIdx, charCount, lines]);

  const currentLine = lines[lineIdx % lines.length].slice(0, charCount);
  // 日本語部分と英語部分を分離して表示
  const jpPart = currentLine.split("...")[0];
  const enPart = currentLine.includes("...") ? currentLine.slice(currentLine.indexOf("...") + 4) : "";

  // 長時間待機時のステータス
  const isLongWait = elapsed >= 15;
  const statusText = isLongWait ? "retrying" : "running";
  const statusColor = isLongWait ? "text-amber-400/70" : "text-indigo-400/70";
  const dotColor = isLongWait ? "bg-amber-400" : "bg-indigo-400";

  return (
    <div className="flex items-start gap-2">
      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-indigo-900/30 ring-1 ring-white/10">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {/* コードライン風の思考表示 */}
        <div className="rounded-xl bg-[#0d1117] dark:bg-[#060810] border border-slate-700/60 overflow-hidden shadow-lg shadow-black/20">
          {/* ターミナルヘッダー */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161b22] border-b border-slate-700/40">
            <span className="h-2 w-2 rounded-full bg-red-500/70" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
            <span className="ml-2 text-[9px] font-mono text-slate-500">eddivom-agent · thinking</span>
            <span className={`ml-auto flex items-center gap-1 text-[9px] font-mono ${statusColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dotColor} animate-pulse`} />
              {statusText}
              <span className="text-slate-600 ml-1">{elapsed}s</span>
            </span>
          </div>
          {/* 出力ライン */}
          <div className="px-3 py-2.5 font-mono text-[11px] space-y-0.5 min-h-[52px]">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-indigo-400/60 shrink-0">$</span>
              <span className="text-emerald-400/70">eddivom</span>
              <span className="text-slate-500">generate</span>
              <span className="text-amber-400/60">--auto-apply</span>
            </div>
            <div className="flex items-center gap-1 pl-4">
              <span className="text-amber-300/90">{jpPart}</span>
              {enPart && <span className="text-slate-500 ml-1">{enPart}</span>}
              <span className="inline-block w-[6px] h-[12px] bg-indigo-400/80 animate-pulse" />
            </div>
            {isLongWait && (
              <div className="flex items-center gap-1 pl-4 mt-1">
                <span className="text-amber-400/60">⏳</span>
                <span className="text-amber-300/70">API制限のためリトライ待機中...</span>
                <span className="text-slate-600">Rate limit, auto-retrying</span>
              </div>
            )}
          </div>
        </div>
      </div>
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
  const [agentMode, setAgentMode] = useState(true); // default: auto-apply (autonomous)
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

  // フィードバック処理
  const handleFeedback = (msgId: string, feedback: "good" | "bad") => {
    const existing = chatMessages.find((m) => m.id === msgId);
    // toggle: 同じボタンをもう一度押したらクリア
    const newFeedback = existing?.feedback === feedback ? null : feedback;
    updateChatMessage(msgId, { feedback: newFeedback });
  };

  // 直近のフィードバックをコンテキストに組み立て
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

    const userMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text };
    addChatMessage(userMsg);
    setInput("");
    setChatLoading(true);

    try {
      // フィードバックコンテキストを最後のユーザーメッセージに付加
      const feedbackCtx = buildFeedbackContext();
      const history = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.role === "user" && m.id === userMsgId ? m.content + feedbackCtx : m.content,
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
    <div className="flex flex-col h-full bg-[#f2f3f5] dark:bg-[#16181c]">
      {/* Header — EddivomAI brand bar */}
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
          {/* Agent mode toggle */}
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
              onClick={() => { clearChat(); setApiKeyMissing(false); try { localStorage.removeItem("latex-gui-chat-v1"); } catch { /**/ } }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-[#f2f3f5] dark:bg-[#16181c]">
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
          <MessageBubble
            key={msg.id}
            msg={msg}
            onApplyPatches={handleApplyPatches}
            onRetryPatches={handleRetryPatches}
            onFeedback={handleFeedback}
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
      <div className="border-t border-slate-200/40 dark:border-slate-700/30 px-3 py-3 shrink-0 bg-white dark:bg-[#1a1c22] shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        {agentMode && (
          <div className="flex items-center gap-1 text-[10px] text-indigo-500/80 mb-2 px-1">
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
              className="p-1.5 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-30"
              title="画像をアップロード (OMR)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowMaterials(!showMaterials)}
              className={`p-1.5 rounded-full transition-colors ${showMaterials ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}
              title="教材DB"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          </div>

          {/* Text input bubble */}
          <div className="flex-1 flex items-end gap-2 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-[#23262e] px-3 py-2 focus-within:border-indigo-400/60 dark:focus-within:border-indigo-600/50 focus-within:ring-2 focus-within:ring-indigo-200/30 dark:focus-within:ring-indigo-900/30 transition-all shadow-sm">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              className="min-h-[20px] max-h-32 text-[13px] resize-none flex-1 font-sans bg-transparent border-none shadow-none p-0 focus-visible:ring-0 placeholder:text-slate-400/60 dark:placeholder:text-slate-500/60"
              disabled={isChatLoading}
            />
            <button
              onClick={handleSend}
              disabled={isChatLoading || !input.trim()}
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                input.trim() && !isChatLoading
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 shadow-md shadow-indigo-900/25"
                  : "bg-slate-100 dark:bg-slate-700/50 text-slate-300 dark:text-slate-600"
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
        <p className="text-[9px] text-slate-400/50 dark:text-slate-600/60 text-center mt-2">{t("chat.hint")}</p>
      </div>
    </div>
  );
}
