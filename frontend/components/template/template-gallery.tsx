"use client";

import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { loadFromLocalStorage } from "@/lib/storage";
import { TEMPLATES, TemplateType } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  FileText,
  Megaphone,
  BookOpen,
  File,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  blank: <File className="h-7 w-7" />,
  report: <FileText className="h-7 w-7" />,
  announcement: <Megaphone className="h-7 w-7" />,
  worksheet: <BookOpen className="h-7 w-7" />,
};

const TEMPLATE_GRADIENTS: Record<string, string> = {
  blank: "from-slate-50 via-gray-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900",
  report: "from-indigo-50 via-blue-50 to-violet-50 dark:from-indigo-950 dark:via-blue-950 dark:to-violet-950",
  announcement: "from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950 dark:via-orange-950 dark:to-yellow-950",
  worksheet: "from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950",
};

const TEMPLATE_ICON_COLORS: Record<string, string> = {
  blank: "text-zinc-400 dark:text-zinc-500",
  report: "text-indigo-500 dark:text-indigo-400",
  announcement: "text-amber-500 dark:text-amber-400",
  worksheet: "text-emerald-500 dark:text-emerald-400",
};

const TEMPLATE_ACCENTS: Record<string, string> = {
  blank: "group-hover:border-zinc-300 dark:group-hover:border-zinc-600",
  report: "group-hover:border-indigo-300 dark:group-hover:border-indigo-700",
  announcement: "group-hover:border-amber-300 dark:group-hover:border-amber-700",
  worksheet: "group-hover:border-emerald-300 dark:group-hover:border-emerald-700",
};

export function TemplateGallery() {
  const router = useRouter();
  const { newDocument, setDocument } = useDocumentStore();

  const savedDoc = typeof window !== "undefined" ? loadFromLocalStorage() : null;

  const handleSelect = (template: TemplateType) => {
    newDocument(template);
    router.push("/editor");
  };

  const handleResume = () => {
    if (savedDoc) {
      setDocument(savedDoc);
      router.push("/editor");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-mesh px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl relative z-10 animate-fade-in">
        {/* Logo & Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 mb-5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary tracking-wide">CANVAS EDITOR</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            PDF<span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"> Studio</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
            テンプレートを選んで、自由にデザインしましょう
          </p>
        </div>

        {/* Resume button */}
        {savedDoc && (
          <div className="mb-8 animate-scale-in">
            <button
              onClick={handleResume}
              className="w-full flex items-center justify-between rounded-xl border border-primary/20
                         bg-primary/5 px-5 py-3.5 text-sm font-medium text-primary
                         transition-all duration-300 hover:bg-primary/10 hover:border-primary/30
                         hover:shadow-lg hover:shadow-primary/5
                         focus:outline-none focus:ring-2 focus:ring-primary/50
                         group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">前回の続きから再開</div>
                  <div className="text-xs text-primary/60 mt-0.5">
                    {savedDoc.metadata.title || "無題のドキュメント"}
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* Section label */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            新規作成
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TEMPLATES.map((tmpl, i) => (
            <button
              key={tmpl.id}
              onClick={() => handleSelect(tmpl.id)}
              className={`group relative flex flex-col items-center gap-3.5 rounded-2xl border
                         bg-card/80 p-5 transition-all duration-300
                         hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1.5
                         dark:hover:shadow-black/20
                         focus:outline-none focus:ring-2 focus:ring-primary/50
                         ${TEMPLATE_ACCENTS[tmpl.id]}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Preview card */}
              <div
                className={`flex h-28 w-full items-center justify-center rounded-xl
                            bg-gradient-to-br ${TEMPLATE_GRADIENTS[tmpl.id]}
                            transition-all duration-300 group-hover:scale-[1.03]
                            ring-1 ring-black/[0.04] dark:ring-white/[0.04]`}
              >
                <div className={`${TEMPLATE_ICON_COLORS[tmpl.id]} transition-transform duration-300 group-hover:scale-110`}>
                  {TEMPLATE_ICONS[tmpl.id]}
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold tracking-tight">{tmpl.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {tmpl.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-center text-[11px] text-muted-foreground/60 mt-10">
          ⌘+S で保存 ・ ⌘+P で PDF 生成 ・ ⌘+Z で元に戻す
        </p>
      </div>
    </div>
  );
}
