"use client";

import { useEffect, useRef } from "react";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";
import { renderMathHTML } from "@/lib/katex-render";

interface MathRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export function MathRenderer({ latex, displayMode = true, className = "" }: MathRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!latex.trim()) {
      ref.current.innerHTML = "";
      return;
    }
    // 中央集約の renderMathHTML を使う。プロジェクト固有マクロが効くので
    // \haiten / \juKey / \circled なども popover プレビューで正しく描画される。
    const { html, ok } = renderMathHTML(latex, { displayMode });
    ref.current.innerHTML = ok
      ? html
      : `<span class="text-muted-foreground text-xs">\u2329 math \u232A</span>`;
  }, [latex, displayMode]);

  return (
    <div
      ref={ref}
      className={`math-renderer ${className}`}
    />
  );
}
