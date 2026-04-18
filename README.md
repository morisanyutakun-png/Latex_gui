# Eddivom

**AI 教材作成 IDE — テンプレ駆動の raw LaTeX エディタ + AI チャット + OMR + 採点モード**

LaTeX を書けない先生・チューター・教材販売者のための self-serve SaaS。
12 種類のテンプレから選び、AI に依頼して、PDF を即出力する。
裏側は LuaLaTeX のプロ組版。

---

## 思想

Eddivom は LaTeX エディタではない。**AI 教材作成 IDE** である。

- **テンプレ駆動** — 12 種のテンプレで「使用パッケージ / 配色 / 見出し設計 / 図の流儀 /
  enumerate 規則 / 数式スタイル」の 6 項目を固定。AI もユーザーもテンプレの範囲内で編集する。
- **raw LaTeX をそのまま編集** — ブロック型構造化レイヤは廃止済。
  AI は `read_latex / set_latex / replace_in_latex / compile_check` のツールで
  LaTeX ソースを直接読み書きする。
- **Visual + LaTeX デュアルペイン** — KaTeX で数式を即時レンダリングする
  Notion ライクな WYSIWYG と、生 LaTeX ペインを切り替えられる。
- **裏は LuaLaTeX** — luatexja + Harano Aji フォントで日英バイリンガル組版。

---

## 主な機能

### テンプレートギャラリー
12 種の "starter templates"。スケルトンではなく、最初から完成度の高いサンプル本文付き。

| ID | テンプレ | 説明 |
|----|---------|------|
| `blank` | 白紙 | Word ライクな白紙 |
| `common-test` | 共通テスト風 | 70 分・100 点・大問 3 題の模試冊子 |
| `kokuko-niji` | 国公立二次風 | 150 分・200 点・記述式 3 題 |
| `school-test` | 学校テスト | 氏名欄+得点欄付き定期考査 |
| `juku` | 塾プリント | ★難度バッジ付き 90 分授業プリント |
| `kaisetsu-note` | 解説ノート | 定義→例題→定理→練習で 1 章 |
| `worksheet` | 演習プリント | 1 単元 7 問・基本/標準/発展 |
| `english-worksheet` | 英語ワークシート | vocab → reading → 設問 → 作文 |
| `article` | レポート・論文 | abstract → 5 セクション → 参考文献 |
| `report` | 技術報告書 | 表紙 + 目次 + 3 章 |
| `beamer` | プレゼン | 16:9・5 枚スライド |
| `letter` | 手紙・通信文 | 拝啓〜敬具・「記」付き案内状 |

### Visual + LaTeX デュアルエディタ
- **VisualEditor** (`frontend/components/editor/visual-editor.tsx`):
  contentEditable + KaTeX で数式・表・図を即時レンダリング
- **LatexCodeEditor**: 生 LaTeX ペイン。両側パネルは resize 可能
- **日本語数式入力**: 「ルートx」→ `\sqrt{x}`、「二分の一」→ `\frac{1}{2}` など
- **数式パレット / 数式辞書**: 記号と TeX コマンドの相互参照
- undo/redo, オートセーブ

### AI チャットエージェント
右サイドバーの **AI** タブから、文書全体をコンテキストに渡してチャット。
自律エージェントとしてツール呼び出しで raw LaTeX を直接編集する。

- **使用ツール**: `read_latex` / `set_latex` / `replace_in_latex` / `compile_check`
- **モデル**: OpenAI **gpt-4.1**(高精度)/ **gpt-4.1-mini**(通常)/ **gpt-4.1-nano**(高速)
- **SSE ストリーミング**: 思考ログと変更案がリアルタイムで表示
- **依頼例**:
  - 「問題を 3 問追加して、難度別に並べて」
  - 「この解説をもっとわかりやすく書き直して」
  - 「LaTeX エラーを直して」

### OMR(画像 / PDF 解析)
AIチャットパネルの📎ボタンから JPEG/PNG/GIF/WEBP/PDF をアップロード。
OpenAI Vision (`gpt-4.1-mini`) が問題冊子・ノート・答案を解析して、
構造化された raw LaTeX を文書に挿入する。

### 採点モード(Grading Mode)
4 ステップのウィザード形式 (`frontend/components/grading/`)。

1. **ルーブリック確認** — 問題 LaTeX に埋め込まれた `%@rubric:` コメントを
   AI が自動抽出 (`grading_service.py`)
2. **答案アップロード** — 生徒の答案画像 / PDF を複数枚投入
3. **AI 採点** — 観点別配点 (criterion / weight) ごとに自動採点 + コメント生成
4. **結果表示** — 設問別カードで点数・コメント・該当箇所をハイライト

