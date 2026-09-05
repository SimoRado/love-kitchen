"use client";

import React from "react";
import { Bike } from "lucide-react";

interface DeliveryCTAProps {
  onOrderClick?: () => void;
}

export default function DeliveryCTA({ onOrderClick }: DeliveryCTAProps) {
  const handleScrollToMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onOrderClick) {
      e.preventDefault();
      onOrderClick();
      return;
    }
    e.preventDefault();
    const menuEl = document.getElementById("menu");
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 w-full box-border overflow-hidden">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#141414] text-white border border-white/5 shadow-2xl p-5 sm:p-10 lg:p-14 w-full">
        {/* Decorative Background Delivery Scooter Silhouette */}
        <div
          aria-hidden="true"
          className="absolute right-0 bottom-0 top-0 w-1/2 max-w-sm pointer-events-none opacity-10 flex items-center justify-end pr-4 sm:pr-8"
        >
          <svg
            viewBox="0 0 200 160"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full text-white"
          >
            {/* Scooter wheel rear */}
            <circle cx="45" cy="115" r="28" />
            <circle cx="45" cy="115" r="10" />
            {/* Scooter wheel front */}
            <circle cx="155" cy="115" r="28" />
            <circle cx="155" cy="115" r="10" />
            {/* Scooter body */}
            <path d="M45 115 H90 L110 85 L140 85 L155 115" />
            <path d="M90 115 V85 H60 L45 115" />
            {/* Handlebar & steering */}
            <path d="M140 85 L135 50 L145 45" />
            {/* Delivery box on rear rack */}
            <rect x="25" y="45" width="40" height="40" rx="4" />
            {/* Rider silhouette */}
            <circle cx="105" cy="35" r="14" />
            <path d="M100 50 C110 50, 115 65, 110 85" />
            <path d="M105 55 L135 50" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 sm:gap-8">
          {/* Left Column: Icon + Headline */}
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-6">
            <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-[#C8102E] text-white flex items-center justify-center shrink-0 shadow-md sm:shadow-lg shadow-red-950/60">
              <Bike className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
            </div>

            <div className="space-y-1">
              <span className="text-[9px] sm:text-xs font-bold tracking-[0.22em] sm:tracking-[0.25em] text-neutral-400 uppercase block">
                Fast · Fresh · Reliable
              </span>
              <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-[#FAF7F0] font-serif leading-tight tracking-tight">
                We bring the flavor<br />
                to <span className="text-[#C8102E]">your</span> door.
              </h2>
            </div>
          </div>

          {/* Right Column: Description + Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-8 lg:text-right w-full sm:w-auto">
            <p className="text-xs sm:text-sm text-neutral-300 max-w-xs leading-relaxed font-normal">
              Enjoy quick delivery or easy pickup. Your favorite meals, just the way you like them.
            </p>

            <a
              href="#menu"
              onClick={handleScrollToMenu}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-[#C8102E] hover:bg-[#B00D26] text-white text-xs sm:text-sm font-bold shadow-md sm:shadow-lg shadow-red-950/50 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <span>Order Now</span>
              <span className="text-base leading-none">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
