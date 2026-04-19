import { DocumentModel } from "./types";

const STORAGE_KEY = "latex-gui-document";
// 別タブが同じドキュメントを上書きしたことを検知するためのタイムスタンプ。
// StorageEvent で別タブの保存が観測できるよう、別キーで書き出す。
export const STORAGE_TS_KEY = "latex-gui-document-ts";
// このタブを一意に識別する ID。自タブが書いた storage event を無視するのに使う。
export const TAB_ID = (typeof crypto !== "undefined" && "randomUUID" in crypto)
  ? crypto.randomUUID()
  : String(Math.random()).slice(2);
export const STORAGE_TAB_KEY = "latex-gui-document-tab";

export function saveToLocalStorage(doc: DocumentModel): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    localStorage.setItem(STORAGE_TAB_KEY, TAB_ID);
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
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