ルーブリック記法(LaTeX コメントとして埋め込み):
```latex
%@rubric-begin: q1
%@rubric: label="問1"
%@rubric: points=20
%@rubric: criterion="式の立て方"; weight=8
%@rubric: criterion="計算過程の正確さ"; weight=7
%@rubric: criterion="最終解答"; weight=5
%@rubric-end
```

### 教材工場(バッチ生成)
`{{変数}}` プレースホルダ + CSV/JSON → 大量 PDF を ZIP で一括出力。
- 例: 生徒名簿 200 行から個人別プリントを一発生成
- API: `POST /api/batch/generate`
- バッチ上限は plan で管理(Pro: 100 行、Premium: 300 行)

### 認証 + 課金
- **認証**: NextAuth.js + Google OAuth (`frontend/auth.ts`)
- **課金**: Stripe Subscription (`backend/app/stripe_service.py`)
- **Webhook**: `POST /api/webhook/stripe` で plan 状態を Postgres に同期
- **プラン管理**: `frontend/lib/plans.ts` で Free / Starter / Pro / Premium を定義

### 多言語対応
- `frontend/lib/i18n.tsx` で `ja` / `en` を完全サポート
- ブラウザ言語を自動判定、ヘッダーの言語スイッチャで切替可能

### 上級者モード
- カスタムプリアンブル / フック / コマンド定義
- 100 種以上のパッケージプリセット(数学 / 図表 / 日本語 / 物理 / 化学)
- セキュリティ: `backend/app/security.py` で許可パッケージと TikZ ライブラリをホワイトリスト化

---

## 価格プラン

| プラン | 月額 | 高性能AI/月 | 教材PDF出力/月 | バッチ | OMR / 採点 |
|--------|------|-------------|----------------|--------|------------|
| Free | ¥0 | 3 | 1 | × | × |
| Starter | ¥1,980 | 150 | 無制限 | × | ○ |
| **Pro** | **¥4,980** | **500** | **無制限** | **100 行** | **○** |
| Premium | ¥19,800 | 2,000 | 無制限 | 300 行 | ○(優先) |

詳細は `frontend/lib/plans.ts` を、サーバサイドの上限値は `backend/app/plan_limits.py` を参照。
利用回数のカウントはサーバサイド (`backend/app/usage_service.py` / `UsageLog` テーブル) で管理されており、
フロント改変や API 直叩きでは上限をバイパスできない。

---

## アーキテクチャ

```
Browser (Next.js 16 + React 19)
    │
    ├─ /api/preview-latex   ──→ FastAPI ──→ LaTeX 生成
    ├─ /api/compile-raw     ──→ FastAPI ──→ LuaLaTeX ──→ PDF
    ├─ /api/ai/chat/stream  ──→ FastAPI ──→ OpenAI gpt-4.1
    ├─ /api/omr/analyze     ──→ FastAPI ──→ OpenAI Vision
    ├─ /api/grading/*       ──→ FastAPI ──→ OpenAI (rubric / 採点)
    ├─ /api/batch/generate  ──→ FastAPI ──→ LuaLaTeX × N → ZIP
    └─ /api/webhook/stripe  ──→ FastAPI ──→ Postgres (plan 同期)

データフロー:
  テンプレ選択 → raw LaTeX → コンパイル → PDF
  AI 依頼 → tool call → raw LaTeX 編集 → 承認 → 反映
  画像アップ → Vision → raw LaTeX 抽出 → 挿入
  答案画像 → 採点 AI → 観点別スコア + コメント
```

**Frontend:** Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Zustand / KaTeX / NextAuth.js
**Backend:** FastAPI / Python 3.11+ / SQLAlchemy / Stripe SDK
**AI:** OpenAI API (`gpt-4.1` / `gpt-4.1-mini` / `gpt-4.1-nano`)
**Typesetting:** LuaLaTeX + luatexja + Harano Aji フォント
**DB:** PostgreSQL (Neon)
**Auth:** Google OAuth 2.0
**Payments:** Stripe Subscription + Webhook

---

## セットアップ

### 前提条件

- **Node.js** 18 以上
- **Python** 3.11 以上
- **TeX Live** with LuaLaTeX + luatexja(PDF 生成に必要)
- **OpenAI API Key**(AI / OMR / 採点機能に必要)
- **PostgreSQL**(認証 + 課金を使う場合 — Neon 推奨)

### 1. バックエンド

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

環境変数(`backend/.env`):
```
OPENAI_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_PREMIUM=price_...
INTERNAL_API_SECRET=<ランダム文字列>
FRONTEND_URL=http://localhost:3000
```

起動:
```bash
uvicorn app.main:app --reload --port 8000
```

### 2. フロントエンド

```bash
cd frontend
npm install
npm run dev
```

環境変数(`frontend/.env.local`):
```
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
INTERNAL_API_SECRET=<バックエンドと同じ値>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

ブラウザで `http://localhost:3000` を開く。

### Docker(ローカルテスト)

```bash
docker-compose up --build
```

---

