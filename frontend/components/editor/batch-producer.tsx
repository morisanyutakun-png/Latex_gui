"use client";

import React, { useState, useCallback, useRef } from "react";
import { useDocumentStore } from "@/store/document-store";
import { detectVariables, batchGeneratePDFs, batchPreview } from "@/lib/api";
import { BatchRequest } from "@/lib/types";

/**
 * バッチ生成パネル (教材工場)
 * テンプレート × 変数 で PDF を量産する機能
 */
export function BatchProducer() {
  const document = useDocumentStore((s) => s.document);
  const [isOpen, setIsOpen] = useState(false);
  const [variables, setVariables] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [filenameTemplate, setFilenameTemplate] = useState("{{_index}}_document");
  const [maxRows, setMaxRows] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [previewLatex, setPreviewLatex] = useState("");
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 変数検出
  const handleDetectVariables = useCallback(async () => {
    if (!document) return;
    setIsDetecting(true);
    setError("");
    try {
      const vars = await detectVariables(document);
      setVariables(vars);
      if (vars.length === 0) {
        setError("テンプレート内に {{変数名}} プレースホルダが見つかりません。\nテキストブロック等に {{名前}} のように記述してください。");
      } else {
        // CSV ヘッダーを自動生成
        if (!csvText.trim()) {
          setCsvText(vars.join(",") + "\n");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "変数検出に失敗しました");
    } finally {
      setIsDetecting(false);
    }
  }, [document, csvText]);

  // CSV ファイル読み込み
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  }, []);

  // プレビュー (1行目)
  const handlePreview = useCallback(async () => {
    if (!document || !csvText.trim()) return;
    setError("");
    try {
      const req: BatchRequest = {
        template: document,
        variablesCsv: csvText,
        filenameTemplate,
        maxRows,
      };
      const result = await batchPreview(req);
      setPreviewLatex(result.latex);
      setPreviewVars(result.variables);
      setTotalRows(result.totalRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "プレビューに失敗しました");
    }
  }, [document, csvText, filenameTemplate, maxRows]);

  // バッチ生成
  const handleGenerate = useCallback(async () => {
    if (!document || !csvText.trim()) return;
    setIsGenerating(true);
    setError("");
    setProgress("PDF を量産中...");
    try {
      const req: BatchRequest = {
        template: document,
        variablesCsv: csvText,
        filenameTemplate,
        maxRows,
      };
      const blob = await batchGeneratePDFs(req);

      // ZIP ダウンロード
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = "batch_output.zip";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setProgress("完了! ZIP ファイルがダウンロードされました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "バッチ生成に失敗しました");
      setProgress("");
    } finally {
      setIsGenerating(false);
    }
  }, [document, csvText, filenameTemplate, maxRows]);

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          handleDetectVariables();
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 dark:hover:bg-orange-900"
        title="テンプレート × 変数 で PDF を量産"
      >
        <span>🏭</span>
        <span>教材工場</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏭</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                教材工場 — テンプレート × 変数
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                1つのテンプレートから複数の PDF を量産
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: 変数検出 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold dark:bg-blue-900 dark:text-blue-300">1</span>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">テンプレート変数</h3>
              <button
                onClick={handleDetectVariables}
                disabled={isDetecting}
                className="ml-auto text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300"
              >
                {isDetecting ? "検出中..." : "再検出"}
              </button>
            </div>

            {variables.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {variables.map((v) => (
                  <span
                    key={v}
                    className="px-2 py-1 text-sm bg-violet-50 text-violet-700 rounded-md border border-violet-200 font-mono dark:bg-violet-900 dark:text-violet-300 dark:border-violet-700"
                  >
                    {"{{" + v + "}}"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                テンプレート内のテキストブロックに <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{変数名}}"}</code> と記述すると、ここに表示されます。
              </p>
            )}
          </div>

          {/* Step 2: CSV データ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full text-xs font-bold dark:bg-green-900 dark:text-green-300">2</span>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">変数データ (CSV)</h3>
              <div className="ml-auto flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 dark:bg-green-900 dark:text-green-300"
                >
                  CSV読み込み
                </button>
              </div>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`${variables.length > 0 ? variables.join(",") : "名前,クラス,点数"}\n太郎,A組,95\n花子,B組,88`}
              className="w-full h-40 px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              1行目はヘッダー（変数名）。2行目以降が各PDFのデータ。
            </p>
          </div>

          {/* Step 3: 設定 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-orange-100 text-orange-700 rounded-full text-xs font-bold dark:bg-orange-900 dark:text-orange-300">3</span>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">出力設定</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">ファイル名テンプレート</label>
                <input
                  type="text"
                  value={filenameTemplate}
                  onChange={(e) => setFilenameTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 font-mono"
                  placeholder="{{_index}}_{{名前}}_レポート"
                />
                <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                  {"{{_index}}"} は自動連番 (1, 2, 3...)
                </p>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">最大行数</label>
                <input
                  type="number"
                  value={maxRows}
                  onChange={(e) => setMaxRows(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                  min={1}
                  max={200}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* プレビュー */}
          {previewLatex && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                プレビュー (1行目: {Object.entries(previewVars).map(([k, v]) => `${k}=${v}`).join(", ")})
                {totalRows > 0 && <span className="text-slate-500 ml-2">全{totalRows}行</span>}
              </h4>
              <pre className="p-3 bg-slate-900 text-green-400 text-xs rounded-lg overflow-x-auto max-h-48 overflow-y-auto font-mono">
                {previewLatex.slice(0, 3000)}
              </pre>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 whitespace-pre-line">
              {error}
            </div>
          )}

          {/* 進捗 */}
          {progress && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
              {progress}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <button
            onClick={handlePreview}
            disabled={!csvText.trim() || isGenerating}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
          >
            プレビュー (1行目)
          </button>
          <button
            onClick={handleGenerate}
            disabled={!csvText.trim() || isGenerating}
            className="px-6 py-2 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⚙️</span>
                <span>量産中...</span>
              </>
            ) : (
              <>
                <span>🏭</span>
                <span>一括生成 (ZIP)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
