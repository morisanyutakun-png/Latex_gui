/**
 * Pro+ 限定機能「類題自動生成 / プロンプト強化 (variantGen)」の
 * Free ユーザ向け 1 回お試しゲート。
 *
 * 仕様:
 *   - Free プラン (および未ログインゲスト) は 1 回だけ無料で試せる。
 *   - フラグはブラウザの localStorage に保持する。
 *   - DevTools で消せば再試行できる寛容運用 (CVR > 不正対策)。
 *     anonymous-trial.ts と同じ思想で揃える。
 *   - サーバ側でのプラン強制は別途必要 (将来やる)。クライアントゲートは UX 用。
 */

const TRIAL_USED_KEY = "eddivom:variant-trial:used";
const TRIAL_LAST_AT_KEY = "eddivom:variant-trial:last_at";

/** 既にお試しを使い切ったか。SSR 中は常に false。 */
export function hasUsedVariantTrial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TRIAL_USED_KEY) === "1";
  } catch {
    return false;
  }
}

/** お試しを 1 回消費したことを記録する。Free ユーザが variantGen を実際に発火した直後に呼ぶ。 */
export function markVariantTrialUsed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRIAL_USED_KEY, "1");
    window.localStorage.setItem(TRIAL_LAST_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** 開発時/QA 用: ローカルでお試しフラグを消す。本番 UI からは呼ばない。 */
export function resetVariantTrialForDev(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TRIAL_USED_KEY);
    window.localStorage.removeItem(TRIAL_LAST_AT_KEY);
  } catch {
    /* ignore */
  }
}
