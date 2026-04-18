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
}

/**
 * GA4 の `purchase` イベントを一度だけ送信する。
 *
 * 二重発火防止:
 *  1. `ga4-purchase:<transaction_id>` が localStorage にあればスキップ
 *  2. 同一ランタイム中の重複呼び出しも in-memory Set でガード
 *  3. gtag 未定義 / transactionId・currency 空 / items 空 なら no-op
 *
 * 返り値: 実際に発火したら true、スキップ/失敗は false。
 */
export function sendPurchaseEvent(payload: GA4PurchasePayload): boolean {
  if (typeof window === "undefined") return false;

  const { transactionId, value, currency, items, coupon, tax, shipping } = payload;
  if (!transactionId || !currency || !items || items.length === 0) return false;

  const gtag = window.gtag;
  if (typeof gtag !== "function") {
    // ベースの GA4 tag (NEXT_PUBLIC_GA4_ID) が読み込まれていない環境。
    return false;
  }

  const dedupeKey = GA4_PURCHASE_SENT_PREFIX + transactionId;

  try {
    if (window.localStorage.getItem(dedupeKey)) return false;
  } catch {
    // localStorage 無効環境: in-memory ガードのみで続行。
  }

  if (ga4InFlight.has(transactionId)) return false;
  ga4InFlight.add(transactionId);

  try {
    gtag("event", "purchase", {
      transaction_id: transactionId,
      value,
      currency,
      items,
      ...(coupon !== undefined ? { coupon } : {}),
      ...(tax !== undefined ? { tax } : {}),
      ...(shipping !== undefined ? { shipping } : {}),
    });
    try {
      window.localStorage.setItem(dedupeKey, String(Date.now()));
    } catch {
      // 書き込み失敗は致命ではない。
    }
    return true;
  } catch {
    ga4InFlight.delete(transactionId);
    return false;
  }
}
