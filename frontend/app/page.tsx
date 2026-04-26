// ルート LP — Static prerender。
// モバイル UA は middleware が `/m` に rewrite するので、こちらは PC 専用として扱える。
// `headers()` を使わない → static export で CDN にキャッシュ → TTFB ~150-300ms。
import { Suspense } from "react";
import { TemplateGallery } from "@/components/template/template-gallery";

export const dynamic = "force-static";
export const revalidate = false;

export default function Home() {
  return (
    <Suspense>
      <TemplateGallery />
    </Suspense>
  );
}
