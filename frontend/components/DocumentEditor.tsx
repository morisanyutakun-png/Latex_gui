"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DocumentModel,
  TemplateType,
  Block,
  BlockType,
  Metadata,
  TEMPLATES,
  createDefaultBlock,
  createDefaultDocument,
} from "@/lib/types";
import { generatePDF, ApiError } from "@/lib/api";
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadAsJSON,
  loadFromJSONFile,
} from "@/lib/storage";

import TemplateSelector from "./TemplateSelector";
import MetadataForm from "./MetadataForm";
import BlockPalette from "./BlockPalette";
import BlockList from "./BlockList";
import BlockForm from "./BlockForm";

type AppPhase = "template" | "editor";

export default function DocumentEditor() {
  const [phase, setPhase] = useState<AppPhase>("template");
  const [document, setDocument] = useState<DocumentModel | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // 自動保存の復元チェック
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved && saved.blocks.length > 0) {
      setDocument(saved);
      setPhase("editor");
    }
  }, []);

  // 自動保存
  useEffect(() => {
    if (document) {
      saveToLocalStorage(document);
    }
  }, [document]);

  // トースト自動消去
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  // テンプレート選択
  const handleSelectTemplate = (template: TemplateType) => {
    setDocument(createDefaultDocument(template));
    setPhase("editor");
    setSelectedBlockIndex(null);
  };

  // メタデータ更新
  const handleMetadataChange = (metadata: Metadata) => {
    if (!document) return;
    setDocument({ ...document, metadata });
  };

  // ブロック追加
  const handleAddBlock = (type: BlockType) => {
    if (!document) return;
    const newBlock = createDefaultBlock(type);
    const blocks = [...document.blocks, newBlock];
    setDocument({ ...document, blocks });
    setSelectedBlockIndex(blocks.length - 1);
  };

  // ブロック更新
  const handleBlockChange = (index: number, block: Block) => {
    if (!document) return;
    const blocks = [...document.blocks];
    blocks[index] = block;
    setDocument({ ...document, blocks });
  };

  // ブロック削除
  const handleDeleteBlock = (index: number) => {
    if (!document) return;
    const blocks = document.blocks.filter((_, i) => i !== index);
    setDocument({ ...document, blocks });
    if (selectedBlockIndex === index) {
      setSelectedBlockIndex(null);
    } else if (selectedBlockIndex !== null && selectedBlockIndex > index) {
      setSelectedBlockIndex(selectedBlockIndex - 1);
    }
  };

  // ブロック移動
  const handleMoveUp = (index: number) => {
    if (!document || index === 0) return;
    const blocks = [...document.blocks];
    [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
    setDocument({ ...document, blocks });
    if (selectedBlockIndex === index) setSelectedBlockIndex(index - 1);
    else if (selectedBlockIndex === index - 1) setSelectedBlockIndex(index);
  };

  const handleMoveDown = (index: number) => {
    if (!document || index >= document.blocks.length - 1) return;
    const blocks = [...document.blocks];
    [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
    setDocument({ ...document, blocks });
    if (selectedBlockIndex === index) setSelectedBlockIndex(index + 1);
    else if (selectedBlockIndex === index + 1) setSelectedBlockIndex(index);
  };

  // PDF生成
  const handleGeneratePDF = async () => {
    if (!document) return;

    if (document.blocks.length === 0) {
      showToast("ブロックを1つ以上追加してください", "error");
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await generatePDF(document);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.metadata.title || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDFを作成しました！ダウンロードを確認してください。", "success");
    } catch (e) {
      if (e instanceof ApiError) {
        showToast(e.userMessage, "error");
      } else {
        showToast("サーバーに接続できません。バックエンドが起動しているか確認してください。", "error");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // JSON保存
  const handleSaveJSON = () => {
    if (!document) return;
    downloadAsJSON(document);
    showToast("ファイルを保存しました", "success");
  };

  // JSON読込
  const handleLoadJSON = async () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const doc = await loadFromJSONFile(file);
        setDocument(doc);
        setPhase("editor");
        setSelectedBlockIndex(null);
        showToast("ファイルを読み込みました", "success");
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    };
    input.click();
  };

  // 新規作成
  const handleNewDocument = () => {
    setPhase("template");
    setDocument(null);
    setSelectedBlockIndex(null);
  };

  // --- テンプレート選択画面 ---
  if (phase === "template") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <TemplateSelector
            selected={document?.template ?? null}
            onSelect={handleSelectTemplate}
          />
          <div className="mt-6 text-center">
            <button
              onClick={handleLoadJSON}
              className="text-sm text-gray-400 hover:text-blue-500 transition cursor-pointer"
            >
              保存したファイルを開く
            </button>
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // --- エディタ画面 ---
  const templateInfo = TEMPLATES.find((t) => t.id === document?.template);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={handleNewDocument}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
            title="テンプレート選択に戻る"
          >
            ← 戻る
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              {document?.metadata.title || "無題のドキュメント"}
            </h1>
            <span className="text-xs text-gray-400">
              {templateInfo?.icon} {templateInfo?.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadJSON}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            開く
          </button>
          <button
            onClick={handleSaveJSON}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            保存
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg
              hover:bg-blue-700 disabled:bg-blue-300 transition shadow-sm cursor-pointer
              flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⏳</span>
                作成中...
              </>
            ) : (
              "PDFを作る"
            )}
          </button>
        </div>
      </header>

      {/* Main 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Block Palette */}
        <aside className="w-64 border-r border-gray-200 bg-white p-4 overflow-y-auto hidden md:block">
          <BlockPalette onAdd={handleAddBlock} />
        </aside>

        {/* Center - Editor */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {document && (
              <MetadataForm
                metadata={document.metadata}
                onChange={handleMetadataChange}
              />
            )}

            {/* モバイル用ブロック追加ボタン */}
            <div className="md:hidden">
              <BlockPalette onAdd={handleAddBlock} />
            </div>

            {/* 選択中ブロックの編集フォーム */}
            {selectedBlockIndex !== null && document?.blocks[selectedBlockIndex] && (
              <div className="bg-white rounded-xl border-2 border-blue-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-600">
                    ブロック #{selectedBlockIndex + 1} を編集中
                  </h3>
                  <button
                    onClick={() => setSelectedBlockIndex(null)}
                    className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                  >
                    閉じる
                  </button>
                </div>
                <BlockForm
                  block={document.blocks[selectedBlockIndex]}
                  index={selectedBlockIndex}
                  onChange={handleBlockChange}
                />
              </div>
            )}

            {!selectedBlockIndex && document?.blocks.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">ここに文書の内容が表示されます</p>
                <p className="text-sm">
                  左のパネルから「見出し」や「本文」を追加して、
                  <br />
                  文書を組み立ててみましょう。
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel - Block List */}
        <aside className="w-72 border-l border-gray-200 bg-white p-4 overflow-y-auto hidden lg:block">
          {document && (
            <BlockList
              blocks={document.blocks}
              selectedIndex={selectedBlockIndex}
              onSelect={setSelectedBlockIndex}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDelete={handleDeleteBlock}
            />
          )}
        </aside>
      </div>

      {/* Mobile Bottom: Block List for small screens */}
      <div className="lg:hidden border-t border-gray-200 bg-white p-4 max-h-48 overflow-y-auto">
        {document && (
          <BlockList
            blocks={document.blocks}
            selectedIndex={selectedBlockIndex}
            onSelect={setSelectedBlockIndex}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDelete={handleDeleteBlock}
          />
        )}
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

// --- Toast Component ---
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div
        className={`px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          type === "success"
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
