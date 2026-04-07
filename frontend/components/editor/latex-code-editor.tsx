"use client";

import { useMemo, useRef } from "react";
import { highlightLatexToHtml } from "@/lib/latex-syntax";

interface LatexCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * LatexCodeEditor — IDE 風の LaTeX ソースエディタ
 *
 * 構造:
 * <div class="latex-code-editor">
 *   <div class="latex-gutter">      ← 行番号
 *   <div class="latex-code-area">   ← grid で pre と textarea を重ねる
 *     <pre class="latex-highlight">  ← シンタックスハイライトされた色付き spans
 *     <textarea class="latex-input"> ← 透明テキスト + 可視キャレット (実際の編集対象)
 *
 * - textarea は color: transparent + caret-color: foreground にして pre の上に重ねる
 * - 同一フォント・同一 padding・white-space: pre / wrap=off で行折り返しを完全一致させる
 * - 横スクロールはラッパ自身が処理し、行番号 gutter は position: sticky で固定
 */
export function LatexCodeEditor({ value, onChange, placeholder, className }: LatexCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // pre と一致するハイライト HTML
  const html = useMemo(() => highlightLatexToHtml(value) + "\n", [value]);

  // gutter 行数 (textarea の論理行数と一致させる)
  const lineCount = useMemo(() => {
    if (!value) return 1;
    let n = 1;
    for (let i = 0; i < value.length; i++) if (value[i] === "\n") n++;
    return n;
  }, [value]);

  // Tab を押したら 2 スペースを挿入 (本物の IDE っぽく)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const insert = "  ";
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    // 次フレームでカーソル位置を復元
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + insert.length;
      }
    });
  };

  return (
    <div className={`latex-code-editor ${className ?? ""}`}>
      <div className="latex-gutter" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="latex-gutter-line">{i + 1}</div>
        ))}
      </div>
      <div className="latex-code-area">
        <pre className="latex-highlight" aria-hidden="true">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
          placeholder={placeholder}
          className="latex-input"
        />
      </div>
    </div>
  );
}
