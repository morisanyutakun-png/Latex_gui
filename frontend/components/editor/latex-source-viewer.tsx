"use client";

import { useState, useCallback } from "react";
import {
  RefreshCw, Copy, Check, AlertCircle, Loader2,
  Edit3, Eye, Download, FileCode2,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { previewLatex, compileRawLatex } from "@/lib/api";
import { Button } from "@/components/ui/button";

// ─── Very lightweight LaTeX syntax highlighter ───────────────────────────────

type TokenKind = "command" | "brace" | "comment" | "math" | "text";

interface Token {
  text: string;
  kind: TokenKind;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "%") {
      const end = src.indexOf("\n", i);
      const slice = end === -1 ? src.slice(i) : src.slice(i, end + 1);
      tokens.push({ text: slice, kind: "comment" });
      i += slice.length;
      continue;
    }
    if (src[i] === "$") {
      const close = src.indexOf("$", i + 1);
      if (close !== -1) {
        tokens.push({ text: src.slice(i, close + 1), kind: "math" });
        i = close + 1;
        continue;
      }
    }
    if (src[i] === "\\") {
      let end = i + 1;
      while (end < src.length && /[a-zA-Z]/.test(src[end])) end++;
      if (end === i + 1) end++;
      tokens.push({ text: src.slice(i, end), kind: "command" });
      i = end;
      continue;
    }
    if (src[i] === "{" || src[i] === "}") {
      tokens.push({ text: src[i], kind: "brace" });
      i++;
      continue;
    }
    let end = i;
    while (end < src.length && src[end] !== "%" && src[end] !== "$" && src[end] !== "\\" && src[end] !== "{" && src[end] !== "}") end++;
    tokens.push({ text: src.slice(i, end), kind: "text" });
    i = end;
  }
  return tokens;
}

const KIND_CLASS: Record<TokenKind, string> = {
  command: "text-blue-500 dark:text-blue-400",
  brace:   "text-slate-400 dark:text-slate-500",
  comment: "text-emerald-600 dark:text-emerald-400 italic",
  math:    "text-violet-600 dark:text-violet-400",
  text:    "",
};

function HighlightedSource({ source }: { source: string }) {
  const tokens = tokenize(source);
  return (
    <pre className="text-xs leading-relaxed font-mono whitespace-pre overflow-x-auto">
      {tokens.map((tok, i) => (
        <span key={i} className={KIND_CLASS[tok.kind]}>{tok.text}</span>
      ))}
    </pre>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LaTeXSourceViewer() {
  const document = useDocumentStore((s) => s.document);
  const [source, setSource] = useState<string | null>(null);
  const [editedSource, setEditedSource] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRefresh = async () => {
    if (!document) return;
    setLoading(true);
    setError(null);
    try {
      const latex = await previewLatex(document);
      setSource(latex);
      setEditedSource(latex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LaTeXソースの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const text = editMode ? editedSource : source;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleCompileRaw = useCallback(async () => {
    if (!editedSource.trim()) return;
    setCompiling(true);
    setError(null);
    try {
      const blob = await compileRawLatex(editedSource, document?.metadata.title || "document");
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document?.metadata.title || "document"}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "コンパイルに失敗しました");
    } finally {
      setCompiling(false);
    }
  }, [editedSource, document]);

  const toggleEditMode = () => {
    if (!editMode && source) setEditedSource(source);
    setEditMode((v) => !v);
    setError(null);
  };

  const currentSource = editMode ? editedSource : source;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0 gap-2">
        <div className="flex items-center gap-1.5">
          <FileCode2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            LaTeXソース
          </span>
          {editMode && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-full">EDIT</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {currentSource && (
            <Button size="sm" variant="ghost" onClick={handleCopy} className="h-6 px-2 text-xs gap-1">
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "済" : "コピー"}
            </Button>
          )}
          {source && (
            <Button
              size="sm"
              variant={editMode ? "secondary" : "ghost"}
              onClick={toggleEditMode}
              className="h-6 px-2 text-xs gap-1"
            >
              {editMode ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
              {editMode ? "プレビュー" : "編集"}
            </Button>
          )}
          {editMode && (
            <Button
              size="sm"
              onClick={handleCompileRaw}
              disabled={compiling || !editedSource.trim()}
              className="h-6 px-2 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {compiling
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Download className="h-3 w-3" />}
              {compiling ? "生成中…" : "PDF出力"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={loading} className="h-6 px-2 text-xs gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            更新
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 mx-3 mt-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {!currentSource && !loading && !error && (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400 dark:text-slate-500 text-center space-y-2 py-8 px-4">
            <div className="text-3xl opacity-20 font-mono text-slate-400">{"{}"}</div>
            <p className="text-sm">「更新」でLaTeXソースを取得。編集→PDF直接出力も可能です。</p>
            <Button size="sm" onClick={handleRefresh} className="mt-2 text-xs h-7">
              <RefreshCw className="h-3 w-3 mr-1" /> LaTeXを取得
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 flex-1 text-slate-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>LaTeXを生成中...</span>
          </div>
        )}

        {currentSource && !loading && (
          editMode ? (
            /* ── 編集モード: textarea ── */
            <textarea
              value={editedSource}
              onChange={(e) => setEditedSource(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full text-xs font-mono leading-relaxed resize-none border-none outline-none bg-slate-950 text-slate-100 p-3 focus:ring-0"
              style={{ caretColor: "#818cf8" }}
            />
          ) : (
            /* ── プレビューモード: ハイライト表示 ── */
            <div className="flex-1 overflow-y-auto p-3">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <HighlightedSource source={currentSource} />
              </div>
            </div>
          )
        )}
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
          LaTeXソースを直接編集できます。「PDF出力」でそのままコンパイル。
        </div>
      )}
    </div>
  );
}
