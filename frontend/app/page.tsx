import { Suspense } from "react";
import { headers } from "next/headers";
import { TemplateGallery } from "@/components/template/template-gallery";

// LP は User-Agent ヘッダから isMobile を判定するため動的レンダリングが必要。
// 純粋に静的化すると mobile 端末に PC レイアウトの HTML を送ってしまい、ハイドレーション
// 後に MobileLanding へ swap が起きて LCP に 2.5 秒以上の遅延が乗る (Lighthouse 実測).
//
// 代わりに Vercel の Edge Runtime + per-UA キャッシュ で TTFB を抑える。
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Edge は headers() 既定動作と差異あり、安全側で nodejs 維持

/**
 * User-Agent から大雑把にモバイル判定。Tailwind の md ブレークポイント (<768px) と
 * 完全一致はしないが、CrUX の対象になる主要モバイル端末 (Moto G / iPhone 等) を
 * 確実にモバイル扱いするために UA ベースで決め打ちする。微妙な狭幅 PC は client 側の
 * useEffect で再評価されるので最終的な見た目は崩れない。
 */
function detectMobileUA(ua: string): boolean {
  return /Mobi|Android|iPhone|iPod|Opera Mini|IEMobile|Mobile Safari/i.test(ua);
}

// LP 固有の FAQPage JSON-LD (リッチリザルト用)。layout.tsx (全ページ共通) から
// ここに移設することで /editor などの内部ページの HTML サイズを ~3KB 削れる。
// 静的レンダリングなので CDN にキャッシュされ、毎回パースするコストは発生しない。
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "AI で問題集を自動生成できますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。Eddivom はチャットで「二次関数の問題を10題」のように依頼するだけで、AIがLaTeX組版で問題を自動生成します。難易度や範囲・分野・問題数を自然言語で指定でき、生成と同時にPDFプレビューが更新されます。",
      },
    },
    {
      "@type": "Question",
      name: "解答付きPDFは自動で作成されますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。問題ページと解答ページがセットになったPDFを自動で書き出します。模範解答だけでなく略解・配点バッジ・解説の有無も指定でき、A4/B5の印刷に最適化されます。",
      },
    },
    {
      "@type": "Question",
      name: "数学プリント作成ソフトとして無料で使えますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "無料プランで会員登録なしに利用を開始できます。AI生成回数とPDF出力数に上限がありますが、数式・図・化学式の組版や直接編集は無料プランでも利用できます。",
      },
    },
    {
      "@type": "Question",
      name: "Overleaf との違いは何ですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Overleafは汎用LaTeXエディタですが、Eddivomは教材作成に特化したIDEです。AIによる問題自動生成・類題量産・解答付きPDFの自動構成・採点など、Overleafにはない教材作成専用フローを最初から備えています。日本語UIと日本語フォント (haranoaji) も初期設定済みです。",
      },
    },
    {
      "@type": "Question",
      name: "1つの問題から類題を自動で量産できますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。既存の問題にカーソルを当てて「類題を5問」と依頼すると、係数や設定を変えた類題をAIが生成します。難易度を一段上げる・下げるといった指示にも対応しています。",
      },
    },
    {
      "@type": "Question",
      name: "高校数学の確認テストや塾の教材作成にも使えますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。共通テスト風レイアウト・国公立二次風・学校用テスト・問題集など、高校数学の確認テスト作成や塾の教材作成に最適化されたテンプレートを多数収録しています。配点バッジや大問ボックスなど、紙に印刷したときに読みやすい体裁を初期設定で実現します。",
      },
    },
    {
      "@type": "Question",
      name: "ルーブリック採点機能はどう使いますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pro プランでは、答案画像をアップロードするとAIが採点項目ごとに○×と部分点を提案します。採点基準 (ルーブリック) は教員が編集でき、最終的な点数調整は人が行えます。OMR (マークシート) 採点も同じ画面から実行可能です。",
      },
    },
    {
      "@type": "Question",
      name: "既存のPDFや画像から問題を取り込めますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。OCR機能で既存のテストPDFや教科書画像を読み取り、数式を含めてLaTeXに変換します。読み取った内容をベースに、Eddivom内で類題量産や解答生成までシームレスに行えます。",
      },
    },
  ],
};

export default async function Home() {
  // サーバ側で UA を読み、isMobile を SSR HTML に反映させる。これだけで mobile LCP の
  // render delay が 2 秒以上削減される (Lighthouse の主要 LCP 候補が mobile banner なので).
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const initialIsMobile = detectMobileUA(ua);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      <Suspense>
        <TemplateGallery initialIsMobile={initialIsMobile} />
      </Suspense>
    </>
  );
}
