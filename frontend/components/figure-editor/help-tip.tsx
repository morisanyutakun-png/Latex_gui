"use client";

/**
 * HelpTip — refined tooltip system with dark bubble, delayed hover,
 * rich content (title + description + kbd), and smart positioning.
 *
 * Usage:
 *   <HelpTip title="Select" kbd="V" description="Click to pick, drag to marquee">
 *     <button>...</button>
 *   </HelpTip>
 *
 * Ergonomic defaults:
 *   - 350 ms delay on hover (avoids flash on pass-by)
 *   - Instant hide on leave
 *   - Follows mouse horizontally, snaps vertically to preferred side
 *   - Auto-flips side if it would clip the viewport
 */

import React, { useEffect, useRef, useState } from "react";

type Side = "top" | "bottom" | "left" | "right";

export interface HelpTipProps {
  /** Short title line (bold) */
  title?: React.ReactNode;
  /** Multi-line description under the title */
  description?: React.ReactNode;
  /** Keyboard shortcut badge(s) */
  kbd?: string | string[];
  /** Preferred side */
  side?: Side;
  /** Show delay in ms (default 900 — only appears when user is genuinely pausing) */
  delay?: number;
  /** Disable the tip entirely */
  disabled?: boolean;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

export function HelpTip({
  title, description, kbd, side = "bottom", delay = 900, disabled, children,
}: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; s: Side } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleEnter = (e: React.MouseEvent) => {
    if (disabled) return;
    targetRef.current = e.currentTarget as HTMLElement;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!targetRef.current) return;
      const r = targetRef.current.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const gap = 6;
      let s: Side = side;
      let x = 0, y = 0;

      // Try preferred side, flip if off-screen
      const placements: Array<[Side, number, number]> = [
        ["bottom", r.left + r.width / 2, r.bottom + gap],
        ["top",    r.left + r.width / 2, r.top - gap],
        ["right",  r.right + gap,         r.top + r.height / 2],
        ["left",   r.left - gap,          r.top + r.height / 2],
      ];
      const pref = placements.find((p) => p[0] === side) ?? placements[0];
      [s, x, y] = pref;

      // Clip-check: if target would overflow, pick next side
      const est = { w: 240, h: 70 };
      const fits = (ss: Side, xx: number, yy: number) => {
        if (ss === "bottom") return yy + est.h < vh - 8;
        if (ss === "top")    return yy - est.h > 8;
        if (ss === "right")  return xx + est.w < vw - 8;
        if (ss === "left")   return xx - est.w > 8;
        return true;
      };
      if (!fits(s, x, y)) {
        for (const alt of placements) {
          if (alt[0] === s) continue;
          if (fits(alt[0], alt[1], alt[2])) { [s, x, y] = alt; break; }
        }
      }

      setPos({ x, y, s });
      setOpen(true);
    }, delay);
  };

  const handleLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setOpen(false);
  };

  const handleClick = () => {
    // Clicking a button should immediately hide the tip (avoid lingering over an action)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setOpen(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = children.props as any;
  const child = React.cloneElement(children, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseEnter: (e: any) => { handleEnter(e); props.onMouseEnter?.(e); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseLeave: (e: any) => { handleLeave(); props.onMouseLeave?.(e); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseDown:  (e: any) => { handleClick(); props.onMouseDown?.(e); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onBlur:       (e: any) => { handleLeave(); props.onBlur?.(e); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!open || !pos || disabled) return child;

  const kbdArray = Array.isArray(kbd) ? kbd : kbd ? [kbd] : [];

  // Outer wrapper positions the bubble's anchor point;
  // inner wrapper handles the entrance animation (they MUST be separate so
  // the animation's `transform` doesn't fight with the positioning `transform`).
  const anchorTransform = pos.s === "bottom" ? "translate(-50%, 0)"
    : pos.s === "top"    ? "translate(-50%, -100%)"
    : pos.s === "right"  ? "translate(0, -50%)"
    : "translate(-100%, -50%)";

  return (
    <>
      {child}
      <div
        role="tooltip"
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          transform: anchorTransform,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div className="relative animate-tooltip-in max-w-[260px] bg-neutral-900 dark:bg-neutral-800 text-white rounded-md shadow-2xl px-2.5 py-1.5 border border-white/[0.08]">
          {title && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight">
              <span className="flex-1">{title}</span>
              {kbdArray.map((k, i) => (
                <kbd key={i} className="text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {k}
                </kbd>
              ))}
            </div>
          )}
          {description && (
            <div className="text-[10px] text-white/70 leading-snug mt-0.5">
              {description}
            </div>
          )}
          {!title && !description && kbdArray.length > 0 && (
            <div className="flex gap-1">
              {kbdArray.map((k, i) => (
                <kbd key={i} className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded">{k}</kbd>
              ))}
            </div>
          )}
          <div className={`absolute w-0 h-0 ${arrowStyle(pos.s)}`} />
        </div>
      </div>
    </>
  );
}

function arrowStyle(side: Side): string {
  // Small triangle pointing back at the anchor
  const base = "border-solid";
  switch (side) {
    case "bottom": return `${base} top-[-5px] left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-neutral-900 dark:border-b-neutral-800`;
    case "top":    return `${base} bottom-[-5px] left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-neutral-900 dark:border-t-neutral-800`;
    case "right":  return `${base} left-[-5px] top-1/2 -translate-y-1/2 border-t-[5px] border-b-[5px] border-r-[5px] border-t-transparent border-b-transparent border-r-neutral-900 dark:border-r-neutral-800`;
    case "left":   return `${base} right-[-5px] top-1/2 -translate-y-1/2 border-t-[5px] border-b-[5px] border-l-[5px] border-t-transparent border-b-transparent border-l-neutral-900 dark:border-l-neutral-800`;
  }
}
