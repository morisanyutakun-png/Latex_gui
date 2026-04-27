import type { NextConfig } from "next";

// セキュリティヘッダ。主要なクリックジャッキング / XSS / MIME sniffing 対策。
// CSP は Next.js + React 19 のインラインハイドレーション、Tailwind / KaTeX の
// インラインスタイル、Stripe.js のロードが必要なため、script-src / style-src
// には 'unsafe-inline' を含める (nonce ベースに移行するのは別フェーズ)。
// 狙いは「frame-ancestors / object-src / base-uri」の硬化と、外部ロード先の制限。
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Stripe.js + Google OAuth + GTM/GA + Google Ads 系。Next.js の inline hydration で unsafe-inline が必要。
      // Google 広告のコンバージョンは gtag.js が googleads.g.doubleclick.net / www.google.com /
      // www.googleadservices.com から追加スクリプトを動的に読み込んでビーコンを送るため、
      // これらが script-src にないと Tag Assistant が「タグ未発火」と判定して conversion が "無効" 扱いになる。
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
      // Tailwind / KaTeX / Next.js の inline style
      "style-src 'self' 'unsafe-inline'",
      // 画像: Google profile / Stripe logo / KaTeX SVG / blob プレビュー +
      // Google Ads conversion ピクセル (1x1 GIF が doubleclick.net / google.com に飛ぶ)
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com https://www.google.co.jp",
      "font-src 'self' data:",
      // XHR / sendBeacon の宛先: 自前 API + Stripe + Google OAuth + GA4 (region1.google-analytics.com 系) +
      // Google Ads conversion endpoint (googleads.g.doubleclick.net / www.google.com/pagead)。
      // ここを抜くと gtag が「fire」しても実際のビーコンが net::ERR_BLOCKED_BY_CSP になる = Ads 側で "未検出"。
      "connect-src 'self' blob: https://api.stripe.com https://accounts.google.com https://*.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com https://www.google.co.jp https://stats.g.doubleclick.net",
      // blob: は PdfPreviewPanel が生成する <iframe src="blob:..."> のため必須。
      // 抜けていると同一オリジンでも CSP violation でプレビューが真っ白になる。
      // td.doubleclick.net / googleads.g.doubleclick.net は Ads conversion linker の iframe 計測に使われる。
      "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://accounts.google.com https://td.doubleclick.net https://*.doubleclick.net https://www.googletagmanager.com",
      // PDF / PNG プレビューなどの media / object 系でも blob: を許可
      "media-src 'self' blob: data:",
      "frame-ancestors 'none'",
      // object-src: Safari は PDF の iframe 描画を内部的に <object>/<embed> で扱うため、
      // 'none' のままだと blob: PDF のプレビューが白紙になる。同一オリジンと blob のみ許可。
      "object-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Route Handler のタイムアウト延長 (PDF生成は時間がかかる)
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
