/**
 * Google Ads / gtag ヘルパー
 *
 * ベースの Google tag は app/layout.tsx で `NEXT_PUBLIC_GOOGLE_ADS_ID` が
 * 設定されている場合にのみ読み込まれる。ここでは purchase conversion 発火を
 * 提供する: サーバ検証済みの購入データを受け取って gtag('event', 'conversion', ...) を
 * 一度だけ呼ぶ。
 */

// gtag 関数の型。window.gtag は layout.tsx のインラインスクリプトで定義される。
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

// 二重発火防止キーの接頭辞。localStorage に transaction_id 単位で残す。
const CONV_SENT_PREFIX = "gads-purchase-conv:";      // Google Ads direct conversion 用 (現在未使用)
const GA4_PURCHASE_SENT_PREFIX = "ga4-purchase:";    // GA4 purchase event 用

// 同一レンダープロセスでの二重発火防止 (localStorage 書き込み前の連続発火対策)
const inFlight = new Set<string>();
const ga4InFlight = new Set<string>();

export interface PurchaseConversionPayload {
  /** 注文単位で一意な ID。可能なら自前 order ID、なければ Stripe session ID。 */
  transactionId: string;
  /** 実売上 (Stripe の amount_total を 10 進に変換した値)。 */
  value: number;
  /** ISO 4217 (例: "JPY")。 */
  currency: string;
}

/**
 * Google Ads Purchase conversion を一度だけ発火する。
 *
 * 二重発火防止:
 *  1. localStorage に `gads-purchase-conv:<transactionId>` が残っていればスキップ
 *  2. 同セッション内の同時呼び出しも in-memory Set でガード
 *  3. gtag 未定義 / 環境変数未設定 / transactionId 空 ならサイレントに no-op
 *
 * 返り値: 実際に発火したら true、スキップ/失敗は false。
 */
export function sendPurchaseConversion(payload: PurchaseConversionPayload): boolean {
  if (typeof window === "undefined") return false;

  const sendTo = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO;
  if (!sendTo) {
    // 購入専用の send_to (AW-XXXX/YYYY 形式) が未設定なら何もしない。
    return false;
  }

  const { transactionId, value, currency } = payload;
  if (!transactionId || !currency) return false;

  const gtag = window.gtag;
  if (typeof gtag !== "function") {
    // ベースの Google tag (NEXT_PUBLIC_GOOGLE_ADS_ID) が読み込まれていない環境。
    return false;
  }

  const dedupeKey = CONV_SENT_PREFIX + transactionId;

  // すでに送信済み (別タブ / 前回の訪問) ならスキップ。
  try {
    if (window.localStorage.getItem(dedupeKey)) return false;
  } catch {
    // localStorage 無効環境: in-memory ガードのみで続行。
  }

  if (inFlight.has(transactionId)) return false;
  inFlight.add(transactionId);

  try {
    gtag("event", "conversion", {
      send_to: sendTo,
      value,
      currency,
      transaction_id: transactionId,
    });
    try {
      window.localStorage.setItem(dedupeKey, String(Date.now()));
    } catch {
      // 書き込み失敗は致命ではない (in-memory で当セッションはガード済)。
    }
    return true;
  } catch {
    inFlight.delete(transactionId);
    return false;
  }
}


// ─── GA4 purchase event ──────────────────────────────────────────────────────
// Google Ads へは GA4 のコンバージョンインポート経由で連携する想定。
// 仕様: https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase

/** GA4 purchase event の items エントリ。最低 item_id があれば OK。 */
export interface GA4Item {
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
  item_category?: string;
  item_brand?: string;
  affiliation?: string;
}

export interface GA4PurchasePayload {
  /** 注文単位で一意な ID。自前 order ID 優先、なければ Stripe Checkout Session ID。 */
  transactionId: string;
  /** 税込の実売上 (10 進)。 */
  value: number;
  /** ISO 4217 通貨コード (例: "JPY")。 */
  currency: string;
  /** 購入アイテム。最低 1 件必須 (GA4 は items が空だと purchase を解釈しない)。 */
  items: GA4Item[];
  /** 任意: クーポン、輸送費、税額など。 */
  coupon?: string;
  tax?: number;
  shipping?: number;
  /** GA4 DebugView に流す場合は true。未指定時は transaction_id に "test" が
   *  含まれるなら自動で true に昇格する。 */
  debug?: boolean;
}

/** gtag が使える状態になるまで短時間だけ待つ (external gtag script が
 *  afterInteractive で遅延ロードされる間に呼ばれてしまうケースを吸収)。 */
async function waitForGtag(timeoutMs = 3000): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof window.gtag === "function") return true;
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (typeof window.gtag === "function") return resolve(true);
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

/**
 * GA4 の `purchase` イベントを一度だけ送信する。
 *
 * 二重発火防止:
 *  1. `ga4-purchase:<transaction_id>` が localStorage にあればスキップ
 *  2. 同一ランタイム中の重複呼び出しも in-memory Set でガード
 *  3. gtag は最大 3 秒待ってから、それでも未ロードなら諦める
 *  4. transactionId・currency 空 / items 空 なら no-op
 *
 * 返り値: 実際に発火したら true、スキップ/失敗は false。
 */
