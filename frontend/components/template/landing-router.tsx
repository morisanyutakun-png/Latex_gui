"use client";

/**
 * LandingRouter — UA で MobileLandingShell / TemplateGallery を分岐し、
 * **どちらか片方の chunk だけが** ブラウザに読み込まれるよう振り分ける。
 *
 * Server Component から `next/dynamic` を直接呼ぶと、Next.js は両方を Page の
 * preload リストに載せてしまい、モバイルでも 137 KiB の TemplateGallery を
 * 落としてしまう (= 当初の Lighthouse で測られていた挙動)。
 * Client Component 経由で `next/dynamic` を使うと、ブラウザ側ランタイムで
 * 「実際に render したコンポーネントの chunk」だけを fetch するため、
 * モバイルでは PC LP の 137 KiB が完全にスキップされる。
 *
 * SSR は通常通り走る (initial paint で空白にならない)。
 */

import nextDynamic from "next/dynamic";

const TemplateGallery = nextDynamic(
  () => import("./template-gallery").then((m) => ({ default: m.TemplateGallery })),
);
const MobileLandingShell = nextDynamic(
  () => import("./mobile-landing-shell").then((m) => ({ default: m.MobileLandingShell })),
);

export function LandingRouter({ initialIsMobile }: { initialIsMobile: boolean }) {
  return initialIsMobile ? (
    <MobileLandingShell />
  ) : (
    <TemplateGallery initialIsMobile={false} />
  );
}
