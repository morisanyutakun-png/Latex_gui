import type { Metadata } from "next";
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
  openGraph: {
    title: "Eddivom — AI worksheet IDE",
    description: "Generate problems, multiply variants, and export answer-key PDFs with AI.",
    type: "website",
  },
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
