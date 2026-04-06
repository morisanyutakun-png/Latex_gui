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
    <div className="mx-3.5 mt-2 mb-0.5 shrink-0">
      <div className="flex items-center justify-between text-[9.5px] mb-1">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-px rounded-full font-bold text-[8.5px] uppercase tracking-wider text-white"
                style={{ background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)" }}>
            {planName}
          </span>
          <span className="text-foreground/45 font-mono tabular-nums">
            {todayUsage}/{dailyLimit}
          </span>
          <span className="text-muted-foreground/25">·</span>
          <span className="text-foreground/35 font-mono tabular-nums">
            {monthUsage}/{monthlyLimit.toLocaleString()}
          </span>
        </div>
        {dailyPercent >= 60 && (
          <button
            onClick={onUpgrade}
            className="text-[8.5px] text-amber-600/70 dark:text-amber-400/60 hover:text-amber-800 dark:hover:text-amber-200 font-semibold uppercase tracking-wider transition-colors"
          >
            UP
          </button>
        )}
      </div>
      <div className="h-[3px] rounded-full bg-black/[0.05] dark:bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, dailyPercent)}%` }}
        />
      </div>
    </div>
  );
}
