# かんたんPDFメーカー 🎨

**LaTeXの高品質PDF生成能力を、GUIで誰でも使えるようにするWebアプリ**

テンプレートを選んで、ブロックを組み合わせるだけで、整ったPDFが作れます。  
LaTeXの知識は一切不要です。

---

## アーキテクチャ

```
Frontend (Next.js)          Backend (FastAPI)
┌──────────────┐           ┌──────────────────┐
│ GUI操作       │  JSON →   │ LaTeX生成         │
│ ブロック編集   │ ───────→  │ XeLaTeXコンパイル   │
│ テンプレ選択   │  ← PDF   │ PDF返却           │
└──────────────┘           └──────────────────┘
```

**データフロー:** GUI入力 → JSON中間表現 → LaTeX生成 → XeLaTeXコンパイル → PDF

---

## セットアップ

### 前提条件

- **Node.js** 18以上
- **Python** 3.11以上
- **XeLaTeX**（TeX Liveなど）
- macOS の場合、ヒラギノフォントが利用可能であること

#### XeLaTeXのインストール（macOS）

```bash
# Homebrew経由
brew install --cask mactex-no-gui

# または BasicTeX（軽量版）
brew install --cask basictex
# BasicTexの場合、追加パッケージが必要:
sudo tlmgr update --self
sudo tlmgr install xetex xecjk fontspec geometry graphicx hyperref enumitem xcolor titlesec fancyhdr tcolorbox
```

### Backend 起動

```bash
cd backend

# 仮想環境作成・有効化
python3 -m venv venv
source venv/bin/activate

# 依存パッケージインストール
pip install -r requirements.txt

# サーバー起動（ポート8000）
uvicorn app.main:app --reload --port 8000
```

### Frontend 起動

```bash
cd frontend

# 依存パッケージインストール
npm install

# 開発サーバー起動（ポート3000）
npm run dev
```

### アクセス

ブラウザで http://localhost:3000 を開きます。

---

## 使い方

1. **テンプレートを選ぶ** — レポート / 案内文 / 教材の3種類
2. **文書情報を入力** — タイトル、作成者、日付
3. **ブロックを追加** — 見出し、本文、箇条書き、表、画像
4. **並び替え・編集** — 右パネルで構成を確認、上下移動で並び替え
5. **PDFを作る** — ボタン1つでPDF生成・ダウンロード
6. **保存・再編集** — JSONでローカル保存、後から再読み込み可能

---

## プロジェクト構成

```
Latex_gui/
├── docker-compose.yml          # ローカル開発用
├── backend/
│   ├── Dockerfile              # Koyebデプロイ用
│   ├── .dockerignore
│   ├── app/
│   │   ├── main.py              # FastAPIエントリーポイント
│   │   ├── models.py            # Pydantic中間表現モデル
│   │   ├── pdf_service.py       # PDF生成サービス
│   │   ├── generators/          # テンプレート別LaTeX生成
│   │   │   ├── report.py
│   │   │   ├── announcement.py
│   │   │   └── worksheet.py
│   │   └── utils/               # 共通ユーティリティ
│   │       ├── latex_utils.py   # エスケープ・変換
│   │       └── base_generator.py # 共通レンダリング
│   ├── sample_data/             # サンプルJSON
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile              # ローカルDocker用
│   ├── .dockerignore
│   ├── app/
│   │   ├── page.tsx             # メインページ
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/              # UIコンポーネント
│   │   ├── DocumentEditor.tsx   # メインエディタ（状態管理）
│   │   ├── TemplateSelector.tsx # テンプレート選択画面
│   │   ├── MetadataForm.tsx     # 文書情報フォーム
│   │   ├── BlockPalette.tsx     # ブロック追加パネル
│   │   ├── BlockList.tsx        # 構成一覧パネル
│   │   └── BlockForm.tsx        # ブロック編集フォーム
│   └── lib/                     # ロジック層
│       ├── types.ts             # TypeScript型定義
│       ├── api.ts               # APIクライアント
│       └── storage.ts           # JSON保存・読込
└── README.md
```

---

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/generate-pdf` | PDF生成（JSON → PDF） |
| POST | `/api/preview-latex` | LaTeXソースプレビュー |

---

## サンプルJSONでのテスト

```bash
# Backend起動後にcurlでテスト
cd backend

# レポートのPDF生成
curl -X POST http://localhost:8000/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d @sample_data/sample_report.json \
  --output report.pdf

# 案内文
curl -X POST http://localhost:8000/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d @sample_data/sample_announcement.json \
  --output announcement.pdf

# 教材
curl -X POST http://localhost:8000/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d @sample_data/sample_worksheet.json \
  --output worksheet.pdf
