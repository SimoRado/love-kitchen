"use client";

import React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { RestaurantOpenStatus } from "@/lib/openingHoursHelper";
import { RESTAURANT_MAPS_URL } from "@/lib/constants";

interface StoreNavbarProps {
  restaurantName?: string;
  restaurantSubtitle?: string | null;
  openStatus: RestaurantOpenStatus;
  onOpenCart: () => void;
}

export default function StoreNavbar({
  restaurantName = "Love Kitchen",
  restaurantSubtitle,
  openStatus,
  onOpenCart,
}: StoreNavbarProps) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const hasSubtitle = Boolean(restaurantSubtitle && restaurantSubtitle.trim());

  return (
    <header className="sticky top-0 z-30 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#EBE3D5] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left: Clean Text Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex flex-col justify-center">
            <span className="font-bold text-xl sm:text-2xl text-slate-900 tracking-tight leading-tight group-hover:text-primary transition-colors font-serif">
              {restaurantName}
            </span>
            {hasSubtitle && (
              <span className="text-[10px] sm:text-[11px] font-medium tracking-widest text-slate-500 uppercase mt-0.5 leading-none">
                {restaurantSubtitle?.trim()}
              </span>
            )}
          </div>
        </Link>

        {/* Center: Live Status Indicator (Desktop) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E8DFD1] bg-white/80 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              openStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-semibold text-slate-800">
            {openStatus.statusText}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500 font-normal">{openStatus.statusDetail}</span>
        </div>

        {/* Right: Menu Link, Location Link & Cart Trigger */}
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="#menu"
            className="hidden sm:inline-flex text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-primary transition-colors py-2 px-3"
          >
            Menu
          </a>

          <a
            href={RESTAURANT_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-primary transition-colors py-2 px-3"
          >
            Location
          </a>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            aria-label={`View shopping cart with ${itemCount} items`}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cart</span>
            <span className="bg-white/25 px-1.5 py-0.2 rounded-full text-[11px] font-semibold min-w-[20px] text-center">
              {itemCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
