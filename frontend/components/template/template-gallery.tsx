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
} from "lucide-react";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  blank: <File className="h-8 w-8" />,
  report: <FileText className="h-8 w-8" />,
  announcement: <Megaphone className="h-8 w-8" />,
  worksheet: <BookOpen className="h-8 w-8" />,
};

const TEMPLATE_COLORS: Record<string, string> = {
  blank: "from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700",
  report: "from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900",
  announcement: "from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900",
  worksheet: "from-emerald-50 to-teal-100 dark:from-emerald-950 dark:to-teal-900",
};

const TEMPLATE_ICON_COLORS: Record<string, string> = {
  blank: "text-zinc-400 dark:text-zinc-500",
  report: "text-blue-500 dark:text-blue-400",
  announcement: "text-amber-500 dark:text-amber-400",
  worksheet: "text-emerald-500 dark:text-emerald-400",
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            PDF<span className="text-primary"> Studio</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            テンプレートを選んで、自由にデザインしましょう
          </p>
        </div>

        {/* Resume button */}
        {savedDoc && (
          <div className="mb-6">
            <button
              onClick={handleResume}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30
                         bg-primary/5 p-3 text-sm font-medium text-primary
                         transition-all duration-200 hover:bg-primary/10 hover:shadow-md
                         focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <RotateCcw className="h-4 w-4" />
              前回の続きから再開：{savedDoc.metadata.title || "無題のドキュメント"}
            </button>
          </div>
        )}

        {/* Template cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleSelect(tmpl.id)}
              className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-5
                         transition-all duration-200
                         hover:shadow-lg hover:border-primary/30 hover:-translate-y-1
                         focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {/* Preview */}
              <div
                className={`flex h-24 w-full items-center justify-center rounded-lg bg-gradient-to-br ${TEMPLATE_COLORS[tmpl.id]}
                            transition-transform group-hover:scale-105`}
              >
                <div className={TEMPLATE_ICON_COLORS[tmpl.id]}>
                  {TEMPLATE_ICONS[tmpl.id]}
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold">{tmpl.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {tmpl.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
