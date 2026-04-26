// 静的にプリレンダリングできる Server Component。
// middleware (`/` から UA がモバイルなら `/m` へ rewrite) 経由でアクセスされる。
// 明示的に `dynamic = "force-static"` にして CDN キャッシュを最大化。
import { Suspense } from "react";
import { MobileGate } from "@/components/template/mobile-gate";

export const dynamic = "force-static";
export const revalidate = false;

// 公開 LP として SEO 効果を出すため、独立した metadata を持つ。
// canonical は `/` を指して duplicate content を回避。
export const metadata = {
  alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://eddivom.com" },
};

export default function MobileHome() {
  return (
    <Suspense>
      <MobileGate />
    </Suspense>
  );
}
