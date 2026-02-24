"use client";

import { Block, BLOCK_TYPES } from "@/lib/types";

interface Props {
  blocks: Block[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
}

export default function BlockList({
  blocks,
  selectedIndex,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  if (blocks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
        <p className="text-gray-400 text-sm">
          まだブロックがありません。
          <br />
          左のパネルからブロックを追加してください。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        文書の構成
      </h3>
      <div className="space-y-1">
        {blocks.map((block, i) => {
          const info = BLOCK_TYPES.find((bt) => bt.type === block.type);
          const isSelected = i === selectedIndex;
          const label = getBlockLabel(block);

          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition cursor-pointer group ${
                isSelected
                  ? "bg-blue-50 border border-blue-300"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
              onClick={() => onSelect(i)}
            >
              <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-100 rounded">
                {info?.icon || "?"}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {label || (
                    <span className="text-gray-400 italic">
                      {info?.name}（未入力）
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp(i);
                  }}
                  disabled={i === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer"
                  title="上に移動"
                >
                  ▲
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown(i);
                  }}
                  disabled={i === blocks.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer"
                  title="下に移動"
                >
                  ▼
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(i);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBlockLabel(block: Block): string {
  switch (block.type) {
    case "heading":
      return block.text;
    case "paragraph":
      return block.text.slice(0, 40);
    case "list":
      return block.items.filter(Boolean).join(", ").slice(0, 40);
    case "table":
      return `表（${block.headers.length}列 × ${block.rows.length}行）`;
    case "image":
      return block.caption || block.url.slice(0, 30) || "画像";
    default:
      return "";
  }
}
