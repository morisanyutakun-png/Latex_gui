import { DocumentModel } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function generatePDF(doc: DocumentModel): Promise<Blob> {
  // Pre-flight health check
  const healthy = await healthCheck();
  if (!healthy) {
    throw new Error(
      "PDF生成サーバーに接続できません。\n" +
      "バックエンドを起動してください：\n" +
      "cd backend && python3 -m uvicorn app.main:app --port 8000"
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });
  } catch (networkErr) {
    throw new Error(
      "PDF生成サーバーへのリクエストに失敗しました。\n" +
      "ネットワーク接続を確認してください。"
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const detail = err?.detail;
    const message = typeof detail === "string"
      ? detail
      : detail?.message || `PDF生成に失敗しました (HTTP ${res.status})`;
    throw new Error(message);
  }
  return res.blob();
}

export async function previewLatex(doc: DocumentModel): Promise<string> {
  const res = await fetch(`${API_BASE}/api/preview-latex`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    throw new Error("LaTeXプレビューの取得に失敗しました");
  }
  const data = await res.json();
  return data.latex;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
