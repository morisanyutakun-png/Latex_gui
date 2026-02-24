"use client";

import { useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { downloadAsJSON } from "@/lib/storage";
import { generatePDF } from "@/lib/api";
import { toast } from "sonner";

export function useKeyboardShortcuts() {
  const store = useDocumentStore;
  const uiStore = useUIStore;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const { document, undo, redo, deleteBlock, duplicateBlock } = store.getState();
      const { selectedBlockId, setGenerating } = uiStore.getState();

      // Undo: Ctrl/Cmd + Z
      if (meta && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((meta && e.shiftKey && e.key === "z") || (meta && e.key === "y")) {
        e.preventDefault();
        redo();
        return;
      }
      // Save: Ctrl/Cmd + S
      if (meta && e.key === "s") {
        e.preventDefault();
        if (document) {
          downloadAsJSON(document, `${document.metadata.title || "document"}.json`);
          toast.success("JSONを保存しました");
        }
        return;
      }
      // Generate PDF: Ctrl/Cmd + P
      if (meta && e.key === "p") {
        e.preventDefault();
        if (document && !uiStore.getState().isGenerating) {
          setGenerating(true);
          generatePDF(document)
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = Object.assign(window.document.createElement("a"), {
                href: url,
                download: `${document.metadata.title || "document"}.pdf`,
              });
              a.click();
              URL.revokeObjectURL(url);
              toast.success("PDFを生成しました");
            })
            .catch((err: Error) => toast.error(err.message))
            .finally(() => setGenerating(false));
        }
        return;
      }
      // Delete selected block: Delete / Backspace (when not editing)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockId && !uiStore.getState().editingBlockId) {
        e.preventDefault();
        deleteBlock(selectedBlockId);
        uiStore.getState().selectBlock(null);
        return;
      }
      // Duplicate: Ctrl/Cmd + D
      if (meta && e.key === "d" && selectedBlockId) {
        e.preventDefault();
        duplicateBlock(selectedBlockId);
        return;
      }
      // Escape: deselect
      if (e.key === "Escape") {
        uiStore.getState().selectBlock(null);
        uiStore.getState().setEditingBlock(null);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, uiStore]);
}
