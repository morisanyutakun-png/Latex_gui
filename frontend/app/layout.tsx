import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "かんたんPDFメーカー",
  description: "テンプレートを選んで、直感操作でPDFを作れるツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
