import { DocumentModel } from "./types";

const STORAGE_KEY = "latex-gui-document";

export function saveToLocalStorage(doc: DocumentModel): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch { /* storage full */ }
}

export function loadFromLocalStorage(): DocumentModel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Reject legacy block-based documents — they cannot be migrated.
    if (!data || typeof data !== "object" || typeof data.latex !== "string") {
      return null;
    }
    return data as DocumentModel;
  } catch {
    return null;
  }
}

export function downloadAsJSON(doc: DocumentModel, filename: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(window.document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export async function loadFromJSONFile(file: File): Promise<DocumentModel> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (
    !data ||
    typeof data !== "object" ||
    typeof data.latex !== "string" ||
    typeof data.settings !== "object" ||
    typeof data.metadata !== "object"
  ) {
    throw new Error("無効なドキュメント形式です（latex フィールドが必要）");
  }
  return data as DocumentModel;
}
