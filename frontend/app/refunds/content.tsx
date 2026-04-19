"use client";

import { LegalLayout, LegalSection } from "@/components/layout/legal-layout";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { useI18n } from "@/lib/i18n";

export function RefundsContent() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  return (
    <LegalLayout
      title="返金・キャンセルポリシー"
      titleEn="Refund & Cancellation Policy"
      lastUpdated="2026-04-19"
    >
      <p>
        {isJa ? (
          <>
            本ポリシーでは、Eddivom (以下「本サービス」) の有料プランに関する返金およびキャンセルの取り扱いを定めます。本ポリシーは
            <a href="/terms" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">利用規約</a>
            および
            <a href="/commerce" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">特定商取引法に基づく表記</a>
            の一部を構成します。
          </>
        ) : (
          <>
            This policy describes cancellation and refund handling for Eddivom paid plans. It forms part of the
            <a href="/terms" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">Terms of Service</a>
            and
            <a href="/commerce" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">Commerce Disclosure</a>
            .
          </>
        )}
      </p>

      <LegalSection number={1} heading={isJa ? "キャンセル (解約) の手続き" : "How to Cancel"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>
                ユーザーはいつでも Stripe カスタマーポータルから有料プランを解約できます。
                エディタ画面の右上メニュー「サブスクリプションの管理」からもアクセスできます。
              </li>
              <li>
                解約手続きを行った場合、<strong>既に支払済みの期間の末日まで</strong>本サービスをご利用いただけます。
                期間末日に自動課金は停止し、その後は Free プランに自動的にダウングレードされます。
              </li>
              <li>
                期間末日より前に解約を行っても、当該期間分の料金の日割り返金は行いません。
              </li>
            </>
          ) : (
            <>
              <li>
                You can cancel your paid plan at any time from the Stripe customer portal. The portal is linked from
                the &quot;Manage subscription&quot; menu in the top-right of the editor.
              </li>
              <li>
                After cancellation you keep access <strong>through the end of the already-paid period</strong>. Auto-renewal
                stops on that date and your account is downgraded to Free.
              </li>
              <li>
                Cancelling mid-period does not trigger a pro-rated refund for the remainder of that period.
              </li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={2} heading={isJa ? "原則: 返金について" : "Default Rule: No Refunds"}>
        <p>
          {isJa
            ? "本サービスはデジタルサービスの性質上、決済完了後の自主返金は原則として行っておりません。これには以下が含まれます。"
            : "As a digital service, refunds after successful payment are generally not provided. This includes:"}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>ご自身で解約忘れ・更新忘れをされた場合の月額料金</li>
              <li>期間途中での解約による残期間分の日割り返金</li>
              <li>AI 回数・PDF 出力回数の未消化分に対する返金</li>
              <li>プランダウングレード時の差額返金</li>
            </>
          ) : (
            <>
              <li>Monthly charges that result from forgetting to cancel before renewal</li>
              <li>Pro-rated refunds for remaining days after mid-period cancellation</li>
              <li>Refunds for unused AI requests or PDF exports</li>
              <li>Difference refunds when downgrading plans</li>
            </>
          )}
        </ul>
        <p className="text-[12px] text-muted-foreground/70">
          {isJa
            ? "※ 更新日に自動課金が発生することをご了承のうえ、不要な場合はお早めに解約手続きをお願いいたします。"
            : "Please note that auto-renewal will charge on each renewal date; cancel early if you no longer need the plan."}
        </p>
      </LegalSection>

      <LegalSection number={3} heading={isJa ? "例外: 返金対応するケース" : "Exceptions: When We Do Refund"}>
        <p>
          {isJa
            ? "以下に該当する場合は、個別にご相談のうえ返金または次月無償提供で対応させていただきます。"
            : "In the following cases we will consider a refund or a free next-month credit on a case-by-case basis:"}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>
                <strong>当方の障害 (サービス停止) が 連続 24 時間以上</strong>継続した月について、
                当該月の料金を返金または次月無償提供いたします。
              </li>
              <li>
                <strong>当方の過失により料金が重複請求された</strong>場合、全額を速やかに返金いたします。
              </li>
              <li>
                <strong>決済エラーや不正利用の疑い</strong>が認められた場合、Stripe とも連携のうえ返金対応を検討します。
              </li>
              <li>
                <strong>消費者契約法・特定商取引法その他の法令により返金が必要とされる</strong>場合は、法令に従い対応いたします。
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>If our outage exceeds 24 continuous hours</strong> in a given month, we will refund that month or
                credit the following month.
              </li>
              <li>
                <strong>If our error results in duplicate charges</strong>, we will refund the duplicate in full promptly.
              </li>
              <li>
                <strong>If payment errors or suspected fraud are confirmed</strong>, we will work with Stripe to consider
                a refund.
              </li>
              <li>
                <strong>Where a refund is required by law</strong> (Japan's Consumer Contract Act, Act on Specified Commercial
                Transactions, or similar), we will comply with the applicable law.
              </li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={4} heading={isJa ? "返金の方法" : "How Refunds Are Issued"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>返金は原則として、ご利用いただいた決済手段 (クレジットカード) への返金で行います。</li>
              <li>カード会社の処理により、返金がご利用明細に反映されるまで 1〜2 週間程度かかる場合があります。</li>
              <li>返金処理にかかる手数料は当方が負担します。</li>
            </>
          ) : (
            <>
              <li>Refunds are issued back to the original payment method (credit card).</li>
              <li>Depending on your card issuer it may take 1–2 weeks to appear on your statement.</li>
              <li>We cover refund-processing fees.</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={5} heading={isJa ? "クーリング・オフについて" : "No Cooling-Off Period"}>
        <p>
          {isJa
            ? "本サービスは特定商取引法上の「通信販売」に該当し、かつインターネット役務提供であるため、同法に定める「クーリング・オフ」制度は適用されません。お申し込み内容のご確認は、決済前に十分に行ってください。"
            : "The Service is classified under Japan's Act on Specified Commercial Transactions as a \"mail-order\" online service. The statutory cooling-off right under that Act does not apply to this type of service. Please confirm your selections carefully before paying."}
        </p>
      </LegalSection>

      <LegalSection number={6} heading={isJa ? "Free プランのダウングレード" : "Downgrade to Free Plan"}>
        <p>
          {isJa
            ? "有料プランを解約された場合、契約期間終了後は自動的に Free プランに移行します。Free プランに移行後も、過去に作成した教材 (ブラウザに保存されたもの) は引き続き閲覧・編集できますが、AI 回数や PDF 出力数は Free プランの上限が適用されます。"
            : "When you cancel a paid plan, your account auto-downgrades to Free at the end of the paid period. Worksheets saved in your browser remain viewable and editable, but AI requests and PDF exports are subject to Free-plan limits."}
        </p>
      </LegalSection>

      <LegalSection number={7} heading={isJa ? "お問い合わせ" : "Contact"}>
        <p>
          {isJa
            ? "返金・解約に関するご相談は下記窓口までお寄せください。ご登録メールアドレスから連絡いただけると本人確認がスムーズです。"
            : "For refund or cancellation inquiries, contact us at the email below. Messages sent from your registered email make identity verification faster."}
        </p>
        <p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
