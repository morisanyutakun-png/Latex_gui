"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

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
    try {
      katex.render(latex, ref.current, {
        throwOnError: false,
        displayMode,
        trust: true,
        strict: false,
      });
    } catch {
      ref.current.innerHTML = `<span class="text-red-400 text-xs">数式エラー</span>`;
    }
  }, [latex, displayMode]);

  return (
    <div
      ref={ref}
      className={`math-renderer ${className}`}
    />
  );
}
