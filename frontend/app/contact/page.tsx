import type { Metadata } from "next";
import { LegalLayout } from "@/components/layout/legal-layout";
import { Mail, MessageCircle, Clock, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "Eddivom へのお問い合わせ窓口",
};

const SUPPORT_EMAIL = "support@eddivom.yuta-eng.com";

export default function ContactPage() {
  return (
    <LegalLayout title="お問い合わせ" titleEn="Contact" lastUpdated="2026-04-19">
      <p>
        Eddivom へのお問い合わせは、以下のメール窓口までお願いいたします。
        <br />
        ご質問内容に応じて、通常 1〜3 営業日以内にご返信いたします。
      </p>

      {/* メール窓口 — メインの導線 */}
      <div className="relative rounded-2xl p-7 bg-gradient-to-br from-blue-500/[0.04] via-violet-500/[0.05] to-fuchsia-500/[0.04] border border-violet-500/[0.18] my-8">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-bold tracking-tight mb-1">メールでのお問い合わせ</h3>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[18px] font-bold text-violet-600 dark:text-violet-400 hover:underline break-all"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="text-[12px] text-muted-foreground mt-2">
              件名にお問い合わせ内容の概要を記載いただけると、よりスムーズにご返信できます。
            </p>
          </div>
        </div>
      </div>

      {/* お問い合わせ内容別の目安 */}
      <h2 className="text-[17px] font-bold tracking-tight mt-10 mb-4 pt-4 border-t border-foreground/[0.05]">
        <span className="text-violet-500 mr-2 font-mono">01.</span>
        お問い合わせの種類と対応の目安
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ContactCategoryCard
          icon={<MessageCircle className="h-4 w-4" />}
          title="機能・使い方の質問"
          desc="AI の使い方、テンプレートの選び方、操作方法など"
          eta="1〜3 営業日"
        />
        <ContactCategoryCard
          icon={<AlertCircle className="h-4 w-4" />}
          title="不具合・バグ報告"
          desc="PDF が生成されない・表示が崩れる・AI が応答しない等"
          eta="24 時間以内 (緊急度に応じて)"
        />
        <ContactCategoryCard
          icon={<Mail className="h-4 w-4" />}
          title="請求・返金のご相談"
          desc="決済の不明点、返金のご相談、プラン変更の技術的問題"
          eta="1〜3 営業日"
        />
        <ContactCategoryCard
          icon={<Clock className="h-4 w-4" />}
          title="法人・機関契約のご相談"
          desc="学校・塾・教育機関での一括契約、請求書払い、見積書など"
          eta="3〜5 営業日"
        />
      </div>

      <h2 className="text-[17px] font-bold tracking-tight mt-10 mb-3 pt-4 border-t border-foreground/[0.05]">
        <span className="text-violet-500 mr-2 font-mono">02.</span>
        お問い合わせ前によくご確認いただく項目
      </h2>
      <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
        <li>ブラウザを最新版にアップデートしてもご不便が続くか</li>
        <li>プランの利用上限 (AI 回数・PDF 出力数) を超えていないか</li>
        <li>エラーメッセージが表示されている場合はその内容・スクリーンショット</li>
        <li>
          お問い合わせの際はご登録メールアドレスから送信いただくと、
          本人確認がスムーズで対応が早くなります
        </li>
      </ul>

      <h2 className="text-[17px] font-bold tracking-tight mt-10 mb-3 pt-4 border-t border-foreground/[0.05]">
        <span className="text-violet-500 mr-2 font-mono">03.</span>
        対応時間
      </h2>
      <p>
        平日 10:00〜18:00 (土日祝日・年末年始を除く) に随時対応いたします。
        個人開発のため、繁忙期はご返信にお時間をいただく場合がございます。ご了承ください。
      </p>
    </LegalLayout>
  );
}

function ContactCategoryCard({
  icon,
  title,
  desc,
  eta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  eta: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-card/50 p-4 hover:border-foreground/[0.12] transition-colors">
      <div className="flex items-start gap-2.5 mb-2">
        <div className="h-7 w-7 shrink-0 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-[13px] font-bold tracking-tight leading-tight pt-1">{title}</h3>
      </div>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">{desc}</p>
      <p className="text-[10.5px] text-muted-foreground/50">
        返信目安: <span className="font-semibold text-foreground/70">{eta}</span>
      </p>
    </div>
  );
}
