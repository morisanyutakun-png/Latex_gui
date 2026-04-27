import { Suspense } from "react";
import { TemplateGallery } from "@/components/template/template-gallery";

// LP は SSG 化して Vercel CDN エッジにキャッシュさせる。TTFB と FCP を大きく改善する。
// 動的なユーザー固有データ (session / saved doc) は client hydration 後に取りに行くので、
// 静的レンダリングしても見た目は変わらない (= TemplateGallery 内部で client-side fetch される)。
export const dynamic = "force-static";
// CDN キャッシュの再検証間隔。コピー文言を更新したらここを短縮 or 即パージ。
export const revalidate = 3600;

export default function Home() {
  return (
    <Suspense>
      <TemplateGallery />
    </Suspense>
  );
}
