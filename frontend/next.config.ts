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
  // HSTS: Lighthouse「強力な HSTS ポリシーを使用する」を満たす設定。
  // max-age=2 年、サブドメイン継承、HSTS プリロードリストへの登録を許可。
  // 本番ドメインで HTTPS が常に成立する前提で設定する (eddivom.com は Vercel の自動 HTTPS)。
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // COOP: cross-origin window.opener アクセスを遮断 → Lighthouse「COOP でオリジン分離」を満たす。
  // `same-origin-allow-popups` は Stripe Checkout / Google OAuth のポップアップを壊さないために必要。
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // CORP: 自オリジン外からの fetch / iframe による埋め込みを遮断 (CDN 越しのリーク対策)。
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
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
      // KaTeX CSS は jsdelivr から非同期で <link> 注入する (LP の critical CSS から外す目的)。
      // jsdelivr.net を style-src に許可しないと CSP 違反でスタイルが適用されず数式が崩れる。
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      // KaTeX フォントは jsdelivr 経由で読まれるため font-src でも許可する (style-src と一対)。
      // 画像: Google profile / Stripe logo / KaTeX SVG / blob プレビュー +
      // Google Ads conversion ピクセル (1x1 GIF が doubleclick.net / google.com に飛ぶ)
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com https://www.google.co.jp",
      "font-src 'self' data: https://cdn.jsdelivr.net",
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
    // lucide-react は ~30 種以上のアイコンを名前付き import しているが、
    // バレルファイル経由だとツリーシェイクが効きにくく未使用アイコンまで
    // バンドルされる。Next.js の optimizePackageImports に渡すと SWC が
    // 名前付き import を個別ファイルへ書き換えてくれて初期 JS が ~40-60 KiB 削減できる。
    // 同様に katex も renderer 側のコードが多いので最適化対象に入れる。
    optimizePackageImports: ["lucide-react", "katex"],
  },
  // 本番ビルド時に console.log を除去 (warn / error は残す) — Lighthouse の
  // 「ブラウザのエラーがコンソールに記録されました」と「未使用 JS」両方に効く。
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
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
