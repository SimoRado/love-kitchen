"use client";

import React from "react";
import { ArrowRight, Bike, Store } from "lucide-react";

export default function StoreHero() {
  const handleScrollToMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const menuEl = document.getElementById("menu");
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative bg-[#111111] text-[#FAF7F0] pt-2 pb-6 sm:pt-6 sm:pb-10 lg:pt-8 lg:pb-14 w-full box-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-3 sm:space-y-4 lg:space-y-5 text-center lg:text-left">
            <div>
              <span className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] text-[#C29B7F] uppercase">
                Artisanal Kitchen &amp; Delivery
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-black text-[#FAF7F0] tracking-tight leading-[1.1] font-serif">
              Fresh food,<br />
              made with <span className="text-[#C8102E]">love</span> &amp;<br />
              crafted for you.
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-neutral-300 font-normal leading-relaxed max-w-lg mx-auto lg:mx-0">
              Artisanal burgers, authentic Asian specialties, and handcrafted favorites, freshly prepared with passion and delivered to your doorstep.
            </p>

            {/* CTA Button */}
            <div className="pt-1 sm:pt-2">
              <a
                href="#menu"
                onClick={handleScrollToMenu}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-[#C8102E] hover:bg-[#B00D26] text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-950/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
              >
                <span>View Menu &amp; Order</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Delivery & Pickup Info (Directly Underneath Button, Clean UI Icons, Zero Emojis) */}
            <div className="pt-1 flex items-center justify-center lg:justify-start gap-4 text-xs font-medium text-neutral-300">
              <span className="inline-flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Fast Delivery</span>
              </span>
              <span className="text-neutral-600">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Store className="w-4 h-4 text-red-400 shrink-0" />
                <span>Borne Pickup</span>
              </span>
            </div>
          </div>

          {/* Right Food Imagery Column (Blended Naturally into Hero, No Card Edge) */}
          <div className="lg:col-span-6 w-full flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-lg lg:max-w-none">
              <div className="relative w-full aspect-[16/11] sm:aspect-[4/3] lg:aspect-[16/11] overflow-hidden max-h-[300px] sm:max-h-[380px] lg:max-h-none">
                {/* Left gradient fade: Dissolves the left edge of the photo seamlessly into the dark hero background */}
                <div className="absolute inset-y-0 left-0 w-10 sm:w-20 lg:w-28 xl:w-40 bg-gradient-to-r from-[#111111] via-[#111111]/70 to-transparent z-10 pointer-events-none" />
                
                {/* Bottom gradient fade: Blends photo base into hero canvas */}
                <div className="absolute inset-x-0 bottom-0 h-14 sm:h-20 bg-gradient-to-t from-[#111111] via-[#111111]/60 to-transparent z-10 pointer-events-none" />
                
                {/* Top gradient fade: Soft blend at top */}
                <div className="absolute inset-x-0 top-0 h-10 sm:h-14 bg-gradient-to-b from-[#111111] via-[#111111]/40 to-transparent z-10 pointer-events-none" />

                {/* Right gradient fade: Soft blend at right */}
                <div className="absolute inset-y-0 right-0 w-10 sm:w-16 bg-gradient-to-l from-[#111111]/80 to-transparent z-10 pointer-events-none" />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/hero-burger.jpg"
                  alt="Artisanal gourmet burger made fresh with love"
                  className="w-full h-full object-cover object-center select-none pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
