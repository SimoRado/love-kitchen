"use client";

import React, { useState } from "react";
import { Plus, Check, UtensilsCrossed } from "lucide-react";
import { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/useCartStore";

interface ProductCardProps {
  product: Product;
  currency?: string;
  isRestaurantOpen: boolean;
}

export default function ProductCard({
  product,
  currency = "MAD",
  isRestaurantOpen,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);

  const isAvailable = product.available;
  const canOrder = isRestaurantOpen && isAvailable;

  const handleAddToCart = () => {
    if (!canOrder) return;

    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1200);
  };

  return (
    <div
      className={`group bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
        !isAvailable
          ? "border-slate-200 bg-slate-50/40"
          : "border-[#EBE3D5] hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <div>
        {/* Product Image Area */}
        <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                !isAvailable ? "grayscale opacity-70" : ""
              }`}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://placehold.co/600x400/fff7ed/ea580c?text=Love+Kitchen";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-orange-50/50 text-slate-400">
              <UtensilsCrossed className="w-8 h-8 opacity-40" />
            </div>
          )}

          {/* Unavailable Badge Overlay */}
          {!isAvailable && (
            <div className="absolute top-3 right-3 bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs shadow-xs">
              Unavailable
            </div>
          )}
        </div>

        {/* Details Area */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-bold text-base tracking-tight leading-snug ${
                !isAvailable ? "text-slate-500 line-through" : "text-slate-900"
              }`}
            >
              {product.name}
            </h3>

            {!isAvailable && (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-200/80 px-2 py-0.5 rounded shrink-0">
                Sold Out
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-normal">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* Card Footer: Price & Add to Cart */}
      <div className="p-4 sm:p-5 pt-0 flex items-center justify-between gap-3 mt-2 border-t border-slate-100 pt-3">
        <span className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
          {formatCurrency(product.price, currency)}
        </span>

        {/* Add to Cart Button */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canOrder}
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            !isRestaurantOpen
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              : !isAvailable
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              : justAdded
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-primary hover:bg-primary-hover text-white shadow-sm"
          }`}
        >
          {!isRestaurantOpen ? (
            <span>Closed</span>
          ) : !isAvailable ? (
            <span>Unavailable</span>
          ) : justAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Added</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
