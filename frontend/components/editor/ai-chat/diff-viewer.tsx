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
    <div className="w-full mt-1">
      {/* Summary header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-1 py-1 rounded-md text-[11px] font-mono hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors w-full"
      >
        <ChevronRight className={`h-3 w-3 transition-transform duration-200 text-slate-400 ${expanded ? "rotate-90" : ""}`} />
        <span className="text-slate-500 dark:text-slate-400">Changes</span>
        <span className="flex items-center gap-1.5 font-mono font-bold text-[11px]">
          {badges}
        </span>
      </button>

      {/* Expanded diff lines */}
      {expanded && (
        <div className="mt-1 rounded-lg bg-[#0d1117] dark:bg-[#060810] border border-slate-700/60 overflow-hidden font-mono text-[11px]">
          <div className="px-3 py-2 space-y-0.5">
            {ops.map((op, i) => {
              const { icon, label, color } = describeOp(op);
              const bgClass = op.op === "add_block"
                ? "bg-emerald-500/8"
                : op.op === "delete_block"
                ? "bg-red-500/8"
                : op.op === "update_block"
                ? "bg-blue-500/8"
                : "";
              return (
                <div key={i} className={`flex items-start gap-2 px-2 py-1 rounded ${bgClass}`}>
                  <span className={`font-bold shrink-0 ${color}`}>{icon}</span>
                  <span className="text-slate-300 break-all">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
