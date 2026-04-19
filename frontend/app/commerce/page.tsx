import type { Metadata } from "next";
import { LegalLayout, LegalKeyValueTable } from "@/components/layout/legal-layout";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "Eddivom の特定商取引法に基づく表記",
};

/**
 * 特定商取引法に基づく表記。
 *
 * 日本で有料サービスを提供する場合に必須の開示事項 (特定商取引法 第11条)。
 * - 事業者名、所在地、連絡先
 * - 販売価格、支払時期・方法
 * - 役務提供時期、返品特約 等
 *
 * 実運用では下記 `BUSINESS_INFO` をユーザー(個人事業主 or 法人)の
 * 情報に置き換えてデプロイする。住所・電話番号は請求時開示でも可。
 */
const BUSINESS_INFO = {
  operatorName: "森 祐太 (個人事業主)",
  operatorTitle: "運営統括責任者",
  addressNote: "ご請求があれば遅滞なく開示いたします。",
  phoneNote: "ご請求があれば遅滞なく開示いたします。",
  email: "support@eddivom.yuta-eng.com",
  siteUrl: "https://eddivom.yuta-eng.com",
};

export default function CommercePage() {
  return (
    <LegalLayout
      title="特定商取引法に基づく表記"
      titleEn="Commerce Disclosure"
      lastUpdated="2026-04-19"
    >
      <p>
        「特定商取引に関する法律」第11条 (通信販売についての広告) に基づき、以下の事項を開示します。
      </p>

      <LegalKeyValueTable
        rows={[
          { key: "販売業者", value: BUSINESS_INFO.operatorName },
          { key: "運営統括責任者", value: BUSINESS_INFO.operatorTitle },
          {
            key: "所在地",
            value: (
              <>
                {BUSINESS_INFO.addressNote}
                <br />
                <span className="text-muted-foreground/60 text-[12px]">
                  (住所の詳細は下記メールアドレスへご請求ください)
                </span>
              </>
            ),
          },
          {
            key: "電話番号",
            value: (
              <>
                {BUSINESS_INFO.phoneNote}
                <br />
                <span className="text-muted-foreground/60 text-[12px]">
                  (お問い合わせは原則としてメール窓口へお願いいたします)
                </span>
              </>
            ),
          },
          {
            key: "メールアドレス",
            value: (
              <a href={`mailto:${BUSINESS_INFO.email}`} className="text-violet-600 dark:text-violet-400 hover:underline">
                {BUSINESS_INFO.email}
              </a>
            ),
          },
          {
            key: "URL",
            value: (
              <a href={BUSINESS_INFO.siteUrl} className="text-violet-600 dark:text-violet-400 hover:underline">
                {BUSINESS_INFO.siteUrl}
              </a>
            ),
          },
          {
            key: "販売価格",
            value: (
              <>
                各プラン詳細は
                <a href="/#pricing" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">
                  料金ページ
                </a>
                をご確認ください。
                <br />
                Starter: 月額 1,980 円 (税込) / Pro: 月額 4,980 円 (税込) / Premium: 月額 19,800 円 (税込)
              </>
            ),
          },
          {
            key: "商品代金以外の必要料金",
            value: "インターネット接続料金、端末等のご利用費用はお客様のご負担となります。",
          },
          {
            key: "支払方法",
            value: "クレジットカード決済 (Stripe) — Visa / Mastercard / American Express / JCB / Diners / Discover。",
          },
          {
            key: "支払時期",
            value: "ご契約と同時に初月分を課金、以降は毎月同日に翌月分を自動課金いたします。",
          },
          {
            key: "役務の提供時期",
            value: "決済完了直後から本サービスをご利用いただけます。",
          },
          {
            key: "返品・キャンセル",
            value: (
              <>
                サービスの性質上、月の途中解約による日割り返金は原則としておこなっておりません。
                詳細は
                <a href="/refunds" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">
                  返金ポリシー
                </a>
                をご覧ください。
              </>
            ),
          },
          {
            key: "動作環境",
            value: "最新の Chrome / Safari / Edge / Firefox。JavaScript 有効。安定したインターネット接続。",
          },
        ]}
      />

      <p className="text-[12px] text-muted-foreground/70 mt-6">
        本表記に関するお問い合わせは上記メールアドレスまでお願いいたします。
      </p>
    </LegalLayout>
  );
}
