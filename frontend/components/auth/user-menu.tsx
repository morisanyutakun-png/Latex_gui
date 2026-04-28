"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, User, CreditCard, Crown } from "lucide-react";
import { usePlanStore } from "@/store/plan-store";
import { PLANS, type PlanId } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";

// プラン別のバッジ配色。アバターの左に表示する。Free を含めて全プランに表示する
// (モバイル幅でもユーザが「自分が今 Free か Starter か」を確実に把握できるようにする)。
const PLAN_BADGE_STYLE: Record<PlanId, { cls: string; icon: boolean }> = {
  free:    { cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700", icon: false },
  starter: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60", icon: false },
  pro:     { cls: "bg-gradient-to-r from-blue-50 to-violet-50 text-violet-700 border-violet-200 dark:from-blue-950/40 dark:to-violet-950/40 dark:text-violet-300 dark:border-violet-800/60", icon: true },
  premium: { cls: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300 dark:border-amber-800/60", icon: true },
};

function PlanBadge({ plan }: { plan: PlanId }) {
  const style = PLAN_BADGE_STYLE[plan];
  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-1.5 sm:px-2 rounded-md border text-[10px] font-bold tracking-wide uppercase ${style.cls}`}
      title={`Current plan: ${PLANS[plan].name}`}
    >
      {style.icon && <Crown className="h-3 w-3" />}
      {PLANS[plan].name}
    </span>
  );
}

export function UserMenu() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const currentPlan = usePlanStore((s) => s.currentPlan);

  // ドロップダウンは state で開閉管理する。以前は CSS hover 依存だったが、
  // モバイル Safari/Chrome では hover が「初回タップで sticky → 二度目タップで click」
  // と曖昧で、ログアウトや「契約管理」がタップ 1 回で起動しないケースがあった。
  // state ベースなら PC (click) でもモバイル (tap) でも完全に同一挙動になる。
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 外側タップ / Escape で閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleManageSubscription = async () => {
    setOpen(false);
    const { createPortalSession } = await import("@/lib/subscription-api");
    const url = await createPortalSession();
    if (url) window.location.href = url;
  };

  const handleSignOut = () => {
    setOpen(false);
    void signOut();
  };

  if (status === "loading") {
    return <div className="h-7 w-7 rounded-full bg-foreground/[0.04] animate-pulse" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all duration-200"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("user.menu.login")}</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex items-center gap-2">
      <PlanBadge plan={currentPlan} />
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 px-1.5 rounded-lg hover:bg-foreground/[0.04] transition-all duration-200"
      >
        {session.user?.image ? (
          <img
            src={session.user.image}
            alt=""
            className="h-6 w-6 rounded-full ring-1 ring-foreground/[0.06]"
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-indigo-500" />
          </div>
        )}
        <span className="hidden sm:inline text-[12px] font-medium text-foreground/60 max-w-[100px] truncate">
          {session.user?.name?.split(" ")[0]}
        </span>
      </button>

      {/* Dropdown — state ベースで開閉。タップ 1 回で必ず開き、外側タップ /
          Escape / 内部の項目クリックで閉じる。 */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 py-1 rounded-xl border border-foreground/[0.08] bg-popover/95 backdrop-blur-xl shadow-xl shadow-black/10 z-50"
        >
          <div className="px-3 py-2 border-b border-foreground/[0.04]">
            <p className="text-xs font-medium text-foreground/70 truncate">{session.user?.name}</p>
            <p className="text-[11px] text-muted-foreground/40 truncate">{session.user?.email}</p>
            {/* dropdown 内にもプラン表示を出して「現在 Free です」が確実に分かるようにする */}
            <div className="mt-1.5">
              <PlanBadge plan={currentPlan} />
            </div>
          </div>
          {currentPlan !== "free" && (
            <button
              type="button"
              role="menuitem"
              onClick={handleManageSubscription}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/5 active:bg-indigo-500/10 transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {t("user.menu.subscription")}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground/60 hover:text-red-500 hover:bg-red-500/5 active:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("user.menu.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
