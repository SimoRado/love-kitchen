"use client";

import { useEffect } from "react";

let activeLocksCount = 0;
let prevOverflow = "";
let prevPaddingRight = "";

/**
 * Reusable hook to lock the background body scroll while an overlay (Modal or Drawer) is open.
 * Uses a reference counter so nested or sequential overlays do not prematurely unlock the body.
 * Compensates for scrollbar width on desktop to prevent layout shifts.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    if (typeof document === "undefined") return;

    if (activeLocksCount === 0) {
      prevOverflow = document.body.style.overflow || "";
      prevPaddingRight = document.body.style.paddingRight || "";

      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";
    }

    activeLocksCount++;

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);
      if (activeLocksCount === 0 && typeof document !== "undefined") {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
      }
    };
  }, [isOpen]);
}
