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
      // Tailwind / KaTeX / Next.js の inline style + jsdelivr (lazy-loaded katex CSS)
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      // Google profile 画像、Stripe logo、base64 data URL (KaTeX SVG)、blob URL (PDF preview)
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      // 自身の API + Stripe API + Google OAuth + Analytics + blob (URL.createObjectURL 由来)
      "connect-src 'self' blob: https://api.stripe.com https://accounts.google.com https://www.google-analytics.com https://www.googletagmanager.com",
      // blob: は PdfPreviewPanel が生成する <iframe src="blob:..."> のため必須。
      // 抜けていると同一オリジンでも CSP violation でプレビューが真っ白になる。
      "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://accounts.google.com",
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
  // standalone: Docker コンテナサイズを ~1.2GB → ~150MB に縮小し cold start を高速化。
  // Koyeb 等の Container PaaS で TTFB の cold-start 部分が短くなる。
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // lucide-react は ~400KB の barrel export。利用したアイコンだけ tree-shake する。
    optimizePackageImports: ["lucide-react", "sonner"],
  },
  productionBrowserSourceMaps: false,
  compress: true,
  // 静的ページ (/ と /m) は CDN / 上流プロキシで積極キャッシュ可能にする。
  // s-maxage=300 (5 分間サーバキャッシュ) + stale-while-revalidate=86400 (24h)
  // これにより、初回以降のリクエストは TTFB ~50-150ms に短縮される。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/m",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" },
        ],
      },
      {
        // Next.js が吐く immutable 静的アセットは 1 年キャッシュ
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
