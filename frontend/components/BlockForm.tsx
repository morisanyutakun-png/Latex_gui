"use client";

import { Block, HeadingBlock, ParagraphBlock, ListBlock, TableBlock, ImageBlock } from "@/lib/types";

interface Props {
  block: Block;
  index: number;
  onChange: (index: number, block: Block) => void;
}

export default function BlockForm({ block, index, onChange }: Props) {
  switch (block.type) {
    case "heading":
      return <HeadingForm block={block} index={index} onChange={onChange} />;
    case "paragraph":
      return <ParagraphForm block={block} index={index} onChange={onChange} />;
    case "list":
      return <ListForm block={block} index={index} onChange={onChange} />;
    case "table":
      return <TableForm block={block} index={index} onChange={onChange} />;
    case "image":
      return <ImageForm block={block} index={index} onChange={onChange} />;
    default:
      return null;
  }
}

// --- Heading ---
function HeadingForm({ block, index, onChange }: { block: HeadingBlock; index: number; onChange: Props["onChange"] }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">見出しテキスト</label>
        <input
          type="text"
          value={block.text}
          onChange={(e) => onChange(index, { ...block, text: e.target.value })}
          placeholder="セクションの見出しを入力"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">見出しの大きさ</label>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((level) => (
            <button
              key={level}
              onClick={() => onChange(index, { ...block, level })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                block.level === level
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {level === 1 ? "大" : level === 2 ? "中" : "小"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Paragraph ---
function ParagraphForm({ block, index, onChange }: { block: ParagraphBlock; index: number; onChange: Props["onChange"] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
      <textarea
        value={block.text}
        onChange={(e) => onChange(index, { ...block, text: e.target.value })}
        placeholder="テキストを入力してください。&#10;空行を挟むと段落が分かれます。"
        rows={5}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-y text-gray-800"
      />
    </div>
  );
}

// --- List ---
function ListForm({ block, index, onChange }: { block: ListBlock; index: number; onChange: Props["onChange"] }) {
  const updateItem = (i: number, value: string) => {
    const items = [...block.items];
    items[i] = value;
    onChange(index, { ...block, items });
  };

  const addItem = () => {
    onChange(index, { ...block, items: [...block.items, ""] });
  };

  const removeItem = (i: number) => {
    if (block.items.length <= 1) return;
    onChange(index, { ...block, items: block.items.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">リストの種類</label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange(index, { ...block, style: "bullet" })}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              block.style === "bullet" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            ● 箇条書き
          </button>
          <button
            onClick={() => onChange(index, { ...block, style: "numbered" })}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              block.style === "numbered" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            1. 番号付き
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">項目</label>
        {block.items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-gray-400 text-sm w-6 text-right">
              {block.style === "numbered" ? `${i + 1}.` : "•"}
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={`項目${i + 1}`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
            />
            {block.items.length > 1 && (
              <button
                onClick={() => removeItem(i)}
                className="p-2 text-gray-400 hover:text-red-500 transition cursor-pointer"
                title="この項目を削除"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addItem}
          className="text-sm text-blue-500 hover:text-blue-700 font-medium transition cursor-pointer"
        >
          ＋ 項目を追加
        </button>
      </div>
    </div>
  );
}

// --- Table ---
function TableForm({ block, index, onChange }: { block: TableBlock; index: number; onChange: Props["onChange"] }) {
  const updateHeader = (i: number, value: string) => {
    const headers = [...block.headers];
    headers[i] = value;
    onChange(index, { ...block, headers });
  };

  const updateCell = (ri: number, ci: number, value: string) => {
    const rows = block.rows.map((r) => [...r]);
    rows[ri][ci] = value;
    onChange(index, { ...block, rows });
  };

  const addColumn = () => {
    if (block.headers.length >= 6) return;
    const headers = [...block.headers, `列${block.headers.length + 1}`];
    const rows = block.rows.map((r) => [...r, ""]);
    onChange(index, { ...block, headers, rows });
  };

  const removeColumn = () => {
    if (block.headers.length <= 1) return;
    const headers = block.headers.slice(0, -1);
    const rows = block.rows.map((r) => r.slice(0, -1));
    onChange(index, { ...block, headers, rows });
  };

  const addRow = () => {
    const rows = [...block.rows, Array(block.headers.length).fill("")];
    onChange(index, { ...block, rows });
  };

  const removeRow = (ri: number) => {
    if (block.rows.length <= 1) return;
    const rows = block.rows.filter((_, i) => i !== ri);
    onChange(index, { ...block, rows });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">表の内容</label>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i} className="p-1">
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => updateHeader(i, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-50 text-sm font-semibold text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800"
                  />
                </th>
              ))}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800"
                    />
                  </td>
                ))}
                <td className="p-1">
                  {block.rows.length > 1 && (
                    <button
                      onClick={() => removeRow(ri)}
                      className="text-gray-400 hover:text-red-500 text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 text-sm">
        <button onClick={addRow} className="text-blue-500 hover:text-blue-700 font-medium cursor-pointer">
          ＋ 行を追加
        </button>
        <button onClick={addColumn} className="text-blue-500 hover:text-blue-700 font-medium cursor-pointer">
          ＋ 列を追加
        </button>
        {block.headers.length > 1 && (
          <button onClick={removeColumn} className="text-gray-400 hover:text-red-500 font-medium cursor-pointer">
            列を削除
          </button>
        )}
      </div>
    </div>
  );
}

// --- Image ---
function ImageForm({ block, index, onChange }: { block: ImageBlock; index: number; onChange: Props["onChange"] }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">画像URL</label>
        <input
          type="url"
          value={block.url}
          onChange={(e) => onChange(index, { ...block, url: e.target.value })}
          placeholder="https://example.com/image.png"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          キャプション
          <span className="text-gray-400 font-normal ml-1">（任意）</span>
        </label>
        <input
          type="text"
          value={block.caption}
          onChange={(e) => onChange(index, { ...block, caption: e.target.value })}
          placeholder="図の説明"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          画像の幅（{Math.round(block.width * 100)}%）
        </label>
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round(block.width * 100)}
          onChange={(e) => onChange(index, { ...block, width: Number(e.target.value) / 100 })}
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  );
}
