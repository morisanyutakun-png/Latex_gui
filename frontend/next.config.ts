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
      // Stripe.js と Google OAuth の外部スクリプトを許可。Next.js の inline hydration で unsafe-inline が必要。
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com https://www.googletagmanager.com",
      // Tailwind / KaTeX / Next.js の inline style
      "style-src 'self' 'unsafe-inline'",
      // Google profile 画像、Stripe logo、base64 data URL (KaTeX SVG)、blob URL (PDF preview)
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
      "font-src 'self' data:",
      // 自身の API + Stripe API + Google OAuth + Analytics + blob (URL.createObjectURL 由来)
      "connect-src 'self' blob: https://api.stripe.com https://accounts.google.com https://www.google-analytics.com https://www.googletagmanager.com",
      // blob: は PdfPreviewPanel が生成する <iframe src="blob:..."> のため必須。
      // 抜けていると同一オリジンでも CSP violation でプレビューが真っ白になる。
      "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://accounts.google.com",
      // PDF / PNG プレビューなどの media / object 系でも blob: を許可
      "media-src 'self' blob: data:",
      "frame-ancestors 'none'",
      "object-src 'none'",
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
