"use client";

import { TemplateInfo, TemplateType, TEMPLATES } from "@/lib/types";

interface Props {
  selected: TemplateType | null;
  onSelect: (template: TemplateType) => void;
}

export default function TemplateSelector({ selected, onSelect }: Props) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          かんたんPDFメーカー
        </h1>
        <p className="text-gray-500 text-lg">
          テンプレートを選んで、すぐにPDFを作れます
        </p>
      </div>

      <h2 className="text-lg font-semibold text-gray-700 text-center">
        どんな文書を作りますか？
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            isSelected={selected === t.id}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onClick,
}: {
  template: TemplateInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative p-6 rounded-2xl border-2 text-left transition-all duration-200
        hover:shadow-lg hover:-translate-y-0.5 cursor-pointer
        ${
          isSelected
            ? "border-blue-500 bg-blue-50 shadow-md"
            : "border-gray-200 bg-white hover:border-blue-300"
        }
      `}
    >
      <div className="text-4xl mb-3">{template.icon}</div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">{template.name}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">
        {template.description}
      </p>
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
