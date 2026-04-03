import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eddivom — Math Worksheets That Just Work",
  description: "Turn PDFs into editable math worksheets. Equations stay perfect. Variants multiply. Answer keys export themselves. No LaTeX needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <Toaster richColors position="bottom-center" />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
