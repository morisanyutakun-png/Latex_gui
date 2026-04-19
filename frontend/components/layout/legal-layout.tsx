"use client";

/**
 * LegalLayout — 利用規約 / プライバシーポリシー / 特商法 等の法務文書用の共通レイアウト。
 *
 * 要件:
 *   · LP と同じ紫ブランドのヘッダー + 戻るリンク + 言語切替
 *   · 読みやすさ優先の幅 (max-w-3xl) + やや広めの行高
 *   · i18n 対応 (ja / en)
 *   · 末尾に同じフッター (法務ページ同士を相互リンク)
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export interface LegalLayoutProps {
  /** 画面タイトル (日本語) */
  title: string;
  /** 英題 (ja モードでは小さい uppercase 副題、en モードではメインタイトル) */
  titleEn?: string;
  /** 最終更新日 (例: "2026-04-19") */
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, titleEn, lastUpdated, children }: LegalLayoutProps) {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  // en モードでは英題をメイン、日題をサブに置く (en speaker には英語を主にする)
  const mainTitle = isJa ? title : (titleEn ?? title);
  const subTitle = isJa ? titleEn : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* 上部バー — LP に戻る導線 + 言語切替 */}
      <header className="border-b border-foreground/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {isJa ? "トップへ戻る" : "Back to home"}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                  <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
                </svg>
              </div>
              <span className="text-[13px] font-bold tracking-tight">Eddivom</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 本文 */}
      <main className="max-w-3xl mx-auto px-6 py-14">
        {subTitle && (
          <p className="text-[10.5px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-3">
            {subTitle}
          </p>
        )}
        <h1 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight mb-2">
          {mainTitle}
        </h1>
        {lastUpdated && (
          <p className="text-[12px] text-muted-foreground/60 mb-10">
            {isJa ? "最終更新日: " : "Last updated: "}
            {lastUpdated}
          </p>
        )}
        <div className="legal-prose text-[14px] leading-[1.85] text-foreground/85 space-y-6">
          {children}
        </div>
      </main>

      {/* フッター — 法務ページ相互リンク (LP と同順序・同文言) */}
      <footer className="border-t border-foreground/[0.05] py-10 mt-10">
        <nav
          className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-muted-foreground/70"
          aria-label={isJa ? "フッターナビゲーション" : "Footer navigation"}
        >
          <Link href="/#pricing" className="hover:text-foreground transition-colors">
            {isJa ? "料金" : "Pricing"}
          </Link>
          <span className="text-muted-foreground/20">·</span>
          <Link href="/contact" className="hover:text-foreground transition-colors">
            {isJa ? "お問い合わせ" : "Contact"}
          </Link>
          <span className="text-muted-foreground/20">·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            {isJa ? "利用規約" : "Terms"}
          </Link>
          <span className="text-muted-foreground/20">·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            {isJa ? "プライバシーポリシー" : "Privacy"}
          </Link>
          <span className="text-muted-foreground/20">·</span>
          <Link href="/commerce" className="hover:text-foreground transition-colors">
            {isJa ? "特定商取引法に基づく表記" : "Commerce Disclosure"}
          </Link>
          <span className="text-muted-foreground/20">·</span>
          <Link href="/refunds" className="hover:text-foreground transition-colors">
            {isJa ? "返金ポリシー" : "Refunds"}
          </Link>
        </nav>
        <p className="text-center text-[10.5px] text-muted-foreground/30 tracking-wide mt-5">
          © {new Date().getFullYear()} Eddivom. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

/**
 * 法務文書内で使う簡易見出し/箇条書き用ユーティリティコンポーネント。
 */
export function LegalSection({
  heading,
  number,
  children,
}: {
  heading: string;
  number?: number | string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[17px] font-bold tracking-tight text-foreground mb-3 pt-4 border-t border-foreground/[0.05]">
        {number !== undefined && (
          <span className="inline-block text-violet-500 mr-2 font-mono">
            {typeof number === "number" ? `${number}.` : number}
          </span>
        )}
        {heading}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** key-value の表 (特商法ページ用)。LP と同トーンの枠線で表示。 */
export function LegalKeyValueTable({
  rows,
}: {
  rows: Array<{ key: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="border border-foreground/[0.08] rounded-xl overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid grid-cols-1 sm:grid-cols-[200px_1fr] ${
            i > 0 ? "border-t border-foreground/[0.06]" : ""
          }`}
        >
          <dt className="bg-foreground/[0.025] px-4 py-3 text-[13px] font-semibold text-foreground/75">
            {row.key}
          </dt>
          <dd className="px-4 py-3 text-[13px] text-foreground/85">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
