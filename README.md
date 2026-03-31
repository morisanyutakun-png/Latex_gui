# かんたんPDFメーカー

**LaTeXを知らなくても、高品質な教材・試験・資料をAIと一緒に作れるWebアプリ**

ブロックを組み合わせ、チャットでAIに頼み、画像を読み取らせて、最後にLaTeX品質のPDFで出力。
LaTeXの知識は不要。でも、LaTeXの強さを裏で使い倒せる。

---

## 思想

このアプリは「LaTeXエディタ」ではなく、**LaTeX制作OS** です。

- **Wordみたいに** — ブロックで直感的に組める
- **Notionみたいに** — `/`コマンドで素早くブロック追加
- **VS Code / Copilotみたいに** — チャットで頼めば、AIが文書を理解して動いてくれる
- **LaTeX品質で** — 裏ではLuaLaTeXが動き、プロ並みの組版で出力

---

## 主な機能

### ブロック編集 (GUI)
- 13種類のブロック: 見出し・テキスト・数式・リスト・表・画像・コード・引用・回路図・ダイアグラム・化学式・グラフ・区切り線
- `/`コマンドパレット — テキスト入力中に`/`を入力するとブロック種別を切り替え・追加
- 日本語数式入力 — 「ルートx」「二分の一」などの日本語でLaTeX数式を入力
- undo/redo (50件), オートセーブ

### AI アシスタント
- 右サイドバーの **AI** タブからチャット
- 現在の文書をコンテキストとして送信し、Claudeが内容を理解して応答
- 「問題を3つ追加して」「章立てを整理して」「表を見やすくして」などの依頼が可能
- AIが変更を **パッチ形式** で返す → 内容を確認して「適用する」ボタンで反映
- 適用はundo/redoに対応（1パッチセット = 1 Ctrl+Z）

### OMR（画像読み取り）
- AIチャットパネルの📎ボタンから画像をアップロード
- Claude Visionが画像（試験問題・ノート・答案用紙など）を解析して構造化
- 抽出されたブロックをパッチとして提案 → 承認でドキュメントに取り込む

### LaTeXソースビューア
- 右サイドバーの **LaTeX** タブで生成されたLaTeXソースを確認
- シンタックスハイライト付き、コピーボタン付き

### 上級者モード
- カスタムプリアンブル・フック・コマンド定義
- 100種類以上のパッケージプリセット（数学・図表・日本語・物理化学など）

### 教材工場（バッチ生成）
- `{{変数}}`プレースホルダー + CSV/JSON → 大量PDFを一括生成
- 例: 生徒名簿から個人別プリントを200枚一括出力

---

## アーキテクチャ

```
Browser (Next.js)
    │
    ├─ /api/generate-pdf ──→ FastAPI ──→ LuaLaTeX ──→ PDF
    ├─ /api/ai/chat       ──→ FastAPI ──→ Anthropic Claude API
    └─ /api/omr/analyze   ──→ FastAPI ──→ Anthropic Claude Vision

データフロー:
  GUI操作 → JSON (DocumentModel) → LaTeX生成 → LuaLaTeXコンパイル → PDF
  AI依頼  → Claude (文書コンテキスト付き) → パッチ (DocumentPatch) → GUI反映
  画像アップ → Claude Vision → 構造化ブロック → GUI取り込み
```

**Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Zustand + KaTeX
**Backend:** FastAPI + Python 3.11+ + Uvicorn
**AI:** Anthropic Claude API (`claude-sonnet-4-6` for chat, `claude-opus-4-6` for OMR)
**Typesetting:** LuaLaTeX + luatexja (Noto CJK fonts)

---

## セットアップ

### 前提条件

- **Node.js** 18以上
- **Python** 3.11以上
- **TeX Live** with LuaLaTeX + luatexja（PDF生成に必要）
- **Anthropic API Key**（AI・OMR機能に必要）

### 1. バックエンド

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

環境変数を設定（`backend/.env` を作成）:
```
ANTHROPIC_API_KEY=sk-ant-...    # AI・OMR機能に必要
ALLOWED_ORIGINS=http://localhost:3000
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

ブラウザで `http://localhost:3000` を開く。

