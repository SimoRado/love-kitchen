"use client";

import React from "react";
import { Mail, Phone } from "lucide-react";
import { RestaurantSettings } from "@/lib/types";
import { getRestaurantMapsUrl } from "@/lib/constants";

interface StoreFooterProps {
  settings: RestaurantSettings | null;
}

export default function StoreFooter({ settings }: StoreFooterProps) {
  const restaurantName = settings?.name || "Love Kitchen";
  const mapsUrl = getRestaurantMapsUrl(settings);
  const currentYear = new Date().getFullYear();

  const handleScrollToMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const menuEl = document.getElementById("menu");
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="bg-[#FAF7F0] border-t border-[#EFE8DC] py-8 sm:py-10 text-slate-700 mt-12 w-full box-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Brand & Copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight font-serif">
              {restaurantName}
            </span>
            <span className="hidden sm:inline text-stone-300">•</span>
            <p className="text-xs text-slate-500 font-normal">
              © {currentYear} {restaurantName}. All rights reserved.
            </p>
          </div>

          {/* Center: Navigation Links */}
          <nav aria-label="Footer navigation" className="flex items-center gap-6 text-xs font-semibold text-slate-700">
            <a
              href="#menu"
              onClick={handleScrollToMenu}
              className="hover:text-[#C8102E] transition-colors focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
            >
              Menu
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#C8102E] transition-colors focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
            >
              Location
            </a>
            {settings?.phone ? (
              <a
                href={`tel:${settings.phone}`}
                className="hover:text-[#C8102E] transition-colors focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
              >
                Contact
              </a>
            ) : (
              <a
                href="#restaurant-info"
                className="hover:text-[#C8102E] transition-colors focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
              >
                Contact
              </a>
            )}
          </nav>

          {/* Right: Social & Contact Icons */}
          <div className="flex items-center gap-3">
            {settings?.phone && (
              <a
                href={`tel:${settings.phone}`}
                aria-label="Call restaurant"
                className="w-8 h-8 rounded-full border border-[#E5DFD5] bg-white/80 hover:bg-stone-100 text-slate-600 hover:text-[#C8102E] flex items-center justify-center transition-colors shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
            <a
              href="#restaurant-info"
              aria-label="Contact restaurant"
              className="w-8 h-8 rounded-full border border-[#E5DFD5] bg-white/80 hover:bg-stone-100 text-slate-600 hover:text-[#C8102E] flex items-center justify-center transition-colors shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
            {/* Instagram icon */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Restaurant Location"
              className="w-8 h-8 rounded-full border border-[#E5DFD5] bg-white/80 hover:bg-stone-100 text-slate-600 hover:text-[#C8102E] flex items-center justify-center transition-colors shadow-2xs"
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            {/* Facebook / Social icon */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Social Page"
              className="w-8 h-8 rounded-full border border-[#E5DFD5] bg-white/80 hover:bg-stone-100 text-slate-600 hover:text-[#C8102E] flex items-center justify-center transition-colors shadow-2xs"
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
