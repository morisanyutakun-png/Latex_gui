"use client";

import { useState } from "react";
import { RefreshCw, Copy, Check, AlertCircle, Loader2 } from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { previewLatex } from "@/lib/api";
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
    // Line comment
    if (src[i] === "%") {
      const end = src.indexOf("\n", i);
      const slice = end === -1 ? src.slice(i) : src.slice(i, end + 1);
      tokens.push({ text: slice, kind: "comment" });
      i += slice.length;
      continue;
    }
    // Inline math $...$
    if (src[i] === "$") {
      const close = src.indexOf("$", i + 1);
      if (close !== -1) {
        tokens.push({ text: src.slice(i, close + 1), kind: "math" });
        i = close + 1;
        continue;
      }
    }
    // LaTeX command \word or \[ \] \( \)
    if (src[i] === "\\") {
      let end = i + 1;
      while (end < src.length && /[a-zA-Z]/.test(src[end])) end++;
      if (end === i + 1) end++; // single non-alpha char (\{, \}, etc.)
      tokens.push({ text: src.slice(i, end), kind: "command" });
      i = end;
      continue;
    }
    // Braces
    if (src[i] === "{" || src[i] === "}") {
      tokens.push({ text: src[i], kind: "brace" });
      i++;
      continue;
    }
    // Plain text — grab a run of non-special chars
    let end = i;
    while (end < src.length && src[end] !== "%" && src[end] !== "$" && src[end] !== "\\" && src[end] !== "{" && src[end] !== "}") {
      end++;
    }
    tokens.push({ text: src.slice(i, end), kind: "text" });
    i = end;
  }

  return tokens;
}

const KIND_CLASS: Record<TokenKind, string> = {
  command: "text-blue-600 dark:text-blue-400",
  brace: "text-slate-400 dark:text-slate-500",
  comment: "text-emerald-600 dark:text-emerald-400 italic",
  math: "text-violet-600 dark:text-violet-400",
  text: "",
};

function HighlightedSource({ source }: { source: string }) {
  const tokens = tokenize(source);
  return (
    <pre className="text-xs leading-relaxed font-mono whitespace-pre overflow-x-auto">
      {tokens.map((tok, i) => (
        <span key={i} className={KIND_CLASS[tok.kind]}>
          {tok.text}
        </span>
      ))}
    </pre>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LaTeXSourceViewer() {
  const document = useDocumentStore((s) => s.document);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRefresh = async () => {
    if (!document) return;
    setLoading(true);
    setError(null);
    try {
      const latex = await previewLatex(document);
      setSource(latex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LaTeXソースの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">生成されたLaTeXソース</span>
        <div className="flex items-center gap-1">
          {source && (
            <Button size="sm" variant="ghost" onClick={handleCopy} className="h-6 px-2 text-xs">
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "コピー済み" : "コピー"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={loading} className="h-6 px-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            更新
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!source && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-center space-y-2 py-8">
            <div className="text-3xl opacity-20 font-mono text-slate-400">{"{}"}</div>
            <p className="text-sm">「更新」を押すと生成されたLaTeXソースを確認できます</p>
            <Button size="sm" onClick={handleRefresh} className="mt-2 text-xs h-7">
              <RefreshCw className="h-3 w-3 mr-1" /> LaTeXを取得
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 h-full text-slate-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>LaTeXを生成中...</span>
          </div>
        )}

        {source && !loading && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <HighlightedSource source={source} />
          </div>
        )}
      </div>
    </div>
  );
}
