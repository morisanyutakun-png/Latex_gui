import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Easy Worksheet Maker — Math Worksheets with Perfect Equations",
  description: "Turn your PDFs into editable math worksheets. Edit equations, generate variants, export with answer keys. No LaTeX needed.",
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
