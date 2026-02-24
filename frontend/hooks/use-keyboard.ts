"use client";

import { useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { generatePDF } from "@/lib/api";
import { downloadAsJSON } from "@/lib/storage";
import { toast } from "sonner";

/**
 * エディタ用キーボードショートカット
 * Delete / Backspace: 選択要素を削除
 * Ctrl/Cmd + Z: 元に戻す
 * Ctrl/Cmd + Shift + Z / Ctrl/Cmd + Y: やり直す
 * Ctrl/Cmd + D: 選択要素を複製
 * Ctrl/Cmd + S: JSONを保存
 * Escape: 選択解除
 */
export function useKeyboardShortcuts() {
  const deleteElement = useDocumentStore((s) => s.deleteElement);
  const duplicateElement = useDocumentStore((s) => s.duplicateElement);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const document = useDocumentStore((s) => s.document);

  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const editingElementId = useUIStore((s) => s.editingElementId);
  const currentPageIndex = useUIStore((s) => s.currentPageIndex);
  const selectElement = useUIStore((s) => s.selectElement);
  const setGenerating = useUIStore((s) => s.setGenerating);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // テキスト入力中は Delete / Backspace を無視
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        if (selectedElementId && !editingElementId) {
          e.preventDefault();
          deleteElement(currentPageIndex, selectedElementId);
          selectElement(null);
        }
        return;
      }

      // Ctrl/Cmd + Z → undo, +Shift → redo
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd + D → 複製
      if (mod && e.key === "d") {
        if (selectedElementId && !isInput) {
          e.preventDefault();
          duplicateElement(currentPageIndex, selectedElementId);
        }
        return;
      }

      // Ctrl/Cmd + S → JSON保存
      if (mod && e.key === "s") {
        e.preventDefault();
        if (document) {
          downloadAsJSON(document, `${document.metadata.title || "document"}.json`);
          toast.success("JSONを保存しました");
        }
        return;
      }

      // Ctrl/Cmd + P → PDF生成
      if (mod && e.key === "p") {
        e.preventDefault();
        if (document) {
          setGenerating(true);
          generatePDF(document)
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              Object.assign(window.document.createElement("a"), {
                href: url,
                download: `${document.metadata.title || "document"}.pdf`,
              }).click();
              URL.revokeObjectURL(url);
              toast.success("PDF を生成しました");
            })
            .catch((err: unknown) => {
              toast.error(
                err instanceof Error ? err.message : "PDF生成に失敗しました",
              );
            })
            .finally(() => setGenerating(false));
        }
        return;
      }

      // Escape → 選択解除
      if (e.key === "Escape") {
        selectElement(null);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedElementId,
    editingElementId,
    currentPageIndex,
    document,
    deleteElement,
    duplicateElement,
    undo,
    redo,
    selectElement,
    setGenerating,
  ]);
}
