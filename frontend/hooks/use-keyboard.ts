"use client";

import { useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { downloadAsJSON } from "@/lib/storage";
import { generatePDF } from "@/lib/api";
import { toast } from "sonner";

export function useKeyboardShortcuts() {
  const store = useDocumentStore;
  const uiStore = useUIStore;
  const { t } = useI18n();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const { document, undo, redo } = store.getState();

      // Undo: Ctrl/Cmd + Z
      if (meta && !e.shiftKey && e.key === "z") {
        // Don't intercept inside textarea/input — those have their own undo
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
        e.preventDefault();
        undo();
        return;
      }
      if ((meta && e.shiftKey && e.key === "z") || (meta && e.key === "y")) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
        e.preventDefault();
        redo();
        return;
      }

      // Save JSON: Ctrl/Cmd + S
      if (meta && e.key === "s") {
        e.preventDefault();
        if (document) {
          downloadAsJSON(document, `${document.metadata.title || "document"}.json`);
          toast.success(t("toast.saved"));
        }
        return;
      }

      // Generate PDF: Ctrl/Cmd + P
      if (meta && e.key === "p") {
        e.preventDefault();
        if (document && !uiStore.getState().isGenerating) {
          uiStore.getState().setGenerating(true);
          generatePDF(document)
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = Object.assign(window.document.createElement("a"), {
                href: url,
                download: `${document.metadata.title || "document"}.pdf`,
              });
              a.click();
              URL.revokeObjectURL(url);
              toast.success(t("toast.pdf.done"));
            })
            .catch((err: Error) => toast.error(err.message))
            .finally(() => uiStore.getState().setGenerating(false));
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, uiStore, t]);
}
