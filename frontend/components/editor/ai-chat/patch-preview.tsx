import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { DocumentPatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { describeOp } from "./utils";

export function PatchPreviewDrawer({
  patch, onApply, onDismiss,
}: {
  patch: DocumentPatch;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const ops = patch.ops;
  const shown = expanded ? ops : ops.slice(0, 3);

  return (
    <div className="border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          {`${ops.length} ${t("chat.changes.title")}`}
        </span>
        {ops.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />{t("chat.collapse")}</> : <><ChevronDown className="h-3 w-3" />{t("chat.see.all")}</>}
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {shown.map((op, i) => {
          const { icon, label, color } = describeOp(op);
          return (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className={`font-mono font-bold mt-0.5 ${color}`}>{icon}</span>
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApply} className="flex-1 h-7 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0">
          <Check className="h-3 w-3 mr-1" /> {t("chat.apply")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs text-slate-500 hover:text-slate-700">
          <X className="h-3 w-3 mr-1" /> {t("chat.cancel")}
        </Button>
      </div>
    </div>
  );
}
