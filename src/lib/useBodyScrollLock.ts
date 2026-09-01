"use client";

import { useEffect, useRef } from "react";

let activeLocksCount = 0;
let prevBodyOverflow = "";
let prevHtmlOverflow = "";
let prevPaddingRight = "";
let savedScrollY = 0;
let savedScrollX = 0;

/**
 * Reusable hook to lock the background body scroll while an overlay (Modal or Drawer) is open.
 * Uses reference counting so nested or sequential overlays do not prematurely unlock the body.
 * Compensates for scrollbar width on desktop to prevent layout shifts.
 * Preserves the exact page scroll position across open/close cycles on both mobile and desktop.
 */
export function useBodyScrollLock(isOpen: boolean) {
  const localScrollYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const currentY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    const currentX =
      window.scrollX ||
      window.pageXOffset ||
      document.documentElement.scrollLeft ||
      document.body.scrollLeft ||
      0;

    localScrollYRef.current = currentY;

    if (activeLocksCount === 0) {
      savedScrollY = currentY;
      savedScrollX = currentX;
      prevBodyOverflow = document.body.style.overflow || "";
      prevHtmlOverflow = document.documentElement.style.overflow || "";
      prevPaddingRight = document.body.style.paddingRight || "";

      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    activeLocksCount++;

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);
      if (activeLocksCount === 0 && typeof document !== "undefined") {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.paddingRight = prevPaddingRight;

        const targetY = localScrollYRef.current ?? savedScrollY;
        const targetX = savedScrollX;

        if (typeof window !== "undefined") {
          window.scrollTo({
            top: targetY,
            left: targetX,
            behavior: "instant" as ScrollBehavior,
          });
        }
      }
    };
  }, [isOpen]);
}
