"use client";

import { LegalLayout, LegalKeyValueTable } from "@/components/layout/legal-layout";
import { SUPPORT_EMAIL, OPERATOR_NAME, SITE_URL } from "@/lib/contact";
import { useI18n } from "@/lib/i18n";

/**
 * 特定商取引法に基づく表記。
 * 日本で有料サービスを提供する場合に必須の開示事項 (特定商取引法 第11条)。
 * 英語話者向けの法的説明としても同等の内容を英訳して提供する
 * (ただし日本法に基づく表示であることを明記)。
 */
export function CommerceContent() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  const operatorName = isJa ? OPERATOR_NAME : "Yuta Mori (Sole Proprietor)";

  return (
    <LegalLayout
      title="特定商取引法に基づく表記"
      titleEn="Commerce Disclosure"
      lastUpdated="2026-04-19"
    >
      <p>
        {isJa
          ? "「特定商取引に関する法律」第11条 (通信販売についての広告) に基づき、以下の事項を開示します。"
          : "The following disclosures are provided in accordance with Article 11 of Japan's Act on Specified Commercial Transactions (the law that requires merchants offering services to Japanese consumers to publish certain business information)."}
      </p>

      <LegalKeyValueTable
        rows={[
          {
            key: isJa ? "販売業者" : "Merchant",
            value: operatorName,
          },
          {
            key: isJa ? "運営統括責任者" : "Representative",
            value: isJa ? `${OPERATOR_NAME} (販売業者と同一)` : `${operatorName} (same as merchant)`,
          },
          {
            key: isJa ? "所在地" : "Address",
            value: (
              <>
                {isJa
                  ? "ご請求があれば遅滞なく開示いたします。"
                  : "Available upon request without delay."}
                <br />
                <span className="text-muted-foreground/60 text-[12px]">
                  {isJa
                    ? "(住所の詳細は下記メールアドレスへご請求ください)"
                    : "(Please contact the email address below for the full address.)"}
                </span>
              </>
            ),
          },
          {
            key: isJa ? "電話番号" : "Phone",
            value: (
              <>
                {isJa
                  ? "ご請求があれば遅滞なく開示いたします。"
                  : "Available upon request without delay."}
                <br />
                <span className="text-muted-foreground/60 text-[12px]">
                  {isJa
                    ? "(お問い合わせは原則としてメール窓口へお願いいたします)"
                    : "(Please use the email contact as the primary channel.)"}
                </span>
              </>
            ),
          },
          {
            key: isJa ? "メールアドレス" : "Email",
            value: (
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            ),
          },
          {
            key: "URL",
            value: (
              <a
                href={SITE_URL}
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                {SITE_URL}
              </a>
            ),
          },
          {
            key: isJa ? "販売価格" : "Pricing",
            value: (
              <>
                {isJa ? "各プラン詳細は" : "See"}
                <a
                  href="/#pricing"
                  className="text-violet-600 dark:text-violet-400 hover:underline mx-1"
                >
                  {isJa ? "料金ページ" : "the pricing section"}
                </a>
                {isJa
                  ? "をご確認ください。"
                  : "for full details."}
                <br />
                {isJa ? (
                  <>Starter: 月額 1,980 円 (税込) / Pro: 月額 4,980 円 (税込) / Premium: 月額 19,800 円 (税込)</>
                ) : (
                  <>
                    Starter: ¥1,980 / month (tax included) · Pro: ¥4,980 / month (tax included) · Premium:
                    ¥19,800 / month (tax included)
                  </>
                )}
              </>
            ),
          },
          {
            key: isJa ? "商品代金以外の必要料金" : "Other Fees Customer Bears",
            value: isJa
              ? "インターネット接続料金、端末等のご利用費用はお客様のご負担となります。"
              : "Internet connection fees and device costs are the customer's responsibility.",
          },
          {
            key: isJa ? "支払方法" : "Payment Methods",
            value: isJa
              ? "クレジットカード決済 (Stripe) — Visa / Mastercard / American Express / JCB / Diners / Discover。"
              : "Credit card via Stripe — Visa / Mastercard / American Express / JCB / Diners / Discover.",
          },
          {
            key: isJa ? "支払時期" : "Payment Timing",
            value: isJa
              ? "ご契約と同時に初月分を課金、以降は毎月同日に翌月分を自動課金いたします。"
              : "The first month is charged at signup; thereafter the next month is auto-charged on the same date each month.",
          },
          {
            key: isJa ? "役務の提供時期" : "Service Delivery",
            value: isJa
              ? "決済完了直後から本サービスをご利用いただけます。"
              : "Access begins immediately after successful payment.",
          },
          {
            key: isJa ? "返品・キャンセル" : "Cancellation & Refunds",
            value: (
              <>
                {isJa
                  ? "サービスの性質上、月の途中解約による日割り返金は原則としておこなっておりません。詳細は"
                  : "Given the nature of the digital service, pro-rated refunds for mid-month cancellation are not offered as a rule. See"}
                <a
                  href="/refunds"
                  className="text-violet-600 dark:text-violet-400 hover:underline mx-1"
                >
                  {isJa ? "返金ポリシー" : "the refund policy"}
                </a>
                {isJa ? "をご覧ください。" : "for details."}
              </>
            ),
          },
          {
            key: isJa ? "動作環境" : "System Requirements",
            value: isJa
              ? "最新の Chrome / Safari / Edge / Firefox。JavaScript 有効。安定したインターネット接続。"
              : "Latest Chrome / Safari / Edge / Firefox. JavaScript enabled. Stable internet connection.",
          },
        ]}
      />

      <p className="text-[12px] text-muted-foreground/70 mt-6">
        {isJa
          ? "本表記に関するお問い合わせは上記メールアドレスまでお願いいたします。"
          : "For inquiries about this disclosure, please contact the email above."}
      </p>
    </LegalLayout>
  );
}
