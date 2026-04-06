export function UsageBar({
  todayUsage, dailyLimit, monthUsage, monthlyLimit, planName, dailyPercent, onUpgrade,
}: {
  todayUsage: number; dailyLimit: number; monthUsage: number; monthlyLimit: number;
  planName: string; dailyPercent: number; onUpgrade: () => void;
}) {
  const isNearLimit = dailyPercent >= 80;
  const isAtLimit = dailyPercent >= 100;
  const barColor = isAtLimit
    ? "bg-red-500"
    : isNearLimit
    ? "bg-orange-500"
    : "bg-amber-500";

  return (
    <div className="mx-4 mt-2.5 mb-1 shrink-0">
      <div className="flex items-center justify-between text-[10px] mb-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider shadow-sm text-white"
                style={{ background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)", boxShadow: "0 1px 4px rgba(180,83,9,0.30)" }}>
            {planName}
          </span>
          <span className="text-foreground/65 font-mono tabular-nums">
            {todayUsage}/{dailyLimit} <span className="text-muted-foreground/45">本日</span>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-foreground/55 font-mono tabular-nums">
            {monthUsage}/{monthlyLimit.toLocaleString()} <span className="text-muted-foreground/45">月</span>
          </span>
        </div>
        {dailyPercent >= 60 && (
          <button
            onClick={onUpgrade}
            className="text-[9px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-bold uppercase tracking-wider transition-colors"
          >
            アップグレード
          </button>
        )}
      </div>
      <div className="h-1 rounded-full bg-black/[0.06] dark:bg-white/[0.07] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, dailyPercent)}%` }}
        />
      </div>
    </div>
  );
}
