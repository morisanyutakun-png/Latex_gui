import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/layout/legal-layout";

export const metadata: Metadata = {
  title: "返金ポリシー",
  description: "Eddivom の返金・キャンセルポリシー",
};

export default function RefundsPage() {
  return (
    <LegalLayout
      title="返金・キャンセルポリシー"
      titleEn="Refund & Cancellation Policy"
      lastUpdated="2026-04-19"
    >
      <p>
        本ポリシーでは、Eddivom (以下「本サービス」) の有料プランに関する
        返金およびキャンセルの取り扱いを定めます。本ポリシーは
        <a href="/terms" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">利用規約</a>
        および
        <a href="/commerce" className="text-violet-600 dark:text-violet-400 hover:underline mx-1">特定商取引法に基づく表記</a>
        の一部を構成します。
      </p>

      <LegalSection number={1} heading="キャンセル (解約) の手続き">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
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
        </ul>
      </LegalSection>

      <LegalSection number={2} heading="原則: 返金について">
        <p>
          本サービスはデジタルサービスの性質上、決済完了後の自主返金は原則として行っておりません。
          これには以下が含まれます。
        </p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>ご自身で解約忘れ・更新忘れをされた場合の月額料金</li>
          <li>期間途中での解約による残期間分の日割り返金</li>
          <li>AI 回数・PDF 出力回数の未消化分に対する返金</li>
          <li>プランダウングレード時の差額返金</li>
        </ul>
        <p className="text-[12px] text-muted-foreground/70">
          ※ 更新日に自動課金が発生することをご了承のうえ、不要な場合はお早めに解約手続きをお願いいたします。
        </p>
      </LegalSection>

      <LegalSection number={3} heading="例外: 返金対応するケース">
        <p>以下に該当する場合は、個別にご相談のうえ返金または次月無償提供で対応させていただきます。</p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
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
        </ul>
      </LegalSection>

      <LegalSection number={4} heading="返金の方法">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
          <li>返金は原則として、ご利用いただいた決済手段 (クレジットカード) への返金で行います。</li>
          <li>カード会社の処理により、返金がご利用明細に反映されるまで 1〜2 週間程度かかる場合があります。</li>
          <li>返金処理にかかる手数料は当方が負担します。</li>
        </ul>
      </LegalSection>

      <LegalSection number={5} heading="クーリング・オフについて">
        <p>
          本サービスは特定商取引法上の「通信販売」に該当し、かつインターネット役務提供であるため、
          同法に定める「クーリング・オフ」制度は適用されません。
          お申し込み内容のご確認は、決済前に十分に行ってください。
        </p>
      </LegalSection>

      <LegalSection number={6} heading="Free プランのダウングレード">
        <p>
          有料プランを解約された場合、契約期間終了後は自動的に Free プランに移行します。
          Free プランに移行後も、過去に作成した教材 (ブラウザに保存されたもの) は引き続き閲覧・編集できますが、
          AI 回数や PDF 出力数は Free プランの上限が適用されます。
        </p>
      </LegalSection>

      <LegalSection number={7} heading="お問い合わせ">
        <p>
          返金・解約に関するご相談は下記窓口までお寄せください。
          ご登録メールアドレスから連絡いただけると本人確認がスムーズです。
        </p>
        <p>
          <a
            href="mailto:support@eddivom.yuta-eng.com"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            support@eddivom.yuta-eng.com
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
