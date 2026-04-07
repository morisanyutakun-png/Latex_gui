"use client";

/**
 * 答案サムネイル列
 *
 * Step 2-4 で常時見える。File オブジェクトをサムネ表示する。
 * 採点中ページのインデックスを props で受け取り、該当サムネに赤枠ハイライト。
 */
import React, { useEffect, useMemo } from "react";
import { FileText } from "lucide-react";

interface Props {
  files: File[];
  highlightIndex?: number | null;
  onClickPage?: (index: number) => void;
}

interface Thumb {
  url: string | null;
  label: string;
  isImage: boolean;
}

export function AnswerThumbnailStrip({ files, highlightIndex = null, onClickPage }: Props) {
  // useMemo: 副作用ではなく派生値として URL を作る (cascading render を避ける)
  const thumbs: Thumb[] = useMemo(() => files.map((f) => {
    const isImage = f.type.startsWith("image/");
    return {
      url: isImage ? URL.createObjectURL(f) : null,
      label: f.name,
      isImage,
    };
  }), [files]);

  // 後始末だけ effect で行う
  useEffect(() => {
    return () => {
      thumbs.forEach((t) => {
        if (t.url) URL.revokeObjectURL(t.url);
      });
    };
  }, [thumbs]);

  if (thumbs.length === 0) return null;

  return (
    <div className="flex flex-row gap-2 overflow-x-auto pb-2">
      {thumbs.map((t, i) => {
        const isHighlight = highlightIndex === i;
        return (
          <button
            type="button"
            key={i}
            onClick={() => onClickPage?.(i)}
            className={`
              relative shrink-0 h-24 w-20 rounded-md border overflow-hidden bg-muted/30 transition-all duration-200
              ${isHighlight
                ? "border-red-500 ring-2 ring-red-500/30 animate-pulse"
                : "border-border/40 hover:border-emerald-500/60"
              }
              ${onClickPage ? "cursor-pointer" : "cursor-default"}
            `}
            title={t.label}
          >
            {t.isImage && t.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.url} alt={t.label} className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground">
                <FileText className="h-6 w-6" />
                <span className="text-[9px] uppercase tracking-wide">PDF</span>
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[9px] font-mono bg-black/50 text-white text-center">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