export async function sendPurchaseEvent(payload: GA4PurchasePayload): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const { transactionId, value, currency, items, coupon, tax, shipping } = payload;

  // 入力検査 — ログを出して原因を切り分けやすくする
  if (!transactionId) {
    console.warn("[sendPurchaseEvent] abort: transactionId is empty");
    return false;
  }
  if (!currency) {
    console.warn("[sendPurchaseEvent] abort: currency is empty", { transactionId });
    return false;
  }
  if (!items || items.length === 0) {
    console.warn("[sendPurchaseEvent] abort: items is empty", { transactionId });
    return false;
  }

  const ready = await waitForGtag(3000);
  if (!ready) {
    console.warn(
      "[sendPurchaseEvent] abort: window.gtag is not available after 3s. " +
      "Check NEXT_PUBLIC_GA4_ID and ad-blockers.",
    );
    return false;
  }
  const gtag = window.gtag as GtagFn;

  const dedupeKey = GA4_PURCHASE_SENT_PREFIX + transactionId;

  try {
    if (window.localStorage.getItem(dedupeKey)) {
      console.info("[sendPurchaseEvent] skip: already sent for", transactionId);
      return false;
    }
  } catch {
    // localStorage 無効環境: in-memory ガードのみで続行。
  }

  if (ga4InFlight.has(transactionId)) return false;
  ga4InFlight.add(transactionId);

  // debug_mode: GA4 DebugView は `debug_mode: true` が付いた event のみ表示する。
  // Stripe test session (cs_test_...) の場合は自動で debug に昇格。
  const debug = payload.debug === true || transactionId.startsWith("cs_test_");

  try {
    const eventParams = {
      transaction_id: transactionId,
      value,
      currency,
      items,
      ...(coupon !== undefined ? { coupon } : {}),
      ...(tax !== undefined ? { tax } : {}),
      ...(shipping !== undefined ? { shipping } : {}),
      ...(debug ? { debug_mode: true } : {}),
    };
    console.info("[sendPurchaseEvent] gtag('event', 'purchase', ...)", eventParams);
    gtag("event", "purchase", eventParams);
    try {
      window.localStorage.setItem(dedupeKey, String(Date.now()));
    } catch {
      // 書き込み失敗は致命ではない。
    }
    return true;
  } catch (e) {
    console.error("[sendPurchaseEvent] gtag call threw", e);
    ga4InFlight.delete(transactionId);
    return false;
  }
}


// ─── GA4 「ログインなし無料お試し生成」イベント ────────────────────────────
// 広告流入ユーザーが登録前で離脱している仮説の検証用。
// start / complete / error / limit_reached の 4 段ファネルで CVR を測る。

/** 無料お試し生成 GA4 イベントの共通パラメータ。 */
export interface FreeGenerateEventParams {
  /** 製品名 (将来別ツール展開時の識別用)。固定で "eddivom"。 */
  tool_name?: string;
  /** 生成成果物の種別。"worksheet" 等。 */
  content_type?: string;
  /** 流入元のラベル。匿名お試しは "anonymous_trial"。 */
  source?: string;
  /** 認証状態。匿名は "anonymous"、ログイン済は "authenticated"。 */
  auth_state?: "anonymous" | "authenticated";
  /** 任意: GA4 の dimensions に流したい追加情報。 */
  [key: string]: unknown;
}

const DEFAULT_FREE_GENERATE_PARAMS: FreeGenerateEventParams = {
  tool_name: "eddivom",
  content_type: "worksheet",
  source: "anonymous_trial",
  auth_state: "anonymous",
};

/** 内部ヘルパー: gtag が無い環境でも安全に no-op で返す。 */
function fireGa4Event(name: string, params: Record<string, unknown>): boolean {
  if (typeof window === "undefined") return false;
  const gtag = window.gtag;
  if (typeof gtag !== "function") {
    // gtag 未ロード (NEXT_PUBLIC_GA4_ID 未設定 / 広告ブロック) — UI を阻害したくないので静かに失敗
    return false;
  }
  try {
    gtag("event", name, params);
    return true;
  } catch (e) {
    console.warn(`[ga4] event '${name}' failed`, e);
    return false;
  }
}

/** お試し生成を「開始した」瞬間に呼ぶ (送信ボタン押下直後)。 */
export function trackFreeGenerateStart(extra?: FreeGenerateEventParams): boolean {
  return fireGa4Event("free_generate_start", { ...DEFAULT_FREE_GENERATE_PARAMS, ...extra });
}

/** 生成 API が成功し、結果を表示できる状態になった瞬間に呼ぶ。 */
export function trackFreeGenerateComplete(extra?: FreeGenerateEventParams & {
  /** 任意: 生成にかかった時間 (ms)。GA4 で平均生成時間を見る用。 */
  duration_ms?: number;
}): boolean {
  return fireGa4Event("free_generate_complete", { ...DEFAULT_FREE_GENERATE_PARAMS, ...extra });
}

/** 生成 API が失敗したときに呼ぶ。reason は "timeout" / "5xx" / "validation" 等の短いラベル。 */
export function trackFreeGenerateError(extra?: FreeGenerateEventParams & {
  /** 失敗種別の短いラベル。GA4 で原因別に分けるためのカスタム dimension。 */
  reason?: string;
  /** HTTP ステータス (取得できれば)。 */
  status?: number;
}): boolean {
  return fireGa4Event("free_generate_error", { ...DEFAULT_FREE_GENERATE_PARAMS, ...extra });
}

/** 未ログインお試しの試行回数上限に達したときに呼ぶ (CTA で弾いた瞬間)。 */
export function trackFreeGenerateLimitReached(extra?: FreeGenerateEventParams): boolean {
  return fireGa4Event("free_generate_limit_reached", { ...DEFAULT_FREE_GENERATE_PARAMS, ...extra });
}
