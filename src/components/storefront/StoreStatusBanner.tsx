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
    <div id="restaurant-info" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-10 mb-8">
      <div className="bg-white rounded-2xl border border-[#EBE3D5] shadow-sm p-4 sm:p-6">
        {/* Closed Warning Banner if restaurant is closed */}
        {!openStatus.isOpen && (
          <div className="mb-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-950">
                The restaurant is currently closed for online ordering.
              </p>
              <p className="text-amber-800 font-normal mt-0.5">
                You are welcome to browse our complete menu and prices. {openStatus.statusDetail}.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* 1. Open Status */}
          <div className="flex items-center gap-3.5 pt-2 sm:pt-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                openStatus.isOpen
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-amber-50 text-amber-600 border border-amber-200"
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    openStatus.isOpen ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {openStatus.statusText}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                {openStatus.statusDetail}
              </p>
            </div>
          </div>

          {/* 2. Delivery Fee */}
          <div className="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-6">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-primary border border-orange-200 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">
                Delivery Fee: {formatCurrency(settings.deliveryFee ?? 15, settings.currency)}
              </p>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                Pickup is always Free
              </p>
            </div>
          </div>

          {/* 3. Phone */}
          <div className="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-6">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">Direct Contact</p>
              <a
                href={`tel:${settings.phone}`}
                className="text-xs text-primary font-medium hover:underline truncate block mt-0.5"
              >
                {settings.phone}
              </a>
            </div>
          </div>

          {/* 4. Address (Clickable Google Maps Link) */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-6 group hover:opacity-95 transition-opacity cursor-pointer"
            title="Open restaurant location in Google Maps"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 group-hover:border-primary/50 group-hover:text-primary group-hover:bg-orange-50/50 flex items-center justify-center shrink-0 transition-colors">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 group-hover:text-primary transition-colors">
                Restaurant Location
              </p>
              <p className="text-xs text-slate-500 font-normal line-clamp-1 mt-0.5">
                {displayAddress}
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
