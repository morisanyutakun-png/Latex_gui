import { Suspense } from "react";
import { headers } from "next/headers";
import dynamic from "next/dynamic";

// PC 版 LP — 通常 import (デスクトップ UA でしか使われない)
import { TemplateGallery } from "@/components/template/template-gallery";

// モバイル版 LP — UA がモバイルのときだけ評価される。
// これにより PC 用の重い LP コードはモバイルユーザに送られない (PageSpeed: 未使用 JS 削減)。
const MobileGate = dynamic(
  () => import("@/components/template/mobile-gate").then((m) => m.MobileGate),
  { ssr: true },
);

/**
 * モバイル UA の単純判定。
 * Lighthouse は Moto G Power をエミュレートするので "Mobi" を含む UA に当たる。
 * Chromebook / iPad の UA は意図的に PC 扱い (PC LP の方が表現力が高い)。
 */
function isMobileUA(ua: string): boolean {
  if (!ua) return false;
  // iPad は最近のバージョンで Mac UA を返すので除外。Mobi/Android/iPhone のみ拾う。
  return /Mobi|Android.*Mobile|iPhone/i.test(ua);
}

export default async function Home() {
  const ua = (await headers()).get("user-agent") ?? "";
  const mobile = isMobileUA(ua);

  return (
    <Suspense>
      {mobile ? <MobileGate /> : <TemplateGallery />}
    </Suspense>
  );
}
