"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore, PaperSize } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

export function StatusBar() {
  const { locale } = useI18n();
  const isJa = locale !== "en";
  const latex = useDocumentStore((s) => s.document?.latex ?? "");
  const template = useDocumentStore((s) => s.document?.template ?? "blank");
  const { paperSize, setPaperSize } = useUIStore();

  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const paperMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paperMenuRef.current && !paperMenuRef.current.contains(e.target as Node)) setShowPaperMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentPaperLabel = PAPER_OPTIONS.find((p) => p.value === paperSize)?.label ?? "A4";
  const lineCount = latex.split("\n").length;

  return (
    <div className="status-bar-accent editor-statusbar flex items-center justify-between h-[22px] px-2 shrink-0 select-none text-foreground/50">
      <div className="flex items-center gap-0 text-[11px] font-mono">
        <span className="px-1.5 h-full flex items-center text-primary-foreground/90 bg-primary/80 text-[10px] font-semibold tracking-wide">
          {latex.length.toLocaleString()} {isJa ? "文字" : "chars"}
        </span>
        <span className="breadcrumb-sep">·</span>
        <span className="px-1.5 text-foreground/40">
          {lineCount} {isJa ? "行" : "lines"}
        </span>
        <span className="breadcrumb-sep">·</span>
        <span className="px-1.5 text-foreground/40">
          {template}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={paperMenuRef}>
          <button
            onClick={() => setShowPaperMenu(!showPaperMenu)}
            className="flex items-center gap-1 px-2 h-5 rounded text-[11px] font-mono text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors"
          >
            {currentPaperLabel}
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {showPaperMenu && (
            <div className="absolute bottom-full right-0 mb-1 py-1 rounded-lg border border-border/40 bg-popover shadow-lg shadow-black/20 min-w-[100px] animate-scale-in z-50">
              {PAPER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setPaperSize(opt.value); setShowPaperMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                    paperSize === opt.value
                      ? "text-primary bg-primary/10 font-semibold"
                      : "text-foreground/60 hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
