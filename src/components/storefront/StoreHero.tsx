"use client";

import React from "react";
import { ArrowDown, Utensils, Bike, ShoppingBag } from "lucide-react";

interface StoreHeroProps {
  restaurantName?: string;
}

export default function StoreHero({
  restaurantName = "Love Kitchen",
}: StoreHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FFF7ED] to-[#FFFDF9] border-b border-[#EBE3D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 border border-orange-200 text-orange-900 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Gourmet Kitchen • Fresh Daily</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] font-serif">
              Fresh food, made with love & crafted for you.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Explore our handcrafted burgers, artisanal pizzas, savory sides, and house desserts made from prime local ingredients.
            </p>

            {/* CTA & Delivery info */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <a
                href="#menu"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md transition-all active:scale-95"
              >
                <span>View Menu & Order</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </a>

              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-primary" />
                  <span>Fast Delivery</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  <span>Store Pickup</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Food Imagery Column */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="aspect-[4/3] sm:aspect-[16/11] rounded-2xl overflow-hidden shadow-xl border border-[#E0D7C6] bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1550547660-d9450f859349?w=900&auto=format&fit=crop&q=80"
                  alt="Delicious gourmet burger and sides"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
                />
              </div>

              {/* Quality highlight badge */}
              <div className="absolute -bottom-4 -left-4 sm:bottom-4 sm:-left-4 bg-white/95 backdrop-blur-xs border border-[#E0D7C6] rounded-xl p-3.5 shadow-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center font-bold">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Freshly Prepared
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    100% Prime Quality
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
