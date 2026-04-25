import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { SessionProvider } from "@/components/auth/session-provider";
import { SubscriptionInitializer } from "@/components/subscription-initializer";
import "./globals.css";

// gtag.js は「1 スクリプト + 複数 config」で GA4 と Google Ads の両方を扱える。
// ここでは GA4 を主 (purchase event 送信先)、Ads ID は任意追加とする。
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const PRIMARY_GTAG_ID = GA4_ID || GOOGLE_ADS_ID;

// SEO: 本番ドメインを env で受け取り、未設定時は eddivom.com に倒す。
// metadataBase があると Next が OG / Twitter 画像を絶対 URL に解決してくれる。
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://eddivom.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // SEO: title は 60 字以内、description は 150 字前後で主要ロングテールを自然に含める。
  // 主軸: AI で問題集自動生成 / 解答付き PDF / 数学プリント / 類題 / 塾・高校
  title: {
    default: "Eddivom｜AIで問題集と解答付きPDFを自動作成する教材作成ツール",
    template: "%s | Eddivom",
  },
  description:
    "AIに依頼するだけで、数学プリントや確認テストの問題・類題・解答付きPDFが自動でできあがる。LaTeX組版で数式・図・化学式まできれい。塾講師・学校教員・教材クリエイター向け、無料プランあり・登録不要のAI教材作成IDE。",
  keywords: [
    // ── 日本語ロングテール (優先 ★★★) ──
    "AI 問題集 自動生成", "解答付きPDF 自動作成", "数学プリント 作成 ソフト 無料",
    "Overleaf 代替 日本語", "ワークシート 自動生成 AI",
    // ── 日本語ロングテール (★★) ──
    "類題 自動生成 AI", "塾 教材 作成 効率化", "高校数学 確認テスト 作成",
    "ルーブリック採点 AI", "テスト 解答用紙 自動作成",
    // ── 日本語 (★) ──
    "OCR 数式 LaTeX 変換", "LaTeX オンライン 日本語", "化学式 LaTeX 教材",
    "学校 プリント 数式", "教材作成 AI 無料",
    // ── 英語ロングテール ──
    "AI worksheet generator with answer keys", "answer key PDF generator",
    "free math worksheet maker", "Overleaf alternative for teachers",
    "AI variant problem generator", "AI rubric grading", "math OCR to LaTeX",
    "online LaTeX editor Japanese", "high school math quiz maker",
    "LuaLaTeX", "LaTeX editor",
  ],
  authors: [{ name: "Eddivom" }],
  creator: "Eddivom",
  publisher: "Eddivom",
  applicationName: "Eddivom",
  category: "education",
  alternates: {
    canonical: "/",
    languages: {
      "ja-JP": "/",
      "en-US": "/",
      "x-default": "/",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // ブラウザタブ・スマホホーム画面用のアイコン。
  // ファイル本体は app/icon.svg / app/apple-icon.png / app/favicon.ico。
  // 再生成は `node scripts/gen-favicon.mjs` (icon.svg → PNG/ICO をまとめて出す)。
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
  openGraph: {
    title: "Eddivom｜AIで問題集と解答付きPDFを自動作成する教材作成ツール",
    description:
      "AIに依頼するだけで、数学プリント・確認テストの問題と解答付きPDFを自動生成。塾講師・高校教員のための AI 教材作成ツール。",
    url: SITE_URL,
    siteName: "Eddivom",
    type: "website",
    locale: "ja_JP",
    alternateLocale: ["en_US"],
    // images は app/opengraph-image.tsx (file-convention) が自動注入する
  },
  twitter: {
    card: "summary_large_image",
    title: "Eddivom｜AI で問題集と解答付き PDF を自動作成",
    description:
      "数学プリント・確認テスト・類題を AI が自動生成。Overleaf より速く、解答付き PDF までワンクリック。塾講師・教員向け。",
    // images は app/twitter-image.tsx (file-convention) が自動注入する
  },
};

// スマホ・タブレットで レイアウトが崩れないよう viewport を明示する。
// エディタ UI はデスクトップ前提 (README でも PWA/モバイルは TODO) だが、
// 最低限ランディング・法務ページが読める状態にする。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {/* JSON-LD: 検索結果でリッチスニペット (アプリ名・評価・価格) を出すための構造化データ。
            軽量プランは無料、Pro プランは有料という二段構成を Offer で表現する。
            schema.org SoftwareApplication 仕様準拠。 */}
        <Script
          id="ld-software-app"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Eddivom",
              applicationCategory: "EducationalApplication",
              applicationSubCategory: "Worksheet Generator",
              operatingSystem: "Web",
              description:
                "AIで問題と類題を自動生成し、解答付きPDFまで自動作成するLaTeXベースの教材作成ツール。数学プリント・確認テスト・ワークシートに対応。",
              url: SITE_URL,
              inLanguage: ["ja-JP", "en-US"],
              audience: {
                "@type": "EducationalAudience",
                educationalRole: ["teacher", "tutor", "student"],
              },
              offers: [
                { "@type": "Offer", name: "Free", price: "0", priceCurrency: "JPY", category: "free" },
                { "@type": "Offer", name: "Pro", priceCurrency: "JPY", category: "subscription" },
              ],
              featureList: [
                "AIによる問題自動生成 (数学・理科・化学)",
                "類題の自動量産 (1クリックでバリエーション)",
                "解答付きPDFの自動作成",
                "LaTeX (LuaLaTeX) による数式・図・化学式組版",
                "ルーブリック採点 (AIアシスト)",
                "OCRによる既存PDF・画像の取り込み",
                "Overleafに近い編集体験を日本語UIで",
              ],
              creator: { "@type": "Organization", name: "Eddivom" },
            }),
          }}
        />
        {/* FAQPage JSON-LD: ロングテール質問でのリッチリザルト獲得のため。
            画面に出す FAQ セクションと内容を一致させる必要がある (page-FAQ整合性)。 */}
        <Script
          id="ld-faq"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "AI で問題集を自動生成できますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "はい。Eddivom はチャットで「二次関数の問題を10題」のように依頼するだけで、AIがLaTeX組版で問題を自動生成します。難易度や範囲・分野・問題数を自然言語で指定でき、生成と同時にPDFプレビューが更新されます。",
                  },
                },
                {
                  "@type": "Question",
                  name: "解答付きPDFは自動で作成されますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "はい。問題ページと解答ページがセットになったPDFを自動で書き出します。模範解答だけでなく略解・配点バッジ・解説の有無も指定でき、A4/B5の印刷に最適化されます。",
                  },
                },
                {
                  "@type": "Question",
                  name: "数学プリント作成ソフトとして無料で使えますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "無料プランで会員登録なしに利用を開始できます。AI生成回数とPDF出力数に上限がありますが、数式・図・化学式の組版や直接編集は無料プランでも利用できます。",
                  },
                },
                {
                  "@type": "Question",
                  name: "Overleaf との違いは何ですか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Overleafは汎用LaTeXエディタですが、Eddivomは教材作成に特化したIDEです。AIによる問題自動生成・類題量産・解答付きPDFの自動構成・採点など、Overleafにはない教材作成専用フローを最初から備えています。日本語UIと日本語フォント (haranoaji) も初期設定済みです。",
                  },
                },
                {
                  "@type": "Question",
                  name: "1つの問題から類題を自動で量産できますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "はい。既存の問題にカーソルを当てて「類題を5問」と依頼すると、係数や設定を変えた類題をAIが生成します。難易度を一段上げる・下げるといった指示にも対応しています。",
                  },
                },
                {
                  "@type": "Question",
                  name: "高校数学の確認テストや塾の教材作成にも使えますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "はい。共通テスト風レイアウト・国公立二次風・学校用テスト・問題集など、高校数学の確認テスト作成や塾の教材作成に最適化されたテンプレートを多数収録しています。配点バッジや大問ボックスなど、紙に印刷したときに読みやすい体裁を初期設定で実現します。",
                  },
                },
                {
                  "@type": "Question",
                  name: "ルーブリック採点機能はどう使いますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Pro プランでは、答案画像をアップロードするとAIが採点項目ごとに○×と部分点を提案します。採点基準 (ルーブリック) は教員が編集でき、最終的な点数調整は人が行えます。OMR (マークシート) 採点も同じ画面から実行可能です。",
                  },
                },
                {
                  "@type": "Question",
                  name: "既存のPDFや画像から問題を取り込めますか？",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "はい。OCR機能で既存のテストPDFや教科書画像を読み取り、数式を含めてLaTeXに変換します。読み取った内容をベースに、Eddivom内で類題量産や解答生成までシームレスに行えます。",
                  },
                },
              ],
            }),
          }}
        />
        {PRIMARY_GTAG_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${PRIMARY_GTAG_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-base" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;
                gtag('js', new Date());
                ${GA4_ID ? `gtag('config', '${GA4_ID}');` : ""}
                ${GOOGLE_ADS_ID && GOOGLE_ADS_ID !== GA4_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ""}
              `}
            </Script>
          </>
        ) : null}
        <SessionProvider>
          <SubscriptionInitializer />
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <I18nProvider>
              <HtmlLangSync />
              <TooltipProvider>
                <div className="animate-page-fade-in">
                  {children}
                </div>
              </TooltipProvider>
              <Toaster richColors position="bottom-center" />
            </I18nProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
