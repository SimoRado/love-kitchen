"use client";

import React from "react";
import { Clock, Phone, MapPin, AlertCircle, Bike } from "lucide-react";
import { RestaurantSettings } from "@/lib/types";
import { RestaurantOpenStatus } from "@/lib/openingHoursHelper";
import { formatCurrency } from "@/lib/formatters";
import { RESTAURANT_ADDRESS, getRestaurantMapsUrl } from "@/lib/constants";

interface StoreStatusBannerProps {
  settings: RestaurantSettings | null;
  openStatus: RestaurantOpenStatus;
}

export default function StoreStatusBanner({
  settings,
  openStatus,
}: StoreStatusBannerProps) {
  if (!settings) return null;

  const mapsUrl = getRestaurantMapsUrl(settings);
  const displayAddress = settings.address?.trim() || RESTAURANT_ADDRESS;

  return (
    <div id="restaurant-info" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-2 sm:mt-4 relative z-10 pb-6 sm:pb-10 w-full box-border">
      <div className="bg-[#161616] rounded-2xl border border-white/10 shadow-2xl p-3.5 sm:p-6 text-white backdrop-blur-md w-full">
        {/* Closed Warning Banner if restaurant is closed */}
        {!openStatus.isOpen && (
          <div className="mb-4 p-3.5 bg-amber-950/40 border border-amber-800/40 rounded-xl flex items-start gap-3 text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-100">
                The restaurant is currently closed for online ordering.
              </p>
              <p className="text-amber-300/80 font-normal mt-0.5">
                You are welcome to browse our complete menu and prices. {openStatus.statusDetail}.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 sm:divide-x sm:divide-white/10 divide-y sm:divide-y-0 divide-white/5">
          {/* 1. Open Status */}
          <div className="flex items-center gap-3.5 pt-2 sm:pt-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                openStatus.isOpen
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    openStatus.isOpen ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {openStatus.statusText}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-normal truncate mt-0.5">
                {openStatus.statusDetail}
              </p>
            </div>
          </div>

          {/* 2. Delivery Fee */}
          <div className="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-6">
            <div className="w-10 h-10 rounded-xl bg-red-950/50 text-[#C8102E] border border-red-900/30 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-neutral-100">
                Delivery Fee: {formatCurrency(settings.deliveryFee ?? 15, settings.currency)}
              </p>
              <p className="text-xs text-neutral-400 font-normal truncate mt-0.5">
                Pickup is always Free
              </p>
            </div>
          </div>

          {/* 3. Phone */}
          <div className="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-6">
            <div className="w-10 h-10 rounded-xl bg-red-950/50 text-[#C8102E] border border-red-900/30 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-neutral-400">Direct Contact</p>
              <a
                href={`tel:${settings.phone}`}
                className="text-xs text-neutral-100 font-bold hover:text-[#C8102E] transition-colors truncate block mt-0.5 focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
              >
                {settings.phone}
              </a>
            </div>
          </div>

          {/* 4. Address */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-6 group hover:opacity-95 transition-opacity cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded-xl"
            title="Open restaurant location in Google Maps"
          >
            <div className="w-10 h-10 rounded-xl bg-red-950/50 text-[#C8102E] border border-red-900/30 group-hover:border-red-700/50 flex items-center justify-center shrink-0 transition-colors">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-neutral-100 group-hover:text-[#C8102E] transition-colors">
                Restaurant Location
              </p>
              <p className="text-xs text-neutral-400 font-normal line-clamp-1 mt-0.5">
                {displayAddress}
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
