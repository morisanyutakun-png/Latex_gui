"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useVisibleInterval — IntersectionObserver で要素が viewport に入ったときだけ
 * setInterval を回す。off-screen / タブ非表示 (visibilitychange) では完全に停止。
 *
 * PageSpeed の TBT / 長時間タスク対策。背景でアニメ用 setState を回し続けるのを止める。
 *
 * 使い方:
 *   const ref = useRef<HTMLDivElement>(null);
 *   const [tick, setTick] = useVisibleInterval(ref, 100);
 *   <div ref={ref}>{...}</div>
 *
 * `prefers-reduced-motion: reduce` のときは tick を更新しない (アクセシビリティ + パフォーマンス)。
 */
export function useVisibleInterval(
  ref: React.RefObject<HTMLElement | null>,
  intervalMs: number,
): [number, React.Dispatch<React.SetStateAction<number>>] {
  const [tick, setTick] = useState(0);
  const visibleRef = useRef(false);
  const docVisibleRef = useRef(true);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onMotion = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches; ensureTimer(); };
    mq.addEventListener("change", onMotion);

    const onDocVis = () => { docVisibleRef.current = !document.hidden; ensureTimer(); };
    document.addEventListener("visibilitychange", onDocVis);
    docVisibleRef.current = !document.hidden;

    // setInterval ではなく requestAnimationFrame ベースの自前タイマーで
    // ブラウザのスケジューリングに乗せる (long task / TBT 抑制)。
    let rafId: number | null = null;
    let lastFire = 0;
    const loop = (ts: number) => {
      rafId = null;
      const shouldRun = visibleRef.current && docVisibleRef.current && !reducedMotionRef.current;
      if (!shouldRun) return;
      if (ts - lastFire >= intervalMs) {
        lastFire = ts;
        setTick((t) => t + 1);
      }
      rafId = requestAnimationFrame(loop);
    };
    const ensureTimer = () => {
      const shouldRun = visibleRef.current && docVisibleRef.current && !reducedMotionRef.current;
      if (shouldRun && rafId === null) {
        lastFire = 0;
        rafId = requestAnimationFrame(loop);
      } else if (!shouldRun && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const el = ref.current;
    let obs: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            visibleRef.current = entry.isIntersecting;
          }
          ensureTimer();
        },
        { threshold: 0.01 },
      );
      obs.observe(el);
    } else {
      // フォールバック: IO 非対応なら常に "見えてる" とみなす
      visibleRef.current = true;
      ensureTimer();
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      mq.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onDocVis);
      obs?.disconnect();
    };
  }, [ref, intervalMs]);

  return [tick, setTick];
}
