/**
 * APIクライアント（将来モバイルからも再利用可能）
 */
import { DocumentModel } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    public userMessage: string,
    public detail?: string,
  ) {
    super(userMessage);
    this.name = "ApiError";
  }
}

export async function generatePDF(doc: DocumentModel): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });

  if (!res.ok) {
    let msg = "PDFの作成中にエラーが発生しました。";
    try {
      const err = await res.json();
      msg = err.detail?.message || err.message || msg;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, msg);
  }

  return res.blob();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export { ApiError };
