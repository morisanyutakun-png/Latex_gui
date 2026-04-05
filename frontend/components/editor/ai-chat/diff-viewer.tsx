import React from "react";
import { DocumentPatch } from "@/lib/types";
import { ChevronRight } from "lucide-react";
import { describeOp } from "./utils";

export function DiffViewer({ patches }: { patches: DocumentPatch }) {
  const [expanded, setExpanded] = React.useState(false);
  const ops = patches.ops;
  if (ops.length === 0) return null;

  let added = 0, updated = 0, deleted = 0;
  for (const op of ops) {
    if (op.op === "add_block") added++;
    else if (op.op === "update_block") updated++;
    else if (op.op === "delete_block") deleted++;
  }

  const badges: React.ReactNode[] = [];
  if (added) badges.push(<span key="a" className="text-emerald-600 dark:text-emerald-400">+{added}</span>);
  if (updated) badges.push(<span key="u" className="text-blue-600 dark:text-blue-400">~{updated}</span>);
  if (deleted) badges.push(<span key="d" className="text-red-600 dark:text-red-400">-{deleted}</span>);

  return (
    <div className="w-full border-t border-emerald-200/40 dark:border-emerald-500/10">
      {/* Summary header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-colors w-full"
      >
        <ChevronRight className={`h-3 w-3 transition-transform duration-200 text-emerald-400 ${expanded ? "rotate-90" : ""}`} />
        <span className="text-emerald-600/70 dark:text-emerald-400/70">変更内容</span>
        <span className="flex items-center gap-1.5 font-medium text-[11px]">
          {badges}
        </span>
      </button>

      {/* Expanded diff lines */}
      {expanded && (
        <div className="px-3 pb-2.5 space-y-0.5">
          {ops.map((op, i) => {
            const { icon, label, color } = describeOp(op);
            const bgClass = op.op === "add_block"
              ? "bg-emerald-50/80 dark:bg-emerald-500/5"
              : op.op === "delete_block"
              ? "bg-red-50/80 dark:bg-red-500/5"
              : op.op === "update_block"
              ? "bg-blue-50/80 dark:bg-blue-500/5"
              : "";
            return (
              <div key={i} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${bgClass}`}>
                <span className={`font-bold shrink-0 ${color}`}>{icon}</span>
                <span className="text-foreground/60 break-all">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
