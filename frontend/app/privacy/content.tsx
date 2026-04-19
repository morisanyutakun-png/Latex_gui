"use client";

import { LegalLayout, LegalSection } from "@/components/layout/legal-layout";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { useI18n } from "@/lib/i18n";

export function PrivacyContent() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  return (
    <LegalLayout
      title="プライバシーポリシー"
      titleEn="Privacy Policy"
      lastUpdated="2026-04-19"
    >
      <p>
        {isJa
          ? "Eddivom (以下「本サービス」) を運営する運営者 (以下「当方」) は、本サービスを通じて取得するユーザーの個人情報を適切に取り扱うため、以下のプライバシーポリシー (以下「本ポリシー」) を定めます。"
          : "Eddivom (the \"Service\") is operated by the individual proprietor (\"we\" / \"us\"). This Privacy Policy (the \"Policy\") explains how we collect and handle personal information through the Service."}
      </p>

      <LegalSection number={1} heading={isJa ? "取得する情報" : "Information We Collect"}>
        <p>
          {isJa
            ? "当方は、本サービスの提供にあたり以下の情報を取得します。"
            : "To operate the Service we collect the following:"}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>Google アカウントを通じた認証情報 (Google が発行する一意 ID、メールアドレス、表示名、プロフィール画像 URL)</li>
              <li>決済情報 (Stripe が発行する顧客 ID・サブスクリプション ID。カード番号そのものは当方のサーバには保存しません)</li>
              <li>サービス利用ログ (AI リクエスト数、PDF 出力数、アクセス日時)</li>
              <li>お問い合わせの際にご提供いただく内容 (メール本文、返信先メールアドレス)</li>
              <li>ブラウザ・端末情報 (Cookie、ローカルストレージ、ユーザーエージェント、IP アドレス)</li>
            </>
          ) : (
            <>
              <li>Google OAuth authentication data (the stable Google-issued subject ID, email, display name, profile picture URL)</li>
              <li>Billing references (Stripe customer and subscription IDs; we never store raw card numbers on our own servers)</li>
              <li>Usage logs (AI request counts, PDF export counts, timestamps)</li>
              <li>Content of inquiries you send us (message body, return email address)</li>
              <li>Browser / device signals (cookies, localStorage, user agent, IP address)</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={2} heading={isJa ? "利用目的" : "How We Use It"}>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>本サービスの提供、認証、課金処理</li>
              <li>プランごとの利用量上限 (月間 AI リクエスト数・PDF 出力数) の管理</li>
              <li>不正利用・セキュリティ違反の検知・防止</li>
              <li>サービス改善のためのアクセス解析</li>
              <li>お問い合わせへの対応</li>
              <li>重要なお知らせ (料金改定、機能変更、利用規約改定等) の通知</li>
            </>
          ) : (
            <>
              <li>Delivering the Service, authenticating users, and processing billing</li>
              <li>Enforcing plan-level limits (monthly AI requests, PDF exports)</li>
              <li>Detecting and preventing abuse or security violations</li>
              <li>Analytics to improve the Service</li>
              <li>Responding to inquiries</li>
              <li>Notifying important updates (pricing changes, feature changes, policy updates)</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={3} heading={isJa ? "第三者提供" : "Disclosure to Third Parties"}>
        <p>
          {isJa
            ? "当方は、以下の場合を除き、取得した個人情報を第三者へ提供しません。"
            : "We do not disclose personal information to third parties except in these cases:"}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          {isJa ? (
            <>
              <li>お客様の同意がある場合</li>
              <li>法令に基づく開示請求を受けた場合</li>
              <li>人の生命・身体・財産の保護のために必要な場合</li>
              <li>以下の業務委託先へ、業務遂行に必要な範囲で提供する場合</li>
            </>
          ) : (
            <>
              <li>With your consent</li>
              <li>When required by law</li>
              <li>When necessary to protect life, body, or property</li>
              <li>To the processors listed below, strictly to the extent needed to operate the Service</li>
            </>
          )}
        </ul>
      </LegalSection>

      <LegalSection number={4} heading={isJa ? "業務委託先 (データ処理の主な委託先)" : "Sub-processors"}>
        <p>
          {isJa
            ? "本サービスは以下の外部サービスを利用しており、各社のプライバシーポリシーが適用されます。"
            : "The Service relies on the following vendors; each vendor's own privacy policy applies to data they process on our behalf."}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>
            <strong>Google</strong> — {isJa ? "認証、解析 (Google Analytics)" : "authentication, analytics (Google Analytics)"}
          </li>
          <li>
            <strong>Stripe, Inc.</strong> — {isJa ? "クレジットカード決済、サブスクリプション管理" : "payment processing and subscription management"}
          </li>
          <li>
            <strong>OpenAI, L.L.C.</strong> — {isJa ? "AI 機能および画像解析 (プロンプト・ドキュメント内容・アップロード画像の一部を推論目的で送信。OpenAI API 経由のため、送信データは OpenAI のモデル学習には使用されません)" : "AI features and image analysis (prompts, selected document content, and uploaded images are sent for inference. Data sent via the OpenAI API is not used to train OpenAI models)"}
          </li>
          <li>
            <strong>Vercel Inc.</strong> — {isJa ? "フロントエンドホスティング、CDN、アクセスログ" : "frontend hosting, CDN, access logs"}
          </li>
          <li>
            <strong>Koyeb Inc.</strong> — {isJa ? "バックエンド API のホスティング" : "backend API hosting"}
          </li>
          <li>
            <strong>Neon Inc.</strong> — {isJa ? "データベース (PostgreSQL) のホスティング" : "PostgreSQL database hosting"}
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={5} heading={isJa ? "Cookie および解析ツール" : "Cookies and Analytics"}>
        <p>
          {isJa
            ? "本サービスはログイン状態の保持・利用状況の計測のために Cookie およびローカルストレージを使用します。Google Analytics (GA4) によりアクセス解析を行い、匿名化されたアクセス統計を取得する場合があります。ブラウザの設定により Cookie を無効化できますが、一部機能がご利用いただけなくなる場合があります。"
            : "We use cookies and localStorage to maintain login state and measure usage. Google Analytics (GA4) provides anonymized aggregate statistics. You can disable cookies in your browser, but some features may stop working."}
        </p>
      </LegalSection>

      <LegalSection
        number={6}
        heading={isJa ? "お客様のデータ (教材コンテンツ) の取り扱い" : "Your Worksheet Content"}
      >
        <p>
          {isJa
            ? "お客様が本サービスで作成された LaTeX ソース・PDF・AI への指示内容等のコンテンツは、AI 機能の実行およびサービス提供に必要な範囲でのみ処理します。これらのコンテンツを広告・AI モデルの学習・第三者への販売目的には使用しません。"
            : "LaTeX source, PDFs, and AI prompts you create are processed solely to run AI features and deliver the Service. We do not use your content for advertising, for training AI models, or to sell to third parties."}
        </p>
      </LegalSection>

      <LegalSection
        number={7}
        heading={isJa ? "開示・訂正・削除請求" : "Access, Correction, and Deletion"}
      >
        <p>
          {isJa
            ? "お客様はご自身の個人情報について、開示・訂正・削除・利用停止を請求できます。ご請求は下記お問い合わせ窓口までご連絡ください。ご本人確認のうえ、法令の定める範囲内で対応いたします。アカウント削除に伴う課金情報は、会計法令により定められた期間保管します。"
            : "You may request access to, correction of, deletion of, or cessation of use of your personal information. Contact us via the address below; after identity verification we will respond within the scope required by law. Billing records are retained for the period required by accounting law even after account deletion."}
        </p>
      </LegalSection>

      <LegalSection number={8} heading={isJa ? "セキュリティ" : "Security"}>
        <p>
          {isJa
            ? "当方は、取得した個人情報を暗号化 (HTTPS 通信)、アクセス制限、脆弱性対策等により保護します。ただし、インターネット通信に絶対的な安全性はないことをご了承ください。"
            : "We protect personal information with encryption (HTTPS), access controls, and routine vulnerability management. However, no internet transmission is perfectly secure."}
        </p>
      </LegalSection>

      <LegalSection number={9} heading={isJa ? "未成年の利用について" : "Minors"}>
        <p>
          {isJa
            ? "13 歳未満の方はご利用いただけません。13 歳以上 18 歳未満の方は、保護者の同意のうえでご利用ください。"
            : "Users under 13 are not permitted. Users between 13 and 17 may use the Service only with a parent or guardian's consent."}
        </p>
      </LegalSection>

      <LegalSection number={10} heading={isJa ? "ポリシーの改定" : "Changes to this Policy"}>
        <p>
          {isJa
            ? "当方は必要に応じて本ポリシーを改定することがあります。改定があった場合は本ページ上部の「最終更新日」を更新します。重要な変更については本サービス内または登録メールアドレスへ通知します。"
            : "We may update this Policy from time to time. Material changes will be announced in-product or via your registered email. The \"Last updated\" date at the top of this page will always reflect the latest revision."}
        </p>
      </LegalSection>

      <LegalSection number={11} heading={isJa ? "お問い合わせ窓口" : "Contact"}>
        <p>
          {isJa
            ? "本ポリシーに関するご質問は、下記お問い合わせフォームまたはメールアドレスまでお寄せください。"
            : "Questions about this Policy? Reach us at the email below:"}
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
