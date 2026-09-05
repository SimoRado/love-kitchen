"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { RestaurantOpenStatus } from "@/lib/openingHoursHelper";
import { getRestaurantMapsUrl } from "@/lib/constants";
import { RestaurantSettings } from "@/lib/types";

interface StoreNavbarProps {
  restaurantName?: string;
  restaurantSubtitle?: string | null;
  settings?: RestaurantSettings | null;
  googleMapsUrl?: string | null;
  openStatus: RestaurantOpenStatus;
  onOpenCart: () => void;
}

export default function StoreNavbar({
  restaurantName = "Love Kitchen",
  restaurantSubtitle = "ARTISANAL KITCHEN & DELIVERY",
  settings,
  googleMapsUrl,
  openStatus,
  onOpenCart,
}: StoreNavbarProps) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const hasSubtitle = Boolean(restaurantSubtitle && restaurantSubtitle.trim());
  const mapsUrl = getRestaurantMapsUrl(settings || { googleMapsUrl, name: restaurantName });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-300 text-[#FAF7F0] w-full box-border pt-[env(safe-area-inset-top)] ${
        isScrolled
          ? "bg-[#111111]/95 backdrop-blur-md border-b border-white/10 shadow-lg"
          : "bg-[#111111] border-b border-transparent shadow-none"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-4 w-full">
        {/* Left: Brand Logo & Subtitle */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded-lg py-1">
          <div className="flex flex-col justify-center">
            <span className="font-bold text-lg sm:text-2xl text-[#FAF7F0] tracking-tight leading-tight font-serif">
              {restaurantName}
            </span>
            {hasSubtitle && (
              <span className="text-[8px] sm:text-[10px] font-semibold tracking-[0.2em] text-neutral-400 uppercase mt-0.5 leading-none">
                {restaurantSubtitle?.trim()}
              </span>
            )}
          </div>
        </Link>

        {/* Center: Live Status Indicator (Desktop) */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1A1A1A] border border-white/10 text-xs text-neutral-200 shadow-inner">
          <span
            className={`w-2 h-2 rounded-full ${
              openStatus.isOpen ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="font-bold uppercase tracking-wider text-[11px] text-white">
            {openStatus.statusText}
          </span>
          <span className="text-white/30">•</span>
          <span className="text-neutral-300 font-medium text-[11px]">{openStatus.statusDetail}</span>
        </div>

        {/* Right: Menu Link, Location Link & Red Cart Pill */}
        <div className="flex items-center gap-3 sm:gap-5">
          <a
            href="#menu"
            className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-widest text-neutral-300 hover:text-white transition-colors py-2 px-3 focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded-lg"
          >
            Menu
          </a>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-widest text-neutral-300 hover:text-white transition-colors py-2 px-3 focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded-lg"
          >
            Location
          </a>

          {/* Cart Button: Red rounded pill button */}
          <button
            onClick={onOpenCart}
            aria-label={`View shopping cart with ${itemCount} items`}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#C8102E] hover:bg-[#B00D26] text-white text-xs font-bold shadow-md shadow-red-950/40 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span>Cart ({itemCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
}
