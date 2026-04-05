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
    <div className="mx-4 mt-2 shrink-0">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 font-medium text-[9px]">
            {planName}
          </span>
          <span className="text-muted-foreground/50">
            {todayUsage}/{dailyLimit} 本日
          </span>
          <span className="text-muted-foreground/25">·</span>
          <span className="text-muted-foreground/50">
            {monthUsage}/{monthlyLimit.toLocaleString()} 月
          </span>
        </div>
        {dailyPercent >= 60 && (
          <button
            onClick={onUpgrade}
            className="text-[9px] text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 font-medium transition-colors"
          >
            アップグレード
          </button>
        )}
      </div>
      <div className="h-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, dailyPercent)}%` }}
        />
      </div>
    </div>
  );
}
