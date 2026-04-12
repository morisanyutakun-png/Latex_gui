import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { SessionProvider } from "@/components/auth/session-provider";
import { SubscriptionInitializer } from "@/components/subscription-initializer";
import "./globals.css";

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
