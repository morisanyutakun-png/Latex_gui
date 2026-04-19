"use client";

import { LegalLayout } from "@/components/layout/legal-layout";
import { Mail, MessageCircle, Clock, AlertCircle } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { useI18n } from "@/lib/i18n";

export function ContactContent() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  return (
    <LegalLayout title="お問い合わせ" titleEn="Contact" lastUpdated="2026-04-19">
      <p>
        {isJa
          ? "Eddivom へのお問い合わせは、以下のメール窓口までお願いいたします。ご質問内容に応じて、通常 1〜3 営業日以内にご返信いたします。"
          : "For Eddivom inquiries, please email the address below. We typically reply within 1–3 business days."}
      </p>

      {/* メール窓口 — メインの導線 */}
      <div className="relative rounded-2xl p-7 bg-gradient-to-br from-blue-500/[0.04] via-violet-500/[0.05] to-fuchsia-500/[0.04] border border-violet-500/[0.18] my-8">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-bold tracking-tight mb-1">
              {isJa ? "メールでのお問い合わせ" : "Email us"}
            </h3>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[18px] font-bold text-violet-600 dark:text-violet-400 hover:underline break-all"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="text-[12px] text-muted-foreground mt-2">
              {isJa
                ? "件名にお問い合わせ内容の概要を記載いただけると、よりスムーズにご返信できます。"
                : "A short topic summary in the subject line helps us respond faster."}
            </p>
          </div>
        </div>
      </div>

      {/* お問い合わせ内容別の目安 */}
      <h2 className="text-[17px] font-bold tracking-tight mt-10 mb-4 pt-4 border-t border-foreground/[0.05]">
        <span className="text-violet-500 mr-2 font-mono">01.</span>
        {isJa ? "お問い合わせの種類と対応の目安" : "Inquiry types & response times"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ContactCategoryCard
          icon={<MessageCircle className="h-4 w-4" />}
          title={isJa ? "機能・使い方の質問" : "Feature / how-to questions"}
          desc={
            isJa
              ? "AI の使い方、テンプレートの選び方、操作方法など"
              : "AI usage, template selection, general how-to"
          }
          eta={isJa ? "1〜3 営業日" : "1–3 business days"}
          etaLabel={isJa ? "返信目安:" : "Typical reply:"}
        />
        <ContactCategoryCard
          icon={<AlertCircle className="h-4 w-4" />}
          title={isJa ? "不具合・バグ報告" : "Bug reports / incidents"}
          desc={
            isJa
              ? "PDF が生成されない・表示が崩れる・AI が応答しない等"
              : "PDF generation failing, display issues, AI not responding, etc."
          }
          eta={isJa ? "24 時間以内 (緊急度に応じて)" : "Within 24 hours (by severity)"}
          etaLabel={isJa ? "返信目安:" : "Typical reply:"}
        />
        <ContactCategoryCard
          icon={<Mail className="h-4 w-4" />}
          title={isJa ? "請求・返金のご相談" : "Billing & refund inquiries"}
          desc={
            isJa
              ? "決済の不明点、返金のご相談、プラン変更の技術的問題"
              : "Payment questions, refund discussions, technical plan-change issues"
          }
          eta={isJa ? "1〜3 営業日" : "1–3 business days"}
          etaLabel={isJa ? "返信目安:" : "Typical reply:"}
        />
        <ContactCategoryCard
          icon={<Clock className="h-4 w-4" />}
          title={isJa ? "法人・機関契約のご相談" : "Institutional / enterprise inquiries"}
          desc={
            isJa
              ? "学校・塾・教育機関での一括契約、請求書払い、見積書など"
              : "School / cram-school / education bulk licensing, invoice payment, quotes"
          }
          eta={isJa ? "3〜5 営業日" : "3–5 business days"}
          etaLabel={isJa ? "返信目安:" : "Typical reply:"}
        />
      </div>

      <h2 className="text-[17px] font-bold tracking-tight mt-10 mb-3 pt-4 border-t border-foreground/[0.05]">
        <span className="text-violet-500 mr-2 font-mono">02.</span>
        {isJa ? "お問い合わせ前によくご確認いただく項目" : "Before reaching out, please check"}
      </h2>
      <ul className="list-disc pl-5 space-y-1.5 marker:text-violet-500/60">
        {isJa ? (
          <>
            <li>ブラウザを最新版にアップデートしてもご不便が続くか</li>
            <li>プランの利用上限 (AI 回数・PDF 出力数) を超えていないか</li>
            <li>エラーメッセージが表示されている場合はその内容・スクリーンショット</li>
            <li>
              お問い合わせの際はご登録メールアドレスから送信いただくと、本人確認がスムーズで対応が早くなります
            </li>
          </>
        ) : (
          <>
            <li>Whether the issue persists after updating your browser to the latest version</li>
            <li>Whether you've exceeded your plan's AI or PDF-export limits</li>
            <li>If there's an error message, include its text and a screenshot</li>
            <li>Sending from your registered email address speeds up identity verification</li>
          </>
        )}
      </ul>

      <h2 className="text-[17px] font-bold tracking-tight mt-10 mb-3 pt-4 border-t border-foreground/[0.05]">
        <span className="text-violet-500 mr-2 font-mono">03.</span>
        {isJa ? "対応時間" : "Support hours"}
      </h2>
      <p>
        {isJa
          ? "平日 10:00〜18:00 (土日祝日・年末年始を除く) に随時対応いたします。個人開発のため、繁忙期はご返信にお時間をいただく場合がございます。ご了承ください。"
          : "We reply on weekdays 10:00–18:00 JST (excluding Japanese public holidays and the year-end break). As this is a solo operation, replies may take longer during busy periods."}
      </p>
    </LegalLayout>
  );
}

function ContactCategoryCard({
  icon,
  title,
  desc,
  eta,
  etaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  eta: string;
  etaLabel: string;
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
        {etaLabel} <span className="font-semibold text-foreground/70">{eta}</span>
      </p>
    </div>
  );
}