## 環境変数

### バックエンド

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API キー | AI / OMR / 採点を使う場合 |
| `OPENAI_MODEL_CHAT` | チャット用モデル(デフォルト `gpt-4.1`) | 任意 |
| `OPENAI_MODEL_VISION` | OMR / 採点用(デフォルト `gpt-4.1-mini`) | 任意 |
| `OPENAI_MODEL_FAST` | 高速処理用(デフォルト `gpt-4.1-nano`) | 任意 |
| `ALLOWED_ORIGINS` | CORS 許可オリジン(カンマ区切り) | 本番 |
| `DATABASE_URL` | PostgreSQL 接続文字列 | 認証/課金 |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | 課金 |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証 | 課金 |
| `STRIPE_PRICE_ID_*` | Starter / Pro / Premium の Price ID | 課金 |
| `INTERNAL_API_SECRET` | フロント↔バック間の内部認証 | 推奨 |
| `FRONTEND_URL` | Stripe Checkout のリダイレクト先 | 課金 |
| `COMPILE_TIMEOUT_SECONDS` | LaTeX コンパイルタイムアウト(秒) | 任意 |

### フロントエンド

| 変数名 | 説明 |
|--------|------|
| `API_URL` | バックエンド URL(サーバーサイド専用) |
| `NEXT_PUBLIC_API_URL` | バックエンド URL(クライアント) |
| `AUTH_SECRET` | NextAuth セッション暗号化キー |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `INTERNAL_API_SECRET` | バックエンドと同じ値 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開キー |

> `OPENAI_API_KEY` はフロントエンドには不要。バックエンドのみで管理。

---

## デプロイ

### バックエンド(Koyeb)

1. **Docker モードでデプロイ**(buildpack は不可 — TeX Live が必要)
2. メモリ: 1GB 以上推奨(LuaLaTeX が安定する)
3. 環境変数: 上記すべて
4. Webhook: Stripe ダッシュボードで `https://<koyeb-url>/api/webhook/stripe` を登録

### フロントエンド(Vercel)

1. **Vercel Pro プラン**(商用 self-serve のため)
2. Git 連携で自動デプロイ
3. 環境変数: 上記すべて
4. NextAuth コールバック: `https://<vercel-url>/api/auth/callback/google`

### DB(Neon)

1. Neon でプロジェクト作成、`DATABASE_URL` を取得
2. 起動時に `Base.metadata.create_all` が実行され、自動でテーブル生成

---

## API リファレンス(主要)

### PDF 生成
- `POST /api/preview-latex` — `DocumentModel` から LaTeX を生成して返す
- `POST /api/generate-pdf` — `DocumentModel` をコンパイルして PDF を返す
- `POST /api/compile-raw` — 生 LaTeX 文字列を直接コンパイル

### AI チャット
- `POST /api/ai/chat` — 単発レスポンス
- `POST /api/ai/chat/stream` — SSE ストリーミング(推奨)

### OMR
- `POST /api/omr/analyze` — 画像 / PDF から raw LaTeX を抽出
- `POST /api/omr/analyze/stream` — SSE 版

### 採点モード
- `POST /api/grading/extract-rubric/stream` — LaTeX からルーブリック抽出
- `POST /api/grading/grade/stream` — 答案画像を採点

### 教材工場(バッチ)
- `POST /api/batch/detect-variables` — `{{変数}}` を検出
- `POST /api/batch/preview` — 1 行目のプレビュー
- `POST /api/batch/generate` — 全行を ZIP で一括出力

### サブスクリプション
- `GET /api/subscription/me` — 現在のプラン取得
- `GET /api/subscription/usage` — 今月/今日の利用回数をサーバサイドから取得
- `POST /api/subscription/checkout` — Stripe Checkout URL を返す
- `POST /api/subscription/portal` — Stripe Customer Portal URL
- `POST /api/webhook/stripe` — Stripe Webhook 受信

---

## 開発ロードマップ

- [x] テンプレ駆動 raw LaTeX エディタ(12 テンプレ)
- [x] LuaLaTeX + 日本語組版(luatexja + Harano Aji)
- [x] 日本語数式入力(「ルートx」→ `\sqrt{x}`)
- [x] Visual + LaTeX デュアルペイン
- [x] AI チャット + tool call(`read_latex` / `set_latex` / `replace_in_latex`)
- [x] OMR 画像 / PDF 解析
- [x] 採点モード(rubric → AI 採点)
- [x] 教材工場(CSV バッチ生成)
- [x] Google OAuth + Stripe Subscription
- [x] EN / JA バイリンガル UI
- [x] 上級者モード(カスタムプリアンブル)
- [ ] 採点モード v2(手書き OCR 強化)
- [ ] テンプレートマーケットプレイス
- [ ] Slack / Google Classroom 連携
- [ ] PWA / モバイル対応

---

## ライセンス

MIT
