"use client";

import { useI18n, Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const LANGS: { value: Locale; label: string; flag: string }[] = [
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "en", label: "English", flag: "🇺🇸" },
];

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "ghost" }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click/touch
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
          variant === "ghost"
            ? "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/30 hover:border-border/60"
        }`}
        title="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wide">{locale}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-background border border-border/40 rounded-xl shadow-xl py-1 z-50 min-w-[130px]">
          {LANGS.map((l) => (
            <button
              key={l.value}
              onClick={() => { setLocale(l.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-muted/50 transition-colors ${
                locale === l.value ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {locale === l.value && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
