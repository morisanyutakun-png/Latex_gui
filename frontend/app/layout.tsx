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
  title: {
    default: "Eddivom — AI教材作成IDE｜数式・図入りワークシートを自動でPDF化",
    template: "%s | Eddivom",
  },
  description:
    "Eddivomは、AIで問題と類題を生成し、解答付きPDFを自動で作るLaTeXベースの教材作成IDE。数式・図・化学式・ルーブリック採点に対応し、塾・学校・教材クリエイターのワークフローを数十分から数十秒に短縮します。",
  keywords: [
    // English / general
    "LaTeX editor", "AI worksheet generator", "math worksheet", "answer key generator",
    "AI teaching tool", "PDF worksheet", "rubric grading", "problem generator",
    "LuaLaTeX", "online LaTeX editor", "Overleaf alternative",
    // Japanese
    "AI教材作成", "ワークシート自動生成", "問題集 自動作成", "数学プリント 作成",
    "LaTeX オンライン", "教材作成 AI", "解答付き PDF", "類題 自動生成",
    "塾 教材", "学校 プリント", "数式 PDF",
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
    title: "Eddivom — AI教材作成IDE｜AIで問題を生成し、解答付きPDFまで",
    description:
      "依頼するだけで、AIが問題・類題・解答付きPDFを自動生成。数式・図・化学式に対応した教材作成IDE。",
    url: SITE_URL,
    siteName: "Eddivom",
    type: "website",
    locale: "ja_JP",
    alternateLocale: ["en_US"],
    // images は app/opengraph-image.tsx (file-convention) が自動注入する
  },
  twitter: {
    card: "summary_large_image",
    title: "Eddivom — AI教材作成IDE",
    description:
      "AIで問題を生成し、解答付きPDFまで自動。塾・学校・クリエイター向けのLaTeX教材作成IDE。",
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
                "AIで問題と類題を生成し、解答付きPDFを自動で作るLaTeXベースの教材作成IDE。数式・図・化学式・ルーブリック採点に対応。",
              url: SITE_URL,
              inLanguage: ["ja-JP", "en-US"],
              offers: [
                {
                  "@type": "Offer",
                  name: "Free",
                  price: "0",
                  priceCurrency: "JPY",
                  category: "free",
                },
                {
                  "@type": "Offer",
                  name: "Pro",
                  priceCurrency: "JPY",
                  category: "subscription",
                },
              ],
              featureList: [
                "AIによる問題生成",
                "類題の自動量産",
                "解答付きPDF出力",
                "数式・図・化学式組版",
                "ルーブリック採点",
                "LuaLaTeXコンパイル",
              ],
              creator: { "@type": "Organization", name: "Eddivom" },
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
