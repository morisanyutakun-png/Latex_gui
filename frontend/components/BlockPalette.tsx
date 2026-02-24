"use client";

import { BLOCK_TYPES, BlockType } from "@/lib/types";

interface Props {
  onAdd: (type: BlockType) => void;
}

export default function BlockPalette({ onAdd }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        ブロックを追加
      </h3>
      <div className="space-y-2">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            onClick={() => onAdd(bt.type)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left 
              hover:bg-blue-50 hover:text-blue-700 transition group cursor-pointer
              border border-transparent hover:border-blue-200"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-gray-100 group-hover:bg-blue-100 rounded-lg text-sm font-bold text-gray-500 group-hover:text-blue-600 transition">
              {bt.icon}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                {bt.name}
              </div>
              <div className="text-xs text-gray-400">{bt.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
