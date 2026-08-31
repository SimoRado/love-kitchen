"use client";

import React from "react";
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

  return (
    <header className="sticky top-0 z-30 bg-[#C8102E] shadow-sm transition-all text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Subtitle */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded-lg py-1">
          <div className="flex flex-col justify-center">
            <span className="font-bold text-xl sm:text-2xl text-white tracking-tight leading-tight font-serif">
              {restaurantName}
            </span>
            {hasSubtitle && (
              <span className="text-[10px] sm:text-[11px] font-medium tracking-widest text-white/80 uppercase mt-0.5 leading-none">
                {restaurantSubtitle?.trim()}
              </span>
            )}
          </div>
        </Link>

        {/* Center: Live Status Indicator (Desktop) */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/15 text-xs text-white">
          <span
            className={`w-2 h-2 rounded-full ${
              openStatus.isOpen ? "bg-emerald-400 animate-pulse" : "bg-amber-300"
            }`}
          />
          <span className="font-bold uppercase tracking-wider text-[11px]">
            {openStatus.statusText}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-white/90 font-medium">{openStatus.statusDetail}</span>
        </div>

        {/* Right: Menu Link, Location Link & White Cart Pill */}
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="#menu"
            className="hidden sm:inline-flex text-xs font-bold uppercase tracking-wider text-white/90 hover:text-white transition-colors py-2 px-3 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded-lg"
          >
            Menu
          </a>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex text-xs font-bold uppercase tracking-wider text-white/90 hover:text-white transition-colors py-2 px-3 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded-lg"
          >
            Location
          </a>

          {/* Cart Button: White pill with red text */}
          <button
            onClick={onOpenCart}
            aria-label={`View shopping cart with ${itemCount} items`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-white/95 text-[#C8102E] text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <ShoppingBag className="w-4 h-4 text-[#C8102E]" />
            <span>Cart ({itemCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
}
