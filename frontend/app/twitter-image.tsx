// Twitter card 用の OG 画像 (1200x630)。
// next/og の file-convention は `runtime` 等を静的に書く必要があるため、
// re-export ではなく値を直接書き、レンダラ関数だけ opengraph-image から拝借する。
import OgImage from "./opengraph-image";

export const runtime = "edge";
export const alt = "Eddivom — AI worksheet IDE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OgImage;