```

---

## 中間表現（JSON）の構造

```json
{
  "template": "report" | "announcement" | "worksheet",
  "metadata": {
    "title": "文書タイトル",
    "subtitle": "サブタイトル",
    "author": "作成者",
    "date": "日付"
  },
  "blocks": [
    { "type": "heading", "text": "見出し", "level": 1 },
    { "type": "paragraph", "text": "本文テキスト" },
    { "type": "list", "style": "bullet", "items": ["項目1", "項目2"] },
    { "type": "table", "headers": ["列1", "列2"], "rows": [["A", "B"]] },
    { "type": "image", "url": "https://...", "caption": "説明", "width": 0.8 }
  ]
}
```

---

## 次フェーズの改善案

### UX強化
- ドラッグ＆ドロップでのブロック並び替え
- リアルタイムHTMLプレビュー
- テンプレートのサムネイルプレビュー
- Undo/Redo機能
- キーボードショートカット

### 機能拡張
- 画像アップロード対応（Base64 / S3）
- AI文章補助（GPT連携）
- CSV差し込み一括PDF生成
- カスタムテーマ（色・フォント・ロゴ）
- ユーザー認証・クラウド保存

### モバイル対応 / App Store展開
- PWA化（オフライン対応）
- React Native / Capacitor でネイティブアプリ化
- API中心設計のためバックエンドはそのまま再利用可能
- モバイル向けUIの最適化（タッチ操作・スワイプ）

### インフラ
- PDFキャッシュ・非同期生成

---

## デプロイ

### 構成

```
ブラウザ → Vercel (Next.js) → Koyeb (FastAPI + TeX Live)
                 ↑ Route Handler でプロキシ      ↑ Docker コンテナ
```

| サービス | プラットフォーム | 備考 |
|---------|---------------|------|
| Frontend (Next.js) | Vercel | Git連携で自動デプロイ |
| Backend (FastAPI + TeX Live) | Koyeb | Docker モードで必ずデプロイ |

**通信フロー:** ブラウザ → Vercel `/api/generate-pdf` (Route Handler) → Koyeb バックエンド → PDF返却

### Docker でローカル確認

```bash
# プロジェクトルートで実行
docker compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

### 1. Backend を Koyeb にデプロイ（先にやる）

1. GitHubにリポジトリをプッシュ
2. [Koyeb](https://app.koyeb.com/) でアカウント作成
3. 「Create App」→ **必ず「Docker」を選択**（Buildpackでは TeX Live が正しくインストールされません）
4. GitHub リポジトリを接続し、以下を設定:
   - **Dockerfile path:** `backend/Dockerfile`
   - **Build context:** `backend/`
   - **Port:** `8000`
5. **インスタンスタイプ:** Nano ($2.7/月) 以上、メモリ 512MB+
   - lualatex はメモリを多く使うため、256MB インスタンスではタイムアウトします
6. 環境変数を設定（Koyeb 管理画面 → Environment Variables）:
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`（後で Vercel の URL が分かったら設定）
7. デプロイ実行
8. デプロイ後に `https://your-backend.koyeb.app/api/health` にアクセスして動作確認
9. `https://your-backend.koyeb.app/api/debug/tex-info` で TeX 環境を確認

> **⚠️ 重要:** Koyeb の URL（例: `https://xxx-xxx.koyeb.app`）をメモしておく。次の Vercel 設定で使います。

> **トラブルシューティング:**
> - `CJK.sty not found` → Koyeb のデプロイが **Docker モード** か確認（Buildpack ではダメ）
> - `lualatex timeout` → インスタンスのメモリが 256MB 以下でないか確認
> - ビルドログで `[OK] pdflatex + bxcjkjatype` / `[OK] lualatex` が出ているか確認

### 2. Frontend を Vercel にデプロイ

1. [Vercel](https://vercel.com/) でアカウント作成
2. 「Import Project」→ GitHubリポジトリを接続
3. 以下を設定:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js（自動検出）
4. **環境変数を設定（Vercel Settings → Environment Variables）:**
   - `API_URL` = `https://your-backend.koyeb.app`（Koyeb の URL）
   
   > ⚠️ `NEXT_PUBLIC_API_URL` ではなく **`API_URL`** を設定してください。  
   > ブラウザからは Vercel の Route Handler 経由でプロキシするため、  
   > バックエンド URL はサーバーサイドだけで使います（CORS 問題を回避）。

5. デプロイ実行
6. Vercel のデプロイ完了後、Vercel の URL（例: `https://your-app.vercel.app`）を  
   Koyeb の環境変数 `ALLOWED_ORIGINS` に設定

### 3. 動作確認

1. Vercel の URL にアクセス → エディタ画面を開く
2. テンプレートを選択してブロックを追加
3. 「PDF出力」ボタンを押す
4. 初回はバックエンドのコールドスタートで 15-30 秒かかることがあります  
   → タイムアウトした場合は数秒待って再度ボタンを押してください
5. 2回目以降は 5-15 秒で生成されます

### 環境変数一覧

| 変数名 | 設定場所 | 必須 | 説明 | 例 |
|--------|---------|------|------|-----|
| `API_URL` | Vercel | **必須** | Koyeb バックエンドの URL（サーバーサイドのみ） | `https://xxx.koyeb.app` |
| `ALLOWED_ORIGINS` | Koyeb | **必須** | CORS で許可する Vercel の URL | `https://xxx.vercel.app` |
| `CJK_MAIN_FONT` | Koyeb | 任意 | 明朝体フォント名（Dockerfile で設定済み） | `Noto Serif CJK JP` |
| `CJK_SANS_FONT` | Koyeb | 任意 | ゴシック体フォント名（Dockerfile で設定済み） | `Noto Sans CJK JP` |
| `COMPILE_MEM_LIMIT_MB` | Koyeb | 任意 | LaTeX プロセスのメモリ上限 (MB) | `1536` |

> **注意:** `NEXT_PUBLIC_API_URL` は本番環境では設定しないでください。  
> 設定するとブラウザから直接バックエンドにアクセスしてしまい、CORS エラーが発生します。  
> ローカル開発時のみ `NEXT_PUBLIC_API_URL=http://localhost:8000` を `.env.local` に設定します。
