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
    : "bg-indigo-500";

  return (
    <div className="mx-3 mt-2 shrink-0">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-foreground/[0.06] text-muted-foreground/60 font-mono font-medium text-[9px]">
            {planName}
          </span>
          <span className="text-slate-500">
            {todayUsage}/{dailyLimit} today
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">
            {monthUsage}/{monthlyLimit.toLocaleString()} mo
          </span>
        </div>
        {dailyPercent >= 60 && (
          <button
            onClick={onUpgrade}
            className="text-[9px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>
      <div className="h-1 rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, dailyPercent)}%` }}
        />
      </div>
    </div>
  );
}
