"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { getAllowedPackages } from "@/lib/api";

/**
 * 上級者モードパネル
 * LaTeX プリアンブルの部分的カスタマイズ（フック）を許可
 */
export function AdvancedModePanel() {
  const document = useDocumentStore((s) => s.document);
  const updateAdvanced = useDocumentStore((s) => s.updateAdvanced);
  const toggleAdvancedMode = useDocumentStore((s) => s.toggleAdvancedMode);

  const [allowedPackages, setAllowedPackages] = useState<string[]>([]);
  const [allowedTikzLibs, setAllowedTikzLibs] = useState<string[]>([]);
  const [showPackages, setShowPackages] = useState(false);
  const [newCommand, setNewCommand] = useState("");

  const advanced = document?.advanced || {
    enabled: false,
    customPreamble: "",
    preDocument: "",
    postDocument: "",
    customCommands: [],
  };

  // 許可パッケージ一覧を取得
  useEffect(() => {
    if (advanced.enabled && allowedPackages.length === 0) {
      getAllowedPackages()
        .then((data) => {
          setAllowedPackages(data.packages);
          setAllowedTikzLibs(data.tikzLibraries);
        })
        .catch(() => {});
    }
  }, [advanced.enabled, allowedPackages.length]);

  const handleAddCommand = useCallback(() => {
    if (!newCommand.trim()) return;
    updateAdvanced({
      customCommands: [...advanced.customCommands, newCommand.trim()],
    });
    setNewCommand("");
  }, [newCommand, advanced.customCommands, updateAdvanced]);

  const handleRemoveCommand = useCallback(
    (index: number) => {
      updateAdvanced({
        customCommands: advanced.customCommands.filter((_, i) => i !== index),
      });
    },
    [advanced.customCommands, updateAdvanced]
  );

  if (!document) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* トグルヘッダー */}
      <button
        onClick={toggleAdvancedMode}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
          advanced.enabled
            ? "bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
            : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-750"
        }`}
      >
        <div className="flex items-center gap-2">
          <span>{advanced.enabled ? "🔓" : "🔒"}</span>
          <span>上級者モード</span>
          {advanced.enabled && (
            <span className="px-2 py-0.5 text-xs bg-purple-200 text-purple-800 rounded-full dark:bg-purple-800 dark:text-purple-200">
              有効
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {advanced.enabled ? "LaTeX フック有効" : "クリックで有効化"}
        </span>
      </button>

      {/* 展開コンテンツ */}
      {advanced.enabled && (
        <div className="p-4 space-y-5 bg-white dark:bg-slate-900">
          {/* 注意書き */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
            <strong>注意:</strong> セキュリティ上、使用できるパッケージとコマンドには制限があります。
            <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">\input</code>,
            <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">\directlua</code>,
            <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">\write18</code> 等は禁止されています。
          </div>

          {/* カスタムプリアンブル */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              カスタムプリアンブル
              <span className="text-xs text-slate-400 ml-2">(\begin&#123;document&#125; の前に挿入)</span>
            </label>
            <textarea
              value={advanced.customPreamble}
              onChange={(e) => updateAdvanced({ customPreamble: e.target.value })}
              placeholder={`% 例: 追加パッケージやカスタム設定\n\\usepackage{siunitx}\n\\sisetup{locale=JP}`}
              className="w-full h-28 px-3 py-2 text-sm font-mono bg-slate-900 text-green-400 border border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* カスタムコマンド */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              カスタムコマンド定義
              <span className="text-xs text-slate-400 ml-2">(\newcommand, \renewcommand, \DeclareMathOperator)</span>
            </label>
            <div className="space-y-1">
              {advanced.customCommands.map((cmd, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="flex-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-700 dark:text-slate-300 truncate">
                    {cmd}
                  </code>
                  <button
                    onClick={() => handleRemoveCommand(i)}
                    className="px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-950"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCommand()}
                placeholder="\\newcommand{\\R}{\\mathbb{R}}"
                className="flex-1 px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
              <button
                onClick={handleAddCommand}
                className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700"
              >
                追加
              </button>
            </div>
          </div>

          {/* Pre/Post Document フック */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Pre-document フック
                <span className="block text-xs text-slate-400">\maketitle 直後</span>
              </label>
              <textarea
                value={advanced.preDocument}
                onChange={(e) => updateAdvanced({ preDocument: e.target.value })}
                placeholder="% \maketitle の後に挿入されるコード"
                className="w-full h-20 px-3 py-2 text-xs font-mono bg-slate-900 text-green-400 border border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Post-document フック
                <span className="block text-xs text-slate-400">\end&#123;document&#125; 直前</span>
              </label>
              <textarea
                value={advanced.postDocument}
                onChange={(e) => updateAdvanced({ postDocument: e.target.value })}
                placeholder="% \end{document} の前に挿入されるコード"
                className="w-full h-20 px-3 py-2 text-xs font-mono bg-slate-900 text-green-400 border border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* 許可パッケージ一覧 */}
          <div className="space-y-2">
            <button
              onClick={() => setShowPackages(!showPackages)}
              className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
            >
              {showPackages ? "▼" : "▶"} 使用可能なパッケージ一覧 ({allowedPackages.length}個)
            </button>
            {showPackages && allowedPackages.length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex flex-wrap gap-1.5">
                  {allowedPackages.map((pkg) => (
                    <span
                      key={pkg}
                      className="px-2 py-0.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded font-mono text-slate-600 dark:text-slate-300"
                    >
                      {pkg}
                    </span>
                  ))}
                </div>
                {allowedTikzLibs.length > 0 && (
                  <>
                    <p className="text-xs text-slate-500 mt-3 mb-1 font-medium dark:text-slate-400">TikZ ライブラリ:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allowedTikzLibs.map((lib) => (
                        <span
                          key={lib}
                          className="px-2 py-0.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded font-mono text-slate-600 dark:text-slate-300"
                        >
                          {lib}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
