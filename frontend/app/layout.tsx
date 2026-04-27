import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { SessionProvider } from "@/components/auth/session-provider";
import { SubscriptionInitializer } from "@/components/subscription-initializer";
import { PageviewConversion } from "@/components/pageview-conversion";
import { GuestSignupOverlayMount } from "@/components/guest-signup-overlay-mount";
import { Suspense } from "react";
import "./globals.css";

// gtag.js は「1 スクリプト + 複数 config」で GA4 と Google Ads の両方を扱える。
// ここでは GA4 を主 (purchase event 送信先)、Ads ID は任意追加とする。
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
// Google 広告 (ページビュー conversion / コンバージョンキャンペーン用)。
// env で上書き可能。未設定時は morisan.yutakun@gmail.com の AW アカウント ID を
// ハードコードしておくことで、Vercel に env を入れ忘れていても確実にタグが出る。
// 広告アカウント切替時は NEXT_PUBLIC_GOOGLE_ADS_ID で上書き。
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-17966887751";
const PRIMARY_GTAG_ID = GA4_ID || GOOGLE_ADS_ID;
// GA4 DebugView は `debug_mode: true` が付いた event しか表示しない。
// 開発環境 (vercel preview / NODE_ENV !== "production") は常に true、
// 本番でも一時的に DebugView を見たいときは NEXT_PUBLIC_GA4_DEBUG=1 で有効化できる。
const GA4_DEBUG_MODE =
  process.env.NEXT_PUBLIC_GA4_DEBUG === "1" || process.env.NODE_ENV !== "production";

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
// theme-color: モバイル Safari/Chrome のステータスバーをページ色に合わせる (体感速度向上)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* preconnect: TLS ハンドシェイクを先回りして実行することで、gtag.js / GA4 ビーコン /
            Ads conversion の初回送信時間を短縮する (LCP・FCP に効く)。`crossOrigin` は
            CORS 付きフェッチに必要 (gtag.js は CORS 越しの動的 import を行う)。 */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />
        <link rel="dns-prefetch" href="https://www.googleadservices.com" />
        {/* KaTeX CSS は jsdelivr から動的注入する (LP critical CSS から外している)。
            preconnect で TLS ハンドシェイクを先回りさせ、SampleShowcase が viewport に
            入った瞬間の数式描画をスムーズにする。 */}
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      </head>
      <body className="antialiased">
        {/* JSON-LD: 検索結果でリッチスニペット (アプリ名・評価・価格) を出すための構造化データ。
            軽量プランは無料、Pro プランは有料という二段構成を Offer で表現する。
            schema.org SoftwareApplication 仕様準拠。 */}
        <Script
          id="ld-software-app"
          type="application/ld+json"
          strategy="afterInteractive"
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
        {/* FAQPage JSON-LD は LP に固有なので app/page.tsx 側に移設。
            ここに置くと /editor 等の内部ページでも 3KB を毎回出力することになり、
            HTML サイズが膨らんで TTFB / FCP に効くため。 */}
        {PRIMARY_GTAG_ID ? (
          <>
            {/* gtag.js 本体。Google 公式の <script async src=".../gtag/js?id=AW-..."> 形と
                完全一致させるため、Next/Script ではなく素の <script> タグで書く。これだと
                Tag Assistant のスパイダー (HTML 静的検査) が確実に検出できる。
                async + 上に置くことで gtag-stub と並行してすぐにロードが始まる。 */}
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${PRIMARY_GTAG_ID}`}
            />
            {/* gtag stub: window.gtag を最速で定義し、後から来る event 呼び出しを
                dataLayer に積む。Google 推奨スニペットと同じ形にしておくことで Tag
                Assistant が「正規の Google tag」として認識する。 */}
            <Script id="gtag-stub" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){ dataLayer.push(arguments); }
                window.gtag = window.gtag || gtag;
                gtag('js', new Date());
                ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ""}
                ${GA4_ID && GA4_ID !== GOOGLE_ADS_ID ? `gtag('config', '${GA4_ID}', { send_page_view: false${GA4_DEBUG_MODE ? `, debug_mode: true` : ``} });` : ""}
              `}
            </Script>
            {/* Google Ads ページビュー conversion (Google 配布スニペットそのもの).
                Ads スパイダーは正規表現で `gtag('event', 'conversion'` + send_to ID を
                文字列マッチで探すため、Next/Script を使うが strategy=afterInteractive で
                defer 相当に振り、初回 paint をブロックしない。 */}
            <Script id="ads-pageview-conv" strategy="afterInteractive">
              {`
                if (typeof window !== 'undefined') {
                  (window.dataLayer = window.dataLayer || []);
                  var _eddivomFireConv = function(){
                    if (typeof window.gtag !== 'function') return false;
                    window.gtag('event', 'conversion', {'send_to': 'AW-17966887751/tQ-PCOuO6JEcEMfmo_dC'});
                    window.gtag('event', 'page_view', {
                      page_location: window.location.href,
                      page_path: window.location.pathname + window.location.search,
                      page_title: document.title${GA4_DEBUG_MODE ? `,
                      debug_mode: true` : ``}
                    });
                    return true;
                  };
                  // gtag.js の async ロードが終わるまで polling で待つ (最大 10s)
                  if (!_eddivomFireConv()) {
                    var _tries = 0;
                    var _t = setInterval(function(){
                      _tries++;
                      if (_eddivomFireConv() || _tries > 50) clearInterval(_t);
                    }, 200);
                  }
                }
              `}
            </Script>
            {/* JS 無効環境向け 1x1 ピクセルフォールバック (Google 推奨パターン).
                CSP の img-src に doubleclick.net を許可済。 */}
            <noscript>
              <img
                height="1"
                width="1"
                style={{ borderStyle: "none" }}
                alt=""
                src="https://www.googletagmanager.com/td?id=AW-17966887751&l=dataLayer&cx=c"
              />
            </noscript>
          </>
        ) : null}
        <SessionProvider>
          <SubscriptionInitializer />
          {/* SPA ナビゲーションごとに Ads pageview conversion を再発火する。
              useSearchParams() を使うので Suspense で囲む必要がある (Next 15)。 */}
          <Suspense fallback={null}>
            <PageviewConversion />
          </Suspense>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <I18nProvider>
              <HtmlLangSync />
              <TooltipProvider>
                <div className="animate-page-fade-in">
                  {children}
                </div>
              </TooltipProvider>
              <Toaster richColors position="bottom-center" />
              {/* 全画面 signup overlay — どのページからでも openSignupOverlay() で呼び出せる。
                  実体は dynamic import で初期 JS バンドルから外し、ストアが open=true に
                  なった瞬間に初めてロードされる (LP の LCP/FCP を悪化させない)。 */}
              <GuestSignupOverlayMount />
            </I18nProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
