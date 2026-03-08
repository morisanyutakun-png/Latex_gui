"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { getAllowedPackages } from "@/lib/api";
import {
  Code2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Shield,
  AlertTriangle,
  Terminal,
  Package,
  Braces,
  BookOpen,
  Sparkles,
  Info,
} from "lucide-react";

/* ────── コード入力フィールド ────── */
function CodeInput({
  value,
  onChange,
  placeholder,
  rows = 4,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-foreground/70 flex items-center gap-1.5">
          <Terminal className="h-3 w-3 text-purple-500" />
          {label}
        </label>
        {hint && (
          <span className="text-[10px] text-muted-foreground/60">{hint}</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className="w-full px-3 py-2 text-[11px] font-mono leading-relaxed bg-slate-950 text-emerald-400 border border-slate-800/80 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-600/40 transition-all placeholder:text-slate-600"
      />
    </div>
  );
}

/* ────── 折りたたみセクション ────── */
function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge && (
          <span className="px-1.5 py-0.5 text-[9px] bg-purple-100 text-purple-700 rounded-md dark:bg-purple-900/40 dark:text-purple-300">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── メインパネル ─────────────────── */
export function AdvancedModePanel() {
  const document = useDocumentStore((s) => s.document);
  const updateAdvanced = useDocumentStore((s) => s.updateAdvanced);
  const toggleAdvancedMode = useDocumentStore((s) => s.toggleAdvancedMode);

  const [allowedPackages, setAllowedPackages] = useState<string[]>([]);
  const [allowedTikzLibs, setAllowedTikzLibs] = useState<string[]>([]);
  const [newCommand, setNewCommand] = useState("");
  const [packageSearch, setPackageSearch] = useState("");

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

  const filteredPackages = packageSearch
    ? allowedPackages.filter((p) =>
        p.toLowerCase().includes(packageSearch.toLowerCase())
      )
    : allowedPackages;

  if (!document) return null;

  return (
    <div className="space-y-3">
      {/* ── メインスイッチ ── */}
      <button
        onClick={toggleAdvancedMode}
        className={`
          w-full group flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300
          ${
            advanced.enabled
              ? "bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200/50 dark:border-purple-700/30 shadow-sm shadow-purple-100/50 dark:shadow-purple-900/20"
              : "bg-muted/30 border border-border/30 hover:bg-muted/50 hover:border-border/50"
          }
        `}
      >
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
            advanced.enabled
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {advanced.enabled ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-xs tracking-tight">
            上級者モード
          </div>
          <div className="text-[10px] text-muted-foreground">
            {advanced.enabled
              ? "LaTeX フック有効"
              : "クリックで LaTeX カスタマイズを有効化"}
          </div>
        </div>
        {advanced.enabled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold bg-purple-600 text-white rounded-full">
            <Sparkles className="h-2.5 w-2.5" />
            ON
          </span>
        )}
      </button>

      {/* ── 展開コンテンツ ── */}
      {advanced.enabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* セキュリティ警告 */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-700/30">
            <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
              セキュリティ上、
              <code className="px-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-[9px]">
                \input
              </code>
              ,{" "}
              <code className="px-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-[9px]">
                \directlua
              </code>
              ,{" "}
              <code className="px-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-[9px]">
                \write18
              </code>{" "}
              等は禁止です
            </p>
          </div>

          {/* カスタムプリアンブル */}
          <CollapsibleSection
            title="カスタムプリアンブル"
            icon={<Code2 className="h-3 w-3 text-purple-500" />}
            defaultOpen={!!advanced.customPreamble}
          >
            <CodeInput
              value={advanced.customPreamble}
              onChange={(v) => updateAdvanced({ customPreamble: v })}
              placeholder={`% 追加パッケージやカスタム設定\n\\usepackage{siunitx}\n\\sisetup{locale=JP}`}
              label="\\begin{document} の前に挿入"
              rows={5}
            />
          </CollapsibleSection>

          {/* カスタムコマンド */}
          <CollapsibleSection
            title="カスタムコマンド"
            icon={<Braces className="h-3 w-3 text-purple-500" />}
            defaultOpen={advanced.customCommands.length > 0}
            badge={
              advanced.customCommands.length > 0
                ? `${advanced.customCommands.length}`
                : undefined
            }
          >
            <div className="space-y-2">
              {/* 既存コマンド */}
              {advanced.customCommands.length > 0 && (
                <div className="space-y-1">
                  {advanced.customCommands.map((cmd, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <code className="flex-1 text-[10px] font-mono text-foreground/70 truncate">
                        {cmd}
                      </code>
                      <button
                        onClick={() => handleRemoveCommand(i)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive/60 hover:text-destructive transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 新規追加 */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCommand()}
                  placeholder="\\newcommand{\\R}{\\mathbb{R}}"
                  className="flex-1 px-2.5 py-1.5 text-[11px] font-mono bg-muted/20 border border-border/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all placeholder:text-muted-foreground/30"
                />
                <button
                  onClick={handleAddCommand}
                  disabled={!newCommand.trim()}
                  className="px-2 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-800/50 transition-colors disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <Info className="h-2.5 w-2.5" />
                \newcommand, \renewcommand, \DeclareMathOperator のみ
              </p>
            </div>
          </CollapsibleSection>

          {/* フック */}
          <CollapsibleSection
            title="ドキュメントフック"
            icon={<BookOpen className="h-3 w-3 text-purple-500" />}
            defaultOpen={!!(advanced.preDocument || advanced.postDocument)}
          >
            <div className="space-y-3">
              <CodeInput
                value={advanced.preDocument}
                onChange={(v) => updateAdvanced({ preDocument: v })}
                placeholder="% \\maketitle の後に挿入されるコード"
                label="Pre-document"
                hint="\\maketitle 直後"
                rows={3}
              />
              <CodeInput
                value={advanced.postDocument}
                onChange={(v) => updateAdvanced({ postDocument: v })}
                placeholder="% \\end{document} の前に挿入されるコード"
                label="Post-document"
                hint="\\end{document} 直前"
                rows={3}
              />
            </div>
          </CollapsibleSection>

          {/* 許可パッケージ一覧 */}
          <CollapsibleSection
            title="使用可能パッケージ"
            icon={<Package className="h-3 w-3 text-purple-500" />}
            badge={
              allowedPackages.length > 0
                ? `${allowedPackages.length}`
                : undefined
            }
          >
            <div className="space-y-2">
              {/* 検索 */}
              {allowedPackages.length > 0 && (
                <>
                  <input
                    type="text"
                    value={packageSearch}
                    onChange={(e) => setPackageSearch(e.target.value)}
                    placeholder="パッケージを検索..."
                    className="w-full px-2.5 py-1.5 text-[11px] bg-muted/20 border border-border/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all placeholder:text-muted-foreground/30"
                  />
                  <div className="flex flex-wrap gap-1">
                    {filteredPackages.map((pkg) => (
                      <span
                        key={pkg}
                        className="px-1.5 py-0.5 text-[9px] bg-muted/40 border border-border/20 rounded-md font-mono text-foreground/60 hover:bg-muted/60 hover:text-foreground/80 transition-colors cursor-default"
                      >
                        {pkg}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {allowedTikzLibs.length > 0 && (
                <div className="pt-2 border-t border-border/20">
                  <p className="text-[9px] text-muted-foreground/60 mb-1.5 font-medium">
                    TikZ ライブラリ
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {allowedTikzLibs.map((lib) => (
                      <span
                        key={lib}
                        className="px-1.5 py-0.5 text-[9px] bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/30 dark:border-cyan-700/30 rounded-md font-mono text-cyan-700 dark:text-cyan-300 cursor-default"
                      >
                        {lib}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {allowedPackages.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-2">
                  読み込み中...
                </p>
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
