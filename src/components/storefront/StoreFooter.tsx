"use client";

import React from "react";
import { Clock, Phone, MapPin, Heart } from "lucide-react";
import { RestaurantSettings } from "@/lib/types";
import { RESTAURANT_ADDRESS, getRestaurantMapsUrl } from "@/lib/constants";

interface StoreFooterProps {
  settings: RestaurantSettings | null;
}

export default function StoreFooter({ settings }: StoreFooterProps) {
  const restaurantName = settings?.name || "Dark Kitchen";
  const hours = settings?.openingHours || [];
  const mapsUrl = getRestaurantMapsUrl(settings);
  const displayAddress = settings?.address?.trim() || RESTAURANT_ADDRESS;

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-16 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 pb-12 border-b border-slate-800">
          {/* Col 1: Brand & Tagline */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white tracking-tight font-serif">
              {restaurantName}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Artisanal restaurant offering freshly made burgers, pizzas, sides, and house desserts crafted with prime ingredients and fast delivery.
            </p>
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} {restaurantName}. All rights reserved.
            </p>
          </div>

          {/* Col 2: Weekly Schedule */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              <span>Opening Schedule</span>
            </h4>
            <div className="space-y-1.5 text-xs text-slate-400">
              {hours.map((h) => (
                <div key={h.dayOfWeek} className="flex justify-between max-w-xs">
                  <span className="font-medium text-slate-300">{h.dayName}:</span>
                  <span>
                    {h.isClosed ? "Closed" : `${h.openTime} – ${h.closeTime}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 3: Contact & Address */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              <span>Visit & Contact</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="leading-relaxed text-slate-300 hover:text-primary transition-colors block"
              >
                {displayAddress}
              </a>
              {settings?.phone && (
                <p className="flex items-center gap-2 text-slate-300 font-semibold pt-1">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <a href={`tel:${settings.phone}`} className="hover:text-primary transition-colors">
                    {settings.phone}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="pt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <span>Freshly crafted with passion and precision</span>
        </div>
      </div>
    </footer>
  );
}
