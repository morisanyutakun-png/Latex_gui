/**
 * 「ログインなし無料お試し生成」のクライアント側ゲート。
 *
 * 仕様:
 *   - 未ログインユーザーは原則 1 回だけ AI 生成を試せる。
 *   - フラグはブラウザの localStorage に保持する。 cookie はサーバ側 (Next.js API
 *     route) で別途付与し、サーバ rate limit と二重に絞る。
 *   - 厳密な不正対策ではなく CVR 検証を優先 (DevTools で localStorage を消せば
 *     再試行できる ─ ここはあえて寛容にしている)。
 *
 * このモジュールは UI レイヤーから直接呼ばれる。GA4 (`free_generate_*`) と
 * トラッキングする側はそちらで分離する。
 */

const TRIAL_USED_KEY = "anonymous-trial:used";
const TRIAL_LAST_AT_KEY = "anonymous-trial:last_at";

/** 未ログインお試しが既に消費済みかどうか。SSR 中は常に false。 */
export function hasUsedAnonymousTrial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TRIAL_USED_KEY) === "1";
  } catch {
    // localStorage 無効環境 (Safari プライベート等) では「未使用」扱いにする
    // ─ 1 回だけ通せれば十分なので、誤判定で UI を完全に塞ぐより寛容に倒す。
    return false;
  }
}

/** お試しを 1 回消費したことを記録する。生成 API 成功時に呼ぶ。 */
export function markAnonymousTrialUsed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRIAL_USED_KEY, "1");
    window.localStorage.setItem(TRIAL_LAST_AT_KEY, String(Date.now()));
  } catch {
    /* localStorage 書き込み失敗はサイレントで許容 (UX を壊さない) */
  }
}

/** 開発時/QA 用: ローカルでお試しフラグを消す。本番 UI からは呼ばない。 */
export function resetAnonymousTrialForDev(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TRIAL_USED_KEY);
    window.localStorage.removeItem(TRIAL_LAST_AT_KEY);
  } catch {
    /* ignore */
  }
}
