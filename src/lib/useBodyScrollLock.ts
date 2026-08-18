"use client";

import { useEffect } from "react";

let activeLocksCount = 0;
let prevOverflow = "";
let prevPaddingRight = "";
let prevPosition = "";
let prevTop = "";
let prevLeft = "";
let prevWidth = "";
let lockedScrollX = 0;
let lockedScrollY = 0;
let usesFixedMobileLock = false;

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
      prevPosition = document.body.style.position || "";
      prevTop = document.body.style.top || "";
      prevLeft = document.body.style.left || "";
      prevWidth = document.body.style.width || "";

      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";

      usesFixedMobileLock = window.matchMedia("(max-width: 639px)").matches;
      if (usesFixedMobileLock) {
        lockedScrollX = window.scrollX;
        lockedScrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = `-${lockedScrollX}px`;
        document.body.style.width = "100%";
      }
    }

    activeLocksCount++;

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);
      if (activeLocksCount === 0 && typeof document !== "undefined") {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
        document.body.style.position = prevPosition;
        document.body.style.top = prevTop;
        document.body.style.left = prevLeft;
        document.body.style.width = prevWidth;

        if (usesFixedMobileLock) {
          window.scrollTo(lockedScrollX, lockedScrollY);
          usesFixedMobileLock = false;
        }
      }
    };
  }, [isOpen]);
}
