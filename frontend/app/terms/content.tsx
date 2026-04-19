"use client";

import { LegalLayout, LegalSection } from "@/components/layout/legal-layout";
import { useI18n } from "@/lib/i18n";

export function TermsContent() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  return (
    <LegalLayout
      title="利用規約"
      titleEn="Terms of Service"
      lastUpdated="2026-04-19"
    >
      <p>
        {isJa
          ? "この利用規約 (以下「本規約」) は、Eddivom (以下「本サービス」) の利用条件を定めるものです。ユーザーの皆様 (以下「ユーザー」) には、本規約に同意のうえ、本サービスをご利用いただきます。"
          : "These Terms of Service (the \"Terms\") govern use of Eddivom (the \"Service\"). By using the Service you agree to these Terms."}
      </p>

      <LegalSection number={1} heading={isJa ? "適用" : "Scope"}>
        <p>
          {isJa
            ? "本規約は、ユーザーと本サービスの運営者 (以下「当方」) との間の、本サービスの利用に関わる一切の関係に適用されます。"
            : "These Terms apply to all interactions between the user and the operator of the Service (\"we\" / \"us\") relating to the Service."}
        </p>
      </LegalSection>

      <LegalSection number={2} heading={isJa ? "利用登録" : "Account Registration"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>本サービスの利用を希望する方は、Google アカウントによる認証を経て登録するものとします。</li>
              <li>登録情報に虚偽があった場合、当方は利用登録を取り消すことができます。</li>
              <li>ユーザーは 1 人につき 1 アカウントのみ登録できます。</li>
              <li>アカウントの管理責任はユーザーに帰属します。</li>
            </>
          ) : (
            <>
              <li>Registration requires Google OAuth authentication.</li>
              <li>We may revoke registration if the information provided is false.</li>
              <li>Each person may hold one account only.</li>
              <li>You are responsible for safeguarding your account.</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={3} heading={isJa ? "料金および支払方法" : "Fees and Payment"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>有料プランの料金は、料金ページに表示された金額 (税込) とします。</li>
              <li>支払方法はクレジットカード (Stripe 経由) とします。</li>
              <li>支払いの遅延・決済失敗が発生した場合、当方は本サービスの提供を停止・制限することがあります。</li>
              <li>料金は予告なく変更されることがあります。変更後の料金は、次回更新時から適用されます。</li>
            </>
          ) : (
            <>
              <li>Paid plans cost the amount shown on the pricing page (tax included).</li>
              <li>Payment is by credit card via Stripe.</li>
              <li>If payment is delayed or fails, we may suspend or restrict access.</li>
              <li>We may change prices at any time. New prices apply from the next renewal.</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={4} heading={isJa ? "プラン変更・解約" : "Plan Changes and Cancellation"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>ユーザーはいつでも Stripe カスタマーポータルから解約できます。</li>
              <li>解約後も、既に支払済みの期間内は引き続き本サービスをご利用いただけます。</li>
              <li>日割り返金は原則として行いません (詳細は「返金ポリシー」をご参照ください)。</li>
            </>
          ) : (
            <>
              <li>You may cancel at any time via the Stripe customer portal.</li>
              <li>After cancellation you retain access through the end of your already-paid period.</li>
              <li>Pro-rated refunds are generally not offered (see the Refund Policy for details).</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={5} heading={isJa ? "AI 機能および利用量上限" : "AI Features and Usage Limits"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>本サービスの AI 機能は、各プランに定められた月間・日次の上限回数の範囲でご利用いただけます。</li>
              <li>上限回数を超過した場合、当該月の AI 機能は利用できなくなります。</li>
              <li>未消化の上限は翌月に繰り越されません。</li>
              <li>AI 応答の内容は参考情報であり、正確性・適法性を当方が保証するものではありません。</li>
            </>
          ) : (
            <>
              <li>AI features are available within the monthly and daily limits defined for each plan.</li>
              <li>Once a limit is reached, the AI feature is unavailable for the rest of the month.</li>
              <li>Unused quota does not roll over.</li>
              <li>AI output is provided for reference; we do not warrant its accuracy or legality.</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={6} heading={isJa ? "禁止事項" : "Prohibited Conduct"}>
        <p>
          {isJa
            ? "ユーザーは、以下の行為を行ってはなりません。"
            : "You must not:"}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>本サービスのサーバまたはネットワークの機能を破壊・妨害する行為</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>他のユーザーや第三者の個人情報を不正に収集・蓄積する行為</li>
              <li>他のユーザーや第三者の知的財産権・プライバシー等を侵害する行為</li>
              <li>不正な方法で利用量制限を回避する行為 (複数アカウント作成による上限回避を含む)</li>
              <li>本サービスを商用 AI モデルの学習データ収集目的で使用する行為</li>
              <li>本サービスの内容を複製・転売・再配布する行為</li>
              <li>その他、当方が不適切と判断する行為</li>
            </>
          ) : (
            <>
              <li>Violate law or public morals</li>
              <li>Engage in criminal activity</li>
              <li>Damage or interfere with the Service's servers or network</li>
              <li>Interfere with operation of the Service</li>
              <li>Unlawfully collect or store other users' or third parties' personal information</li>
              <li>Infringe intellectual property, privacy, or other rights of others</li>
              <li>Circumvent usage limits by any means (including creating multiple accounts)</li>
              <li>Use the Service to gather training data for commercial AI models</li>
              <li>Copy, resell, or redistribute the Service's content</li>
              <li>Engage in any other conduct we deem inappropriate</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection
        number={7}
        heading={isJa ? "本サービスの提供の停止・変更" : "Service Suspension and Changes"}
      >
        <p>
          {isJa
            ? "当方は、メンテナンス、障害対応、法令遵守、その他の事情により、予告なく本サービスの提供を一時停止・変更することがあります。これによりユーザーに生じた不利益について、当方は一切の責任を負いません。"
            : "We may suspend or modify the Service without notice for maintenance, incidents, legal compliance, or other reasons. We are not liable for any resulting inconvenience, subject to the limitation of liability below."}
        </p>
      </LegalSection>

      <LegalSection number={8} heading={isJa ? "利用資格の停止・削除" : "Account Suspension / Termination"}>
        <p>
          {isJa
            ? "ユーザーが以下のいずれかに該当すると当方が判断した場合、事前通知なく当該ユーザーの利用資格を停止または削除できます。"
            : "We may suspend or terminate a user's rights without prior notice if we determine any of the following:"}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>本規約のいずれかの条項に違反した場合</li>
              <li>登録事項に虚偽の事実があることが判明した場合</li>
              <li>料金の支払債務の不履行があった場合</li>
              <li>長期間にわたって連絡が取れない場合</li>
              <li>その他、当方が本サービスの利用を適当でないと判断した場合</li>
            </>
          ) : (
            <>
              <li>Breach of any provision of these Terms</li>
              <li>False registration information</li>
              <li>Failure to pay fees</li>
              <li>Extended inability to reach the user</li>
              <li>Any other situation where we deem use inappropriate</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={9} heading={isJa ? "知的財産権" : "Intellectual Property"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>本サービスに含まれるソフトウェア、デザイン、ロゴ、ブランド等の知的財産権は、当方または正当な権利者に帰属します。</li>
              <li>ユーザーが本サービス上で作成したコンテンツ (LaTeX ソース、PDF、設問等) の著作権は、ユーザーに帰属します。</li>
              <li>ユーザーは、自身のコンテンツについて第三者の権利を侵害していないことを表明・保証します。</li>
            </>
          ) : (
            <>
              <li>Software, designs, logos, and branding in the Service are owned by us or our licensors.</li>
              <li>Copyright in content you create on the Service (LaTeX source, PDFs, problems, etc.) belongs to you.</li>
              <li>You warrant that your content does not infringe third-party rights.</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={10} heading={isJa ? "免責事項" : "Disclaimer and Limitation of Liability"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>当方は、本サービスの内容に事実上または法律上の瑕疵 (安全性、信頼性、正確性、完全性、有効性、特定目的への適合性、セキュリティ上の欠陥、エラーやバグ、権利侵害等を含む) がないことを明示的にも黙示的にも保証しません。</li>
              <li>当方は、本サービスに起因してユーザーに生じたあらゆる損害について、直接か間接かを問わず、一切の責任を負いません。</li>
              <li>ただし、当方の故意または重過失による場合、当方は当該ユーザーが直近 12 か月で支払った利用料金の合計額を上限として責任を負います。</li>
              <li>ユーザー間または第三者との間で生じた紛争については、当方は責任を負いません。</li>
            </>
          ) : (
            <>
              <li>We make no express or implied warranty that the Service is free of factual or legal defects — including safety, reliability, accuracy, completeness, usefulness, fitness for a particular purpose, security flaws, errors, bugs, or infringement.</li>
              <li>We are not liable for any direct or indirect damages caused by the Service.</li>
              <li>Where our willful misconduct or gross negligence is involved, our liability is capped at the total fees the affected user paid us in the preceding 12 months.</li>
              <li>We are not liable for disputes between users or between a user and a third party.</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={11} heading={isJa ? "規約の変更" : "Changes to these Terms"}>
        <p>
          {isJa
            ? "当方は必要と判断した場合、ユーザーへ通知することなく本規約を変更できます。変更後の本規約は、本サービス上での掲示または登録メールアドレスへの通知の時点から効力を生じます。変更後も本サービスを継続して利用する場合、ユーザーは変更後の規約に同意したものとみなします。"
            : "We may change these Terms without individual notice. Changes take effect when posted on the Service or when notice is sent to your registered email address. Continued use of the Service after changes constitutes acceptance of the revised Terms."}
        </p>
      </LegalSection>

      <LegalSection number={12} heading={isJa ? "準拠法・裁判管轄" : "Governing Law and Venue"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
              <li>本サービスに関して紛争が生じた場合、当方の所在地を管轄する裁判所を専属的合意管轄とします。</li>
            </>
          ) : (
            <>
              <li>These Terms are governed by the laws of Japan.</li>
              <li>Any dispute shall be brought exclusively in the court with jurisdiction over our place of business.</li>
            </>
          )}
        </ul>
      </LegalSection>
    </LegalLayout>
  );
}
