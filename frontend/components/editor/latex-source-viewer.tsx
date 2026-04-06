"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  RefreshCw, Copy, Check, AlertCircle, Loader2,
  Edit3, Eye, Download, FileCode2, X,
} from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { previewLatex, compileRawLatex } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { tokenize, KIND_CLASS } from "@/lib/latex-syntax";

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

export function LaTeXSourceViewer({ onClose }: { onClose?: () => void } = {}) {
  const document = useDocumentStore((s) => s.document);
  const [source, setSource] = useState<string | null>(null);
  const [editedSource, setEditedSource] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRefresh = useCallback(async () => {
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
  }, [document]);

  // Auto-fetch on mount so the panel is immediately useful
  const didAutoFetch = useRef(false);
  useEffect(() => {
    if (didAutoFetch.current || !document) return;
    didAutoFetch.current = true;
    void handleRefresh();
  }, [document, handleRefresh]);

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
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar — also serves as the panel header when used inside LeftReviewPanel (OMR-style) */}
      <div className="h-12 border-b border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <FileCode2 className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="text-sm font-medium text-foreground/90">LaTeX ソース</span>
          {editMode && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">編集モード</span>
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
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
              <div className="bg-slate-50 dark:bg-slate-900 p-3 border-2 border-slate-300 dark:border-slate-700">
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
