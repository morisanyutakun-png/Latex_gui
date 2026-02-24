"use client";

import { Metadata } from "@/lib/types";

interface Props {
  metadata: Metadata;
  onChange: (metadata: Metadata) => void;
}

export default function MetadataForm({ metadata, onChange }: Props) {
  const update = (field: keyof Metadata, value: string) => {
    onChange({ ...metadata, [field]: value });
  };

  return (
    <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        文書情報
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          タイトル
        </label>
        <input
          type="text"
          value={metadata.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="例: 月次レポート"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          サブタイトル
          <span className="text-gray-400 font-normal ml-1">（任意）</span>
        </label>
        <input
          type="text"
          value={metadata.subtitle}
          onChange={(e) => update("subtitle", e.target.value)}
          placeholder="例: 2026年2月度"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            作成者
            <span className="text-gray-400 font-normal ml-1">（任意）</span>
          </label>
          <input
            type="text"
            value={metadata.author}
            onChange={(e) => update("author", e.target.value)}
            placeholder="名前"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            日付
          </label>
          <input
            type="text"
            value={metadata.date}
            onChange={(e) => update("date", e.target.value)}
            placeholder="2026/02/24"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800"
          />
        </div>
      </div>
    </div>
  );
}
