/**
 * localStorage へのJSON保存・読込
 */
import { DocumentModel } from "./types";

const STORAGE_KEY = "latex_gui_document";
const AUTOSAVE_KEY = "latex_gui_autosave";

export function saveToLocalStorage(doc: DocumentModel): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc));
  } catch {
    // storage full or unavailable
  }
}

export function loadFromLocalStorage(): DocumentModel | null {
  try {
    const data = localStorage.getItem(AUTOSAVE_KEY);
    if (!data) return null;
    return JSON.parse(data) as DocumentModel;
  } catch {
    return null;
  }
}

export function downloadAsJSON(doc: DocumentModel, filename?: string): void {
  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${doc.metadata.title || "document"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadFromJSONFile(file: File): Promise<DocumentModel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const doc = JSON.parse(reader.result as string) as DocumentModel;
        if (!doc.template || !doc.metadata || !doc.blocks) {
          reject(new Error("ファイルの形式が正しくありません。"));
          return;
        }
        resolve(doc);
      } catch {
        reject(new Error("ファイルの読み込みに失敗しました。正しいJSONファイルか確認してください。"));
      }
    };
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました。"));
    reader.readAsText(file);
  });
}