### Docker（ローカルテスト）

```bash
docker-compose up --build
```

---

## 環境変数

### バックエンド（Koyeb / `.env`）

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | Claude APIキー（AI・OMR機能） | AI機能を使う場合 |
| `ALLOWED_ORIGINS` | CORSオリジン（カンマ区切り） | 本番環境 |
| `COMPILE_TIMEOUT_SECONDS` | LaTeXコンパイルタイムアウト（秒） | 任意（デフォルト120） |

### フロントエンド（Vercel / `.env.local`）

| 変数名 | 説明 |
|--------|------|
| `API_URL` | バックエンドURL（サーバーサイド専用） |
| `NEXT_PUBLIC_API_URL` | バックエンドURL（ローカル開発用） |

> `ANTHROPIC_API_KEY` はフロントエンドには不要。バックエンドのみで管理。

---

## デプロイ

### バックエンド（Koyeb）

1. Docker モードでデプロイ（buildpackは不可 — TeX Liveが必要）
2. メモリ: 512MB以上
3. 環境変数: `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`（VercelのURL）

### フロントエンド（Vercel）

1. Git連携で自動デプロイ
2. 環境変数: `API_URL`（KoyebのURL）

---

## AI機能の使い方

### チャットで文書を編集する

1. エディタ右上の **Bot** アイコン → AI タブを開く
2. 入力欄に依頼を入力して送信

**依頼の例:**
- `「はじめに」「本論」「まとめ」の3章を追加して`
- `この問題の解説をもっとわかりやすく書き直して`
- `表のヘッダーを太字にして見やすくして`
- `数式ブロックを追加して、2次方程式の解の公式を入れて`

3. AIが変更案を返したら「◯件の変更を確認・適用」をクリック
4. 変更内容を確認して「**適用する**」→ 文書に反映

適用後に後悔したら `Cmd+Z` でundo可能。

### OMR（画像読み取り）

1. AI タブの📎ボタンをクリック
2. 試験問題・ノート・答案用紙などの画像を選択（JPEG/PNG/GIF/WEBP、5MB以下）
3. AIが画像を解析してブロックとして提案
4. 「適用する」で文書に取り込む

---

## ブロック種別

| 種別 | 説明 | LaTeX変換 |
|------|------|-----------|
| 見出し | セクション見出し（レベル1-3） | `\section`, `\subsection` |
| テキスト | 本文（インライン数式対応） | `\par` |
| 数式 | LaTeX数式（日本語入力対応） | `\[...\]` / `$...$` |
| リスト | 箇条書き・番号リスト | `itemize` / `enumerate` |
| 表 | データ表組み | `tabular` + booktabs |
| 画像 | 外部URL画像 | `\includegraphics` |
| コード | プログラムコード | `lstlisting` |
| 引用 | 引用・コールアウト | `tcolorbox` |
| 回路図 | 電子回路（circuitikz） | `circuitikz` |
| ダイアグラム | フローチャート・状態図（TikZ） | `tikzpicture` |
| 化学式 | 化学反応式（mhchem） | `\ce{}` |
| グラフ | データ可視化（pgfplots） | `pgfplots` |
| 区切り線 | 水平線 | `\hrule` |

---

## 開発ロードマップ

- [x] ブロックベースGUI編集
- [x] LuaLaTeX + 日本語組版
- [x] 日本語数式入力（「ルートx」→ `\sqrt{x}`）
- [x] 教材工場（バッチPDF生成）
- [x] 上級者モード（カスタムプリアンブル）
- [x] AI チャット + 文書パッチ（Claude API）
- [x] OMR 画像解析（Claude Vision）
- [x] LaTeXソースビューア
- [x] スラッシュコマンドパレット
- [ ] リアルタイムプレビュー（PDF / HTML）
- [ ] クラウド保存 / ユーザー認証
- [ ] テンプレートマーケットプレイス
- [ ] モバイル対応（PWA）
- [ ] コラボレーション編集

---

## ライセンス

MIT
