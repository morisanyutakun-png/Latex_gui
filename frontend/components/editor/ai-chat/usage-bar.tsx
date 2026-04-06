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
    ? "bg-amber-400"
    : "bg-violet-500";

  return (
    <div className="mx-4 mt-2.5 shrink-0">
      <div className="flex items-center justify-between text-[10px] mb-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-violet-600/95 text-white border border-violet-500/40 dark:border-violet-400/30 font-bold text-[9px] uppercase tracking-wider shadow-sm">
            {planName}
          </span>
          <span className="text-foreground/70 font-mono tabular-nums">
            {todayUsage}/{dailyLimit} <span className="text-muted-foreground/50">本日</span>
          </span>
          <span className="text-muted-foreground/35">·</span>
          <span className="text-foreground/60 font-mono tabular-nums">
            {monthUsage}/{monthlyLimit.toLocaleString()} <span className="text-muted-foreground/50">月</span>
          </span>
        </div>
        {dailyPercent >= 60 && (
          <button
            onClick={onUpgrade}
            className="text-[9px] text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 font-bold uppercase tracking-wider transition-colors"
          >
            アップグレード
          </button>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, dailyPercent)}%` }}
        />
      </div>
    </div>
  );
}
