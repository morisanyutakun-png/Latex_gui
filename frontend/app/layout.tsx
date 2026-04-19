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

export const metadata: Metadata = {
  title: {
    default: "Eddivom — AI worksheet IDE for teachers",
    template: "%s | Eddivom",
  },
  description: "Generate problems, multiply variants, and export answer-key PDFs with AI. A professional LaTeX worksheet tool for teachers, tutors, and content creators.",
  keywords: ["LaTeX editor", "worksheet generator", "math worksheet", "AI teaching tool", "PDF export", "rubric grading"],
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
    title: "Eddivom — AI worksheet IDE",
    description: "Generate problems, multiply variants, and export answer-key PDFs with AI.",
    type: "website",
    images: [{ url: "/apple-icon.png", width: 180, height: 180 }],
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
