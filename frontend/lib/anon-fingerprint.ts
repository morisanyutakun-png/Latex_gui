/**
 * 匿名トライアルの追加識別: ブラウザ指紋。
 *
 * 目的:
 *   - localStorage / cookie だけだと、シークレットウィンドウで両方クリアされて
 *     1 ブラウザから無限に「無料お試し」を踏める。
 *   - とはいえ完全な不正対策はやり過ぎ — 1 回目の正規ユーザーは必ず通したい。
 *   - **同一デバイス上の通常ウィンドウとシークレットウィンドウで一致する程度**
 *     の半安定な指紋を作り、サーバ側の TTL カウンタでゲートする。
 *
 * 採用シグナル (どれもプライベートモードで保たれる傾向が強い):
 *   - User-Agent
 *   - 画面解像度 (screen.width × height) と colorDepth
 *   - タイムゾーン (Intl.DateTimeFormat().resolvedOptions().timeZone)
 *   - 言語 (navigator.language)
 *   - hardwareConcurrency (CPU 数)
 *   - canvas データ URL の先頭 64 文字 (フォントレンダリング差異)
 *
 * 不採用:
 *   - WebGL renderer はクロスサイト指紋として悪用されるため避ける
 *   - localStorage / cookie 由来の値はここでは混ぜない (循環防止)
 *
 * 出力: 16進 32桁の SHA-256 (前半切詰)。サーバはこの hex 値で TTL カウンタを引く。
 */

const FP_CACHE_KEY = "eddivom-anon-fp-v1";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // crypto.subtle が無い古い環境向けの fallback (FNV-1a 32bit を 8 倍折り返し)。
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(8);
}

function canvasSignature(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 50;
    const ctx = c.getContext("2d");
    if (!ctx) return "no-ctx";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("Eddivom ✨仮類", 2, 2);
    ctx.strokeStyle = "rgba(102,204,0,0.7)";
    ctx.beginPath();
    ctx.arc(100, 25, 10, 0, Math.PI * 2);
    ctx.stroke();
    const url = c.toDataURL();
    return url.slice(0, 80);
  } catch {
    return "canvas-blocked";
  }
}

/**
 * 指紋を 1 セッション内ではキャッシュして返す。プライベート/通常で値が一致する
 * ように、ストレージへの永続化はしない (sessionStorage のみ — 現セッション内の
 * 高速化用途)。
 */
export async function getAnonymousFingerprint(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.sessionStorage.getItem(FP_CACHE_KEY);
    if (cached && /^[0-9a-f]{16,64}$/.test(cached)) return cached;
  } catch {
    /* sessionStorage が使えない環境 — 都度計算する */
  }

  const parts: string[] = [];
  try {
    parts.push(navigator.userAgent || "");
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    parts.push(navigator.language || "");
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(canvasSignature());
  } catch {
    /* 取れないシグナルはスキップ — 残ったぶんだけで指紋化 */
  }

  const hex = await sha256Hex(parts.join("|"));
  const fp = hex.slice(0, 32); // 32 桁あれば衝突ほぼなし
  try {
    window.sessionStorage.setItem(FP_CACHE_KEY, fp);
  } catch {
    /* ignore */
  }
  return fp;
}
