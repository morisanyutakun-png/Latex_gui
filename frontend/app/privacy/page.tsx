import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/layout/legal-layout";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "Eddivom のプライバシーポリシー (個人情報の取り扱いについて)",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="プライバシーポリシー"
      titleEn="Privacy Policy"
      lastUpdated="2026-04-19"
    >
      <p>
        Eddivom (以下「本サービス」) を運営する運営者 (以下「当方」) は、
        本サービスを通じて取得するユーザーの個人情報を適切に取り扱うため、
        以下のプライバシーポリシー (以下「本ポリシー」) を定めます。
      </p>

      <LegalSection number={1} heading="取得する情報">
        <p>当方は、本サービスの提供にあたり以下の情報を取得します。</p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>Google アカウントを通じた認証情報 (Google が発行する一意 ID、メールアドレス、表示名、プロフィール画像 URL)</li>
          <li>決済情報 (Stripe が発行する顧客 ID・サブスクリプション ID。カード番号そのものは当方のサーバには保存しません)</li>
          <li>サービス利用ログ (AI リクエスト数、PDF 出力数、アクセス日時)</li>
          <li>お問い合わせの際にご提供いただく内容 (メール本文、返信先メールアドレス)</li>
          <li>ブラウザ・端末情報 (Cookie、ローカルストレージ、ユーザーエージェント、IP アドレス)</li>
        </ul>
      </LegalSection>

      <LegalSection number={2} heading="利用目的">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>本サービスの提供、認証、課金処理</li>
          <li>プランごとの利用量上限 (月間 AI リクエスト数・PDF 出力数) の管理</li>
          <li>不正利用・セキュリティ違反の検知・防止</li>
          <li>サービス改善のためのアクセス解析</li>
          <li>お問い合わせへの対応</li>
          <li>重要なお知らせ (料金改定、機能変更、利用規約改定等) の通知</li>
        </ul>
      </LegalSection>

      <LegalSection number={3} heading="第三者提供">
        <p>
          当方は、以下の場合を除き、取得した個人情報を第三者へ提供しません。
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>お客様の同意がある場合</li>
          <li>法令に基づく開示請求を受けた場合</li>
          <li>人の生命・身体・財産の保護のために必要な場合</li>
          <li>以下の業務委託先へ、業務遂行に必要な範囲で提供する場合</li>
        </ul>
      </LegalSection>

      <LegalSection number={4} heading="業務委託先 (データ処理の主な委託先)">
        <p>本サービスは以下の外部サービスを利用しており、各社のプライバシーポリシーが適用されます。</p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>
            <strong>Google (Google Cloud / NextAuth OAuth)</strong> — 認証、解析 (Google Analytics)
          </li>
          <li>
            <strong>Stripe, Inc.</strong> — クレジットカード決済、サブスクリプション管理
          </li>
          <li>
            <strong>Anthropic PBC</strong> — AI 機能 (プロンプト・ドキュメント内容の一部を解析目的で送信)
          </li>
          <li>
            <strong>Vercel Inc.</strong> — フロントエンドホスティング、CDN、アクセスログ
          </li>
          <li>
            <strong>Koyeb Inc.</strong> — バックエンド API のホスティング
          </li>
          <li>
            <strong>Neon Inc.</strong> — データベース (PostgreSQL) のホスティング
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={5} heading="Cookie および解析ツール">
        <p>
          本サービスはログイン状態の保持・利用状況の計測のために Cookie およびローカルストレージを使用します。
          Google Analytics (GA4) によりアクセス解析を行い、匿名化されたアクセス統計を取得する場合があります。
          ブラウザの設定により Cookie を無効化できますが、一部機能がご利用いただけなくなる場合があります。
        </p>
      </LegalSection>

      <LegalSection number={6} heading="お客様のデータ (教材コンテンツ) の取り扱い">
        <p>
          お客様が本サービスで作成された LaTeX ソース・PDF・AI への指示内容等のコンテンツは、
          AI 機能の実行およびサービス提供に必要な範囲でのみ処理します。
          これらのコンテンツを広告・AI モデルの学習・第三者への販売目的には使用しません。
        </p>
      </LegalSection>

      <LegalSection number={7} heading="開示・訂正・削除請求">
        <p>
          お客様はご自身の個人情報について、開示・訂正・削除・利用停止を請求できます。
          ご請求は下記お問い合わせ窓口までご連絡ください。ご本人確認のうえ、
          法令の定める範囲内で対応いたします。アカウント削除に伴う課金情報は、
          会計法令により定められた期間保管します。
        </p>
      </LegalSection>

      <LegalSection number={8} heading="セキュリティ">
        <p>
          当方は、取得した個人情報を暗号化 (HTTPS 通信)、アクセス制限、脆弱性対策等により
          保護します。ただし、インターネット通信に絶対的な安全性はないことをご了承ください。
        </p>
      </LegalSection>

      <LegalSection number={9} heading="未成年の利用について">
        <p>
          13 歳未満の方はご利用いただけません。13 歳以上 18 歳未満の方は、
          保護者の同意のうえでご利用ください。
        </p>
      </LegalSection>

      <LegalSection number={10} heading="ポリシーの改定">
        <p>
          当方は必要に応じて本ポリシーを改定することがあります。
          改定があった場合は本ページ上部の「最終更新日」を更新します。
          重要な変更については本サービス内または登録メールアドレスへ通知します。
        </p>
      </LegalSection>

      <LegalSection number={11} heading="お問い合わせ窓口">
        <p>
          本ポリシーに関するご質問は、下記お問い合わせフォームまたはメールアドレスまでお寄せください。
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
