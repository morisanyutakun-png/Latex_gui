/**
 * サポートお問い合わせ先の中央定数。
 *
 * 法務ページ (contact / commerce / privacy / terms / refunds) から参照する
 * 単一の Source of Truth。差し替えたいときはこのファイル 1 箇所を変えれば
 * 全ページに反映される。
 *
 * 現状: 独自ドメイン `eddivom.yuta-eng.com` 宛メールの受信環境 (MX / 転送)
 * を契約していないので、運営者の Gmail を直接表示している。
 *
 * 独自ドメインメール (例: Cloudflare Email Routing / ImprovMX 等) を
 * セットアップした後は、`SUPPORT_EMAIL` を `support@eddivom.yuta-eng.com`
 * に戻せば良い。UI 側は何も触らなくて済む。
 */
export const SUPPORT_EMAIL = "morisan.yutakun@gmail.com";

/** 運営者名 (特商法表記で使う)。後で屋号・法人名に差し替え可。 */
export const OPERATOR_NAME = "森 祐太 (個人事業主)";

/** 公開サイト URL (特商法表記 "URL" 欄で使う)。 */
export const SITE_URL = "https://eddivom.yuta-eng.com";
