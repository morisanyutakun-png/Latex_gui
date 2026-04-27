import { Suspense } from "react";
import { TemplateGallery } from "@/components/template/template-gallery";

// LP は SSG 化して Vercel CDN エッジにキャッシュさせる。TTFB と FCP を大きく改善する。
// 動的なユーザー固有データ (session / saved doc) は client hydration 後に取りに行くので、
// 静的レンダリングしても見た目は変わらない (= TemplateGallery 内部で client-side fetch される)。
export const dynamic = "force-static";
// CDN キャッシュの再検証間隔。コピー文言を更新したらここを短縮 or 即パージ。
export const revalidate = 3600;

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

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      <Suspense>
        <TemplateGallery />
      </Suspense>
    </>
  );
}
